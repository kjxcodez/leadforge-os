import { GmailMailProvider } from './gmail-provider';
import { SmtpMailProvider } from './smtp-provider';
import type { MailProvider, MailProviderResolution } from './types';

export * from './types';

/**
 * Resolves a concrete mail provider from a normalized provider configuration.
 * Outreach and automation code should use this factory instead of constructing
 * Nodemailer/Gmail transports directly.
 */
export function createMailProvider(resolution: MailProviderResolution): MailProvider {
  if (resolution.kind === 'gmail_oauth' && resolution.gmail) {
    return new GmailMailProvider(resolution.gmail);
  }
  if (resolution.smtp) {
    return new SmtpMailProvider(resolution.smtp);
  }
  throw new Error('Cannot build mail provider: no valid transport configuration found.');
}

/**
 * Determines the effective provider kind for an email account row.
 * Gmail OAuth accounts are identified by provider == 'gmail_oauth' or by the
 * presence of an OAuth refresh token.
 */
export function resolveProviderKind(account: Record<string, any> | null | undefined): 'gmail_oauth' | 'smtp' {
  if (!account) return 'smtp';
  const provider = (account.provider || '').toLowerCase();
  if (provider === 'gmail_oauth' || provider === 'gmail_oauth2') return 'gmail_oauth';
  if (account.refreshToken || account.gmailRefreshToken) return 'gmail_oauth';
  return 'smtp';
}