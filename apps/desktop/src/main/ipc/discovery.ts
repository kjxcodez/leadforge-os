import { safeRegister } from './helper';
import { SdkClient } from '@leadforge/sdk';
import { WorkspaceManager } from '../lib/workspace-manager';
import { LocalCRMRepository } from '../database/repositories/local-crm';

/**
 * Registers discovery platform background jobs and leads imports IPC channels.
 */
export function registerDiscoveryIpc(sdk: SdkClient) {
  safeRegister('discovery:list', async (_event, filters) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    try {
      const list = await sdk.discovery.listJobs(filters);
      await LocalCRMRepository.saveMany('discovery_jobs', list.map(item => ({ ...item, workspaceId: runtime.workspaceId })), true);
      return list;
    } catch (err) {
      return LocalCRMRepository.findMany('discovery_jobs', runtime.workspaceId, filters);
    }
  });

  safeRegister('discovery:create', async (_event, payload) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    const res = await sdk.discovery.createJob(payload);
    await LocalCRMRepository.save('discovery_jobs', { ...res, workspaceId: runtime.workspaceId }, true);
    return res;
  });

  safeRegister('discovery:get', async (_event, id) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    try {
      const res = await sdk.discovery.getJob(id);
      await LocalCRMRepository.save('discovery_jobs', { ...res, workspaceId: runtime.workspaceId }, true);
      return res;
    } catch (err) {
      const cached = await LocalCRMRepository.findById('discovery_jobs', runtime.workspaceId, id);
      if (!cached) throw err;
      return cached;
    }
  });

  safeRegister('discovery:results', async (_event, id) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    try {
      const res = await sdk.discovery.getJobResults(id);
      await LocalCRMRepository.saveMany('discovery_results', res.map((item: any) => ({ ...item, workspaceId: runtime.workspaceId })), true);
      return res;
    } catch (err) {
      return LocalCRMRepository.findMany('discovery_results', runtime.workspaceId, { jobId: id });
    }
  });

  safeRegister('discovery:import', async (_event, id) => {
    return sdk.discovery.importResult(id);
  });

  safeRegister('discovery:skip', async (_event, id) => {
    return sdk.discovery.skipResult(id);
  });
}
