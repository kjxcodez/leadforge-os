import { safeRegister } from './helper';
import { SdkClient } from '@leadforge/sdk';

/**
 * Registers sequences and executions automation IPC channels.
 */
export function registerAutomationIpc(sdk: SdkClient) {
  // Sequences CRUD
  safeRegister('sequence:list', async () => {
    return sdk.sequences.list();
  });

  safeRegister('sequence:get', async (_event, id) => {
    return sdk.sequences.get(id);
  });

  safeRegister('sequence:create', async (_event, dto) => {
    return sdk.sequences.create(dto);
  });

  safeRegister('sequence:update', async (_event, { id, dto }) => {
    return sdk.sequences.update(id, dto);
  });

  safeRegister('sequence:delete', async (_event, id) => {
    return sdk.sequences.delete(id);
  });

  // Executions Orchestration
  safeRegister('sequence:start', async (_event, { sequenceId, contactId, companyId }) => {
    return sdk.executions.start(sequenceId, contactId, companyId);
  });

  safeRegister('sequence:stop', async (_event, id) => {
    return sdk.executions.stop(id);
  });

  safeRegister('execution:list', async () => {
    return sdk.executions.list();
  });

  safeRegister('execution:get', async (_event, id) => {
    return sdk.executions.get(id);
  });

  safeRegister('execution:logs', async (_event, id) => {
    return sdk.executions.getLogs(id);
  });
}
