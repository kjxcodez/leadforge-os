/**
 * Canonical Email domain types shared by the API EmailService and EmailAccountService.
 *
 * These are intentionally DTO-shaped (no Mongo internals) so they can be reused
 * by the future Web/Mobile clients.
 */

export type EmailAccountProviderKind =
  | 'gmail_oauth'
  | 'other';

export type EmailAccountStatus =
  | 'connected'
  | 'reauth_required'
  | 'disconnected'
  | 'failed'
  | 'disabled';

export type EmailProviderHealth =
  | 'healthy'
  | 'reauth_required'
  | 'failed';

export interface SafeEmailAccount {
  id: string;
  workspaceId: string;
  name: string;
  email: string;
  provider: EmailAccountProviderKind;
  status: EmailAccountStatus;
  isDefault: boolean;
  dailyLimit: number;
  hourlyLimit: number;
  dailySent: number;
  hourlySent: number;
  signature?: string | null;
  lastVerifiedAt?: string | null;
  lastError?: string | null;
  googleAccountId?: string | null;
  tokenExpiresAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface SendEmailInput {
  accountId: string;
  to: string;
  subject: string;
  text?: string | undefined;
  html?: string | undefined;
  from?: string | undefined;
}

export interface SendEmailResult {
  messageId: string;
  accepted: string[];
}

export interface EmailProviderErrorShape {
  code:
    | 'MAILBOX_NOT_FOUND'
    | 'MAILBOX_NOT_AUTHORIZED'
    | 'MAILBOX_REAUTH_REQUIRED'
    | 'MAILBOX_DISCONNECTED'
    | 'EMAIL_SEND_FAILED'
    | 'EMAIL_RATE_LIMITED'
    | 'GMAIL_OAUTH_NOT_CONFIGURED'
    | 'GMAIL_OAUTH_CALLBACK_FAILED'
    | 'GMAIL_OAUTH_FAILED'
    | 'TRANSACTION_NOT_FOUND'
    | 'MAILBOX_NOT_SUPPORTED'
    | 'GMAIL_TOKEN_REFRESH_FAILED'
    | 'GMAIL_AUTH_REVOKED';
  message: string;
  reauthRequired?: boolean;
}

export class EmailDomainError extends Error {
  code: EmailProviderErrorShape['code'];
  reauthRequired: boolean;
  constructor(
    code: EmailProviderErrorShape['code'],
    message: string,
    reauthRequired = false
  ) {
    super(message);
    this.code = code;
    this.reauthRequired = reauthRequired;
  }
}