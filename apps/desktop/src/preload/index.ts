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