import nodemailer from 'nodemailer';
import { logger } from '@leadforge/logger';

export class MailerService {
  private static instance: MailerService;
  private transporter: nodemailer.Transporter | null = null;
  private fromAddress: string = 'LeadForge OS <noreply@leadforge.com>';

  private constructor() {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
    const secure = process.env.SMTP_SECURE === 'true';
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM;

    if (from) {
      this.fromAddress = from;
    }

    if (host && port && user && pass) {
      logger.info(`Mailer: Initializing SMTP transport for ${host}:${port}`);
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass
        }
      });
    } else {
      logger.warn(
        'Mailer: SMTP environment variables are not fully configured. Falling back to dev console logger.'
      );
    }
  }

  public static getInstance(): MailerService {
    if (!MailerService.instance) {
      MailerService.instance = new MailerService();
    }
    return MailerService.instance;
  }

  public async sendMail(to: string, subject: string, html: string, textFallback: string): Promise<void> {
    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: this.fromAddress,
          to,
          subject,
          text: textFallback,
          html
        });
        logger.info(`Mailer: Email sent successfully to: ${to}`);
      } catch (err: any) {
        logger.error(err, `Mailer: Failed to send email to ${to}`);
        throw err;
      }
    } else {
      logger.info(
        `Mailer [DEV LOG ONLY - NO SMTP INSTANCE]\nTo: ${to}\nSubject: ${subject}\nBody:\n${textFallback}\n`
      );
    }
  }

  public async sendVerificationEmail(to: string, verificationUrl: string): Promise<void> {
    const subject = 'Verify your email address - LeadForge OS';
    const textFallback = `Welcome to LeadForge OS! Please verify your email by opening the following link: ${verificationUrl}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: #0c0a09;
            color: #e7e5e4;
            margin: 0;
            padding: 40px 20px;
          }
          .container {
            max-width: 500px;
            margin: 0 auto;
            background-color: #1c1917;
            border: 1px solid #2e2a24;
            padding: 32px;
            text-align: center;
          }
          .logo {
            font-size: 20px;
            font-weight: 800;
            color: #ffffff;
            margin-bottom: 24px;
            letter-spacing: -0.025em;
          }
          h1 {
            font-size: 20px;
            font-weight: 700;
            color: #ffffff;
            margin-top: 0;
            margin-bottom: 12px;
          }
          p {
            font-size: 13px;
            line-height: 1.5;
            color: #a8a29e;
            margin-bottom: 24px;
          }
          .button {
            display: inline-block;
            background-color: #f5f5f4;
            color: #0c0a09;
            text-decoration: none;
            padding: 10px 20px;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 24px;
            transition: background-color 0.15s ease;
          }
          .button:hover {
            background-color: #e7e5e4;
          }
          .footer {
            font-size: 10px;
            color: #78716c;
            margin-top: 32px;
            border-top: 1px solid #2e2a24;
            padding-top: 16px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">LEADFORGE OS</div>
          <h1>Verify your email address</h1>
          <p>Thank you for signing up for LeadForge OS. Please click the button below to verify your email address and activate your account.</p>
          <a href="${verificationUrl}" class="button" target="_blank">Verify Email</a>
          <p style="font-size: 11px; margin-top: 16px;">If the button above does not work, copy and paste this URL into your browser:<br/><span style="color: #78716c; word-break: break-all;">${verificationUrl}</span></p>
          <div class="footer">
            &copy; 2026 LeadForge OS. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `;
    await this.sendMail(to, subject, html, textFallback);
  }

  public async sendResetPasswordEmail(to: string, resetUrl: string): Promise<void> {
    const subject = 'Reset your password - LeadForge OS';
    const textFallback = `We received a request to reset your LeadForge OS password. You can reset your password by opening the following link: ${resetUrl}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: #0c0a09;
            color: #e7e5e4;
            margin: 0;
            padding: 40px 20px;
          }
          .container {
            max-width: 500px;
            margin: 0 auto;
            background-color: #1c1917;
            border: 1px solid #2e2a24;
            padding: 32px;
            text-align: center;
          }
          .logo {
            font-size: 20px;
            font-weight: 800;
            color: #ffffff;
            margin-bottom: 24px;
            letter-spacing: -0.025em;
          }
          h1 {
            font-size: 20px;
            font-weight: 700;
            color: #ffffff;
            margin-top: 0;
            margin-bottom: 12px;
          }
          p {
            font-size: 13px;
            line-height: 1.5;
            color: #a8a29e;
            margin-bottom: 24px;
          }
          .button {
            display: inline-block;
            background-color: #ef4444;
            color: #ffffff;
            text-decoration: none;
            padding: 10px 20px;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 24px;
            transition: background-color 0.15s ease;
          }
          .button:hover {
            background-color: #dc2626;
          }
          .footer {
            font-size: 10px;
            color: #78716c;
            margin-top: 32px;
            border-top: 1px solid #2e2a24;
            padding-top: 16px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">LEADFORGE OS</div>
          <h1>Reset your password</h1>
          <p>We received a request to reset the password for your LeadForge OS account. Click the button below to set a new password. This link will expire shortly.</p>
          <a href="${resetUrl}" class="button" target="_blank">Reset Password</a>
          <p style="font-size: 11px; margin-top: 16px;">If you did not request a password reset, you can safely ignore this email.</p>
          <p style="font-size: 11px; margin-top: 16px;">If the button above does not work, copy and paste this URL into your browser:<br/><span style="color: #78716c; word-break: break-all;">${resetUrl}</span></p>
          <div class="footer">
            &copy; 2026 LeadForge OS. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `;
    await this.sendMail(to, subject, html, textFallback);
  }
}
