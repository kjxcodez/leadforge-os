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

/**
 * Sends a test email through the server-side API EmailService.
 */
export async function sendTestEmail(
  sdk: SdkClient,
  id: string
): Promise<{ sent: boolean; messageId?: string }> {
  const res = await sdk.outreach.sendTestEmail(id);
  return { sent: true, messageId: res.messageId };
}