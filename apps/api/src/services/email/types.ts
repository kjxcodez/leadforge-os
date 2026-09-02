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

export interface EmailAttachmentInput {
  filename: string;
  contentBase64?: string | undefined;
  path?: string | undefined;
  contentType?: string | undefined;
  size?: number | undefined;
}

export interface SendEmailInput {
  accountId: string;
  to: string;
  subject: string;
  text?: string | undefined;
  html?: string | undefined;
  from?: string | undefined;
  cc?: string | undefined;
  bcc?: string | undefined;
  useSignature?: boolean | undefined;
  attachments?: EmailAttachmentInput[] | undefined;
  idempotencyKey?: string | undefined;
  campaignId?: string | undefined;
  sequenceId?: string | undefined;
  executionId?: string | undefined;
  stepIndex?: number | undefined;
  contactId?: string | undefined;
}

export interface SendEmailResult {
  messageId: string;
  threadId?: string | null | undefined;
  accepted: string[];
  sentAt?: Date | undefined;
}

export interface EmailProviderErrorShape {
  code:
    | 'MAILBOX_NOT_FOUND'
    | 'MAILBOX_NOT_AUTHORIZED'
    | 'MAILBOX_REAUTH_REQUIRED'
    | 'MAILBOX_DISCONNECTED'
    | 'EMAIL_SEND_FAILED'
    | 'EMAIL_RATE_LIMITED'
    | 'SENDER_RATE_LIMITED'
    | 'GMAIL_OAUTH_NOT_CONFIGURED'
    | 'GMAIL_OAUTH_CALLBACK_FAILED'
    | 'GMAIL_OAUTH_FAILED'
    | 'TRANSACTION_NOT_FOUND'
    | 'MAILBOX_NOT_SUPPORTED'
    | 'GMAIL_TOKEN_REFRESH_FAILED'
    | 'GMAIL_AUTH_REVOKED'
    | 'TEST_RECIPIENT_LIMIT_REACHED'
    | 'ATTACHMENT_SIZE_EXCEEDED'
    | 'ATTACHMENT_TYPE_NOT_ALLOWED'
    | 'ATTACHMENT_UNREADABLE'
    | 'ATTACHMENT_NOT_FOUND'
    | 'ATTACHMENT_ACCESS_DENIED'
    | 'ATTACHMENT_BINARY_EMPTY'
    | 'DRIVE_ATTACHMENT_ACCESS_DENIED'
    | 'DRIVE_DOWNLOAD_FAILED'
    | 'DRIVE_UNAUTHORIZED'
    | 'DRIVE_AUTH_REQUIRED'
    | 'DRIVE_REAUTH_REQUIRED'
    | 'DRIVE_ACCESS_DENIED'
    | 'DRIVE_FILE_NOT_FOUND'
    | 'DRIVE_CONNECTION_NOT_FOUND'
    | 'DRIVE_RATE_LIMITED'
    | 'DRIVE_UPLOAD_FAILED'
    | 'MESSAGE_SIZE_EXCEEDED'
    | 'HEADER_INJECTION_DETECTED'
    | 'INVALID_RECIPIENT'
    | 'AMBIGUOUS_SEND_TIMEOUT'
    | 'DELIVERY_ALREADY_SENT'
    | 'DELIVERY_ALREADY_RESERVED'
    | 'CAMPAIGN_LIMIT_EXCEEDED'
    | 'TRANSIENT_NETWORK_ERROR';
  message: string;
  reauthRequired?: boolean;
  retryable?: boolean;
  classification?: string;
}

export class EmailDomainError extends Error {
  code: EmailProviderErrorShape['code'];
  reauthRequired: boolean;
  retryable: boolean;
  classification?: string | undefined;

  constructor(
    code: EmailProviderErrorShape['code'],
    message: string,
    reauthRequired = false,
    retryable = false,
    classification?: string | undefined
  ) {
    super(message);
    this.code = code;
    this.reauthRequired = reauthRequired;
    this.retryable = retryable;
    this.classification = classification;
  }
}