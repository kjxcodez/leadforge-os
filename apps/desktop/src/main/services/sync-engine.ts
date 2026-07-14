import Database from 'better-sqlite3';
import { SdkClient } from '@leadforge/sdk';
import { LocalEventBus } from '../lib/event-bus';
import { AppLogger } from '../lib/logger';

interface QueueItem {
  id: string;
  workspaceId: string;
  entityType: 'companies' | 'contacts' | 'campaigns';
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: string;
  version: number;
  retryCount: number;
}

/**
 * SyncEngine monitors the local sync_queue table and pushes pending mutations
 * to the remote API sequentially, resolving conflicts using Last-Write-Wins.
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

  /**
   * Starts periodic polling loop.
   */
  public async start(): Promise<void> {
    if (this.intervalId) return;

    // Check queue every 5 seconds
    this.intervalId = setInterval(() => this.tick(), 5000);
    AppLogger.info('SyncEngine', `Sync engine started for workspace: ${this.workspaceId}`, this.workspaceId);
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
    const pendingItems = this.db.prepare(`
      SELECT * FROM sync_queue
      WHERE workspaceId = ?
      ORDER BY createdAt ASC
    `).all(this.workspaceId) as QueueItem[];

    if (pendingItems.length === 0) return;

    AppLogger.info('SyncEngine', `Found ${pendingItems.length} pending mutations to sync.`, this.workspaceId);
    this.eventBus.publish('sync:started', { count: pendingItems.length });

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
  }

  /**
   * Resolves entity type to matching SdkClient module.
   */
  private resolveSdkModule(entityType: string): any {
    if (entityType === 'companies') return this.sdk.companies;
    if (entityType === 'contacts') return this.sdk.contacts;
    if (entityType === 'campaigns') return this.sdk.campaigns;
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
  console.log(`[SyncEngine] ${msg}`);
}
