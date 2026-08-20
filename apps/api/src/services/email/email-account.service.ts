import { randomUUID, randomBytes, createHash } from 'crypto';
import { EmailAccountModel } from '../../db/models/email-account.model.js';
import { OAuthTransactionModel } from '../../db/models/oauth-transaction.model.js';
import { encrypt, decrypt } from '../../utils/encryption.js';
import { env } from '../../config/index.js';
import { EmailDomainError, type SafeEmailAccount } from './types.js';
import {
  getServerGmailOAuthClient,
  type GoogleOAuthClient
} from './providers/google-oauth.js';
import {
  GmailProvider,
  type GmailProviderConfig
} from './providers/gmail-provider.js';
import type { EmailProvider } from './providers/types.js';

/**
 * EmailAccountService owns mailbox lifecycle and OAuth credential handling:
 * server-side OAuth transactions (PKCE state/code exchange), reconnect, disconnect,
 * lookup, list, and health. It never exposes raw tokens — it returns only
 * `SafeEmailAccount` objects.
 */
export class EmailAccountService {
  constructor(private readonly workspaceId: string) {}

  // ── Queries ──────────────────────────────────────────────────────────────

  async listAccounts(): Promise<SafeEmailAccount[]> {
    const accounts = await EmailAccountModel.find({
      workspaceId: this.workspaceId
    } as any).sort({ createdAt: -1 });
    return accounts.map((a) => sanitize(a.toObject()));
  }

  async getAccount(id: string): Promise<SafeEmailAccount> {
    const account = await this.findAccount(id);
    return sanitize(account.toObject());
  }

  // ── Server-Side OAuth Transaction Lifecycle ──────────────────────────────

  /**
   * Initiates a short-lived Gmail OAuth transaction on the server.
   * Generates state & codeVerifier PKCE tokens, creates an OAuthTransaction record,
   * builds the Google authorization URL, and returns transactionId + authorizationUrl.
   */
  async initiateGmailOAuth(
    userId: string,
    callbackRedirectUri?: string
  ): Promise<{ transactionId: string; authorizationUrl: string }> {
    const transactionId = randomUUID();
    const state = randomBytes(32).toString('hex');
    const codeVerifier = randomBytes(32).toString('hex');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

    const baseUrl = env.BETTER_AUTH_URL.replace(/\/auth\/?$/, '');
    const redirectUri = callbackRedirectUri || `${baseUrl}/email/accounts/gmail/oauth/callback`;

    const oauth = this.buildOAuthClient(redirectUri);
    const authorizationUrl = oauth.buildAuthUrl(state, codeChallenge);

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minute TTL

    await OAuthTransactionModel.create({
      transactionId,
      workspaceId: this.workspaceId,
      userId,
      state,
      codeVerifier,
      provider: 'gmail',
      status: 'pending',
      expiresAt
    });

    return { transactionId, authorizationUrl };
  }

