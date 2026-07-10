import type { IRemoteRepository } from '../../main/database/contracts';

/**
 * RemoteCompanyRepository wraps remote CRM Company API communication via IPC.
 */
export const RemoteCompanyRepository: IRemoteRepository<any> = {
  async get(id: string): Promise<any> {
    return window.ipc.invoke('companies:get', id); // placeholder in main if needed
  },

  async list(filter?: Record<string, any>): Promise<any[]> {
    return window.ipc.invoke('companies:list', filter || {});
  },

  async create(data: Record<string, any>): Promise<any> {
    return window.ipc.invoke('companies:create', data as any);
  },

  async update(id: string, data: Record<string, any>): Promise<any> {
    return window.ipc.invoke('companies:update', { id, dto: data } as any); // placeholder
  },

  async delete(id: string): Promise<void> {
    return window.ipc.invoke('companies:delete', id);
  },
};

/**
 * RemoteContactRepository wraps remote CRM Contact API communication.
 */
export const RemoteContactRepository: IRemoteRepository<any> = {
  async get(id: string): Promise<any> {
    return window.ipc.invoke('contacts:get', id);
  },

  async list(filter?: Record<string, any>): Promise<any[]> {
    return window.ipc.invoke('contacts:list', filter || {});
  },

  async create(data: Record<string, any>): Promise<any> {
    return window.ipc.invoke('contacts:create', data);
  },

  async update(id: string, data: Record<string, any>): Promise<any> {
    return window.ipc.invoke('contacts:update', { id, dto: data } as any);
  },

  async delete(id: string): Promise<void> {
    return window.ipc.invoke('contacts:delete', id);
  },
};

/**
 * RemoteCampaignRepository wraps remote CRM Campaign API communication.
 */
export const RemoteCampaignRepository: IRemoteRepository<any> = {
  async get(id: string): Promise<any> {
    return window.ipc.invoke('campaigns:get', id);
  },

  async list(filter?: Record<string, any>): Promise<any[]> {
    return window.ipc.invoke('campaigns:list', filter || {});
  },

  async create(data: Record<string, any>): Promise<any> {
    return window.ipc.invoke('campaigns:create', data);
  },

  async update(id: string, data: Record<string, any>): Promise<any> {
    return window.ipc.invoke('campaigns:update', { id, dto: data } as any);
  },

  async delete(id: string): Promise<void> {
    return window.ipc.invoke('campaigns:delete', id);
  },
};

/**
 * RemoteActivityRepository wraps remote Activity log API calls.
 */
export const RemoteActivityRepository: IRemoteRepository<any> = {
  async get(id: string): Promise<any> {
    return null;
  },

  async list(filter?: Record<string, any>): Promise<any[]> {
    return window.ipc.invoke('activities:list', filter || {});
  },

  async create(data: Record<string, any>): Promise<any> {
    return null;
  },

  async update(id: string, data: Record<string, any>): Promise<any> {
    return null;
  },

  async delete(id: string): Promise<void> {
    return;
  },
};
