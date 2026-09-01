import { WorkspaceManager } from '../lib/workspace-manager';
import { safeRegister } from './helper';

/**
 * Registers Google Drive file browsing IPC channels.
 */
export function registerDriveIpc(): void {
  safeRegister('drive:connections:list', async (_event: any, payload?: { workspaceId?: string }) => {
    const workspaceId = payload?.workspaceId || WorkspaceManager.getActiveRuntime()?.workspaceId;
    if (!workspaceId) throw new Error('Active workspace context is required.');
    const sdk = WorkspaceManager.getSdk();
    const connections = await sdk.googleConnections.list();
    return connections;
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