  /**
   * Handles the Google OAuth redirect callback on the API.
   * Exchanges the authorization code for tokens using server-side client credentials,
   * encrypts & saves the tokens in MongoDB, and marks the transaction completed.
   */
  static async handleGmailOAuthCallback(
    code: string,
    state: string
  ): Promise<{ transactionId: string; account: SafeEmailAccount }> {
    const transaction = await OAuthTransactionModel.findOne({ state });
    if (!transaction) {
      throw new EmailDomainError('GMAIL_OAUTH_FAILED', 'Invalid or expired OAuth state token.');
    }
    if (transaction.status === 'completed' && transaction.emailAccountId) {
      const accountService = new EmailAccountService(transaction.workspaceId);
      const account = await accountService.getAccount(transaction.emailAccountId);
      return { transactionId: transaction.transactionId, account };
    }

    const baseUrl = env.BETTER_AUTH_URL.replace(/\/auth\/?$/, '');
    const redirectUri = `${baseUrl}/email/accounts/gmail/oauth/callback`;

    const accountService = new EmailAccountService(transaction.workspaceId);
    const oauth = accountService.buildOAuthClient(redirectUri);

    try {
      const tokens = await oauth.exchangeCodeForTokens(code, transaction.codeVerifier);
      if (!tokens.refreshToken) {
        throw new EmailDomainError(
          'GMAIL_OAUTH_FAILED',
          'Google did not return a refresh token. Please re-consent.'
        );
      }

      const info = await oauth.getTokenInfo(tokens.accessToken);
      const email = info.email;
      if (!email) {
        throw new EmailDomainError('GMAIL_OAUTH_FAILED', 'Google did not return the authorized email address.');
      }

      const tokenExpiresAt = new Date(Date.now() + tokens.expiresIn * 1000);
      const existing = await EmailAccountModel.findOne({
        workspaceId: transaction.workspaceId,
        email: email.toLowerCase()
      } as any);

      let accountDoc: any;
      if (existing) {
        existing.provider = 'gmail_oauth';
        existing.status = 'connected';
        existing.encryptedRefreshToken = encrypt(tokens.refreshToken);
        existing.encryptedAccessToken = encrypt(tokens.accessToken);
        existing.tokenExpiresAt = tokenExpiresAt;
        existing.googleAccountId = info.sub || existing.googleAccountId || null;
        existing.lastVerifiedAt = new Date();
        existing.lastError = null;
        await existing.save();
        accountDoc = existing;
      } else {
        accountDoc = await EmailAccountModel.create({
          workspaceId: transaction.workspaceId as any,
          name: email.split('@')[0] || 'Gmail',
          email: email.toLowerCase(),
          provider: 'gmail_oauth',
          status: 'connected',
          isDefault: false,
          dailyLimit: 200,
          hourlyLimit: 50,
          encryptedRefreshToken: encrypt(tokens.refreshToken),
          encryptedAccessToken: encrypt(tokens.accessToken),
          tokenExpiresAt,
          googleAccountId: info.sub || null,
          lastVerifiedAt: new Date()
        });
      }

      transaction.status = 'completed';
      transaction.emailAccountId = accountDoc._id.toString();
      await transaction.save();

      return { transactionId: transaction.transactionId, account: sanitize(accountDoc.toObject()) };
    } catch (err: any) {
      transaction.status = 'failed';
      transaction.error = err.message || String(err);
      await transaction.save();
      throw err;
    }
  }

  /**
   * Polls the status of a server-side OAuth transaction.
   */
  async getOAuthTransactionStatus(
    transactionId: string
  ): Promise<{ status: string; emailAccountId?: string; account?: SafeEmailAccount; error?: string }> {
    const transaction = await OAuthTransactionModel.findOne({
      transactionId,
      workspaceId: this.workspaceId
    });
    if (!transaction) {
      throw new EmailDomainError('TRANSACTION_NOT_FOUND', 'OAuth transaction not found or expired.');
    }
    if (transaction.status === 'completed' && transaction.emailAccountId) {
      const account = await this.getAccount(transaction.emailAccountId);
      return { status: 'completed', emailAccountId: transaction.emailAccountId, account };
    }
    return {
      status: transaction.status,
      ...(transaction.error ? { error: transaction.error } : {})
    };
  }

  /**
   * Re-runs authorization for an existing account.
   */
  async initiateGmailReconnect(
    userId: string,
    id: string
  ): Promise<{ transactionId: string; authorizationUrl: string }> {
    await this.findAccount(id);
    return this.initiateGmailOAuth(userId);
  }

  /**
   * Disconnects a mailbox: revokes any Gmail refresh token and clears stored
   * credentials, marking the account 'disconnected'.
   */
  async disconnect(id: string): Promise<{ success: boolean }> {
    const account = await this.findAccount(id);

    if (account.provider === 'gmail_oauth' && account.encryptedRefreshToken) {
      try {
        const refreshToken = decrypt(account.encryptedRefreshToken);
        await this.buildOAuthClient('http://127.0.0.1').revokeToken(refreshToken);
      } catch (err) {
        // Revocation is best-effort; disconnect proceeds regardless.
      }
    }

    account.status = 'disconnected';
    account.encryptedAccessToken = null;
    account.tokenExpiresAt = null;
    account.lastError = null;
    await account.save();
    return { success: true };
  }

