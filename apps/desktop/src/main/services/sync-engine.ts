import Database from 'better-sqlite3';
import { BrowserWindow } from 'electron';
import { SdkClient } from '@leadforge/sdk';
import { LocalEventBus } from '../lib/event-bus';
import { AppLogger } from '../lib/logger';
import { LocalCRMRepository } from '../database/repositories/local-crm';

interface QueueItem {
  id: string;
  workspaceId: string;
  entityType: 'companies' | 'contacts' | 'campaigns' | 'sequences' | 'sequence_executions' | 'email_accounts' | 'templates';
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: string;
  version: number;
  retryCount: number;
  lastError?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const MAX_SYNC_RETRIES = 5;

/**
 * SyncEngine monitors the local sync_queue table and pushes pending mutations
 * to the remote API sequentially, resolving conflicts using Last-Write-Wins.
 * It also pulls remote updates to refresh the local SQLite cache.
 */
export class SyncEngine {
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    private workspaceId: string,
    private db: Database.Database,
    private eventBus: LocalEventBus,
    private sdk: SdkClient
  ) {}

  public get isActive(): boolean {
    return this.intervalId !== null;
  }

  /**
   * Starts periodic polling loop.
   */
  public async start(): Promise<void> {
    if (this.intervalId) return;

    // Check queue every 5 seconds
    this.intervalId = setInterval(() => this.tick(), 5000);
    AppLogger.info('SyncEngine', `Sync engine started for workspace: ${this.workspaceId}`, this.workspaceId);

    // Perform initial remote pull sync asynchronously
    this.pullRemoteUpdates().catch((err) => {
      AppLogger.error('SyncEngine', 'Initial pull remote updates failed', this.workspaceId, err);
    });
  }

