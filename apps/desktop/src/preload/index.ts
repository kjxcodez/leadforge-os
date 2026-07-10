import { contextBridge, ipcRenderer } from 'electron';
import type { IpcChannelMap } from '@leadforge/schema';

contextBridge.exposeInMainWorld('ipc', {
  test: (): Promise<{ status: string; timestamp: number }> => {
    return ipcRenderer.invoke('ipc:test');
  },

  invoke: <K extends keyof IpcChannelMap>(
    channel: K,
    payload: IpcChannelMap[K]['input']
  ): Promise<IpcChannelMap[K]['output']> => {
    const validChannels: Array<string> = [
      'companies:list',
      'companies:create',
      'system:status',
      'auth:login',
      'auth:register',
      'auth:logout',
      'auth:session',
      'workspaces:create',
      'workspaces:list',
      'workspaces:update',
      'workspaces:delete',
      'workspaces:get',
      'workspaces:members:list',
      'workspaces:members:invite',
      'workspaces:members:updateRole',
      'workspaces:members:remove',
      'workspaces:members:leave',
      'workspaces:members:transferOwnership',
      'workspaces:invites:list',
      'workspaces:invites:accept',
      'workspaces:invites:decline',
      'electron:setActiveWorkspace',
      'electron:getActiveWorkspace',
      'db:find',
      'db:findById',
      'db:save',
      'db:saveMany',
      'db:softDelete',
      'db:delete',
      'db:workspaces:findMany',
      'db:workspaces:saveMany',
      'db:queue:push',
      'db:queue:pop',
      'db:queue:list',
      'db:queue:update',
      'db:queue:remove',
      'companies:list',
      'companies:get',
      'companies:create',
      'companies:update',
      'companies:delete',
      'contacts:list',
      'contacts:get',
      'contacts:create',
      'contacts:update',
      'contacts:delete',
      'campaigns:list',
      'campaigns:get',
      'campaigns:create',
      'campaigns:update',
      'campaigns:delete',
      'activities:list',
      'discovery:list',
      'discovery:create',
      'discovery:get',
      'discovery:results',
      'discovery:import',
      'discovery:skip',
      'electron:version',
      'electron:platform',
      'electron:openUrl',
      'electron:notify',
    ];
    if (validChannels.includes(channel as string)) {
      return ipcRenderer.invoke(channel, payload);
    }
    throw new Error(`Unauthorized IPC channel: ${channel}`);
  },

  on: <K extends keyof IpcChannelMap>(
    channel: K,
    callback: (payload: IpcChannelMap[K]['output']) => void
  ) => {
    const validChannels: Array<string> = [
      'companies:list',
      'companies:create',
      'system:status',
      'auth:login',
      'auth:register',
      'auth:logout',
      'auth:session',
      'workspaces:create',
      'workspaces:list',
    ];
    if (validChannels.includes(channel as string)) {
      const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(args[0] as any);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    }
    throw new Error(`Unauthorized IPC channel: ${channel}`);
  },
});

export interface IpcApi {
  test(): Promise<{ status: string; timestamp: number }>;
  invoke<K extends keyof IpcChannelMap>(
    channel: K,
    payload: IpcChannelMap[K]['input']
  ): Promise<IpcChannelMap[K]['output']>;
  on<K extends keyof IpcChannelMap>(
    channel: K,
    callback: (payload: IpcChannelMap[K]['output']) => void
  ): () => void;
}

declare global {
  interface Window {
    ipc: IpcApi;
  }
}