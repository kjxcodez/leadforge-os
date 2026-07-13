import type { ISyncRepository } from '../../main/database/contracts';
import {
  RemoteCompanyRepository,
  RemoteContactRepository,
  RemoteCampaignRepository,
  RemoteActivityRepository,
  RemoteDiscoveryJobRepository,
  RemoteSequenceRepository,
  RemoteSequenceExecutionRepository,
  RemoteSequenceLogRepository,
} from './remote';


// ---------------------------------------------------------------------------
// Base SyncRepository Class
// ---------------------------------------------------------------------------

const DOMAIN_CHANNELS: Record<string, { list: string; get: string; create: string; update: string; delete: string }> = {
  companies: {
    list: 'companies:list',
    get: 'companies:get',
    create: 'companies:create',
    update: 'companies:update',
    delete: 'companies:delete',
  },
  contacts: {
    list: 'contacts:list',
    get: 'contacts:get',
    create: 'contacts:create',
    update: 'contacts:update',
    delete: 'contacts:delete',
  },
  campaigns: {
    list: 'campaigns:list',
    get: 'campaigns:get',
    create: 'campaigns:create',
    update: 'campaigns:update',
    delete: 'campaigns:delete',
  },
};

class BaseSyncRepository<T> implements ISyncRepository<T> {
  constructor(
    protected tableName: string,
    protected remoteRepo: any
  ) {}

  async findById(id: string): Promise<T | null> {
    const workspaceId = await window.ipc.invoke('electron:getActiveWorkspace', undefined);
    if (!workspaceId) throw new Error('Active workspace context is required for database queries.');

    const channels = DOMAIN_CHANNELS[this.tableName];
    if (channels) {
      return window.ipc.invoke(channels.get as any, { workspaceId, id });
    }

    // Fallback legacy path
    const cached = await window.ipc.invoke('db:findById', { tableName: this.tableName, workspaceId, id });
    return cached as T | null;
  }

  async findMany(filter?: Partial<T> & { workspaceId: string }): Promise<T[]> {
    if (!filter?.workspaceId) {
      throw new Error('workspaceId is required for repository findMany.');
    }

    const channels = DOMAIN_CHANNELS[this.tableName];
    if (channels) {
      return window.ipc.invoke(channels.list as any, { workspaceId: filter.workspaceId, filter });
    }

    // Fallback legacy path
    const cached = await window.ipc.invoke('db:find', {
      tableName: this.tableName,
      workspaceId: filter.workspaceId,
      filter,
    });
    return cached as T[];
  }

  async listAndSync(workspaceId: string, filter?: Record<string, any>): Promise<T[]> {
    // Under local-first architecture, SWR pull is handled by the Main process SyncEngine.
    // The renderer repository instantly reads and returns SQLite cache results.
    return this.findMany({ workspaceId, ...filter } as any);
  }

  async create(data: T & { workspaceId: string }): Promise<T> {
    const channels = DOMAIN_CHANNELS[this.tableName];
    if (channels) {
      // Main process database repository save automatically handles local writes
      // and schedules synchronization inside a single database transaction.
      return window.ipc.invoke(channels.create as any, data);
    }

    // Fallback path
    const id = (data as any).id || crypto.randomUUID();
    const record = {
      ...data,
      id,
      syncStatus: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await window.ipc.invoke('db:save', { tableName: this.tableName, record });
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
    const channels = DOMAIN_CHANNELS[this.tableName];
    if (channels) {
      return window.ipc.invoke(channels.update as any, { id, dto: data });
    }

    // Fallback path
    const current = await this.findById(id);
    const updatedRecord = {
      ...current,
      ...data,
      syncStatus: 'pending',
      updatedAt: new Date().toISOString(),
    };
    await window.ipc.invoke('db:save', { tableName: this.tableName, record: updatedRecord });
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
    const workspaceId = await window.ipc.invoke('electron:getActiveWorkspace', undefined);
    if (!workspaceId) throw new Error('Active workspace context is required.');

    const channels = DOMAIN_CHANNELS[this.tableName];
    if (channels) {
      return window.ipc.invoke(channels.delete as any, { workspaceId, id });
    }

    // Fallback path
    await window.ipc.invoke('db:softDelete', { tableName: this.tableName, workspaceId, id });
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
export const SyncSequenceRepository = new BaseSyncRepository<any>('sequences', RemoteSequenceRepository);
export const SyncSequenceExecutionRepository = new BaseSyncRepository<any>('sequence_executions', RemoteSequenceExecutionRepository);
export const SyncSequenceLogRepository = new BaseSyncRepository<any>('sequence_logs', RemoteSequenceLogRepository);

