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
import { getDatabase } from '../database/connection';

/**
 * Registers outreach email accounts, templates, and campaigns scheduling IPC channels.
 */
export function registerOutreachIpc(sdk: SdkClient) {
  // Email Accounts
  safeRegister('email-accounts:list', async () => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');

    const localAccounts = await LocalCRMRepository.findMany('email_accounts', runtime.workspaceId);

    try {
      const remoteList = await sdk.outreach.listAccounts();
      if (Array.isArray(remoteList) && remoteList.length > 0) {
        await LocalCRMRepository.saveMany(
          'email_accounts',
          remoteList.map((item) => ({ ...item, workspaceId: runtime.workspaceId })),
          true
        );
        // Merge local and remote by unique ID
        const map = new Map<string, any>();
        localAccounts.forEach((acc: any) => map.set(acc.id, acc));
        remoteList.forEach((acc: any) => map.set(acc.id, { ...map.get(acc.id), ...acc }));
        return Array.from(map.values());
      }
    } catch (err) {
      console.warn('[IPC] Failed to list accounts from remote, falling back to local cache:', err);
    }

    return localAccounts;
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

  safeRegister('email-accounts:send-test', async (_event, payload) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    return sendTestEmail(sdk, payload);
  });

  safeRegister('email-accounts:test-recipients', async () => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    try {
      return await sdk.outreach.getTestRecipients();
    } catch {
      return [];
    }
  });

  safeRegister('attachments:save', async (_event, { filePath, filename }) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');

    const fs = await import('fs');
    const path = await import('path');
    const { app } = await import('electron');

    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist at path: ${filePath}`);
    }

    const stat = fs.statSync(filePath);
    if (stat.size > 25 * 1024 * 1024) {
      throw new Error(`File size (${(stat.size / 1024 / 1024).toFixed(1)} MB) exceeds 25 MB limit.`);
    }

    const attachmentsDir = path.join(app.getPath('userData'), 'attachments', runtime.workspaceId);
    if (!fs.existsSync(attachmentsDir)) {
      fs.mkdirSync(attachmentsDir, { recursive: true });
    }

    const fileId = require('crypto').randomUUID();
    const safeName = (filename || path.basename(filePath)).replace(/[^a-zA-Z0-9._-]/g, '_');
    const managedPath = path.join(attachmentsDir, `${fileId}_${safeName}`);

    fs.copyFileSync(filePath, managedPath);

    return {
      id: fileId,
      filename: filename || path.basename(filePath),
      size: stat.size,
      storagePath: managedPath
    };
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
              : JSON.stringify(item.variables || []),
          attachments:
            typeof item.attachments === 'string'
              ? item.attachments
              : JSON.stringify(item.attachments || [])
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
      attachments:
        typeof dto.attachments === 'string'
          ? dto.attachments
          : JSON.stringify(dto.attachments || []),
      syncStatus: 'pending'
    };
    await LocalCRMRepository.save('templates', record);
    return {
      ...record,
      variables: typeof record.variables === 'string' ? JSON.parse(record.variables) : record.variables,
      attachments: typeof record.attachments === 'string' ? JSON.parse(record.attachments) : record.attachments
    };
  });

  safeRegister('templates:update', async (_event, { id, dto }) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    if (!id) throw new Error('Template ID is required.');
    const record: any = {
      ...dto,
      id,
      workspaceId: runtime.workspaceId,
      syncStatus: 'pending'
    };
    if (dto.variables !== undefined) {
      record.variables =
        typeof dto.variables === 'string' ? dto.variables : JSON.stringify(dto.variables || []);
    }
    if (dto.attachments !== undefined) {
      record.attachments =
        typeof dto.attachments === 'string'
          ? dto.attachments
          : JSON.stringify(dto.attachments || []);
    }
    await LocalCRMRepository.save('templates', record);
    return {
      ...record,
      variables: typeof record.variables === 'string' ? JSON.parse(record.variables) : (record.variables || []),
      attachments: typeof record.attachments === 'string' ? JSON.parse(record.attachments) : (record.attachments || [])
    };
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

  safeRegister('email-deliveries:list', async (_event, payload) => {
    const targetWsId = payload?.workspaceId || WorkspaceManager.getActiveRuntime()?.workspaceId;
    if (!targetWsId) throw new Error('workspaceId is required.');
    const db = getDatabase(targetWsId);
    let query = `
      SELECT ed.*, c.firstName, c.lastName, c.email as contactEmail, comp.name as companyName, camp.name as campaignName
      FROM email_deliveries ed
      LEFT JOIN contacts c ON ed.contactId = c.id
      LEFT JOIN companies comp ON c.companyId = comp.id
      LEFT JOIN campaigns camp ON ed.campaignId = camp.id
      WHERE ed.workspaceId = ?
    `;
    const params: any[] = [targetWsId];
    if (payload?.campaignId) {
      query += ` AND ed.campaignId = ?`;
      params.push(payload.campaignId);
    }
    if (payload?.contactId) {
      query += ` AND ed.contactId = ?`;
      params.push(payload.contactId);
    }
    if (payload?.status) {
      query += ` AND ed.status = ?`;
      params.push(payload.status);
    }
    query += ` ORDER BY ed.createdAt DESC LIMIT 100`;
    try {
      return db.prepare(query).all(...params);
    } catch {
      return [];
    }
  });
}