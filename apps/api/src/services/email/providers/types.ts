import {
  EmailDomainError,
  type EmailProviderHealth,
  type SendEmailInput,
  type SendEmailResult
} from '../types.js';

/**
 * Transport-level provider interface. Implemented by GmailProvider and
 * SMTPProvider. EmailService composes EmailProvider — it never calls Google
 * or SMTP APIs directly.
 */
export interface EmailProvider {
  readonly kind: 'gmail_oauth' | 'smtp';

  /** Lightweight health check (e.g. token validity, mailer login). */
  verify(): Promise<EmailProviderHealth>;

  /** Send a single email through the mailbox. */
  send(input: SendEmailInput): Promise<SendEmailResult>;

  /** Release any underlying resources. */
  close(): void;
}

export async function withProviderErrorMapping<T>(
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    if (err instanceof EmailDomainError) throw err;
    if (err?.reauthRequired) {
      throw new EmailDomainError(
        'MAILBOX_REAUTH_REQUIRED',
        err.message || 'Mailbox requires re-authentication.',
        true
      );
    }
    throw new EmailDomainError('EMAIL_SEND_FAILED', err?.message || String(err));
  }
}