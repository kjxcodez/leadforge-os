import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('ipc', {
  // Test channel
  test: () => ipcRenderer.invoke('ipc:test'),

  // Generic invoke
  invoke: (channel: string, ...args: unknown[]) => {
    const validChannels = ['ipc:test'];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    throw new Error(`Unauthorized IPC channel: ${channel}`);
  },

  // Event listeners
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const validChannels = ['ipc:test'];
    if (validChannels.includes(channel)) {
      const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    }
    throw new Error(`Unauthorized IPC channel: ${channel}`);
  },
});

// Type definitions for the exposed API
export interface IpcApi {
  test: () => Promise<{ status: string; timestamp: number }>;
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
}

declare global {
  interface Window {
    ipc: IpcApi;
  }
}