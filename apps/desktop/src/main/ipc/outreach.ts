import { safeRegister } from './helper';
import { SdkClient } from '@leadforge/sdk';
import { shell } from 'electron';
import { WorkspaceManager } from '../lib/workspace-manager';
import { LocalCRMRepository } from '../database/repositories/local-crm';
import {
  connectGmailAccount,
  getOAuthTransactionStatus,
  disconnectGmailAccount,
  reconnectGmailAccount,
  sendTestEmail
} from '../services/email-account-service';

/**
 * Registers outreach email accounts, templates, and campaigns scheduling IPC channels.
 */
export function registerOutreachIpc(sdk: SdkClient) {
  // Email Accounts
  safeRegister('email-accounts:list', async () => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    try {
      const list = await sdk.outreach.listAccounts();
      await LocalCRMRepository.saveMany(
        'email_accounts',
        list.map((item) => ({ ...item, workspaceId: runtime.workspaceId })),
        true
      );
      return list;
    } catch (err) {
      console.warn('[IPC] Failed to list accounts from remote, falling back to local cache:', err);
      return LocalCRMRepository.findMany('email_accounts', runtime.workspaceId);
    }
  });

  safeRegister('email-accounts:delete', async (_event, id) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    await disconnectGmailAccount(sdk, id);
    await LocalCRMRepository.softDelete('email_accounts', runtime.workspaceId, id);
    return { success: true };
  });

  // Initiate Gmail OAuth via API and open external Chrome browser
  safeRegister('email-accounts:gmail:connect', async () => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    const result = await connectGmailAccount(sdk);
    if (result.authorizationUrl) {
      console.log(`[IPC] Opening Google OAuth in Chrome: ${result.authorizationUrl}`);
      await shell.openExternal(result.authorizationUrl);
    }
    return result;
  });

  // Poll status of an OAuth transaction
  safeRegister('email-accounts:gmail:status', async (_event, { transactionId }) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    return getOAuthTransactionStatus(sdk, transactionId);
  });

  safeRegister('email-accounts:gmail:disconnect', async (_event, { id }) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    return disconnectGmailAccount(sdk, id);
  });

  safeRegister('email-accounts:gmail:reconnect', async (_event, { id }) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    const result = await reconnectGmailAccount(sdk, id);
    if (result.authorizationUrl) {
      console.log(`[IPC] Opening Google Reconnect OAuth in Chrome: ${result.authorizationUrl}`);
      await shell.openExternal(result.authorizationUrl);
    }
    return result;
  });

  safeRegister('email-accounts:send-test', async (_event, { id }) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    return sendTestEmail(sdk, id);
  });

  // Templates
  safeRegister('templates:list', async () => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    try {
      const list = await sdk.outreach.listTemplates();
      await LocalCRMRepository.saveMany(
        'templates',
        list.map((item) => ({
          ...item,
          workspaceId: runtime.workspaceId,
          variables:
            typeof item.variables === 'string'
              ? item.variables
              : JSON.stringify(item.variables || [])
        })),
        true
      );
      return list;
    } catch (err) {
      console.warn('[IPC] Failed to list templates from remote, falling back to local cache:', err);
      return LocalCRMRepository.findMany('templates', runtime.workspaceId);
    }
  });

  safeRegister('templates:create', async (_event, dto) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    const id = dto.id || require('crypto').randomUUID();
    const record = {
      ...dto,
      id,
      workspaceId: runtime.workspaceId,
      variables:
        typeof dto.variables === 'string' ? dto.variables : JSON.stringify(dto.variables || []),
      syncStatus: 'pending'
    };
    await LocalCRMRepository.save('templates', record);
    return record;
  });

  safeRegister('templates:delete', async (_event, id) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    await LocalCRMRepository.softDelete('templates', runtime.workspaceId, id);
    return { success: true };
  });

  safeRegister('templates:preview', async (_event, { id, contactId }) => {
    return sdk.outreach.previewTemplate(id, contactId);
  });

  // Campaigns scheduling trigger
  safeRegister('campaigns:schedule', async (_event, id) => {
    return sdk.campaigns.schedule(id);
  });
}