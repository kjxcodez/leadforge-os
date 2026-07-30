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

    // Encrypt password before storing in global settings
    const encryptedPassword = encryptSecret(dto.password);

    const db = getDatabase(runtime.workspaceId);
    
    // Save to settings table
    const saveSetting = db.prepare(`
      INSERT INTO settings (key, value, workspaceId, updatedAt)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(key, workspaceId) DO UPDATE SET value = excluded.value, updatedAt = datetime('now')
    `);

    db.transaction(() => {
      saveSetting.run('smtp.host', 'smtp.gmail.com', runtime.workspaceId);
      saveSetting.run('smtp.port', '465', runtime.workspaceId);
      saveSetting.run('smtp.secure', 'true', runtime.workspaceId);
      saveSetting.run('smtp.username', dto.email, runtime.workspaceId);
      saveSetting.run('smtp.password', encryptedPassword, runtime.workspaceId);

      saveSetting.run('imap.host', 'imap.gmail.com', runtime.workspaceId);
      saveSetting.run('imap.port', '993', runtime.workspaceId);
      saveSetting.run('imap.secure', 'true', runtime.workspaceId);
      saveSetting.run('imap.username', dto.email, runtime.workspaceId);
      saveSetting.run('imap.password', encryptedPassword, runtime.workspaceId);
    })();

    // Remove password from cached email_accounts record
    const cleanDto = { ...dto };
    delete cleanDto.password;

    const record = { ...cleanDto, id, workspaceId: runtime.workspaceId, status: 'unverified', syncStatus: 'pending' };
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
    
    // Load SMTP settings from settings table
    const rows = db.prepare(`SELECT key, value FROM settings WHERE workspaceId = ?`).all(runtime.workspaceId) as { key: string; value: string }[];
    const settings = new Map<string, string>();
    for (const row of rows) {
      if (row.key) settings.set(row.key, row.value);
    }

    const host = settings.get('smtp.host') || settings.get('smtpHost') || settings.get('host');
    const portStr = settings.get('smtp.port') || settings.get('smtpPort') || settings.get('port');
    const secureStr = settings.get('smtp.secure') || settings.get('smtpSecure') || settings.get('secure');
    const username = settings.get('smtp.username') || settings.get('smtp.user') || settings.get('smtpUsername') || settings.get('username');
    const encryptedPassword = settings.get('smtp.password') || settings.get('smtp.pass') || settings.get('smtpPassword') || settings.get('password');

    if (!host || !username || !encryptedPassword) {
      throw new Error(
        'Incomplete SMTP configuration in settings. ' +
        'Please verify smtp.host, smtp.username, and smtp.password are configured.'
      );
    }

    // Decrypt password
    const password = decryptSecret(encryptedPassword);

    const port = portStr ? parseInt(portStr, 10) : 465;
    const secure = secureStr !== undefined ? secureStr === 'true' : port === 465;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: username,
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
