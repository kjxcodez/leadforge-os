import nodemailer from 'nodemailer';

export interface EmailProviderConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export interface EmailProvider {
  testConnection(config: EmailProviderConfig): Promise<boolean>;
  sendEmail(
    config: EmailProviderConfig,
    to: string,
    subject: string,
    body: string
  ): Promise<{ messageId: string }>;
}

export class GmailSmtpProvider implements EmailProvider {
  /**
   * Tests connection validity to Gmail SMTP servers with the given App Password.
   */
  public async testConnection(config: EmailProviderConfig): Promise<boolean> {
    const transporter = nodemailer.createTransport({
      host: config.host || 'smtp.gmail.com',
      port: config.port || 465,
      secure: config.secure ?? true,
      auth: {
        user: config.auth.user,
        pass: config.auth.pass
      },
      connectTimeout: 5000
    } as any);

    try {
      await transporter.verify();
      return true;
    } catch (err: any) {
      console.warn('[GmailSmtpProvider] SMTP credentials validation failure:', err.message);
      throw new Error(err.message || 'SMTP Authentication verification failed.');
    } finally {
      transporter.close();
    }
  }

  /**
   * Sends an email via Nodemailer.
   */
  public async sendEmail(
    config: EmailProviderConfig,
    to: string,
    subject: string,
    body: string
  ): Promise<{ messageId: string }> {
    const transporter = nodemailer.createTransport({
      host: config.host || 'smtp.gmail.com',
      port: config.port || 465,
      secure: config.secure ?? true,
      auth: {
        user: config.auth.user,
        pass: config.auth.pass
      }
    } as any);

    try {
      const info = await transporter.sendMail({
        from: `"${config.auth.user}" <${config.auth.user}>`,
        to,
        subject,
        html: body
      });

      return {
        messageId: info.messageId || Math.random().toString()
      };
    } catch (err: any) {
      console.error('[GmailSmtpProvider] Send email failed:', err);
      throw new Error(err.message || 'Failed to send outbound email via SMTP.');
    } finally {
      transporter.close();
    }
  }
}
