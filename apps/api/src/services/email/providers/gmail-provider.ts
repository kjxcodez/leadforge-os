import { decrypt } from '../../../utils/encryption.js';
import {
  EmailDomainError,
  type EmailProviderHealth,
  type SendEmailInput,
  type SendEmailResult
} from '../types.js';
import {
  GMAIL_SEND_SCOPE,
  GmailApiClient,
  GoogleOAuthClient
} from './google-oauth.js';
import type { EmailProvider } from './types.js';

export interface GmailProviderConfig {
  email: string;
  clientId: string;
  clientSecret: string;
  encryptedRefreshToken: string;
  encryptedAccessToken?: string | null;
  tokenExpiresAt?: string | null;
}

/**
 * Gmail OAuth mail provider backed by the Gmail REST API.
 *
 * The provider is constructed with already-encrypted credentials from MongoDB.
 * It transparently refreshes expired access tokens before sending. On
 * refresh/revoke failure it surfaces `MAILBOX_REAUTH_REQUIRED` so callers can
 * drive a reconnect flow.
 */
export class GmailProvider implements EmailProvider {
  readonly kind = 'gmail_oauth' as const;
  private readonly oauth: GoogleOAuthClient;
  private readonly client: GmailApiClient;
  private readonly config: GmailProviderConfig;

  constructor(config: GmailProviderConfig) {
    this.config = config;
    this.oauth = new GoogleOAuthClient({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      // redirectUri is unused at runtime for refresh/send, but required by the
      // OAuth client constructor for code exchange (used by web/mobile).
      redirectUri: 'http://127.0.0.1'
    });
    const tokens: { refreshToken: string; accessToken?: string; tokenExpiresAt?: string } = {
      refreshToken: decrypt(config.encryptedRefreshToken)
    };
    if (config.encryptedAccessToken) {
      tokens.accessToken = decrypt(config.encryptedAccessToken);
    }
    if (config.tokenExpiresAt) {
      tokens.tokenExpiresAt = config.tokenExpiresAt;
    }
    this.client = new GmailApiClient(this.oauth, tokens);
  }

  async verify(): Promise<EmailProviderHealth> {
    try {
      const { email } = await this.client.verify();
      if (!email) {
        throw new Error('Token did not resolve to an email');
      }
      return 'healthy';
    } catch (err: any) {
      const reauth = !!err?.reauthRequired;
      throw new EmailDomainError(
        reauth ? 'MAILBOX_REAUTH_REQUIRED' : 'EMAIL_SEND_FAILED',
        `Gmail verification failed: ${err.message || err}`,
        reauth
      );
    }
  }

  async fetchSignature(): Promise<import('./google-oauth.js').SignatureFetchResult> {
    return this.client.getSendAsSignature(this.config.email);
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    try {
      const from = input.from || this.config.email;
      const messageId = await this.client.sendMessage({
        from,
        to: input.to,
        subject: input.subject,
        ...(input.html !== undefined ? { html: input.html } : {}),
        ...(input.text !== undefined ? { text: input.text } : {}),
        ...(input.attachments !== undefined ? { attachments: input.attachments } : {})
      });
      return { messageId, accepted: [input.to] };
    } catch (err: any) {
      const reauth = !!err?.reauthRequired;
      throw new EmailDomainError(
        reauth ? 'MAILBOX_REAUTH_REQUIRED' : 'EMAIL_SEND_FAILED',
        `Gmail send failed: ${err.message || err}`,
        reauth
      );
    }
  }

  close(): void {
    // No persistent connection to close for the Gmail REST API.
  }

  /** The Gmail scope used for this provider. Exposed for diagnostics. */
  get scope(): string {
    return GMAIL_SEND_SCOPE;
  }
}