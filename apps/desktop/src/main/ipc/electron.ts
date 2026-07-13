import { safeRegister } from './helper';
import { app, shell, Notification } from 'electron';
import { WorkspaceManager } from '../lib/workspace-manager';

/**
 * Registers native Electron window, platform, utility, and notification channels.
 */
export function registerElectronIpc(
  setWorkspaceHeader: (workspaceId: string | null) => void,
  persistActiveWorkspace: (workspaceId: string | null) => void,
  getPersistedActiveWorkspace: () => string | null
) {
  safeRegister('electron:setActiveWorkspace', async (_event, workspaceId) => {
    console.log('Main Process: Setting active workspace headers:', workspaceId);
    setWorkspaceHeader(workspaceId);
    persistActiveWorkspace(workspaceId);
    try {
      await WorkspaceManager.setActiveWorkspace(workspaceId);
    } catch (err) {
      console.error('[IPC] Failed to switch workspace in runtime manager:', err);
    }
  });


  safeRegister('electron:getActiveWorkspace', () => {
    return getPersistedActiveWorkspace();
  });

  safeRegister('electron:version', () => {
    return app.getVersion();
  });

  safeRegister('electron:platform', () => {
    return process.platform;
  });

  safeRegister('electron:openUrl', async (_event, url: string) => {
    if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
      await shell.openExternal(url);
    }
  });

  safeRegister('electron:notify', (_event, payload: { title: string; body: string }) => {
    if (Notification.isSupported()) {
      new Notification({ title: payload.title, body: payload.body }).show();
    }
  });
}
