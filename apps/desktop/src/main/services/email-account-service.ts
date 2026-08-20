import { getDatabase } from '../database/connection';
import { LocalCRMRepository } from '../database/repositories/local-crm';
import { encryptSecret, decryptSecret } from '../lib/crypto';
import { randomUUID } from 'crypto';
import { AppLogger } from '../lib/logger';
import {
  performGmailOAuth,
  getGmailOAuthConfig,
  GoogleOAuthClient,
  GmailApiClient,
  type GmailTokens,
  GMAIL_SEND_SCOPE
} from '../gmail';
import {
  createMailProvider,
  resolveProviderKind,
  isReauthError,
  type MailProviderResolution
} from '../mail';
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
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpSecure?: string | null;
  smtpUsername?: string | null;
  smtpPassword?: string | null;
  refreshToken?: string | null;
  accessToken?: string | null;
  tokenExpiresAt?: string | null;
  googleAccountId?: string | null;
}

export interface ConnectGmailOptions {
  name?: string;
  dailyLimit?: number;
  hourlyLimit?: number;
  signature?: string;
}

/**
 * Loads a full email account row (including encrypted credentials).
 */
export function loadEmailAccount(
  workspaceId: string,
  id: string
): EmailAccountRow | null {
  const db = getDatabase(workspaceId);
  return (db
    .prepare(
      `SELECT * FROM email_accounts WHERE id = ? AND workspaceId = ? AND deletedAt IS NULL`
    )
    .get(id, workspaceId) as EmailAccountRow) || null;
}

/**
 * Builds a normalized provider resolution from a stored account row so the
 * mail factory can construct the correct transport.
 */
export function buildProviderResolution(account: EmailAccountRow): MailProviderResolution {
  const kind = resolveProviderKind(account);
  if (kind === 'gmail_oauth') {
    const config = getGmailOAuthConfig();
    const gmail: MailProviderResolution['gmail'] = {
      user: account.email,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      refreshToken: decryptSecret(account.refreshToken || ''),
      accessToken: decryptSecret(account.accessToken || '')
    };
    if (account.tokenExpiresAt) gmail.tokenExpiresAt = account.tokenExpiresAt;
    return { kind, gmail };
  }
  const port = account.smtpPort ? Number(account.smtpPort) : 465;
  return {
    kind: 'smtp',
    smtp: {
      host: account.smtpHost || 'smtp.gmail.com',
      port,
      secure: account.smtpSecure !== undefined ? account.smtpSecure === 'true' : port === 465,
      username: account.smtpUsername || account.email,
      password: decryptSecret(account.smtpPassword || '')
    }
  };
}

function updateLocalStatus(workspaceId: string, id: string, status: string, lastError?: string | null): void {
  const db = getDatabase(workspaceId);
  db.prepare(
    `UPDATE email_accounts SET status = ?, lastError = ?, updatedAt = datetime('now') WHERE id = ? AND workspaceId = ?`
  ).run(status, lastError ?? null, id, workspaceId);
}

/**
 * Connects a Gmail mailbox via Google OAuth 2.0 and stores the encrypted
 * refresh/access credentials. The record is written locally and queued for
 * sync to the API (see SyncEngine.resolveSdkModule for token decryption).
 */
export async function connectGmailAccount(
  sdk: SdkClient,
  workspaceId: string,
  options: ConnectGmailOptions = {}
): Promise<EmailAccountRow> {
  const config = getGmailOAuthConfig();
  const result = await performGmailOAuth({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectPort: config.redirectPort
  });

  if (!result.ok || !result.tokens) {
    throw new Error(result.error || 'Gmail connection failed.');
  }

  const email = result.email || '';
  if (!email) {
    throw new Error('Google did not return the Gmail account email address.');
  }

  const name = options.name || email.split('@')[0] || 'Gmail';

  const record: EmailAccountRow = {
    id: randomUUID(),
    workspaceId,
    name,
    email,
    provider: 'gmail_oauth',
    status: 'connected',
    dailyLimit: options.dailyLimit || 200,
    hourlyLimit: options.hourlyLimit || 50,
    dailySent: 0,
    hourlySent: 0,
    signature: options.signature || '',
    lastVerifiedAt: new Date().toISOString(),
    lastError: null,
    refreshToken: encryptSecret(result.tokens.refreshToken),
    accessToken: encryptSecret(result.tokens.accessToken),
    tokenExpiresAt: result.tokens.tokenExpiresAt,
    googleAccountId: result.googleAccountId || null,
    syncStatus: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  } as any;

  await LocalCRMRepository.save('email_accounts', record);

  AppLogger.info(
    'EmailAccount',
    `Gmail OAuth account connected for ${email} (scopes: ${GMAIL_SEND_SCOPE})`
  );

  return record;
}

