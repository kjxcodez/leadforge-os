import type { QueryClient } from '@tanstack/react-query';
import { QueueProcessor } from './queue-processor';
import {
  SyncCompanyRepository,
  SyncContactRepository,
  SyncCampaignRepository
} from '../repositories/sync';

let pollerInterval: any = null;

/**
 * SyncWorker manages background polling, periodic queue pushes, and delta pull syncs.
 */
export const SyncWorker = {
  /**
   * Starts background synchronization loop.
   */
  start(queryClient: QueryClient, workspaceId: string): void {
    this.stop();

    // 1. Process queue immediately
    this.sync(queryClient, workspaceId);

    // 2. Poll every 60 seconds
    pollerInterval = setInterval(() => {
      this.sync(queryClient, workspaceId);
    }, 60000);

    // 3. Listen for online reconnection
    window.addEventListener('online', () => this.sync(queryClient, workspaceId));

    console.log(`[SyncWorker] Background sync started for workspace: ${workspaceId}`);
  },

  /**
   * Stops background synchronization loop.
   */
  stop(): void {
    if (pollerInterval) {
      clearInterval(pollerInterval);
      pollerInterval = null;
    }
  },

  /**
   * Performs an atomic pull/push sync cycle.
   */
  async sync(queryClient: QueryClient, workspaceId: string): Promise<void> {
    if (!navigator.onLine) {
      console.log('[SyncWorker] Offline. Skipping synchronization cycle.');
      return;
    }

    try {
      console.log('[SyncWorker] Sync cycle triggered...');

      // A. Push offline changes
      await QueueProcessor.processQueue(workspaceId);

      // B. Pull fresh data from API to refresh SQLite Cache
      // (This will call listAndSync which writes to SQLite)
      await Promise.all([
        SyncCompanyRepository.listAndSync(workspaceId),
        SyncContactRepository.listAndSync(workspaceId),
        SyncCampaignRepository.listAndSync(workspaceId),
      ]);

      // C. Invalidate TanStack query client caches to update renderer UI
      queryClient.invalidateQueries();

      console.log('[SyncWorker] Sync cycle complete.');
    } catch (err) {
      console.error('[SyncWorker] Sync cycle failure:', err);
    }
  },
};
