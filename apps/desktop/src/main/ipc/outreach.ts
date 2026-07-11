import { safeRegister } from './helper';
import { SdkClient } from '@leadforge/sdk';

/**
 * Registers outreach email accounts, templates, and campaigns scheduling IPC channels.
 */
export function registerOutreachIpc(sdk: SdkClient) {
  // Email Accounts
  safeRegister('email-accounts:list', async () => {
    return sdk.outreach.listAccounts();
  });

  safeRegister('email-accounts:create', async (_event, dto) => {
    return sdk.outreach.createAccount(dto);
  });

  safeRegister('email-accounts:delete', async (_event, id) => {
    return sdk.outreach.deleteAccount(id);
  });

  safeRegister('email-accounts:test', async (_event, id) => {
    return sdk.outreach.verifyAccount(id);
  });

  // Templates
  safeRegister('templates:list', async () => {
    return sdk.outreach.listTemplates();
  });

  safeRegister('templates:create', async (_event, dto) => {
    return sdk.outreach.createTemplate(dto);
  });

  safeRegister('templates:delete', async (_event, id) => {
    return sdk.outreach.deleteTemplate(id);
  });

  safeRegister('templates:preview', async (_event, { id, contactId }) => {
    return sdk.outreach.previewTemplate(id, contactId);
  });

  // Campaigns scheduling trigger
  safeRegister('campaigns:schedule', async (_event, id) => {
    return sdk.campaigns.schedule(id);
  });
}
