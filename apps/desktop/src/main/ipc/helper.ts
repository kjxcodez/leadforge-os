import { ipcMain } from 'electron';

/**
 * Registers an IPC handler safely by removing any existing handler first.
 * This prevents runtime duplication crashes during Vite Hot Module Replacement (HMR).
 */
export function safeRegister(channel: string, handler: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any) {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, handler);
}
