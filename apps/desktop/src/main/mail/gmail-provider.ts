import { GmailApiClient, GoogleOAuthClient, type GmailTokens } from '../gmail/google-client';
import type {
  GmailMailProviderConfig,
  MailProvider,
  MailProviderError,
  MailSendOptions,
  MailSendResult
} from './types';

/**
 * Gmail OAuth mail provider backed by the Gmail REST API.
 * Uses only the `gmail.send` scope and refreshes expired access tokens
 * automatically before sending.
 */
export class GmailMailProvider implements MailProvider {
  readonly kind = 'gmail_oauth' as const;
  private oauth: GoogleOAuthClient;
  private client: GmailApiClient;
  private config: GmailMailProviderConfig;

  constructor(config: GmailMailProviderConfig) {
    this.config = config;
    this.oauth = new GoogleOAuthClient({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: 'http://127.0.0.1' // unused for refresh/send; kept for compatibility
    });
    const gmailTokens: GmailTokens = { refreshToken: config.refreshToken };
    if (config.accessToken) gmailTokens.accessToken = config.accessToken;
    if (config.tokenExpiresAt) gmailTokens.tokenExpiresAt = config.tokenExpiresAt;
    this.client = new GmailApiClient(this.oauth, gmailTokens);
  }

  async verify(): Promise<boolean> {
    try {
      await this.client.verify();
      return true;
    } catch (err: any) {
      const wrapped: MailProviderError = new Error(
        `Gmail connection verification failed: ${err.message || err}`
      );
      if (err?.reauthRequired) wrapped.reauthRequired = true;
      throw wrapped;
    }
  }

  async send(options: MailSendOptions): Promise<MailSendResult> {
    try {
      const message: {
        from: string;
        to: string;
        subject: string;
        text?: string;
        html?: string;
      } = { from: options.from, to: options.to, subject: options.subject };
      if (options.text !== undefined) message.text = options.text;
      if (options.html !== undefined) message.html = options.html;
      const messageId = await this.client.sendMessage(message);
      return { messageId, accepted: [options.to] };
    } catch (err: any) {
      const wrapped: MailProviderError = new Error(
        `Gmail send failed: ${err.message || err}`
      );
      if (err?.reauthRequired) wrapped.reauthRequired = true;
      throw wrapped;
    }
  }

  close(): void {
    // No persistent connection to close for the Gmail REST API.
  }

  get configSnapshot(): GmailMailProviderConfig {
    return this.config;
  }
}