import { EmailAccountModel } from '../../db/models/email-account.model.js';
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
import { SMTPProvider } from './providers/smtp-provider.js';
import type { EmailProvider } from './providers/types.js';

/**
 * EmailAccountService owns mailbox lifecycle and OAuth credential handling:
 * connect (authorization-code exchange), reconnect, disconnect, lookup, list,
 * and health. It never exposes raw tokens — it returns only `SafeEmailAccount`
 * objects.
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

  // ── Lifecycle ────────────────────────────────────────────────────────────

  /**
   * Completes a Gmail OAuth authorization-code exchange on the server, encrypts
   * the resulting tokens, and creates an EmailAccount. The desktop/web/mobile
   * client only ever supplies the code and redirect URI — never tokens.
   */
  async connectGmail(input: {
    code: string;
    redirectUri: string;
    name?: string | undefined;
    signature?: string | undefined;
    dailyLimit?: number | undefined;
    hourlyLimit?: number | undefined;
    isDefault?: boolean | undefined;
  }): Promise<SafeEmailAccount> {
    const oauth = this.buildOAuthClient(input.redirectUri);
    const tokens = await oauth.exchangeCodeForTokens(input.code);
    if (!tokens.refreshToken) {
      throw new EmailDomainError(
        'GMAIL_OAUTH_CALLBACK_FAILED',
        'Google did not return a refresh token. Please re-consent.'
      );
    }

    let email = '';
    let googleAccountId: string | null = null;
    try {
      const info = await oauth.getTokenInfo(tokens.accessToken);
      email = info.email || '';
      googleAccountId = info.sub || null;
    } catch (err) {
      throw new EmailDomainError(
        'GMAIL_OAUTH_CALLBACK_FAILED',
        'Could not resolve the authorized Gmail account.'
      );
    }
    if (!email) {
      throw new EmailDomainError(
        'GMAIL_OAUTH_CALLBACK_FAILED',
        'Google did not return the authorized email address.'
      );
    }

    const name = input.name || email.split('@')[0] || 'Gmail';
    if (input.isDefault) {
      await EmailAccountModel.updateMany(
        { workspaceId: this.workspaceId } as any,
        { isDefault: false }
      );
    }

    const tokenExpiresAt = new Date(
      Date.now() + tokens.expiresIn * 1000
    ).toISOString();

    const account = await EmailAccountModel.create({
      workspaceId: this.workspaceId as any,
      name,
      email,
      provider: 'gmail_oauth',
      status: 'connected',
      isDefault: !!input.isDefault,
      dailyLimit: input.dailyLimit || 200,
      hourlyLimit: input.hourlyLimit || 50,
      signature: input.signature || '',
      lastVerifiedAt: new Date(),
      googleAccountId,
      encryptedRefreshToken: encrypt(tokens.refreshToken),
      encryptedAccessToken: encrypt(tokens.accessToken),
      tokenExpiresAt
    });

    return sanitize(account.toObject());
  }

  /**
   * Re-runs the authorization-code exchange and updates an existing account
   * with fresh encrypted credentials, restoring it to 'connected'.
   */
  async reconnectGmail(
    id: string,
    input: {
      code: string;
      redirectUri: string;
      name?: string | undefined;
      signature?: string | undefined;
      dailyLimit?: number | undefined;
      hourlyLimit?: number | undefined;
    }
  ): Promise<SafeEmailAccount> {
    const account = await this.findAccount(id);
    const oauth = this.buildOAuthClient(input.redirectUri);
    const tokens = await oauth.exchangeCodeForTokens(input.code);
    if (!tokens.refreshToken) {
      throw new EmailDomainError(
        'GMAIL_OAUTH_CALLBACK_FAILED',
        'Google did not return a refresh token. Please re-consent.'
      );
    }

    let googleAccountId: string | null = account.googleAccountId;
    try {
      const info = await oauth.getTokenInfo(tokens.accessToken);
      googleAccountId = info.sub || googleAccountId;
    } catch {
      // best-effort
    }

    account.provider = 'gmail_oauth';
    account.encryptedRefreshToken = encrypt(tokens.refreshToken);
    account.encryptedAccessToken = encrypt(tokens.accessToken);
    account.tokenExpiresAt = new Date(
      Date.now() + tokens.expiresIn * 1000
    );
    account.googleAccountId = googleAccountId;
    account.status = 'connected';
    account.lastVerifiedAt = new Date();
    account.lastError = null;
    if (input.name) account.name = input.name;
    if (input.signature !== undefined) account.signature = input.signature;
    if (input.dailyLimit) account.dailyLimit = input.dailyLimit;
    if (input.hourlyLimit) account.hourlyLimit = input.hourlyLimit;
    await account.save();

    return sanitize(account.toObject());
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
   * Verifies mailbox health and returns an EmailProvider for sending.
   * Used internally by EmailService; not exposed as a route that leaks tokens.
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

    // SMTP / legacy gmail_smtp fallback
    if (!account.encryptedPassword) {
      throw new EmailDomainError(
        'MAILBOX_NOT_AUTHORIZED',
        'SMTP mailbox is missing credentials.'
      );
    }
    return new SMTPProvider({
      host: (account as any).smtpHost || 'smtp.gmail.com',
      port: (account as any).smtpPort || 465,
      secure:
        (account as any).smtpSecure !== undefined
          ? (account as any).smtpSecure === 'true'
          : true,
      username: (account as any).smtpUsername || account.email,
      encryptedPassword: account.encryptedPassword,
      senderName: account.name,
      senderEmail: account.email
    });
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
