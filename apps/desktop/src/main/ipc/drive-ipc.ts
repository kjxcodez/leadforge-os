import { shell } from 'electron';
import { WorkspaceManager } from '../lib/workspace-manager';
import { safeRegister } from './helper';

/**
 * Registers Google Drive file browsing and connection lifecycle IPC channels.
 */
export function registerDriveIpc(): void {
  safeRegister('drive:connections:list', async (_event: any, payload?: { workspaceId?: string }) => {
    const workspaceId = payload?.workspaceId || WorkspaceManager.getActiveRuntime()?.workspaceId;
    if (!workspaceId) throw new Error('Active workspace context is required.');
    const sdk = WorkspaceManager.getSdk();
    const connections = await sdk.googleConnections.list();
    return connections;
  });

  safeRegister('drive:connect', async () => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    const sdk = WorkspaceManager.getSdk();
    const result = await sdk.googleConnections.connect({
      scopes: [
        'openid',
        'email',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.settings.basic',
        'https://www.googleapis.com/auth/drive.file'
      ]
    });
    if (result.authorizationUrl) {
      console.log(`[IPC] Opening Google Drive OAuth in Chrome: ${result.authorizationUrl}`);
      await shell.openExternal(result.authorizationUrl);
    }
    return result;
  });

  safeRegister('drive:status', async (_event: any, { transactionId }: { transactionId: string }) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    const sdk = WorkspaceManager.getSdk();
    return sdk.googleConnections.getStatus(transactionId);
  });

  safeRegister('drive:disconnect', async (_event: any, { id }: { id: string }) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    const sdk = WorkspaceManager.getSdk();
    return sdk.googleConnections.disconnect(id);
  });

  safeRegister('drive:reconnect', async (_event: any, { id }: { id: string }) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    const sdk = WorkspaceManager.getSdk();
    const result = await sdk.googleConnections.reauthorize(id, {
      scopes: [
        'openid',
        'email',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.settings.basic',
        'https://www.googleapis.com/auth/drive.file'
      ]
    });
    if (result.authorizationUrl) {
      console.log(`[IPC] Opening Google Drive Reconnect OAuth in Chrome: ${result.authorizationUrl}`);
      await shell.openExternal(result.authorizationUrl);
    }
    return result;
  });

  safeRegister(
    'drive:files:list',
    async (
      _event: any,
      params: { connectionId: string; folderId?: string; search?: string; pageToken?: string; pageSize?: number }
    ) => {
      const { connectionId, folderId, search, pageToken, pageSize } = params || {};
      if (!connectionId) throw new Error('connectionId is required.');
      const sdk = WorkspaceManager.getSdk();
      return sdk.drive.listFiles(connectionId, { folderId, search, pageToken, pageSize });
    }
  );

  safeRegister('drive:files:get', async (_event: any, params: { connectionId: string; fileId: string }) => {
    const { connectionId, fileId } = params || {};
    if (!connectionId) throw new Error('connectionId is required.');
    if (!fileId) throw new Error('fileId is required.');
    const sdk = WorkspaceManager.getSdk();
    return sdk.drive.getFile(connectionId, fileId);
  });
}
