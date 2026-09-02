import { SdkClient } from '@leadforge/sdk';
import { LocalCRMRepository } from '../database/repositories/local-crm';
import { getDatabase } from '../database/connection';
import { AppLogger } from '../lib/logger';
import { BrowserWindow } from 'electron';

/**
 * ProjectionService — Reconciles authoritative MongoDB state into the local
 * disposable SQLite read projection.
 *
 * Invariants (Phase 2B):
 * 1. MongoDB is the sole authority; SQLite is purely a read-accelerating cache.
 * 2. Workers NEVER write directly to SQLite. Main process reconciles projections.
 * 3. All operations are strictly workspace-scoped.
 * 4. Repeated projections are idempotent (INSERT OR REPLACE).
 * 5. Failures are logged and observable without corrupting durable MongoDB data.
 */
export class ProjectionService {
  /**
   * Projects a single entity record from server into the workspace SQLite cache.
   */
  public static async projectEntity(
    table: string,
    record: any,
    workspaceId: string
  ): Promise<void> {
    if (!record || !workspaceId) return;
    try {
      await LocalCRMRepository.saveFromServer(table, {
        ...record,
        workspaceId
      });
    } catch (err: any) {
      AppLogger.warn(
        'ProjectionService',
        `Failed to project entity into "${table}": ${err?.message || err}`,
        workspaceId,
        { recordId: record.id || record._id }
      );
    }
  }

  /**
   * Projects an array of entity records from server into the workspace SQLite cache.
   */
  public static async projectEntities(
    table: string,
    records: any[],
    workspaceId: string
  ): Promise<void> {
    if (!Array.isArray(records) || records.length === 0 || !workspaceId) return;
    try {
      const scoped = records.map((r) => ({
        ...r,
        workspaceId
      }));
      await LocalCRMRepository.saveManyFromServer(table, scoped);
    } catch (err: any) {
      AppLogger.warn(
        'ProjectionService',
        `Failed to project ${records.length} entities into "${table}": ${err?.message || err}`,
        workspaceId
      );
    }
  }

  /**
   * Reconciles a DiscoveryRun and its associated company relationships.
   * Pulls authoritative companies for the run from MongoDB, updates
   * company_discovery_runs provenance links and discovery_runs result count.
   */
  public static async reconcileDiscoveryRun(
    workspaceId: string,
    runId: string,
    sdk: SdkClient
  ): Promise<any[]> {
    if (!workspaceId || !runId) return [];

    try {
      AppLogger.info('ProjectionService', `Reconciling DiscoveryRun "${runId}"`, workspaceId);

      // 1. Fetch authoritative companies linked to this run from MongoDB
      const serverCompanies = await sdk.discovery.listCompaniesForRun(runId);
      const companiesList = Array.isArray(serverCompanies) ? serverCompanies : [];

      // 2. Project companies into SQLite
      if (companiesList.length > 0) {
        await this.projectEntities('companies', companiesList, workspaceId);

        // 3. Project company_discovery_runs provenance links
        const links = companiesList.map((c: any) => ({
          id: `${runId}_${c.id || c._id}`,
          workspaceId,
          companyId: c.id || c._id,
          discoveryRunId: runId,
          createdAt: c.createdAt || new Date().toISOString()
        }));
        await this.projectEntities('company_discovery_runs', links, workspaceId);
      }

      // 4. Update the discovery run record in SQLite with latest count and status
      const existingRun = await LocalCRMRepository.findById('discovery_runs', workspaceId, runId);
      const runRecord = {
        id: runId,
        workspaceId,
        ...(existingRun || {}),
        resultCount: companiesList.length,
        status: existingRun?.status === 'running' ? 'completed' : (existingRun?.status || 'completed'),
        finishedAt: existingRun?.finishedAt || new Date().toISOString()
      };
      await LocalCRMRepository.saveFromServer('discovery_runs', runRecord);

      // 5. Query and return distinct companies from SQLite projection
      const db = getDatabase(workspaceId);
      const rows = db
        .prepare(
          `SELECT DISTINCT c.* FROM companies c
           INNER JOIN company_discovery_runs cdr ON c.id = cdr.companyId
           WHERE cdr.workspaceId = ? AND cdr.discoveryRunId = ? AND c.deletedAt IS NULL
           ORDER BY c.createdAt DESC`
        )
        .all(workspaceId, runId) as any[];

      this.broadcastProjectionUpdated('discovery_runs', workspaceId);
      return rows || [];
    } catch (err: any) {
      AppLogger.error(
        'ProjectionService',
        `Reconcile DiscoveryRun "${runId}" failed: ${err?.message || err}`,
        workspaceId,
        err
      );
      throw err;
    }
  }

