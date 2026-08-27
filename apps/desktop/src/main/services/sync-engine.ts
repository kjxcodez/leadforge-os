import Database from 'better-sqlite3';
import { BrowserWindow } from 'electron';
import { SdkClient } from '@leadforge/sdk';
import { LocalEventBus } from '../lib/event-bus';
import { AppLogger } from '../lib/logger';
import { LocalCRMRepository } from '../database/repositories/local-crm';
import { decryptSecret } from '../lib/crypto';
import { CacheHydrator } from './cache-hydrator';

interface QueueItem {
  id: string;
  workspaceId: string;
  entityType:
    | 'companies'
    | 'contacts'
    | 'campaigns'
    | 'sequences'
    | 'sequence_executions'
    | 'email_accounts'
    | 'templates'
    | 'discovery_runs'
    | 'company_discovery_runs'
    | 'audiences'
    | 'intelligence_sources'
    | 'intelligence_evidence'
    | 'intelligence_claims'
    | 'intelligence_inferences'
    | 'opportunity_scores'
    | 'page_crawls';
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
    AppLogger.info(
      'SyncEngine',
      `Sync engine started for workspace: ${this.workspaceId}`,
      this.workspaceId
    );

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
    AppLogger.info(
      'SyncEngine',
      `Sync engine stopped for workspace: ${this.workspaceId}`,
      this.workspaceId
    );
  }

  /**
   * Pulls fresh records from remote API and saves them to local SQLite cache.
   */
  public async pullRemoteUpdates(): Promise<void> {
    try {
      await CacheHydrator.hydrateWorkspaceCache(this.workspaceId, this.sdk);
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
    const poisonedItems = this.db
      .prepare(
        `
      SELECT * FROM sync_queue
      WHERE workspaceId = ? AND retryCount >= ?
    `
      )
      .all(this.workspaceId, MAX_SYNC_RETRIES) as QueueItem[];

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
        AppLogger.error(
          'SyncEngine',
          'Failed to archive poisoned sync items',
          this.workspaceId,
          err
        );
      }
    }

    const pendingItems = this.db
      .prepare(
        `
      SELECT * FROM sync_queue
      WHERE workspaceId = ? AND retryCount < ?
      ORDER BY createdAt ASC
    `
      )
      .all(this.workspaceId, MAX_SYNC_RETRIES) as QueueItem[];

    if (pendingItems.length === 0) return;

    AppLogger.info(
      'SyncEngine',
      `Found ${pendingItems.length} pending mutations to sync.`,
      this.workspaceId
    );
    this.eventBus.publish('sync:started', { count: pendingItems.length });

    let hasUpdates = false;

    for (const item of pendingItems) {
      try {
        const payload = JSON.parse(item.payload || '{}');

        // Map local campaign and execution status casing to server uppercase requirements
        if (
          (item.entityType === 'campaigns' || item.entityType === 'sequence_executions') &&
          payload.status
        ) {
          payload.status = payload.status.toUpperCase();
        }

        // Resolve SDK module dynamically
        const clientModule = this.resolveSdkModule(item.entityType);
        if (!clientModule) {
          throw new Error(`Unsupported sync entity type: ${item.entityType}`);
        }

        ctxLog(
          `Syncing "${item.operation}" on ${item.entityType}/${item.entityId} (Version ${item.version})`
        );

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

        AppLogger.warn(
          'SyncEngine',
          `Sync failed for item "${item.id}": ${errorMsg}`,
          this.workspaceId
        );

        // Update retry logs in database
        this.db
          .prepare(
            `
          UPDATE sync_queue
          SET retryCount = retryCount + 1, lastError = ?, updatedAt = CURRENT_TIMESTAMP
          WHERE id = ?
        `
          )
          .run(errorMsg, item.id);

        this.eventBus.publish('sync:failed', {
          queueItemId: item.id,
          entityId: item.entityId,
          error: errorMsg
        });

        if (isNetworkErr) {
          // Suspend sequential queue processing until next tick if offline/network failed
          AppLogger.warn(
            'SyncEngine',
            'Network connection issue detected. Suspending sync execution.',
            this.workspaceId
          );
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
        create: (payload: any) => Promise.resolve(),
        update: (id: string, payload: any) => this.sdk.outreach.syncAccountMeta(id, payload),
        delete: (id: string) => this.sdk.outreach.disconnectAccount(id)
      };
    }
    if (entityType === 'templates') {
      return {
        create: (payload: any) => this.sdk.outreach.createTemplate(payload),
        update: (id: string, payload: any) => this.sdk.outreach.updateTemplate(id, payload),
        delete: (id: string) => this.sdk.outreach.deleteTemplate(id)
      };
    }
    if (entityType === 'discovery_runs') return this.sdk.discovery;
    if (entityType === 'audiences') return this.sdk.audiences;
    if (entityType === 'company_discovery_runs') return this.sdk.companyDiscoveryRuns;
    // Local-only operational ledgers and intelligence caches (durable in local SQLite)
    if (
      entityType === 'intelligence_sources' ||
      entityType === 'intelligence_evidence' ||
      entityType === 'intelligence_claims' ||
      entityType === 'intelligence_inferences' ||
      entityType === 'opportunity_scores' ||
      entityType === 'page_crawls' ||
      entityType === 'email_deliveries'
    ) {
      return {
        create: (_payload: any) => Promise.resolve(),
        update: (_id: string, _payload: any) => Promise.resolve(),
        delete: (_id: string) => Promise.resolve()
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