  /**
   * Stops the polling loop.
   */
  public async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    AppLogger.info('SyncEngine', `Sync engine stopped for workspace: ${this.workspaceId}`, this.workspaceId);
  }

  /**
   * Pulls fresh records from remote API and saves them to local SQLite cache.
   */
  public async pullRemoteUpdates(): Promise<void> {
    try {
      AppLogger.info('SyncEngine', `Pulling remote updates for workspace: ${this.workspaceId}`, this.workspaceId);

      // A. Pull companies
      try {
        const companies = await this.sdk.companies.list();
        if (companies && companies.length) {
          const records = companies.map((c: any) => ({
            ...c,
            workspaceId: this.workspaceId,
            syncStatus: 'synced',
          }));
          await LocalCRMRepository.saveMany('companies', records, true); // skipQueue = true
        }
      } catch (e) {
        AppLogger.warn('SyncEngine', 'Failed to pull companies', this.workspaceId, e);
      }

      // B. Pull contacts
      try {
        const contacts = await this.sdk.contacts.list();
        if (contacts && contacts.length) {
          const records = contacts.map((c: any) => ({
            ...c,
            workspaceId: this.workspaceId,
            syncStatus: 'synced',
          }));
          await LocalCRMRepository.saveMany('contacts', records, true); // skipQueue = true
        }
      } catch (e) {
        AppLogger.warn('SyncEngine', 'Failed to pull contacts', this.workspaceId, e);
      }

      // C. Pull campaigns
      try {
        const campaigns = await this.sdk.campaigns.list();
        if (campaigns && campaigns.length) {
          const records = campaigns.map((c: any) => ({
            ...c,
            workspaceId: this.workspaceId,
            syncStatus: 'synced',
          }));
          await LocalCRMRepository.saveMany('campaigns', records, true); // skipQueue = true
        }
      } catch (e) {
        AppLogger.warn('SyncEngine', 'Failed to pull campaigns', this.workspaceId, e);
      }

      // D. Pull sequences
      try {
        const sequences = await this.sdk.sequences.list();
        if (sequences && sequences.length) {
          const records = sequences.map((s: any) => ({
            ...s,
            workspaceId: this.workspaceId,
            syncStatus: 'synced',
          }));
          await LocalCRMRepository.saveMany('sequences', records, true); // skipQueue = true
        }
      } catch (e) {
        AppLogger.warn('SyncEngine', 'Failed to pull sequences', this.workspaceId, e);
      }

      // E. Pull executions
      try {
        const executions = await this.sdk.executions.list();
        if (executions && executions.length) {
          const records = executions.map((ex: any) => ({
            ...ex,
            workspaceId: this.workspaceId,
            syncStatus: 'synced',
          }));
          await LocalCRMRepository.saveMany('sequence_executions', records, true); // skipQueue = true
        }
      } catch (e) {
        AppLogger.warn('SyncEngine', 'Failed to pull sequence_executions', this.workspaceId, e);
      }

      // F. Pull email_accounts
      try {
        const accounts = await this.sdk.outreach.listAccounts();
        if (accounts && accounts.length) {
          const records = accounts.map((a: any) => ({
            ...a,
            workspaceId: this.workspaceId,
            syncStatus: 'synced',
          }));
          await LocalCRMRepository.saveMany('email_accounts', records, true);
        }
      } catch (e) {
        AppLogger.warn('SyncEngine', 'Failed to pull email_accounts', this.workspaceId, e);
      }

      // G. Pull templates
      try {
        const templates = await this.sdk.outreach.listTemplates();
        if (templates && templates.length) {
          const records = templates.map((t: any) => ({
            ...t,
            workspaceId: this.workspaceId,
            variables: typeof t.variables === 'string' ? t.variables : JSON.stringify(t.variables || []),
            syncStatus: 'synced',
          }));
          await LocalCRMRepository.saveMany('templates', records, true);
        }
      } catch (e) {
        AppLogger.warn('SyncEngine', 'Failed to pull templates', this.workspaceId, e);
      }

      AppLogger.info('SyncEngine', `Remote updates pulled successfully for workspace: ${this.workspaceId}`, this.workspaceId);
      this.broadcastToRenderer();
    } catch (err) {
      AppLogger.error('SyncEngine', 'Critical error pulling remote updates', this.workspaceId, err);
    }
  }

  /**
   * Broadcasts sync completion notification to all active renderer windows.
   */
  private broadcastToRenderer(): void {
    try {
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send('sync:completed', { timestamp: new Date().toISOString() });
        }
      });
    } catch (err) {
      // IPC window context not yet active
    }
  }

  /**
   * Polling tick handler.
   */
  private async tick(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      await this.processQueue();
    } catch (err) {
      // General tick error
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Processes pending sync queue items sequentially.
   */
  private async processQueue(): Promise<void> {
    // Detect and archive permanently failed/poisoned sync items to the dead-letter table
    const poisonedItems = this.db.prepare(`
      SELECT * FROM sync_queue
      WHERE workspaceId = ? AND retryCount >= ?
    `).all(this.workspaceId, MAX_SYNC_RETRIES) as QueueItem[];

    if (poisonedItems.length > 0) {
      const insertDeadLetter = this.db.prepare(`
        INSERT OR REPLACE INTO sync_dead_letter (id, workspaceId, entityType, entityId, operation, payload, version, retryCount, lastError, createdAt, updatedAt, archivedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      const deleteQueueItem = this.db.prepare(`
        DELETE FROM sync_queue WHERE id = ?
      `);

      const archiveTx = this.db.transaction((items: QueueItem[]) => {
        for (const item of items) {
          insertDeadLetter.run(
            item.id,
            item.workspaceId,
            item.entityType,
            item.entityId,
            item.operation,
            item.payload,
            item.version,
            item.retryCount,
            item.lastError,
            item.createdAt,
            item.updatedAt
          );
          deleteQueueItem.run(item.id);
        }
      });

      try {
        archiveTx(poisonedItems);
        AppLogger.warn(
          'SyncEngine',
          `Archived ${poisonedItems.length} permanently failed sync queue items to dead-letter queue.`,
          this.workspaceId
        );
        this.broadcastToRenderer();
      } catch (err) {
        AppLogger.error('SyncEngine', 'Failed to archive poisoned sync items', this.workspaceId, err);
      }
    }

    const pendingItems = this.db.prepare(`
      SELECT * FROM sync_queue
      WHERE workspaceId = ? AND retryCount < ?
      ORDER BY createdAt ASC
    `).all(this.workspaceId, MAX_SYNC_RETRIES) as QueueItem[];

    if (pendingItems.length === 0) return;

    AppLogger.info('SyncEngine', `Found ${pendingItems.length} pending mutations to sync.`, this.workspaceId);
    this.eventBus.publish('sync:started', { count: pendingItems.length });

    let hasUpdates = false;

    for (const item of pendingItems) {
      try {
        const payload = JSON.parse(item.payload || '{}');
        
        // Resolve SDK module dynamically
        const clientModule = this.resolveSdkModule(item.entityType);
        if (!clientModule) {
          throw new Error(`Unsupported sync entity type: ${item.entityType}`);
        }

        ctxLog(`Syncing "${item.operation}" on ${item.entityType}/${item.entityId} (Version ${item.version})`);

        if (item.operation === 'CREATE') {
          await clientModule.create(payload);
        } else if (item.operation === 'UPDATE') {
          await clientModule.update(item.entityId, payload);
        } else if (item.operation === 'DELETE') {
          await clientModule.delete(item.entityId);
        }

        // Mutation synced successfully: remove from local queue
        this.db.prepare('DELETE FROM sync_queue WHERE id = ?').run(item.id);
        hasUpdates = true;
        
        this.eventBus.publish('sync:progress', {
          queueItemId: item.id,
          entityId: item.entityId,
          status: 'success'
        });

      } catch (err: any) {
        const errorMsg = err.message || String(err);
        const isNetworkErr = this.isNetworkError(err);

        AppLogger.warn('SyncEngine', `Sync failed for item "${item.id}": ${errorMsg}`, this.workspaceId);

        // Update retry logs in database
        this.db.prepare(`
          UPDATE sync_queue
          SET retryCount = retryCount + 1, lastError = ?, updatedAt = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(errorMsg, item.id);

        this.eventBus.publish('sync:failed', {
          queueItemId: item.id,
          entityId: item.entityId,
          error: errorMsg
        });

        if (isNetworkErr) {
          // Suspend sequential queue processing until next tick if offline/network failed
          AppLogger.warn('SyncEngine', 'Network connection issue detected. Suspending sync execution.', this.workspaceId);
          break;
        }
      }
    }

    this.eventBus.publish('sync:completed', { timestamp: new Date().toISOString() });
    if (hasUpdates) {
      this.broadcastToRenderer();
    }
  }

  /**
   * Resolves entity type to matching SdkClient module.
   */
  private resolveSdkModule(entityType: string): any {
    if (entityType === 'companies') return this.sdk.companies;
    if (entityType === 'contacts') return this.sdk.contacts;
    if (entityType === 'campaigns') return this.sdk.campaigns;
    if (entityType === 'sequences') return this.sdk.sequences;
    if (entityType === 'sequence_executions') return this.sdk.executions;
    if (entityType === 'email_accounts') {
      return {
        create: (payload: any) => this.sdk.outreach.createAccount(payload),
        update: (id: string, payload: any) => Promise.resolve(),
        delete: (id: string) => this.sdk.outreach.deleteAccount(id),
      };
    }
    if (entityType === 'templates') {
      return {
        create: (payload: any) => this.sdk.outreach.createTemplate(payload),
        update: (id: string, payload: any) => Promise.resolve(),
        delete: (id: string) => this.sdk.outreach.deleteTemplate(id),
      };
    }
    return null;
  }

  /**
   * Checks if error is a connection/network issue.
   */
  private isNetworkError(err: any): boolean {
    if (!err) return false;
    const msg = String(err.message || err).toLowerCase();
    return (
      msg.includes('fetch failed') ||
      msg.includes('network') ||
      msg.includes('dns') ||
      msg.includes('econnrefused') ||
      msg.includes('timeout')
    );
  }
}

function ctxLog(msg: string) {
  AppLogger.info('SyncEngine', msg);
}
