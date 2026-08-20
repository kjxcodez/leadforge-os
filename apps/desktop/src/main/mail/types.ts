/**
 * Small provider abstraction for outbound email sending.
 *
 * Both SMTP (Nodemailer) and Gmail OAuth (Gmail REST API) sending are exposed
 * through this interface so outreach/automation code does not need to know
 * which transport a mailbox uses.
 *
 * IMPORTANT: Modules under `mail/` must NOT import `electron` so they can be
 * used inside forked worker processes.
 */

export type MailProviderKind = 'smtp' | 'gmail_oauth';

export interface MailSendOptions {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface MailSendResult {
  messageId: string;
  accepted?: string[];
  rejected?: string[];
  response?: string;
}

export interface MailProvider {
  readonly kind: MailProviderKind;
  /** Validates connectivity/credentials without sending. */
  verify(): Promise<boolean>;
  send(options: MailSendOptions): Promise<MailSendResult>;
  /** Releases any underlying connections/resources. */
  close(): void;
}

export interface SmtpMailProviderConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  connectionTimeout?: number;
  greetingTimeout?: number;
  socketTimeout?: number;
}

export interface GmailMailProviderConfig {
  /** The Gmail account email address used as the sender. */
  user: string;
  /** Google OAuth 2.0 client credentials (used to refresh access tokens). */
  clientId: string;
  clientSecret: string;
  /** Long-lived refresh token. */
  refreshToken: string;
  /** Cached access token, if present. */
  accessToken?: string;
  /** ISO timestamp when `accessToken` expires. */
  tokenExpiresAt?: string;
}

export interface MailProviderResolution {
  kind: MailProviderKind;
  smtp?: SmtpMailProviderConfig;
  gmail?: GmailMailProviderConfig;
}

export interface MailProviderError extends Error {
  /** true when the OAuth token is expired/revoked/invalid and re-auth is required. */
  reauthRequired?: boolean;
  /** true when credentials are invalid (e.g. bad SMTP password). */
  invalidCredentials?: boolean;
}

export function isReauthError(err: unknown): boolean {
  return !!(err && typeof err === 'object' && (err as MailProviderError).reauthRequired);
}

export function isInvalidCredentialsError(err: unknown): boolean {
  return !!(err && typeof err === 'object' && (err as MailProviderError).invalidCredentials);
}