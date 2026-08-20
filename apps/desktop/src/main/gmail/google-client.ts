import type { MailProviderError } from '../mail/types';

/**
 * Google OAuth 2.0 helpers for Gmail mailbox authorization.
 *
 * IMPORTANT: This module must NOT import `electron` so it can run inside
 * forked worker processes. Raw tokens are never logged.
 */

export const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
export const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
export const GMAIL_SEND_API_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

export interface GoogleOAuthClientConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  /** seconds until access token expiry */
  expiresIn: number;
  scope: string;
}

export interface TokenInfo {
  email: string;
  scope: string;
  expiresIn?: number;
  sub?: string;
}

export interface GmailTokens {
  refreshToken: string;
  accessToken?: string;
  /** ISO timestamp at which accessToken expires. */
  tokenExpiresAt?: string;
}

function toOAuthError(err: unknown, message: string): MailProviderError {
  const wrapped: MailProviderError = new Error(message);
  const status = (err as any)?.status || (err as any)?.code;
  if (status === 401 || status === 403) {
    wrapped.reauthRequired = true;
  }
  return wrapped;
}

function isInvalidGrant(err: unknown): boolean {
  const body = (err as any)?.body || '';
  return typeof body === 'string' && body.includes('invalid_grant');
}

export class GoogleOAuthClient {
  constructor(private config: GoogleOAuthClientConfig) {}

  get redirectUri(): string {
    return this.config.redirectUri;
  }

  get clientId(): string {
    return this.config.clientId;
  }

  /**
   * Builds the Google authorization URL. Requests ONLY the scope required for
   * sending mail (`gmail.send`), `access_type=offline` to obtain a refresh
   * token, and `prompt=consent` to guarantee a refresh token is issued.
   */
  buildAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: GMAIL_SEND_SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchanges the authorization code for access + refresh tokens.
   */
  async exchangeCodeForTokens(code: string): Promise<TokenResponse> {
    return this.requestTokens({
      code,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: this.config.redirectUri,
      grant_type: 'authorization_code'
    });
  }

  /**
   * Refreshes an expired access token using the long-lived refresh token.
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    return this.requestTokens({
      refresh_token: refreshToken,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: 'refresh_token'
    });
  }

  /**
   * Revokes a refresh token, permanently invalidating the authorization.
   */
  async revokeRefreshToken(refreshToken: string): Promise<void> {
    try {
      const res = await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(refreshToken)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      // 200 and 400 (already revoked) are both acceptable outcomes.
      if (res.status !== 200 && res.status !== 400) {
        throw toOAuthError(
          { status: res.status, body: await res.text().catch(() => '') },
          `Failed to revoke Gmail access (HTTP ${res.status})`
        );
      }
    } catch (err) {
      if ((err as MailProviderError)?.reauthRequired) throw err;
      throw toOAuthError(err, 'Failed to revoke Gmail access');
    }
  }

  /**
   * Returns information about an access token including the authorized email.
   */
  async getTokenInfo(accessToken: string): Promise<TokenInfo> {
    const res = await fetch(
      `${GOOGLE_TOKENINFO_URL}?access_token=${encodeURIComponent(accessToken)}`
    );
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok || body.error) {
      throw toOAuthError({ status: res.status, body }, 'Gmail access token is invalid');
    }
    const info: TokenInfo = { email: body.email || '', scope: body.scope || '' };
    if (body.expires_in) info.expiresIn = Number(body.expires_in);
    if (body.sub) info.sub = body.sub;
    return info;
  }

  private async requestTokens(formData: Record<string, string>): Promise<TokenResponse> {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(formData).toString()
    });

    const body: any = await res.json().catch(() => ({}));

    if (!res.ok || body.error) {
      if (body.error === 'invalid_grant' || body.error === 'invalid_client') {
        const wrapped: MailProviderError = new Error(
          `Google rejected the OAuth credentials (${body.error}). Please reconnect the mailbox.`
        );
        wrapped.reauthRequired = true;
        throw wrapped;
      }
      throw toOAuthError({ status: res.status, body }, `Google token request failed (${body.error || res.status})`);
    }

    return {
      accessToken: body.access_token || '',
      refreshToken: body.refresh_token,
      tokenType: body.token_type || 'Bearer',
      expiresIn: Number(body.expires_in) || 3600,
      scope: body.scope || ''
    };
  }
}

/**
 * Thin Gmail REST API client used for sending. Handles access-token refresh
 * transparently when the cached token is missing or expired.
 */
export class GmailApiClient {
  constructor(
    private oauth: GoogleOAuthClient,
    private tokens: GmailTokens
  ) {}

  /**
   * Returns a valid access token, refreshing it if expired or missing.
   * The refreshed token is NOT persisted by this client — callers persist via
   * `persistTokens`.
   */
  async getAccessToken(): Promise<{ accessToken: string; tokenExpiresAt: string | null }> {
    const now = Date.now();
    const expiresAt = this.tokens.tokenExpiresAt
      ? new Date(this.tokens.tokenExpiresAt).getTime()
      : 0;

    if (this.tokens.accessToken && (expiresAt === 0 || expiresAt - now > 60_000)) {
      return { accessToken: this.tokens.accessToken, tokenExpiresAt: this.tokens.tokenExpiresAt || null };
    }

    const refreshed = await this.oauth.refreshAccessToken(this.tokens.refreshToken);
    const newExpiresAt = new Date(Date.now() + refreshed.expiresIn * 1000).toISOString();
    this.tokens.accessToken = refreshed.accessToken;
    this.tokens.tokenExpiresAt = newExpiresAt;
    return { accessToken: refreshed.accessToken, tokenExpiresAt: newExpiresAt };
  }

  /**
   * Validates the mailbox connection by confirming tokeninfo is reachable and
   * maps to an email address.
   */
  async verify(): Promise<{ email: string; expiresIn?: number }> {
    const { accessToken } = await this.getAccessToken();
    const info = await this.oauth.getTokenInfo(accessToken);
    const result: { email: string; expiresIn?: number } = { email: info.email };
    if (info.expiresIn !== undefined) result.expiresIn = info.expiresIn;
    return result;
  }

  /**
   * Sends a message through the Gmail REST API using the `gmail.send` scope.
   * Returns the Gmail message id.
   */
  async sendMessage(options: {
    from: string;
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }): Promise<string> {
    const raw = await this.buildRawMime(options);
    const { accessToken } = await this.getAccessToken();

    const res = await fetch(GMAIL_SEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw })
    });

    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        const wrapped: MailProviderError = new Error(
          'Gmail authorization expired or was revoked. Please reconnect the mailbox.'
        );
        wrapped.reauthRequired = true;
        throw wrapped;
      }
      throw toOAuthError(
        { status: res.status, body },
        `Gmail send failed (HTTP ${res.status}): ${body?.error?.message || 'unknown error'}`
      );
    }

    return body.id || '';
  }

  /**
   * Builds the base64url-encoded RFC822 message using Nodemailer's
   * JSON transport so we reuse the existing template/message handling.
   */
  private async buildRawMime(options: {
    from: string;
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }): Promise<string> {
    // Lazy-import to avoid pulling nodemailer into the OAuth module's load path
    // when only OAuth endpoints are needed.
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({ jsonTransport: true });
    const info = await transporter.sendMail({
      from: options.from,
      to: options.to,
      subject: options.subject,
      ...(options.html ? { html: options.html } : { text: options.text || '' })
    });
    const raw = (info as any).message as string;
    return Buffer.from(raw).toString('base64url');
  }
}