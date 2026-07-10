import { ipcMain } from 'electron';
import { LocalCRMRepository } from '../database/repositories/local-crm';
import { LocalWorkspaceRepository } from '../database/repositories/local-workspace';
import { LocalQueueRepository } from '../database/repositories/local-queue';

/**
 * Exposes local SQLite database queries over safe Electron IPC channels.
 * Enforces workspaceId scoping to prevent database cache leakage.
 */
export function registerDatabaseIpc(): void {
  // ── CRM Cache Queries ───────────────────────────────────────────────────

  ipcMain.handle('db:find', async (_event, { tableName, workspaceId, filter }) => {
    if (!workspaceId) throw new Error('workspaceId is required for SQLite queries.');
    return LocalCRMRepository.findMany(tableName, workspaceId, filter);
  });

  ipcMain.handle('db:findById', async (_event, { tableName, id }) => {
    if (!id) throw new Error('id is required.');
    return LocalCRMRepository.findById(tableName, id);
  });

  ipcMain.handle('db:save', async (_event, { tableName, record }) => {
    if (!record.workspaceId) throw new Error('workspaceId is required.');
    return LocalCRMRepository.save(tableName, record);
  });

  ipcMain.handle('db:saveMany', async (_event, { tableName, records }) => {
    if (records.length && !records[0].workspaceId) throw new Error('workspaceId is required.');
    return LocalCRMRepository.saveMany(tableName, records);
  });

  ipcMain.handle('db:softDelete', async (_event, { tableName, id }) => {
    if (!id) throw new Error('id is required.');
    return LocalCRMRepository.softDelete(tableName, id);
  });

  ipcMain.handle('db:delete', async (_event, { tableName, id }) => {
    if (!id) throw new Error('id is required.');
    return LocalCRMRepository.hardDelete(tableName, id);
  });

  // ── Workspaces Cache Queries ─────────────────────────────────────────────

  ipcMain.handle('db:workspaces:findMany', async () => {
    return LocalWorkspaceRepository.findMany();
  });

  ipcMain.handle('db:workspaces:saveMany', async (_event, workspaces) => {
    return LocalWorkspaceRepository.saveMany(workspaces);
  });

  // ── Offline Queue Queries ────────────────────────────────────────────────

  ipcMain.handle('db:queue:push', async (_event, item) => {
    if (!item.workspaceId) throw new Error('workspaceId is required.');
    return LocalQueueRepository.push(item);
  });

  ipcMain.handle('db:queue:pop', async (_event, workspaceId) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    return LocalQueueRepository.pop(workspaceId);
  });

  ipcMain.handle('db:queue:list', async (_event, workspaceId) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    return LocalQueueRepository.list(workspaceId);
  });

  ipcMain.handle('db:queue:update', async (_event, { id, retryCount, error }) => {
    return LocalQueueRepository.updateProgress(id, retryCount, error);
  });

  ipcMain.handle('db:queue:remove', async (_event, id) => {
    return LocalQueueRepository.remove(id);
  });
}
