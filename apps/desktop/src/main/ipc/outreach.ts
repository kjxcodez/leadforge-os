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
    await LocalCRMRepository.softDeleteFromServer('email_accounts', runtime.workspaceId, id);
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

    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist at path: ${filePath}`);
    }

    const stat = fs.statSync(filePath);
    if (stat.size > 25 * 1024 * 1024) {
      throw new Error(`File size (${(stat.size / 1024 / 1024).toFixed(1)} MB) exceeds 25 MB limit.`);
    }

    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.csv': 'text/csv',
      '.txt': 'text/plain'
    };
    const mimeType = mimeMap[ext] || 'application/octet-stream';
    const safeFilename = filename || path.basename(filePath);

    const sdk = WorkspaceManager.getSdk();
    const connections = await sdk.googleConnections.list().catch(() => []);
    const activeConn = connections.find((c: any) => c.status === 'connected') || connections[0];

    if (!activeConn) {
      throw new Error(
        'No connected Google account found in this workspace. Please connect a Gmail/Google account in Settings before uploading Drive attachments.'
      );
    }

    const createdAttachment = await sdk.attachments.upload({
      googleConnectionId: activeConn.id,
      filename: safeFilename,
      mimeType,
      contentBase64: buffer.toString('base64'),
      metadata: { size: stat.size }
    });

    return {
      id: createdAttachment.id,
      filename: createdAttachment.filename,
      size: createdAttachment.size,
      mimeType: createdAttachment.mimeType,
      provider: createdAttachment.provider,
      fileId: createdAttachment.fileId
    };
  });

  // Templates
  safeRegister('templates:list', async () => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    const localTemplates = await LocalCRMRepository.findMany('templates', runtime.workspaceId);
    try {
      const list = await sdk.outreach.listTemplates();
      if (Array.isArray(list) && list.length > 0) {
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
      }

      const localMap = new Map<string, any>();
      localTemplates.forEach((t: any) => localMap.set(t.id, t));

      const mergedList = (list || []).map((remote: any) => {
        const local = localMap.get(remote.id);
        const remoteAtts = Array.isArray(remote.attachments)
          ? remote.attachments
          : typeof remote.attachments === 'string'
          ? (() => {
              try {
                return JSON.parse(remote.attachments);
              } catch {
                return [];
              }
            })()
          : [];
        const localAtts = Array.isArray(local?.attachments) ? local.attachments : [];
        const attachments = remoteAtts.length > 0 ? remoteAtts : localAtts;
        return { ...local, ...remote, attachments };
      });

      const remoteIds = new Set((list || []).map((t: any) => t.id));
      const localOnly = localTemplates.filter((t: any) => !remoteIds.has(t.id));

      return [...mergedList, ...localOnly];
    } catch (err) {
      console.warn('[IPC] Failed to list templates from remote, falling back to local cache:', err);
      return localTemplates;
    }
  });

  safeRegister('templates:create', async (_event, dto) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    const created = await sdk.outreach.createTemplate(dto);
    const record = {
      ...created,
      workspaceId: runtime.workspaceId,
      variables:
        typeof created.variables === 'string' ? created.variables : JSON.stringify(created.variables || []),
      attachments:
        typeof created.attachments === 'string'
          ? created.attachments
          : JSON.stringify(created.attachments || [])
    };
    await LocalCRMRepository.saveFromServer('templates', record);
    return {
      ...record,
      variables: typeof record.variables === 'string' ? JSON.parse(record.variables) : (record.variables || []),
      attachments: typeof record.attachments === 'string' ? JSON.parse(record.attachments) : (record.attachments || [])
    };
  });

  safeRegister('templates:update', async (_event, { id, dto }) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    if (!id) throw new Error('Template ID is required.');
    const updated = await sdk.outreach.updateTemplate(id, dto);
    const record: any = {
      ...updated,
      id,
      workspaceId: runtime.workspaceId,
      variables:
        typeof updated.variables === 'string' ? updated.variables : JSON.stringify(updated.variables || []),
      attachments:
        typeof updated.attachments === 'string'
          ? updated.attachments
          : JSON.stringify(updated.attachments || [])
    };
    await LocalCRMRepository.saveFromServer('templates', record);
    return {
      ...record,
      variables: typeof record.variables === 'string' ? JSON.parse(record.variables) : (record.variables || []),
      attachments: typeof record.attachments === 'string' ? JSON.parse(record.attachments) : (record.attachments || [])
    };
  });

  safeRegister('templates:delete', async (_event, id) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    await sdk.outreach.deleteTemplate(id);
    await LocalCRMRepository.softDeleteFromServer('templates', runtime.workspaceId, id);
    return { success: true };
  });

  safeRegister('templates:preview', async (_event, { id, contactId }) => {
    return sdk.outreach.previewTemplate(id, contactId);
  });

  safeRegister('email-deliveries:list', async (_event, payload) => {
    const targetWsId = payload?.workspaceId || WorkspaceManager.getActiveRuntime()?.workspaceId;
    if (!targetWsId) throw new Error('workspaceId is required.');

    try {
      const sdk = WorkspaceManager.getSdk();
      const res = await sdk.emailDeliveries.list({
        campaignId: payload?.campaignId,
        sequenceId: payload?.sequenceId,
        status: payload?.status,
        page: payload?.page || 1,
        limit: payload?.limit || 100
      });
      const list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
      return list;
    } catch {
      // Fallback to local cache query if API is temporarily unavailable
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
    }
  });
}