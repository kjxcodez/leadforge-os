import nodemailer from 'nodemailer';
import type {
  MailProvider,
  MailProviderError,
  MailSendOptions,
  MailSendResult,
  SmtpMailProviderConfig
} from './types';

/**
 * SMTP mail provider backed by Nodemailer. Preserves the existing
 * SMTP/app-password sending behavior used by outreach and automation workers.
 */
export class SmtpMailProvider implements MailProvider {
  readonly kind = 'smtp' as const;
  private transporter: any;
  private config: SmtpMailProviderConfig;

  constructor(config: SmtpMailProviderConfig) {
    this.config = config;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.username,
        pass: config.password
      },
      connectionTimeout: config.connectionTimeout ?? 10000,
      greetingTimeout: config.greetingTimeout ?? 5000,
      socketTimeout: config.socketTimeout ?? 15000
    });
  }

  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (err: any) {
      const wrapped: MailProviderError = new Error(
        `SMTP connection verification failed: ${err.message || err}`
      );
      wrapped.invalidCredentials = true;
      throw wrapped;
    }
  }

  async send(options: MailSendOptions): Promise<MailSendResult> {
    try {
      const info = await this.transporter.sendMail({
        from: options.from,
        to: options.to,
        subject: options.subject,
        ...(options.html ? { html: options.html } : { text: options.text || '' })
      });
      return {
        messageId: info.messageId || '',
        accepted: info.accepted,
        rejected: info.rejected,
        response: info.response
      };
    } catch (err: any) {
      const wrapped: MailProviderError = new Error(
        `SMTP send failed: ${err.message || err}`
      );
      wrapped.invalidCredentials = true;
      throw wrapped;
    }
  }

  close(): void {
    try {
      this.transporter?.close();
    } catch {
      // ignore close errors
    }
  }
}