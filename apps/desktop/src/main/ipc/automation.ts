import { safeRegister } from './helper';
import { SdkClient } from '@leadforge/sdk';
import { WorkspaceManager } from '../lib/workspace-manager';
import { LocalCRMRepository } from '../database/repositories/local-crm';

/**
 * Registers sequences and executions automation IPC channels.
 */
export function registerAutomationIpc(sdk: SdkClient) {
  // Sequences CRUD
  safeRegister('sequence:list', async () => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    try {
      const list = await sdk.sequences.list();
      await LocalCRMRepository.saveMany('sequences', list.map(item => ({ ...item, workspaceId: runtime.workspaceId })), true);
      return list;
    } catch (err) {
      console.warn('[IPC] Failed to list sequences from remote, falling back to local cache:', err);
      return LocalCRMRepository.findMany('sequences', runtime.workspaceId);
    }
  });

  safeRegister('sequence:get', async (_event, id) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    try {
      const res = await sdk.sequences.get(id);
      await LocalCRMRepository.save('sequences', { ...res, workspaceId: runtime.workspaceId }, true);
      return res;
    } catch (err) {
      const cached = await LocalCRMRepository.findById('sequences', runtime.workspaceId, id);
      if (!cached) throw err;
      return cached;
    }
  });

  safeRegister('sequence:create', async (_event, dto) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    const id = dto.id || require('crypto').randomUUID();
    const record = { ...dto, id, workspaceId: runtime.workspaceId, syncStatus: 'pending' };
    await LocalCRMRepository.save('sequences', record);
    return record;
  });

  safeRegister('sequence:update', async (_event, { id, dto }) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    const record = { ...dto, id, workspaceId: runtime.workspaceId, syncStatus: 'pending' };
    await LocalCRMRepository.save('sequences', record);
    return record;
  });

  safeRegister('sequence:delete', async (_event, id) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    await LocalCRMRepository.softDelete('sequences', runtime.workspaceId, id);
    return { success: true };
  });

  // Executions Orchestration
  safeRegister('sequence:start', async (_event, { sequenceId, contactId, companyId }) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    const res = await sdk.executions.start(sequenceId, contactId, companyId);
    await LocalCRMRepository.save('sequence_executions', { ...res, workspaceId: runtime.workspaceId }, true);
    return res;
  });

  safeRegister('sequence:stop', async (_event, id) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    const res = await sdk.executions.stop(id);
    await LocalCRMRepository.save('sequence_executions', { ...res, workspaceId: runtime.workspaceId }, true);
    return res;
  });

  safeRegister('execution:list', async () => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    try {
      const list = await sdk.executions.list();
      await LocalCRMRepository.saveMany('sequence_executions', list.map(item => ({ ...item, workspaceId: runtime.workspaceId })), true);
      return list;
    } catch (err) {
      return LocalCRMRepository.findMany('sequence_executions', runtime.workspaceId);
    }
  });

  safeRegister('execution:get', async (_event, id) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    try {
      const res = await sdk.executions.get(id);
      await LocalCRMRepository.save('sequence_executions', { ...res, workspaceId: runtime.workspaceId }, true);
      return res;
    } catch (err) {
      const cached = await LocalCRMRepository.findById('sequence_executions', runtime.workspaceId, id);
      if (!cached) throw err;
      return cached;
    }
  });

  safeRegister('execution:logs', async (_event, id) => {
    return sdk.executions.getLogs(id);
  });
}
