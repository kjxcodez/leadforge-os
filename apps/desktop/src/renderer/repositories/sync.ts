import type { ISyncRepository } from '../../main/database/contracts';
import {
  RemoteCompanyRepository,
  RemoteContactRepository,
  RemoteCampaignRepository,
  RemoteActivityRepository,
  RemoteDiscoveryJobRepository
} from './remote';

// ---------------------------------------------------------------------------
// Base SyncRepository Class
// ---------------------------------------------------------------------------

class BaseSyncRepository<T> implements ISyncRepository<T> {
  constructor(
    protected tableName: string,
    protected remoteRepo: any
  ) {}

  async findById(id: string): Promise<T | null> {
    // 1. Read from SQLite cache instantly
    const cached = await window.ipc.invoke('db:findById', { tableName: this.tableName, id });
    return cached as T | null;
  }

  async findMany(filter?: Partial<T> & { workspaceId: string }): Promise<T[]> {
    if (!filter?.workspaceId) {
      throw new Error('workspaceId is required for repository findMany.');
    }
    // 1. Read from SQLite cache instantly
    const cached = await window.ipc.invoke('db:find', {
      tableName: this.tableName,
      workspaceId: filter.workspaceId,
      filter,
    });
    return cached as T[];
  }

  async listAndSync(workspaceId: string, filter?: Record<string, any>): Promise<T[]> {
    // 1. Return cached items immediately (no UI spinner)
    const cached = await this.findMany({ workspaceId, ...filter } as any);

    // 2. Fire background network pull if online
    if (navigator.onLine) {
      this.remoteRepo.list({ workspaceId, ...filter }).then(async (freshList: T[]) => {
        // Bulk write to cache
        await window.ipc.invoke('db:saveMany', {
          tableName: this.tableName,
          records: freshList.map((item: any) => ({
            ...item,
            workspaceId,
            syncStatus: 'synced',
          })),
        });
      }).catch((err: any) => {
        console.warn(`[Sync] Background pull failed for ${this.tableName}:`, err);
      });
    }

    return cached;
  }

  async create(data: T & { workspaceId: string }): Promise<T> {
    const id = (data as any).id || crypto.randomUUID();
    const record = {
      ...data,
      id,
      syncStatus: navigator.onLine ? 'synced' : 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Write to local cache immediately
    await window.ipc.invoke('db:save', { tableName: this.tableName, record });

    if (navigator.onLine) {
      try {
        const remoteRecord = await this.remoteRepo.create(data);
        // Overwrite local with server response (e.g. if ID was modified)
        await window.ipc.invoke('db:save', {
          tableName: this.tableName,
          record: { ...remoteRecord, workspaceId: data.workspaceId, syncStatus: 'synced' },
        });
        return remoteRecord;
      } catch (err) {
        console.warn('[Sync] Online write failed, queueing task offline instead:', err);
      }
    }

    // 2. Queue offline mutation task if offline or remote write failed
    await window.ipc.invoke('db:queue:push', {
      id: crypto.randomUUID(),
      workspaceId: data.workspaceId,
      entityType: this.tableName,
      entityId: id,
      operation: 'CREATE',
      payload: JSON.stringify(record),
    });

    return record;
  }

  async update(id: string, data: Partial<T> & { workspaceId: string }): Promise<T> {
    // Read current cached item
    const current = await this.findById(id);
    const updatedRecord = {
      ...current,
      ...data,
      syncStatus: navigator.onLine ? 'synced' : 'pending',
      updatedAt: new Date().toISOString(),
    };

    // 1. Save updated record in SQLite
    await window.ipc.invoke('db:save', { tableName: this.tableName, record: updatedRecord });

    if (navigator.onLine) {
      try {
        const remoteRecord = await this.remoteRepo.update(id, data);
        await window.ipc.invoke('db:save', {
          tableName: this.tableName,
          record: { ...remoteRecord, workspaceId: data.workspaceId, syncStatus: 'synced' },
        });
        return remoteRecord;
      } catch (err) {
        console.warn('[Sync] Online update failed, queueing task offline:', err);
      }
    }

    // 2. Queue task offline
    await window.ipc.invoke('db:queue:push', {
      id: crypto.randomUUID(),
      workspaceId: data.workspaceId,
      entityType: this.tableName,
      entityId: id,
      operation: 'UPDATE',
      payload: JSON.stringify(data),
    });

    return updatedRecord as T;
  }

  async delete(id: string): Promise<void> {
    // 1. Soft-delete locally immediately
    await window.ipc.invoke('db:softDelete', { tableName: this.tableName, id });

    const cached = await this.findById(id) as any;
    const workspaceId = cached?.workspaceId || '';

    if (navigator.onLine) {
      try {
        await this.remoteRepo.delete(id);
        // Hard delete from cache once API deletion is done
        await window.ipc.invoke('db:delete', { tableName: this.tableName, id });
        return;
      } catch (err) {
        console.warn('[Sync] Online deletion failed, queueing task offline:', err);
      }
    }

    // 2. Queue deletion task
    await window.ipc.invoke('db:queue:push', {
      id: crypto.randomUUID(),
      workspaceId,
      entityType: this.tableName,
      entityId: id,
      operation: 'DELETE',
      payload: null,
    });
  }

  async pushLocalMutations(workspaceId: string): Promise<void> {
    // Executed by the background QueueProcessor
  }
}

// ---------------------------------------------------------------------------
// Concrete Sync Repositories exports
// ---------------------------------------------------------------------------

export const SyncCompanyRepository = new BaseSyncRepository<any>('companies', RemoteCompanyRepository);
export const SyncContactRepository = new BaseSyncRepository<any>('contacts', RemoteContactRepository);
export const SyncCampaignRepository = new BaseSyncRepository<any>('campaigns', RemoteCampaignRepository);
export const SyncActivityRepository = new BaseSyncRepository<any>('activities', RemoteActivityRepository);
export const SyncDiscoveryJobRepository = new BaseSyncRepository<any>('discovery_jobs', RemoteDiscoveryJobRepository);
