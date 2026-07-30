import { safeRegister } from './helper';
import { SdkClient } from '@leadforge/sdk';
import { WorkspaceManager } from '../lib/workspace-manager';
import { LocalCRMRepository } from '../database/repositories/local-crm';
import { getDatabase } from '../database/connection';
import { encryptSecret, decryptSecret } from '../lib/crypto';
import nodemailer from 'nodemailer';

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
      await LocalCRMRepository.saveMany('email_accounts', list.map(item => ({ ...item, workspaceId: runtime.workspaceId })), true);
      return list;
    } catch (err) {
      console.warn('[IPC] Failed to list accounts from remote, falling back to local cache:', err);
      return LocalCRMRepository.findMany('email_accounts', runtime.workspaceId);
    }
  });

  safeRegister('email-accounts:create', async (_event, dto) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');

    // Field Validations
    if (!dto.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dto.email)) {
      throw new Error('A valid email address is required.');
    }
    if (!dto.password || dto.password.trim().length < 6) {
      throw new Error('A valid SMTP app password is required (minimum 6 characters).');
    }

    const id = dto.id || require('crypto').randomUUID();

    // Encrypt password before storing
    const encryptedPassword = encryptSecret(dto.password);

    // Remove plain password
    const cleanDto = { ...dto };
    delete cleanDto.password;

    const record = {
      ...cleanDto,
      id,
      workspaceId: runtime.workspaceId,
      status: 'unverified',
      syncStatus: 'pending',
      
      // Store credentials directly on the account record (authoritative configuration)
      smtpHost: 'smtp.gmail.com',
      smtpPort: 465,
      smtpSecure: 'true',
      smtpUsername: dto.email,
      smtpPassword: encryptedPassword,
      
      imapHost: 'imap.gmail.com',
      imapPort: 993,
      imapSecure: 'true',
      imapUsername: dto.email,
      imapPassword: encryptedPassword,
    };

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

    const db = getDatabase(runtime.workspaceId);
    
    // Load SMTP settings directly from the target email_accounts row
    const account = db.prepare(`
      SELECT smtpHost, smtpPort, smtpSecure, smtpUsername, smtpPassword
      FROM email_accounts
      WHERE id = ? AND workspaceId = ? AND deletedAt IS NULL
    `).get(id, runtime.workspaceId) as any;

    if (!account || !account.smtpHost || !account.smtpUsername || !account.smtpPassword) {
      throw new Error(
        'Incomplete SMTP configuration for the selected email account. ' +
        'Please verify smtpHost, smtpUsername, and smtpPassword are configured.'
      );
    }

    // Decrypt password
    const password = decryptSecret(account.smtpPassword);

    const port = account.smtpPort ? parseInt(account.smtpPort, 10) : 465;
    const secure = account.smtpSecure !== undefined ? account.smtpSecure === 'true' : port === 465;

    const transporter = nodemailer.createTransport({
      host: account.smtpHost,
      port,
      secure,
      auth: {
        user: account.smtpUsername,
        pass: password,
      },
      connectionTimeout: 8000,
    });

    try {
      await transporter.verify();
      transporter.close();
      
      // Update local cache status to connected
      db.prepare(`
        UPDATE email_accounts
        SET status = 'connected', updatedAt = datetime('now')
        WHERE id = ? AND workspaceId = ?
      `).run(id, runtime.workspaceId);
      
      return { success: true, message: 'SMTP connection verified successfully.' };
    } catch (err: any) {
      transporter.close();
      
      // Update local cache status to error
      db.prepare(`
        UPDATE email_accounts
        SET status = 'error', updatedAt = datetime('now')
        WHERE id = ? AND workspaceId = ?
      `).run(id, runtime.workspaceId);

      throw new Error(`SMTP connection check failed: ${err.message || err}`);
    }
  });

  // Templates
  safeRegister('templates:list', async () => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    try {
      const list = await sdk.outreach.listTemplates();
      await LocalCRMRepository.saveMany('templates', list.map(item => ({
        ...item,
        workspaceId: runtime.workspaceId,
        variables: typeof item.variables === 'string' ? item.variables : JSON.stringify(item.variables || [])
      })), true);
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
      variables: typeof dto.variables === 'string' ? dto.variables : JSON.stringify(dto.variables || []),
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
