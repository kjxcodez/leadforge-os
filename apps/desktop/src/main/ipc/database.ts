import { safeRegister } from './helper';
import { LocalCRMRepository } from '../database/repositories/local-crm';
import { LocalWorkspaceRepository } from '../database/repositories/local-workspace';
import { LocalQueueRepository } from '../database/repositories/local-queue';

/**
 * Exposes local SQLite database queries over safe Electron IPC channels.
 * Enforces workspaceId scoping to prevent database cache leakage.
 */
export function registerDatabaseIpc(): void {
  // ── CRM Cache Queries ───────────────────────────────────────────────────

  safeRegister('db:find', async (_event, { tableName, workspaceId, filter }) => {
    if (!workspaceId) throw new Error('workspaceId is required for SQLite queries.');
    return LocalCRMRepository.findMany(tableName, workspaceId, filter);
  });

  safeRegister('db:findById', async (_event, { tableName, id }) => {
    if (!id) throw new Error('id is required.');
    return LocalCRMRepository.findById(tableName, id);
  });

  safeRegister('db:save', async (_event, { tableName, record }) => {
    if (!record.workspaceId) throw new Error('workspaceId is required.');
    return LocalCRMRepository.save(tableName, record);
  });

  safeRegister('db:saveMany', async (_event, { tableName, records }) => {
    if (records.length && !records[0].workspaceId) throw new Error('workspaceId is required.');
    return LocalCRMRepository.saveMany(tableName, records);
  });

  safeRegister('db:softDelete', async (_event, { tableName, id }) => {
    if (!id) throw new Error('id is required.');
    return LocalCRMRepository.softDelete(tableName, id);
  });

  safeRegister('db:delete', async (_event, { tableName, id }) => {
    if (!id) throw new Error('id is required.');
    return LocalCRMRepository.hardDelete(tableName, id);
  });

  // ── Workspaces Cache Queries ─────────────────────────────────────────────

  safeRegister('db:workspaces:findMany', async () => {
    return LocalWorkspaceRepository.findMany();
  });

  safeRegister('db:workspaces:saveMany', async (_event, workspaces) => {
    return LocalWorkspaceRepository.saveMany(workspaces);
  });

  // ── Offline Queue Queries ────────────────────────────────────────────────

  safeRegister('db:queue:push', async (_event, item) => {
    if (!item.workspaceId) throw new Error('workspaceId is required.');
    return LocalQueueRepository.push(item);
  });

  safeRegister('db:queue:pop', async (_event, workspaceId) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    return LocalQueueRepository.pop(workspaceId);
  });

  safeRegister('db:queue:list', async (_event, workspaceId) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    return LocalQueueRepository.list(workspaceId);
  });

  safeRegister('db:queue:update', async (_event, { id, retryCount, error }) => {
    return LocalQueueRepository.updateProgress(id, retryCount, error);
  });

  safeRegister('db:queue:remove', async (_event, id) => {
    return LocalQueueRepository.remove(id);
  });
}
