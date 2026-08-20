import { safeRegister } from './helper';
import { SdkClient } from '@leadforge/sdk';
import { WorkspaceManager } from '../lib/workspace-manager';
import { LocalCRMRepository } from '../database/repositories/local-crm';
import { encryptSecret } from '../lib/crypto';
import {
  connectGmailAccount,
  disconnectGmailAccount,
  reconnectGmailAccount,
  sendTestEmail,
  verifyEmailAccount
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

  safeRegister('email-accounts:create', async (_event, dto) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');

    const isOAuth = dto.provider === 'gmail_oauth' || !!dto.refreshToken;

    if (!dto.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dto.email)) {
      throw new Error('A valid email address is required.');
    }
    if (!isOAuth && (!dto.password || dto.password.trim().length < 6)) {
      throw new Error('A valid SMTP app password is required (minimum 6 characters).');
    }

    const id = dto.id || require('crypto').randomUUID();

    // Encrypt credentials before storing
    const cleanDto = { ...dto };
    delete cleanDto.password;

    const record: any = {
      ...cleanDto,
      id,
      workspaceId: runtime.workspaceId,
      status: isOAuth ? 'connected' : 'unverified',
      syncStatus: 'pending'
    };

    if (isOAuth) {
      if (dto.refreshToken) record.refreshToken = encryptSecret(dto.refreshToken);
      if (dto.accessToken) record.accessToken = encryptSecret(dto.accessToken);
      if (dto.tokenExpiresAt) record.tokenExpiresAt = dto.tokenExpiresAt;
      if (dto.googleAccountId) record.googleAccountId = dto.googleAccountId;
    } else {
      const encryptedPassword = encryptSecret(dto.password);
      // Store credentials directly on the account record (authoritative configuration)
      record.smtpHost = 'smtp.gmail.com';
      record.smtpPort = 465;
      record.smtpSecure = 'true';
      record.smtpUsername = dto.email;
      record.smtpPassword = encryptedPassword;

      record.imapHost = 'imap.gmail.com';
      record.imapPort = 993;
      record.imapSecure = 'true';
      record.imapUsername = dto.email;
      record.imapPassword = encryptedPassword;
    }

    await LocalCRMRepository.save('email_accounts', record);
    return record;
  });

  safeRegister('email-accounts:delete', async (_event, id) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    await LocalCRMRepository.softDelete('email_accounts', runtime.workspaceId, id);
    return { success: true };
  });

  safeRegister('email-accounts:test', async (_event, id) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    const result = await verifyEmailAccount(runtime.workspaceId, id);
    return result;
  });

  safeRegister('email-accounts:gmail:connect', async (_event, options) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    return connectGmailAccount(sdk, runtime.workspaceId, options || {});
  });

  safeRegister('email-accounts:gmail:disconnect', async (_event, { id }) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    return disconnectGmailAccount(sdk, runtime.workspaceId, id);
  });

  safeRegister('email-accounts:gmail:reconnect', async (_event, { id, ...options }) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    return reconnectGmailAccount(sdk, runtime.workspaceId, id, options || {});
  });

  safeRegister('email-accounts:send-test', async (_event, { id }) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    return sendTestEmail(runtime.workspaceId, id);
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