  /**
   * Updates safe metadata fields for an account.
   */
  async syncMeta(
    id: string,
    meta: {
      provider?: string;
      name?: string;
      email?: string;
      status?: string;
      googleAccountId?: string;
      signature?: string;
      dailyLimit?: number;
      hourlyLimit?: number;
    }
  ): Promise<SafeEmailAccount> {
    const account = await this.findAccount(id);

    if (meta.name !== undefined) account.name = meta.name;
    if (meta.email !== undefined) account.email = meta.email;
    if (meta.status !== undefined) account.status = meta.status as any;
    if (meta.provider !== undefined) account.provider = meta.provider as any;
    if (meta.googleAccountId !== undefined) account.googleAccountId = meta.googleAccountId;
    if (meta.signature !== undefined) account.signature = meta.signature;
    if (meta.dailyLimit !== undefined) account.dailyLimit = meta.dailyLimit;
    if (meta.hourlyLimit !== undefined) account.hourlyLimit = meta.hourlyLimit;

    await account.save();
    return sanitize(account.toObject());
  }

  /**
   * Verifies mailbox health and returns an EmailProvider for sending.
   */
  async buildProvider(id: string): Promise<EmailProvider> {
    const account = await this.findAccount(id);

    if (account.status === 'disconnected' || account.status === 'disabled') {
      throw new EmailDomainError(
        'MAILBOX_DISCONNECTED',
        'Mailbox is disconnected. Please reconnect it.'
      );
    }

    if (account.provider === 'gmail_oauth') {
      if (!account.encryptedRefreshToken) {
        throw new EmailDomainError(
          'MAILBOX_NOT_AUTHORIZED',
          'Gmail mailbox is missing OAuth credentials.'
        );
      }
      const config: GmailProviderConfig = {
        email: account.email,
        clientId: env.GOOGLE_CLIENT_ID || '',
        clientSecret: env.GOOGLE_CLIENT_SECRET || '',
        encryptedRefreshToken: account.encryptedRefreshToken,
        encryptedAccessToken: account.encryptedAccessToken,
        tokenExpiresAt: account.tokenExpiresAt?.toISOString()
      };
      if (!config.clientId || !config.clientSecret) {
        throw new EmailDomainError(
          'GMAIL_OAUTH_NOT_CONFIGURED',
          'Gmail OAuth is not configured on the API.'
        );
      }
      return new GmailProvider(config);
    }

    throw new EmailDomainError(
      'MAILBOX_NOT_SUPPORTED',
      `Unsupported email account provider: ${account.provider}`
    );
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async findAccount(id: string): Promise<any> {
    const account = await EmailAccountModel.findOne({
      _id: id,
      workspaceId: this.workspaceId
    } as any);
    if (!account) {
      throw new EmailDomainError('MAILBOX_NOT_FOUND', 'Email Account not found.');
    }
    return account;
  }

  private buildOAuthClient(redirectUri: string): GoogleOAuthClient {
    return getServerGmailOAuthClient(redirectUri);
  }
}

function sanitize(doc: any): SafeEmailAccount {
  const obj: any = { ...doc };
  if (obj._id) obj.id = obj._id.toString();
  delete obj._id;
  delete obj.__v;
  delete obj.encryptedPassword;
  delete obj.encryptedRefreshToken;
  delete obj.encryptedAccessToken;
  if (obj.createdAt) obj.createdAt = new Date(obj.createdAt).toISOString();
  if (obj.updatedAt) obj.updatedAt = new Date(obj.updatedAt).toISOString();
  if (obj.lastVerifiedAt)
    obj.lastVerifiedAt = new Date(obj.lastVerifiedAt).toISOString();
  if (obj.tokenExpiresAt)
    obj.tokenExpiresAt = new Date(obj.tokenExpiresAt).toISOString();
  return obj as SafeEmailAccount;
}
