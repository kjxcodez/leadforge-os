import {
  RemoteCompanyRepository,
  RemoteContactRepository,
  RemoteCampaignRepository
} from '../repositories/remote';

const REMOTES: Record<string, any> = {
  companies: RemoteCompanyRepository,
  contacts: RemoteContactRepository,
  campaigns: RemoteCampaignRepository,
};

/**
 * QueueProcessor pops, processes, and pushes pending offline mutations to the server.
 */
export const QueueProcessor = {
  isProcessing: false,

  /**
   * Processes the next pending task in the sync queue for a workspace.
   */
  async processNext(workspaceId: string): Promise<boolean> {
    const task = await window.ipc.invoke('db:queue:pop', workspaceId);
    if (!task) return false; // Queue is empty

    const { id, entityType, entityId, operation, payload, retryCount } = task;
    const remoteRepo = REMOTES[entityType];

    if (!remoteRepo) {
      console.error(`[Sync] No remote repository registered for: ${entityType}`);
      await window.ipc.invoke('db:queue:remove', id);
      return true;
    }

    console.log(`[Sync] Processing queue task: ${operation} on ${entityType}/${entityId} (Attempt ${retryCount + 1})`);

    try {
      if (operation === 'CREATE') {
        const parsed = JSON.parse(payload);
        const serverRecord = await remoteRepo.create(parsed);
        
        // Update local cache with actual server response and clear pending status
        await window.ipc.invoke('db:save', {
          tableName: entityType,
          record: { ...serverRecord, workspaceId, syncStatus: 'synced' }
        });
      } 
      else if (operation === 'UPDATE') {
        const parsed = JSON.parse(payload);
        const serverRecord = await remoteRepo.update(entityId, parsed);
        
        await window.ipc.invoke('db:save', {
          tableName: entityType,
          record: { ...serverRecord, workspaceId, syncStatus: 'synced' }
        });
      } 
      else if (operation === 'DELETE') {
        await remoteRepo.delete(entityId);
        // Hard-delete locally since deletion is synced
        await window.ipc.invoke('db:delete', { tableName: entityType, id: entityId });
      }

      // Sync successful: remove task from queue
      await window.ipc.invoke('db:queue:remove', id);
      console.log(`[Sync] Task ${id} processed and removed successfully.`);
      return true;
    } catch (err: any) {
      const errorMsg = err.message || 'Unknown network error.';
      console.error(`[Sync] Task ${id} failed:`, errorMsg);

      // Increment retry counter and update log
      await window.ipc.invoke('db:queue:update', {
        id,
        retryCount: retryCount + 1,
        error: errorMsg,
      });

      return false; // Stop queue iteration if network failed
    }
  },

  /**
   * Processes the entire queue for a workspace.
   */
  async processQueue(workspaceId: string): Promise<void> {
    if (this.isProcessing) return;
    if (!navigator.onLine) return;

    this.isProcessing = true;
    try {
      let hasMore = true;
      while (hasMore) {
        hasMore = await this.processNext(workspaceId);
      }
    } finally {
      this.isProcessing = false;
    }
  },
};
