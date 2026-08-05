import nodemailer from 'nodemailer';
import { logger } from '@leadforge/logger';

// ─────────────────────────────────────────────────────────────────────────────
// Design System Tokens (from DESIGN.md)
// ─────────────────────────────────────────────────────────────────────────────
const DS = {
  bgBase: '#0A0A0B',
  bgSurface1: '#131316',
  bgSurface2: '#1B1B1F',
  borderSubtle: '#232327',
  borderDefault: '#2E2E33',
  accent: '#E8622C',
  accentHover: '#F17441',
  textPrimary: '#F4F4F5',
  textSecondary: '#A3A3AB',
  textTertiary: '#6E6E76',
  textOnAccent: '#0A0A0B',
  success: '#3FB27F',
  danger: '#E24C4B',
  fontStack: "'Inter', 'Helvetica Neue', Arial, sans-serif",
  monoStack: "'JetBrains Mono', 'Menlo', 'Courier New', monospace"
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Shared HTML email shell
// Used by all templates — handles consistent outer structure, font loading,
// dark background, and max-width 600px container (email-safe table layout).
// ─────────────────────────────────────────────────────────────────────────────
function emailShell(content: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap');

    /* Reset */
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    a { color: ${DS.accent}; }

    /* Base */
    body {
      background-color: ${DS.bgBase};
      font-family: ${DS.fontStack};
      font-size: 15px;
      line-height: 24px;
      color: ${DS.textSecondary};
      margin: 0;
      padding: 0;
    }

    /* Dark mode overrides for clients that force light mode */
    @media (prefers-color-scheme: dark) {
      body { background-color: ${DS.bgBase} !important; }
      .email-body { background-color: ${DS.bgBase} !important; }
      .email-card { background-color: ${DS.bgSurface1} !important; }
    }
  </style>
</head>
<body style="background-color: ${DS.bgBase}; margin: 0; padding: 0;">
  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-body"
         style="background-color: ${DS.bgBase}; margin: 0; padding: 0;">
    <tr>
      <td align="center" style="padding: 48px 16px;">

        <!-- Card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="max-width: 560px; width: 100%;">

          <!-- Logo bar -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <span style="font-family: ${DS.fontStack}; font-size: 13px; font-weight: 600;
                           letter-spacing: 0.12em; color: ${DS.textTertiary}; text-transform: uppercase;">
                LEADFORGE OS
              </span>
            </td>
          </tr>

          <!-- Main card -->
          <tr>
            <td style="background-color: ${DS.bgSurface1}; border: 1px solid ${DS.borderDefault};
                       border-radius: 12px; padding: 40px 40px 32px 40px;" class="email-card">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 32px;">
              <p style="font-family: ${DS.fontStack}; font-size: 12px; line-height: 18px;
                         color: ${DS.textTertiary}; margin: 0;">
                &copy; ${new Date().getFullYear()} LeadForge OS &nbsp;&middot;&nbsp;
                <span style="color: ${DS.textTertiary};">You received this because you have an account on LeadForge OS.</span>
              </p>
              <p style="font-family: ${DS.fontStack}; font-size: 11px; line-height: 16px;
                         color: ${DS.textTertiary}; margin: 8px 0 0 0; opacity: 0.6;">
                This is an automated system email — do not reply.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Primary CTA button — Forge Orange, 44px height, 16px h-padding */
function primaryButton(href: string, label: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
      <tr>
        <td align="center" style="border-radius: 8px; background-color: ${DS.accent};">
          <a href="${href}" target="_blank"
             style="display: inline-block; font-family: ${DS.fontStack}; font-size: 14px;
                    font-weight: 600; color: ${DS.textOnAccent}; text-decoration: none;
                    padding: 13px 28px; border-radius: 8px; letter-spacing: -0.01em;
                    mso-padding-alt: 13px 28px;">
            ${label}
          </a>
        </td>
      </tr>
    </table>`;
}

/** Ghost fallback URL for when buttons don't render */
function fallbackUrl(url: string): string {
  return `
    <p style="font-family: ${DS.monoStack}; font-size: 11px; line-height: 18px;
               color: ${DS.textTertiary}; word-break: break-all; margin: 0;
               background-color: ${DS.bgSurface2}; border: 1px solid ${DS.borderSubtle};
               border-radius: 6px; padding: 10px 12px; text-align: left;">
      ${url}
    </p>`;
}

/** Horizontal divider */
function divider(): string {
  return `<tr><td style="padding: 24px 0;">
    <div style="height: 1px; background-color: ${DS.borderSubtle};"></div>
  </td></tr>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MailerService
// ─────────────────────────────────────────────────────────────────────────────
export class MailerService {
  private static instance: MailerService;
  private transporter: nodemailer.Transporter | null = null;
  private fromAddress: string = 'LeadForge OS <noreply.leadforgeos@gmail.com>';

  private constructor() {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
    const secure = process.env.SMTP_SECURE === 'true';
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM;

    if (from) this.fromAddress = from;

    if (host && port && user && pass) {
      logger.info(`Mailer: Initializing SMTP transport → ${host}:${port}`);
      this.transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
    } else {
      logger.warn('Mailer: SMTP not configured — emails will be logged to console only.');
    }
  }

  public static getInstance(): MailerService {
    if (!MailerService.instance) MailerService.instance = new MailerService();
    return MailerService.instance;
  }

  public async sendMail(to: string, subject: string, html: string, text: string): Promise<void> {
    if (this.transporter) {
      try {
        await this.transporter.sendMail({ from: this.fromAddress, to, subject, text, html });
        logger.info(`Mailer: Sent → ${to} [${subject}]`);
      } catch (err: any) {
        logger.error(err, `Mailer: Failed → ${to}`);
        throw err;
      }
    } else {
      logger.info(`[DEV MAIL] To: ${to}\nSubject: ${subject}\n\n${text}\n`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Template: Verify Email
  // ──────────────────────────────────────────────────────────────────────────
  public async sendVerificationEmail(to: string, verificationUrl: string): Promise<void> {
    const subject = 'Verify your email — LeadForge OS';
    const text = `Welcome to LeadForge OS.\n\nVerify your email address by opening this link:\n${verificationUrl}\n\nIf you did not create an account, ignore this email.`;

    const content = `
      <!-- Icon -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="padding-bottom: 28px;">
            <div style="width: 48px; height: 48px; border-radius: 8px;
                        background-color: ${DS.bgSurface2}; border: 1px solid ${DS.borderDefault};
                        display: inline-flex; align-items: center; justify-content: center;">
              <!-- Mail icon (SVG inline) -->
              <img src="https://em-content.zobj.net/source/noto/386/envelope_2709-fe0f.png"
                   width="24" height="24" alt="" style="display: block;" />
            </div>
          </td>
        </tr>

        <!-- Heading -->
        <tr>
          <td align="center" style="padding-bottom: 12px;">
            <h1 style="font-family: ${DS.fontStack}; font-size: 20px; font-weight: 600;
                        line-height: 28px; color: ${DS.textPrimary}; margin: 0;
                        letter-spacing: -0.02em;">
              Verify your email address
            </h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td align="center" style="padding-bottom: 32px;">
            <p style="font-family: ${DS.fontStack}; font-size: 15px; line-height: 24px;
                       color: ${DS.textSecondary}; margin: 0; max-width: 400px;">
              You created an account on LeadForge OS. Click the button below to verify your
              email address and activate your account.
            </p>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td align="center" style="padding-bottom: 32px;">
            ${primaryButton(verificationUrl, 'Verify Email Address')}
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="padding-bottom: 20px;">
            <div style="height: 1px; background-color: ${DS.borderSubtle};"></div>
          </td>
        </tr>

        <!-- Fallback URL -->
        <tr>
          <td style="padding-bottom: 8px;">
            <p style="font-family: ${DS.fontStack}; font-size: 12px; line-height: 18px;
                       color: ${DS.textTertiary}; margin: 0 0 8px 0;">
              Button not working? Copy this link into your browser:
            </p>
            ${fallbackUrl(verificationUrl)}
          </td>
        </tr>

        <!-- Security note -->
        <tr>
          <td style="padding-top: 20px;">
            <p style="font-family: ${DS.fontStack}; font-size: 12px; line-height: 18px;
                       color: ${DS.textTertiary}; margin: 0;">
              This link expires in 24 hours. If you did not create an account on LeadForge OS,
              you can safely ignore this email.
            </p>
          </td>
        </tr>
      </table>`;

    await this.sendMail(to, subject, emailShell(content), text);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Template: Reset Password
  // ──────────────────────────────────────────────────────────────────────────
  public async sendResetPasswordEmail(to: string, resetUrl: string): Promise<void> {
    const subject = 'Reset your password — LeadForge OS';
    const text = `You requested a password reset for your LeadForge OS account.\n\nReset your password here:\n${resetUrl}\n\nThis link expires in 1 hour. If you did not request this, ignore this email — your password has not been changed.`;

    const content = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">

        <!-- Accent bar at top -->
        <tr>
          <td style="padding-bottom: 28px;">
            <div style="height: 3px; border-radius: 2px; background-color: ${DS.accent};
                        width: 48px; margin: 0 auto;"></div>
          </td>
        </tr>

        <!-- Heading -->
        <tr>
          <td align="center" style="padding-bottom: 12px;">
            <h1 style="font-family: ${DS.fontStack}; font-size: 20px; font-weight: 600;
                        line-height: 28px; color: ${DS.textPrimary}; margin: 0;
                        letter-spacing: -0.02em;">
              Reset your password
            </h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td align="center" style="padding-bottom: 32px;">
            <p style="font-family: ${DS.fontStack}; font-size: 15px; line-height: 24px;
                       color: ${DS.textSecondary}; margin: 0; max-width: 400px;">
              We received a request to reset the password for your LeadForge OS account.
              Click the button below to choose a new password. This link expires in
              <strong style="color: ${DS.textPrimary}; font-weight: 500;">1 hour</strong>.
            </p>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td align="center" style="padding-bottom: 32px;">
            ${primaryButton(resetUrl, 'Reset Password')}
          </td>
        </tr>

        <!-- Warning box -->
        <tr>
          <td style="padding-bottom: 24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                   style="background-color: ${DS.bgSurface2}; border: 1px solid ${DS.borderDefault};
                          border-left: 3px solid ${DS.textTertiary}; border-radius: 8px;">
              <tr>
                <td style="padding: 14px 16px;">
                  <p style="font-family: ${DS.fontStack}; font-size: 13px; line-height: 20px;
                             color: ${DS.textTertiary}; margin: 0;">
                    If you did not request a password reset, your account is secure.
                    No changes have been made. You can safely ignore this email.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="padding-bottom: 20px;">
            <div style="height: 1px; background-color: ${DS.borderSubtle};"></div>
          </td>
        </tr>

        <!-- Fallback URL -->
        <tr>
          <td style="padding-bottom: 8px;">
            <p style="font-family: ${DS.fontStack}; font-size: 12px; line-height: 18px;
                       color: ${DS.textTertiary}; margin: 0 0 8px 0;">
              Button not working? Copy this link into your browser:
            </p>
            ${fallbackUrl(resetUrl)}
          </td>
        </tr>

      </table>`;

    await this.sendMail(to, subject, emailShell(content), text);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Template: Welcome (post-verification)
  // ──────────────────────────────────────────────────────────────────────────
  public async sendWelcomeEmail(to: string, name: string): Promise<void> {
    const subject = 'Welcome to LeadForge OS';
    const text = `Hi ${name},\n\nYour email has been verified. Your LeadForge OS account is active.\n\nOpen the desktop app and sign in to get started.`;

    const content = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">

        <!-- Success bar -->
        <tr>
          <td align="center" style="padding-bottom: 28px;">
            <div style="width: 48px; height: 48px; border-radius: 8px;
                        background-color: rgba(63, 178, 127, 0.12);
                        border: 1px solid rgba(63, 178, 127, 0.3);
                        line-height: 48px; text-align: center; font-size: 22px;">
              ✓
            </div>
          </td>
        </tr>

        <!-- Heading -->
        <tr>
          <td align="center" style="padding-bottom: 12px;">
            <h1 style="font-family: ${DS.fontStack}; font-size: 20px; font-weight: 600;
                        line-height: 28px; color: ${DS.textPrimary}; margin: 0;
                        letter-spacing: -0.02em;">
              You're in.
            </h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td align="center" style="padding-bottom: 32px;">
            <p style="font-family: ${DS.fontStack}; font-size: 15px; line-height: 24px;
                       color: ${DS.textSecondary}; margin: 0; max-width: 400px;">
              Your email is verified and your LeadForge OS account is active.
              Open the desktop app to sign in and get started.
            </p>
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="padding-bottom: 20px;">
            <div style="height: 1px; background-color: ${DS.borderSubtle};"></div>
          </td>
        </tr>

        <!-- What's next — 3 items -->
        <tr>
          <td style="padding-bottom: 8px;">
            <p style="font-family: ${DS.fontStack}; font-size: 12px; font-weight: 600;
                       letter-spacing: 0.06em; text-transform: uppercase; color: ${DS.textTertiary};
                       margin: 0 0 16px 0;">
              What to do next
            </p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${[
                ['01', 'Sign in', 'Open the desktop app and authenticate with your credentials.'],
                ['02', 'Create a workspace', 'Workspaces keep your leads, campaigns, and settings organized.'],
                ['03', 'Run your first discovery', 'Find and enrich leads from LinkedIn and web sources.']
              ].map(([num, title, desc]) => `
              <tr>
                <td style="padding-bottom: 16px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td width="32" valign="top" style="padding-top: 1px;">
                        <span style="font-family: ${DS.monoStack}; font-size: 11px; font-weight: 400;
                                     color: ${DS.accent}; line-height: 20px;">${num}</span>
                      </td>
                      <td valign="top">
                        <p style="font-family: ${DS.fontStack}; font-size: 13px; font-weight: 600;
                                   color: ${DS.textPrimary}; margin: 0 0 2px 0; line-height: 20px;">${title}</p>
                        <p style="font-family: ${DS.fontStack}; font-size: 13px; color: ${DS.textSecondary};
                                   margin: 0; line-height: 20px;">${desc}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>`).join('')}
            </table>
          </td>
        </tr>

      </table>`;

    await this.sendMail(to, subject, emailShell(content), text);
  }
}