/**
 * Disconnects a Gmail mailbox: revokes the Google refresh token (if present),
 * marks the account disconnected locally, and mirrors the state to the API.
 */
export async function disconnectGmailAccount(
  sdk: SdkClient,
  workspaceId: string,
  id: string
): Promise<{ success: boolean }> {
  const account = loadEmailAccount(workspaceId, id);
  if (account && account.provider === 'gmail_oauth' && account.refreshToken) {
    const config = getGmailOAuthConfig();
    try {
      const oauth = new GoogleOAuthClient({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri: `http://127.0.0.1:${config.redirectPort}/oauth2callback`
      });
      await oauth.revokeRefreshToken(decryptSecret(account.refreshToken));
    } catch (err) {
      AppLogger.warn('EmailAccount', `Token revocation failed (continuing disconnect): ${(err as Error).message}`);
    }
  }

  const db = getDatabase(workspaceId);
  db.prepare(
    `UPDATE email_accounts SET status = 'disconnected', accessToken = NULL, tokenExpiresAt = NULL, updatedAt = datetime('now') WHERE id = ? AND workspaceId = ?`
  ).run(id, workspaceId);

  try {
    await sdk.outreach.disconnectAccount(id);
  } catch (err) {
    AppLogger.warn('EmailAccount', `Remote disconnect failed (local state kept): ${(err as Error).message}`);
  }

  return { success: true };
}

/**
 * Re-runs the Gmail OAuth flow for an existing account and replaces the stored
 * tokens, restoring it to 'connected' locally and remotely.
 */
export async function reconnectGmailAccount(
  sdk: SdkClient,
  workspaceId: string,
  id: string,
  options: ConnectGmailOptions = {}
): Promise<EmailAccountRow> {
  const existing = loadEmailAccount(workspaceId, id);
  if (!existing) throw new Error('Email account not found.');

  const config = getGmailOAuthConfig();
  const result = await performGmailOAuth({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectPort: config.redirectPort
  });

  if (!result.ok || !result.tokens) {
    throw new Error(result.error || 'Gmail reconnection failed.');
  }

  const db = getDatabase(workspaceId);
  const email = result.email || existing.email;
  const name = options.name || existing.name || email.split('@')[0] || 'Gmail';

  db.prepare(
    `
    UPDATE email_accounts
    SET name = ?, email = ?, status = 'connected', lastError = NULL,
        refreshToken = ?, accessToken = ?, tokenExpiresAt = ?, googleAccountId = ?,
        lastVerifiedAt = ?, updatedAt = datetime('now')
    WHERE id = ? AND workspaceId = ?
  `
  ).run(
    name,
    email,
    encryptSecret(result.tokens.refreshToken),
    encryptSecret(result.tokens.accessToken),
    result.tokens.tokenExpiresAt,
    result.googleAccountId || null,
    new Date().toISOString(),
    id,
    workspaceId
  );

  if (options.signature !== undefined) {
    db.prepare(`UPDATE email_accounts SET signature = ? WHERE id = ? AND workspaceId = ?`).run(
      options.signature,
      id,
      workspaceId
    );
  }
  if (options.dailyLimit) {
    db.prepare(`UPDATE email_accounts SET dailyLimit = ? WHERE id = ? AND workspaceId = ?`).run(
      options.dailyLimit,
      id,
      workspaceId
    );
  }
  if (options.hourlyLimit) {
    db.prepare(`UPDATE email_accounts SET hourlyLimit = ? WHERE id = ? AND workspaceId = ?`).run(
      options.hourlyLimit,
      id,
      workspaceId
    );
  }

  // Sync metadata (not credentials) to the API.
  // The desktop manages its own encrypted credential store (SQLite + AES).
  // We deliberately do NOT send refreshToken or accessToken over the network.
  try {
    const metaPayload: Parameters<typeof sdk.outreach.syncAccountMeta>[1] = {
      provider: 'gmail_oauth',
      name,
      email,
      status: 'connected'
    };
    if (result.googleAccountId) metaPayload.googleAccountId = result.googleAccountId;
    if (options.signature !== undefined) metaPayload.signature = options.signature;
    if (options.dailyLimit) metaPayload.dailyLimit = options.dailyLimit;
    if (options.hourlyLimit) metaPayload.hourlyLimit = options.hourlyLimit;
    await sdk.outreach.syncAccountMeta(id, metaPayload);
  } catch (err) {
    AppLogger.warn('EmailAccount', `Remote metadata sync failed (local state kept): ${(err as Error).message}`);
  }

  return loadEmailAccount(workspaceId, id) as EmailAccountRow;
}

