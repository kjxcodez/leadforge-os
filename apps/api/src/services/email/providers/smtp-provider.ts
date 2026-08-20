import nodemailer from 'nodemailer';
import { decrypt } from '../../../utils/encryption.js';
import {
  EmailDomainError,
  type EmailProviderHealth,
  type SendEmailInput,
  type SendEmailResult
} from '../types.js';
import type { EmailProvider } from './types.js';

export interface SmtpProviderConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  encryptedPassword: string;
  senderName: string;
  senderEmail: string;
}

/**
 * SMTP transport for any IMAP/SMTP mailbox (incl. legacy Gmail App Password
 * accounts). Used by future web/mobile clients and as a fallback.
 */
export class SMTPProvider implements EmailProvider {
  readonly kind = 'smtp' as const;
  private transporter: nodemailer.Transporter;

  constructor(private readonly config: SmtpProviderConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.username, pass: decrypt(config.encryptedPassword) },
      connectionTimeout: 10_000,
      greetingTimeout: 5_000,
      socketTimeout: 15_000
    });
  }

  async verify(): Promise<EmailProviderHealth> {
    try {
      await this.transporter.verify();
      return 'healthy';
    } catch (err: any) {
      throw new EmailDomainError(
        'EMAIL_SEND_FAILED',
        `SMTP verification failed: ${err.message || err}`
      );
    }
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    try {
      const info = await this.transporter.sendMail({
        from: input.from || `"${this.config.senderName}" <${this.config.senderEmail}>`,
        to: input.to,
        subject: input.subject,
        ...(input.html ? { html: input.html } : { text: input.text || '' })
      });
      return { messageId: info.messageId || '', accepted: [input.to] };
    } catch (err: any) {
      throw new EmailDomainError(
        'EMAIL_SEND_FAILED',
        `SMTP send failed: ${err.message || err}`
      );
    }
  }

  close(): void {
    try {
      this.transporter.close();
    } catch {
      // ignore
    }
  }
}