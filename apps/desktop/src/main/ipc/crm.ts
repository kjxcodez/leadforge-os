import { safeRegister } from './helper';
import { SdkClient } from '@leadforge/sdk';

/**
 * Registers CRM entities (companies, contacts, campaigns, activities) IPC channels.
 */
export function registerCrmIpc(sdk: SdkClient) {
  // Companies
  safeRegister('companies:list', async (_event, filters) => {
    return sdk.companies.list(filters);
  });

  safeRegister('companies:get', async (_event, id) => {
    return sdk.companies.get(id);
  });

  safeRegister('companies:create', async (_event, dto) => {
    return sdk.companies.create(dto);
  });

  safeRegister('companies:update', async (_event, { id, dto }) => {
    return sdk.companies.update(id, dto);
  });

  safeRegister('companies:delete', async (_event, id) => {
    return sdk.companies.delete(id);
  });

  // Contacts
  safeRegister('contacts:list', async (_event, filters) => {
    return sdk.contacts.list(filters);
  });

  safeRegister('contacts:get', async (_event, id) => {
    return sdk.contacts.get(id);
  });

  safeRegister('contacts:create', async (_event, dto) => {
    return sdk.contacts.create(dto);
  });

  safeRegister('contacts:update', async (_event, { id, dto }) => {
    return sdk.contacts.update(id, dto);
  });

  safeRegister('contacts:delete', async (_event, id) => {
    return sdk.contacts.delete(id);
  });

  // Campaigns
  safeRegister('campaigns:list', async (_event, filters) => {
    return sdk.campaigns.list(filters);
  });

  safeRegister('campaigns:get', async (_event, id) => {
    return sdk.campaigns.get(id);
  });

  safeRegister('campaigns:create', async (_event, dto) => {
    return sdk.campaigns.create(dto);
  });

  safeRegister('campaigns:update', async (_event, { id, dto }) => {
    return sdk.campaigns.update(id, dto);
  });

  safeRegister('campaigns:delete', async (_event, id) => {
    return sdk.campaigns.delete(id);
  });

  // Activities log
  safeRegister('activities:list', async (_event, filters) => {
    return sdk.activities.list(filters);
  });
}
