import { contextBridge, ipcRenderer } from 'electron';
import type { IpcChannelMap } from '@leadforge/schema';

contextBridge.exposeInMainWorld('ipc', {
  test: (): Promise<{ status: string; timestamp: number }> => {
    return ipcRenderer.invoke('ipc:test');
  },

  getInitialSettings: (): any => {
    return ipcRenderer.sendSync('settings:getSync');
  },

  setSettings: (settings: any): void => {
    ipcRenderer.send('settings:set', settings);
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
      'scheduler:jobs:list',
      'scheduler:jobs:submit',
      'scheduler:jobs:cancel',
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
      'email-accounts:list',
      'email-accounts:create',
      'email-accounts:delete',
      'email-accounts:test',
      'templates:list',
      'templates:create',
      'templates:delete',
      'templates:preview',
      'campaigns:schedule',
      'sequence:list',
      'sequence:get',
      'sequence:create',
      'sequence:update',
      'sequence:delete',
      'sequence:start',
      'sequence:stop',
      'execution:list',
      'execution:get',
      'execution:logs',
      'electron:version',
      'electron:platform',
      'electron:openUrl',
      'electron:notify',
      'auth:unauthorized',
      'system:diagnostics',
      'scheduler:jobs:pause',
      'scheduler:jobs:resume',
      'dashboard:stats',
      'dashboard:chart-data',
      'dashboard:activity-feed',
      'system:infrastructure-status',
      'electron:ready-to-show',
      'linkedin:get-cookie-status',
      'linkedin:save-cookie',
      'linkedin:validate',
      'intelligence:get',
      'intelligence:trigger',
      'onboarding:get-diagnostics',
      'onboarding:generate-sample-data',
      'onboarding:save-setting',
      'system-logs:query',
      'audit-logs:list',
      'diagnostics:run',
      'metrics:get',
      'errors:get',
      'recovery:execute',
      'dev-mode:log',
      'updater:get-status',
      'updater:check',
      'updater:download',
      'updater:install',
      'agent:execute',
      'agent:workflow:execute'
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
      'auth:unauthorized',
      'sync:completed',
      'system:log:event',
      'job:progress',
      'job:completed',
      'job:failed',
      'job:starting',
      'job:started',
      'job:paused',
      'job:cancelled',
      'automation:queued',
      'automation:started',
      'automation:resumed',
      'automation:paused',
      'automation:waiting',
      'automation:completed',
      'automation:cancelled',
      'automation:failed',
      'automation:recovered',
      'workspace:boot-progress',
      'scheduler:tick',
      'updater:status-changed',
      'agent:workflow:progress'
    ];
    if (validChannels.includes(channel as string)) {
      const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
        callback(args[0] as any);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    }
    throw new Error(`Unauthorized IPC channel: ${channel}`);
  }
});

export interface IpcApi {
  test(): Promise<{ status: string; timestamp: number }>;
  getInitialSettings(): any;
  setSettings(settings: any): void;
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