/**
 * Sends a test email through the account's provider abstraction. For Gmail
 * OAuth accounts the token is refreshed automatically if expired. On a token
 * expiry/revocation the account is marked `reauth_required`.
 */
export async function sendTestEmail(
  workspaceId: string,
  id: string
): Promise<{ sent: boolean; messageId?: string }> {
  const account = loadEmailAccount(workspaceId, id);
  if (!account) throw new Error('Email account not found.');

  const provider = createMailProvider(buildProviderResolution(account));
  try {
    await provider.verify();
    const result = await provider.send({
      from: `"${account.name}" <${account.email}>`,
      to: account.email,
      subject: `LeadForge OS test email (${new Date().toISOString()})`,
      text: `This is a test email from LeadForge OS. If you received this, the mailbox connection is working.`
    });
    updateLocalStatus(workspaceId, id, 'connected', null);
    return { sent: true, messageId: result.messageId };
  } catch (err) {
    if (isReauthError(err)) {
      updateLocalStatus(workspaceId, id, 'reauth_required', (err as Error).message);
    } else {
      updateLocalStatus(workspaceId, id, 'failed', (err as Error).message);
    }
    throw err;
  } finally {
    provider.close();
  }
}

/**
 * Verifies a mailbox connection through its provider abstraction.
 */
export async function verifyEmailAccount(
  workspaceId: string,
  id: string
): Promise<{ verified: boolean }> {
  const account = loadEmailAccount(workspaceId, id);
  if (!account) throw new Error('Email account not found.');

  const provider = createMailProvider(buildProviderResolution(account));
  try {
    await provider.verify();
    updateLocalStatus(workspaceId, id, 'connected', null);
    return { verified: true };
  } catch (err) {
    if (isReauthError(err)) {
      updateLocalStatus(workspaceId, id, 'reauth_required', (err as Error).message);
    } else {
      updateLocalStatus(workspaceId, id, 'failed', (err as Error).message);
    }
    throw new Error((err as Error).message);
  } finally {
    provider.close();
  }
}

/**
 * Ensures a fresh access token for an account, refreshing it if needed.
 * Used by non-worker flows. Returns the access token and its expiry.
 */
export async function getFreshAccessToken(
  workspaceId: string,
  id: string
): Promise<{ accessToken: string; tokenExpiresAt: string | null }> {
  const account = loadEmailAccount(workspaceId, id);
  if (!account) throw new Error('Email account not found.');
  if (account.provider !== 'gmail_oauth') {
    throw new Error('Account is not a Gmail OAuth mailbox.');
  }

  const config = getGmailOAuthConfig();
  const gmailTokens: GmailTokens = { refreshToken: decryptSecret(account.refreshToken || '') };
    if (account.accessToken) gmailTokens.accessToken = decryptSecret(account.accessToken);
    if (account.tokenExpiresAt) gmailTokens.tokenExpiresAt = account.tokenExpiresAt;
    const client = new GmailApiClient(
      new GoogleOAuthClient({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri: `http://127.0.0.1:${config.redirectPort}/oauth2callback`
      }),
      gmailTokens
    );

  const result = await client.getAccessToken();
  if (result.tokenExpiresAt) {
    const db = getDatabase(workspaceId);
    db.prepare(`UPDATE email_accounts SET accessToken = ?, tokenExpiresAt = ? WHERE id = ?`).run(
      encryptSecret(result.accessToken),
      result.tokenExpiresAt,
      id
    );
  }
  return result;
}