  /**
   * Reconciles targeted entities after a background worker job completes successfully.
   * Called by JobScheduler.handleJobSuccess to ensure worker mutations in MongoDB
   * immediately reach the desktop SQLite projection.
   */
  public static async reconcileJobOutcome(
    workspaceId: string,
    jobType: string | undefined,
    payload: any,
    result: any,
    sdk: SdkClient
  ): Promise<void> {
    if (!workspaceId) return;

    try {
      // 1. Scraper Job Outcome -> Reconcile Discovery Run & Companies
      if (jobType === 'scraper:maps' || payload?.discoveryRunId) {
        const runId = payload?.discoveryRunId;
        if (runId) {
          await this.reconcileDiscoveryRun(workspaceId, runId, sdk).catch((err) => {
            AppLogger.warn('ProjectionService', `Auto-reconcile run "${runId}" failed: ${err.message}`, workspaceId);
          });
        }
      }

      // 2. Crawler / Enrichment Job Outcome -> Reconcile Target Company & Contacts
      if (jobType === 'crawler:website' || jobType === 'enrich:intelligence' || jobType === 'enrich:linkedin') {
        const companyId = payload?.companyId;
        if (companyId) {
          try {
            const company = await sdk.companies.get(companyId).catch(() => null);
            if (company) {
              await this.projectEntity('companies', company, workspaceId);
            }
            const contacts = await sdk.contacts.list({ companyId } as any).catch(() => []);
            const contactsList = Array.isArray(contacts) ? contacts : (contacts as any)?.data || [];
            if (contactsList.length > 0) {
              await this.projectEntities('contacts', contactsList, workspaceId);
            }
          } catch (entityErr: any) {
            AppLogger.warn('ProjectionService', `Failed to reconcile company "${companyId}": ${entityErr.message}`, workspaceId);
          }
        }
      }

      // 3. Campaign / Workflow Outreach Outcome -> Reconcile Campaign & Executions
      if (jobType === 'outreach:campaign' || jobType === 'automation:workflow' || payload?.campaignId) {
        let campaignId = payload?.campaignId;
        const executionId = payload?.executionId;

        // If executionId is present, project the individual execution
        if (executionId) {
          try {
            const ex = await sdk.executions.get(executionId).catch(() => null);
            if (ex) {
              await this.projectEntity('sequence_executions', ex, workspaceId);
              if (!campaignId && ex.campaignId) {
                campaignId = ex.campaignId;
              }
            }
          } catch {}
        }

        if (campaignId) {
          try {
            const campaign = await sdk.campaigns.get(campaignId).catch(() => null);
            if (campaign) {
              await this.projectEntity('campaigns', campaign, workspaceId);
            }
            const executions = await sdk.executions.list().catch(() => []);
            const exList = Array.isArray(executions) ? executions : (executions as any)?.data || [];
            const campaignExecs = exList.filter((e: any) => e.campaignId === campaignId);
            if (campaignExecs.length > 0) {
              await this.projectEntities('sequence_executions', campaignExecs, workspaceId);

              // Check if all executions for this active campaign are now in terminal states
              const allTerminal = campaignExecs.every((e: any) =>
                ['completed', 'failed', 'replied'].includes(String(e.status || '').toLowerCase())
              );
              if (allTerminal && campaign && String(campaign.status).toUpperCase() === 'ACTIVE') {
                try {
                  const completedCamp = await sdk.campaigns.update(campaignId, { status: 'COMPLETED' as any });
                  if (completedCamp) {
                    await this.projectEntity('campaigns', completedCamp, workspaceId);
                    AppLogger.info('ProjectionService', `Campaign "${campaignId}" transitioned to COMPLETED authoritatively`, workspaceId);
                  }
                } catch (updateErr: any) {
                  AppLogger.warn('ProjectionService', `Authoritative campaign status update error: ${updateErr.message}`, workspaceId);
                }
              }
            }
          } catch (campErr: any) {
            AppLogger.warn('ProjectionService', `Failed to reconcile campaign "${campaignId}": ${campErr.message}`, workspaceId);
          }
        }
      }

      this.broadcastProjectionUpdated(jobType || 'generic', workspaceId);
    } catch (err: any) {
      AppLogger.error(
        'ProjectionService',
        `Error during reconcileJobOutcome (${jobType}): ${err?.message || err}`,
        workspaceId,
        err
      );
    }
  }

  /**
   * Broadcasts a sync notification to all active renderer windows.
   */
  public static broadcastProjectionUpdated(scope: string, workspaceId: string): void {
    try {
      if (typeof BrowserWindow !== 'undefined' && BrowserWindow.getAllWindows) {
        BrowserWindow.getAllWindows().forEach((win) => {
          if (!win.isDestroyed()) {
            win.webContents.send('sync:completed', {
              scope,
              workspaceId,
              timestamp: new Date().toISOString()
            });
          }
        });
      }
    } catch {
      // Safe fallback in headless / test environments
    }
  }
}
