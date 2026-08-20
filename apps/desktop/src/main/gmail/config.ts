/**
 * Loads Gmail OAuth configuration for the desktop main process.
 * Credentials come from `apps/desktop/.env` (GOOGLE_CLIENT_ID,
 * GOOGLE_CLIENT_SECRET, GMAIL_REDIRECT_PORT).
 */
export interface GmailOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectPort: number;
}

export function getGmailOAuthConfig(): GmailOAuthConfig {
  return {
    clientId: (process.env.GOOGLE_CLIENT_ID || '').trim(),
    clientSecret: (process.env.GOOGLE_CLIENT_SECRET || '').trim(),
    redirectPort: parseInt(process.env.GMAIL_REDIRECT_PORT || '48112', 10) || 48112
  };
}

export function isGmailOAuthConfigured(): boolean {
  const config = getGmailOAuthConfig();
  return Boolean(config.clientId && config.clientSecret);
}