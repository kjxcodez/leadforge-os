import { safeRegister } from './helper';
import { SdkClient } from '@leadforge/sdk';

/**
 * Registers discovery platform background jobs and leads imports IPC channels.
 */
export function registerDiscoveryIpc(sdk: SdkClient) {
  safeRegister('discovery:list', async (_event, filters) => {
    return sdk.discovery.listJobs(filters);
  });

  safeRegister('discovery:create', async (_event, payload) => {
    return sdk.discovery.createJob(payload);
  });

  safeRegister('discovery:get', async (_event, id) => {
    return sdk.discovery.getJob(id);
  });

  safeRegister('discovery:results', async (_event, id) => {
    return sdk.discovery.getJobResults(id);
  });

  safeRegister('discovery:import', async (_event, id) => {
    return sdk.discovery.importResult(id);
  });

  safeRegister('discovery:skip', async (_event, id) => {
    return sdk.discovery.skipResult(id);
  });
}
