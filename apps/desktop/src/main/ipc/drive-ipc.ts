import { shell } from 'electron';
import { WorkspaceManager } from '../lib/workspace-manager';
import { safeRegister } from './helper';

/**
 * Registers Google Drive file browsing and connection lifecycle IPC channels.
 */
export function registerDriveIpc(): void {
  safeRegister('drive:connections:list', async (_event: any, payload?: { workspaceId?: string }) => {
    const runtime = await WorkspaceManager.getOrAwaitActiveRuntime(payload?.workspaceId);
    if (!runtime) return [];
    const sdk = WorkspaceManager.getSdk();
    try {
      const connections = await sdk.googleConnections.list();
      return connections;
    } catch (err) {
      console.warn('[IPC] Failed to list drive connections:', err);
      return [];
    }
  });

  safeRegister('drive:connect', async () => {
    const runtime = await WorkspaceManager.getOrAwaitActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    const sdk = WorkspaceManager.getSdk();
    const result = await sdk.googleConnections.connect({
      scopes: [
        'openid',
        'email',
        'https://www.googleapis.com/auth/userinfo.profile',
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
    const runtime = await WorkspaceManager.getOrAwaitActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    const sdk = WorkspaceManager.getSdk();
    const res = await sdk.googleConnections.getStatus(transactionId);
    if (res && res.status === 'completed') {
      const { BrowserWindow } = await import('electron');
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) win.webContents.send('google-connections:changed');
      });
    }
    return res;
  });

  safeRegister('drive:disconnect', async (_event: any, { id }: { id: string }) => {
    const runtime = await WorkspaceManager.getOrAwaitActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    const sdk = WorkspaceManager.getSdk();
    const res = await sdk.googleConnections.disconnect(id);
    const { BrowserWindow } = await import('electron');
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) win.webContents.send('google-connections:changed');
    });
    return res;
  });

  safeRegister('drive:reconnect', async (_event: any, { id }: { id: string }) => {
    const runtime = await WorkspaceManager.getOrAwaitActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    const sdk = WorkspaceManager.getSdk();
    const result = await sdk.googleConnections.reauthorize(id, {
      scopes: [
        'openid',
        'email',
        'https://www.googleapis.com/auth/userinfo.profile',
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
      try {
        return await sdk.drive.listFiles(connectionId, { folderId, search, pageToken, pageSize });
      } catch (err: any) {
        console.warn('[IPC] drive:files:list failed:', err.message);
        return { files: [], nextPageToken: undefined };
      }
    }
  );

  safeRegister('drive:about', async (_event: any, { connectionId }: { connectionId: string }) => {
    if (!connectionId) return { user: {}, storageQuota: {} };
    const sdk = WorkspaceManager.getSdk();
    try {
      return await sdk.drive.getAbout(connectionId);
    } catch (err: any) {
      console.warn('[IPC] drive:about query failed gracefully:', err.message);
      return { user: {}, storageQuota: {} };
    }
  });

  safeRegister('drive:files:get', async (_event: any, params: { connectionId: string; fileId: string }) => {
    const { connectionId, fileId } = params || {};
    if (!connectionId) throw new Error('connectionId is required.');
    if (!fileId) throw new Error('fileId is required.');
    const sdk = WorkspaceManager.getSdk();
    return sdk.drive.getFile(connectionId, fileId);
  });

  // ── Media Library IPC Channels ───────────────────────────────────────────────

  safeRegister(
    'media:list',
    async (_event: any, params?: { search?: string; category?: string; connectionId?: string; page?: number; limit?: number }) => {
      const runtime = WorkspaceManager.getActiveRuntime();
      if (!runtime) throw new Error('No active workspace runtime');
      const sdk = WorkspaceManager.getSdk();
      return sdk.attachments.list(params);
    }
  );

  safeRegister(
    'media:upload',
    async (
      _event: any,
      payload: { filename: string; mimeType: string; contentBase64: string; googleConnectionId?: string; metadata?: Record<string, any> }
    ) => {
      const runtime = WorkspaceManager.getActiveRuntime();
      if (!runtime) throw new Error('No active workspace runtime');
      const sdk = WorkspaceManager.getSdk();

      let connId = payload.googleConnectionId;
      if (!connId) {
        const connections = await sdk.googleConnections.list().catch(() => []);
        const activeDriveConn = connections.find(
          (c: any) => c.status === 'active' && c.driveStatus === 'authorized'
        );
        if (!activeDriveConn) {
          throw new Error('No authorized Google Drive account found in this workspace. Please connect Google Drive in Settings.');
        }
        connId = activeDriveConn.id;
      }

      if (!connId) {
        throw new Error('Google connection ID could not be determined.');
      }

      const uploadPayload: {
        googleConnectionId: string;
        filename: string;
        mimeType: string;
        contentBase64: string;
        metadata?: Record<string, any>;
      } = {
        googleConnectionId: connId,
        filename: payload.filename,
        mimeType: payload.mimeType,
        contentBase64: payload.contentBase64
      };
      if (payload.metadata) {
        uploadPayload.metadata = payload.metadata;
      }

      return sdk.attachments.upload(uploadPayload);
    }
  );

  safeRegister('media:delete', async (_event: any, { id }: { id: string }) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    if (!id) throw new Error('Attachment ID is required.');
    const sdk = WorkspaceManager.getSdk();
    return sdk.attachments.delete(id);
  });

  safeRegister(
    'media:link',
    async (_event: any, payload: { googleConnectionId: string; fileId: string }) => {
      const runtime = WorkspaceManager.getActiveRuntime();
      if (!runtime) throw new Error('No active workspace runtime');
      if (!payload.googleConnectionId || !payload.fileId) {
        throw new Error('googleConnectionId and fileId are required.');
      }
      const sdk = WorkspaceManager.getSdk();
      return sdk.attachments.linkDriveFile(payload);
    }
  );
}
