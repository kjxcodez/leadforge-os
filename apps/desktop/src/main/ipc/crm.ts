import { safeRegister } from './helper';
import { LocalCRMRepository } from '../database/repositories/local-crm';

/**
 * Registers CRM entities (companies, contacts, campaigns, activities) IPC channels
 * targeting the local SQLite database.
 */
export function registerCrmIpc() {
  // Companies
  safeRegister('companies:list', async (_event, { workspaceId, filter }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    return LocalCRMRepository.findMany('companies', workspaceId, filter);
  });

  safeRegister('companies:get', async (_event, { workspaceId, id }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    if (!id) throw new Error('id is required.');
    return LocalCRMRepository.findById('companies', workspaceId, id);
  });

  safeRegister('companies:create', async (_event, record) => {
    if (!record.workspaceId) throw new Error('workspaceId is required.');
    return LocalCRMRepository.save('companies', record);
  });

  safeRegister('companies:update', async (_event, { id, dto }) => {
    if (!dto.workspaceId) throw new Error('workspaceId is required.');
    return LocalCRMRepository.save('companies', { ...dto, id });
  });

  safeRegister('companies:delete', async (_event, { workspaceId, id }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    if (!id) throw new Error('id is required.');
    return LocalCRMRepository.softDelete('companies', workspaceId, id);
  });

  // Contacts
  safeRegister('contacts:list', async (_event, { workspaceId, filter }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    return LocalCRMRepository.findMany('contacts', workspaceId, filter);
  });

  safeRegister('contacts:get', async (_event, { workspaceId, id }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    if (!id) throw new Error('id is required.');
    return LocalCRMRepository.findById('contacts', workspaceId, id);
  });

  safeRegister('contacts:create', async (_event, record) => {
    if (!record.workspaceId) throw new Error('workspaceId is required.');
    return LocalCRMRepository.save('contacts', record);
  });

  safeRegister('contacts:update', async (_event, { id, dto }) => {
    if (!dto.workspaceId) throw new Error('workspaceId is required.');
    return LocalCRMRepository.save('contacts', { ...dto, id });
  });

  safeRegister('contacts:delete', async (_event, { workspaceId, id }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    if (!id) throw new Error('id is required.');
    return LocalCRMRepository.softDelete('contacts', workspaceId, id);
  });

  // Campaigns
  safeRegister('campaigns:list', async (_event, { workspaceId, filter }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    return LocalCRMRepository.findMany('campaigns', workspaceId, filter);
  });

  safeRegister('campaigns:get', async (_event, { workspaceId, id }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    if (!id) throw new Error('id is required.');
    return LocalCRMRepository.findById('campaigns', workspaceId, id);
  });

  safeRegister('campaigns:create', async (_event, record) => {
    if (!record.workspaceId) throw new Error('workspaceId is required.');
    return LocalCRMRepository.save('campaigns', record);
  });

  safeRegister('campaigns:update', async (_event, { id, dto }) => {
    if (!dto.workspaceId) throw new Error('workspaceId is required.');
    return LocalCRMRepository.save('campaigns', { ...dto, id });
  });

  safeRegister('campaigns:delete', async (_event, { workspaceId, id }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    if (!id) throw new Error('id is required.');
    return LocalCRMRepository.softDelete('campaigns', workspaceId, id);
  });

  // Activities log
  safeRegister('activities:list', async (_event, { workspaceId, filter }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    return LocalCRMRepository.findMany('activities', workspaceId, filter);
  });
}

