import { ipcMain } from 'electron';

export const REGISTERED_IPC_CHANNELS = new Set<string>();

/**
 * Registers an IPC handler safely by removing any existing handler first.
 * This prevents runtime duplication crashes during Vite Hot Module Replacement (HMR).
 */
export function safeRegister(channel: string, handler: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any) {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, handler);
  REGISTERED_IPC_CHANNELS.add(channel);
}
