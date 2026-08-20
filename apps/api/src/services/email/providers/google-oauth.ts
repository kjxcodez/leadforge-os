import { env, logger } from '../../../config/index.js';

/**
 * Server-side Google OAuth + Gmail REST client.
 *
 * Mirrors the desktop Gmail client (`apps/desktop/src/main/gmail/google-client.ts`)
 * but uses the API's `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` env vars and
 * reads/writes Gmail tokens directly from MongoDB-encrypted fields. No browser
 * or Electron involvement.
 */

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
const GMAIL_SEND_API_URL =
 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

export const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GoogleTokenResponse {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn: number;
  scope: string;
}

export interface GoogleTokenInfo {
  email: string;
  scope: string;
  expiresIn?: number;
  sub?: string;
}

export class GoogleOAuthError extends Error {
  reauthRequired: boolean;
  constructor(message: string, reauthRequired = false) {
    super(message);
    this.reauthRequired = reauthRequired;
  }
}

export class GoogleOAuthClient {
  constructor(private readonly config: GoogleOAuthConfig) {}

  /** Build the user-facing authorization URL with optional PKCE codeChallenge. */
  buildAuthUrl(state: string, codeChallenge?: string, scopes: string = GMAIL_SEND_SCOPE): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: scopes,
      access_type: 'offline',
      prompt: 'consent',
      state
    });
    if (codeChallenge) {
      params.set('code_challenge', codeChallenge);
      params.set('code_challenge_method', 'S256');
    }
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /** Exchange an authorization code (with optional PKCE codeVerifier) for tokens. */
  async exchangeCodeForTokens(code: string, codeVerifier?: string): Promise<GoogleTokenResponse> {
    const form: Record<string, string> = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri
    };
    if (codeVerifier) {
      form.code_verifier = codeVerifier;
    }
    return this.requestTokens(form);
  }

  /** Refresh an access token. Marks reauth required on invalid_grant. */
  async refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
    return this.requestTokens({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    });
  }

  /** Revoke a refresh/access token with Google. */
  async revokeToken(token: string): Promise<void> {
    try {
      const res = await fetch(
        `${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
      );
      if (res.status !== 200 && res.status !== 400) {
        throw new GoogleOAuthError(
          `Failed to revoke Gmail access (HTTP ${res.status})`,
          true
        );
      }
    } catch (err) {
      if (err instanceof GoogleOAuthError) throw err;
      throw new GoogleOAuthError('Failed to revoke Gmail access', true);
    }
  }

  /** Resolve email and subject for an access token. */
  async getTokenInfo(accessToken: string): Promise<GoogleTokenInfo> {
    const res = await fetch(
      `${GOOGLE_TOKENINFO_URL}?access_token=${encodeURIComponent(accessToken)}`
    );
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok || body.error) {
      throw new GoogleOAuthError(
        'Gmail access token is invalid',
        res.status === 401 || res.status === 400
      );
    }
    const info: GoogleTokenInfo = {
      email: body.email || '',
      scope: body.scope || ''
    };
    if (body.expires_in) info.expiresIn = Number(body.expires_in);
    if (body.sub) info.sub = body.sub;
    return info;
  }

  private async requestTokens(
    form: Record<string, string>
  ): Promise<GoogleTokenResponse> {
    const params = new URLSearchParams({
      ...form,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret
    });
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok || body.error) {
      const invalidGrant =
        body.error === 'invalid_grant' || body.error === 'invalid_client';
      logger.warn(
        { error: body.error, status: res.status },
        'Google token request failed'
      );
      throw new GoogleOAuthError(
        `Google token request failed (${body.error || res.status})`,
        invalidGrant
      );
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

export class GmailApiClient {
  constructor(
    private readonly oauth: GoogleOAuthClient,
    private tokens: {
      refreshToken: string;
      accessToken?: string;
      tokenExpiresAt?: string;
    }
  ) {}

  /** Returns a valid access token, refreshing if expired or missing. */
  async getAccessToken(): Promise<{ accessToken: string; tokenExpiresAt: string | null }> {
    const now = Date.now();
    const expiresAt = this.tokens.tokenExpiresAt
      ? new Date(this.tokens.tokenExpiresAt).getTime()
      : 0;
    if (this.tokens.accessToken && (expiresAt === 0 || expiresAt - now > 60_000)) {
      return {
        accessToken: this.tokens.accessToken,
        tokenExpiresAt: this.tokens.tokenExpiresAt || null
      };
    }
    const refreshed = await this.oauth.refreshAccessToken(this.tokens.refreshToken);
    const newExpiresAt = new Date(Date.now() + refreshed.expiresIn * 1000).toISOString();
    this.tokens.accessToken = refreshed.accessToken;
    this.tokens.tokenExpiresAt = newExpiresAt;
    return { accessToken: refreshed.accessToken, tokenExpiresAt: newExpiresAt };
  }

  async verify(): Promise<{ email: string }> {
    const { accessToken } = await this.getAccessToken();
    const info = await this.oauth.getTokenInfo(accessToken);
    return { email: info.email };
  }

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
        throw new GoogleOAuthError(
          'Gmail authorization expired or was revoked. Please reconnect the mailbox.',
          true
        );
      }
      throw new GoogleOAuthError(
        `Gmail send failed (HTTP ${res.status}): ${
          body?.error?.message || 'unknown error'
        }`
      );
    }
    return body.id || '';
  }

  private buildRawMime(options: {
    from: string;
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }): string {
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const headers = [
      `From: ${options.from}`,
      `To: ${options.to}`,
      `Subject: =?UTF-8?B?${Buffer.from(options.subject, 'utf8').toString('base64')}?=`,
      'MIME-Version: 1.0'
    ];

    let body = '';
    if (options.html) {
      headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
      body = [
        `--${boundary}`,
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        '',
        options.text || '',
        `--${boundary}`,
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        '',
        options.html,
        `--${boundary}--`
      ].join('\r\n');
    } else {
      headers.push('Content-Type: text/plain; charset=UTF-8');
      headers.push('Content-Transfer-Encoding: 8bit');
      body = options.text || '';
    }

    const fullMessage = `${headers.join('\r\n')}\r\n\r\n${body}`;
    return Buffer.from(fullMessage, 'utf8').toString('base64url');
  }
}

export function getServerGmailOAuthClient(redirectUri: string): GoogleOAuthClient {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new GoogleOAuthError(
      'Gmail OAuth is not configured on the API. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
      false
    );
  }
  return new GoogleOAuthClient({
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri
  });
}