import { GoogleAuthService } from './auth.service.js';
import { MimeBuilder, type MimeAttachment } from './mime-builder.js';
import { GoogleConnectionModel } from '../../db/models/google-connection.model.js';
import { EmailDomainError } from '../email/types.js';
import { logger } from '../../config/index.js';

const GMAIL_SEND_API_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

export interface SendGmailMessageOptions {
  connectionId: string;
  from: string;
  to: string;
  cc?: string | undefined;
  bcc?: string | undefined;
  subject: string;
  text?: string | undefined;
  html?: string | undefined;
  attachments?: MimeAttachment[] | undefined;
  mixedBoundary?: string | undefined;
  altBoundary?: string | undefined;
}

export type GmailTransportFn = (url: string, init: RequestInit) => Promise<Response>;

export class GmailProvider {
  private transportFn: GmailTransportFn = fetch;

  constructor(private readonly authService: GoogleAuthService) {}

  /**
   * Allows injecting a custom transport function for deterministic unit & integration tests.
   */
  public setTransport(transport: GmailTransportFn): void {
    this.transportFn = transport;
  }

  /**
   * Sends an email through the Gmail REST API for a specific Google Connection.
   */
  public async sendMessage(
    options: SendGmailMessageOptions
  ): Promise<{ messageId: string; threadId?: string }> {
    const connection = await GoogleConnectionModel.findById(options.connectionId);
    if (!connection) {
      throw new EmailDomainError('MAILBOX_NOT_FOUND', `Google connection "${options.connectionId}" not found.`);
    }

    if (connection.status === 'disconnected' || connection.gmailStatus === 'revoked') {
      throw new EmailDomainError(
        'MAILBOX_DISCONNECTED',
        `Gmail mailbox "${connection.email}" is disconnected or revoked. Please reconnect the account.`
      );
    }

    // Acquire valid access token (refreshes independently if needed)
    let accessToken: string;
    try {
      accessToken = await this.authService.getValidAccessToken(options.connectionId);
    } catch (err: any) {
      if (err instanceof EmailDomainError) throw err;
      throw new EmailDomainError('GMAIL_TOKEN_REFRESH_FAILED', `Failed to obtain access token: ${err.message}`, true);
    }

    // Build standard base64url MIME payload
    const raw = MimeBuilder.buildRaw({
      from: options.from,
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments,
      mixedBoundary: options.mixedBoundary,
      altBoundary: options.altBoundary
    });

    let res: Response;
    try {
      res = await this.transportFn(GMAIL_SEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ raw })
      });
    } catch (netErr: any) {
      // Network disconnect / socket error during sending
      throw new EmailDomainError(
        'AMBIGUOUS_SEND_TIMEOUT',
        `Network failure while contacting Gmail API: ${netErr.message}`,
        false,
        true,
        'transient_network'
      );
    }

    const body: any = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        await GoogleConnectionModel.updateOne(
          { _id: options.connectionId },
          {
            $set: {
              gmailStatus: 'reauth_required',
              status: 'reauth_required',
              lastError: body?.error?.message || 'Gmail authorization expired or revoked'
            }
          }
        );
        throw new EmailDomainError(
          'MAILBOX_REAUTH_REQUIRED',
          'Gmail authorization expired or was revoked. Please reconnect the mailbox.',
          true,
          false,
          'authentication'
        );
      }

      if (res.status === 429 || body?.error?.status === 'RESOURCE_EXHAUSTED') {
        throw new EmailDomainError(
          'SENDER_RATE_LIMITED',
          `Gmail API rate limit exceeded for sender "${connection.email}". Please back off before retrying.`,
          false,
          true,
          'rate_limit'
        );
      }

      if (res.status === 400) {
        throw new EmailDomainError(
          'INVALID_RECIPIENT',
          `Gmail rejected message as invalid request: ${body?.error?.message || 'Bad Request'}`,
          false,
          false,
          'invalid_request'
        );
      }

      if (res.status >= 500) {
        throw new EmailDomainError(
          'TRANSIENT_NETWORK_ERROR',
          `Gmail API temporary server error (HTTP ${res.status}): ${body?.error?.message || 'Server error'}`,
          false,
          true,
          'transient_server_error'
        );
      }

      logger.error({ status: res.status, error: body?.error }, 'Gmail messages.send failed');
      throw new EmailDomainError(
        'EMAIL_SEND_FAILED',
        `Gmail send failed (HTTP ${res.status}): ${body?.error?.message || 'unknown error'}`,
        false,
        false,
        'permanent_provider_error'
      );
    }

    return {
      messageId: body.id || '',
      threadId: body.threadId || null
    };
  }

  /**
   * Fetches the web signature configured in Gmail for the user's sendAs address.
   */
  public async getSendAsSignature(connectionId: string, email: string): Promise<string | null> {
    try {
      const accessToken = await this.authService.getValidAccessToken(connectionId);
      const url = `https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs/${encodeURIComponent(email)}`;
      const res = await this.transportFn(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!res.ok) return null;
      const data: any = await res.json().catch(() => ({}));
      return data?.signature ? String(data.signature).trim() : null;
    } catch {
      return null;
    }
  }
}
