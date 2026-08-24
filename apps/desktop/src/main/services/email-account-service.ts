import { getDatabase } from '../database/connection';
import type { SdkClient } from '@leadforge/sdk';

export interface EmailAccountRow {
  id: string;
  workspaceId: string;
  name: string;
  email: string;
  provider: string;
  status: string;
  dailyLimit: number;
  hourlyLimit: number;
  dailySent: number;
  hourlySent: number;
  signature?: string | null;
  lastVerifiedAt?: string | null;
  lastError?: string | null;
  googleAccountId?: string | null;
}

/**
 * Loads a safe email account row from local SQLite cache.
 */
export function loadEmailAccount(
  workspaceId: string,
  id: string
): EmailAccountRow | null {
  const db = getDatabase(workspaceId);
  return (db
    .prepare(
      `SELECT id, workspaceId, name, email, provider, status, dailyLimit, hourlyLimit, dailySent, hourlySent, signature, lastVerifiedAt, lastError, googleAccountId FROM email_accounts WHERE id = ? AND workspaceId = ? AND deletedAt IS NULL`
    )
    .get(id, workspaceId) as EmailAccountRow) || null;
}

/**
 * Initiates a server-owned Gmail OAuth connection transaction via API SDK.
 */
export async function connectGmailAccount(
  sdk: SdkClient
): Promise<{ transactionId: string; authorizationUrl: string }> {
  return sdk.outreach.connectGmail();
}

/**
 * Polls the status of an OAuth connection transaction.
 */
export async function getOAuthTransactionStatus(
  sdk: SdkClient,
  transactionId: string
): Promise<{ status: string; emailAccountId?: string; account?: any; error?: string }> {
  return sdk.outreach.getOAuthStatus(transactionId);
}

/**
 * Re-initiates Gmail OAuth authorization for an existing account via API SDK.
 */
export async function reconnectGmailAccount(
  sdk: SdkClient,
  id: string
): Promise<{ transactionId: string; authorizationUrl: string }> {
  return sdk.outreach.reconnectGmail(id);
}

/**
 * Disconnects a Gmail mailbox remotely via API SDK.
 */
export async function disconnectGmailAccount(
  sdk: SdkClient,
  id: string
): Promise<{ success: boolean }> {
  return sdk.outreach.disconnectAccount(id);
}

export async function sendTestEmail(
  sdk: SdkClient,
  payload: {
    id: string;
    to: string;
    useSignature?: boolean;
    attachments?: Array<{
      filename: string;
      contentBase64?: string;
      path?: string;
      contentType?: string;
      size?: number;
    }>;
  }
): Promise<{ sent: boolean; messageId?: string; sentTo?: string }> {
  const processedAttachments: Array<{
    filename: string;
    contentBase64?: string;
    path?: string;
    contentType?: string;
    size?: number;
  }> = [];
  if (Array.isArray(payload.attachments)) {
    const fs = await import('fs');
    for (const att of payload.attachments) {
      let contentBase64 = att.contentBase64 || '';
      if (!contentBase64 && att.path) {
        if (fs.existsSync(att.path)) {
          try {
            contentBase64 = fs.readFileSync(att.path).toString('base64');
          } catch {
            // Error handling below
          }
        }
      }
      if (!contentBase64) {
        throw new Error(`Unable to read "${att.filename || 'attachment'}". Please remove and attach the file again.`);
      }
      const item: any = { filename: att.filename, contentBase64 };
      if (att.contentType) item.contentType = att.contentType;
      if (att.size) item.size = att.size;
      processedAttachments.push(item);
    }
  }

  const sendOpts: any = {
    to: payload.to,
    attachments: processedAttachments
  };
  if (payload.useSignature !== undefined) {
    sendOpts.useSignature = payload.useSignature;
  }

  const res = await sdk.outreach.sendTestEmail(payload.id, sendOpts);
  return { sent: true, messageId: res.messageId, sentTo: res.sentTo };
}