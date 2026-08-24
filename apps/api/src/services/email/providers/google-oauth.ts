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

export const GMAIL_SEND_SCOPE =
  'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.settings.basic https://www.googleapis.com/auth/userinfo.email openid';

export interface EmailAttachmentInput {
  filename: string;
  contentBase64?: string | undefined;
  path?: string | undefined;
  contentType?: string | undefined;
  size?: number | undefined;
}

export interface SendMessageOptions {
  from: string;
  to: string;
  subject: string;
  text?: string | undefined;
  html?: string | undefined;
  attachments?: EmailAttachmentInput[] | undefined;
}

export type SignatureFetchResult =
  | { status: 'success'; signature: string }
  | { status: 'empty' }
  | { status: 'insufficient_scope'; message: string }
  | { status: 'error'; message: string };

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
    let email = body.email || '';
    let sub = body.sub || '';

    // Fallback: If tokeninfo did not return an email, fetch directly from Google userinfo endpoint
    if (!email) {
      try {
        const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (userinfoRes.ok) {
          const userinfo: any = await userinfoRes.json();
          email = userinfo.email || '';
          if (!sub && userinfo.id) sub = userinfo.id;
        }
      } catch (err) {
        logger.warn({ err }, 'Fallback userinfo fetch failed');
      }
    }

    const info: GoogleTokenInfo = {
      email,
      scope: body.scope || ''
    };
    if (body.expires_in) info.expiresIn = Number(body.expires_in);
    if (sub) info.sub = sub;
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
  private refreshPromise: Promise<{ accessToken: string; tokenExpiresAt: string }> | null = null;

  constructor(
    private readonly oauth: GoogleOAuthClient,
    private tokens: {
      refreshToken: string;
      accessToken?: string;
      tokenExpiresAt?: string;
    },
    private readonly onTokenRefresh?: (tokens: {
      accessToken: string;
      tokenExpiresAt: string;
      refreshToken?: string;
    }) => Promise<void>
  ) {}

  /** Returns a valid access token, refreshing if expired or missing. Prevents concurrent refresh stampedes. */
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

    if (this.refreshPromise) {
      return await this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const refreshed = await this.oauth.refreshAccessToken(this.tokens.refreshToken);
        const newExpiresAt = new Date(Date.now() + refreshed.expiresIn * 1000).toISOString();

        this.tokens.accessToken = refreshed.accessToken;
        this.tokens.tokenExpiresAt = newExpiresAt;
        if (refreshed.refreshToken) {
          this.tokens.refreshToken = refreshed.refreshToken;
        }

        if (this.onTokenRefresh) {
          await this.onTokenRefresh({
            accessToken: refreshed.accessToken,
            tokenExpiresAt: newExpiresAt,
            ...(refreshed.refreshToken ? { refreshToken: refreshed.refreshToken } : {})
          }).catch((err) => {
            logger.warn({ err }, 'Failed to persist refreshed Google tokens to database');
          });
        }

        return { accessToken: refreshed.accessToken, tokenExpiresAt: newExpiresAt };
      } finally {
        this.refreshPromise = null;
      }
    })();

    return await this.refreshPromise;
  }

  async verify(): Promise<{ email: string }> {
    const { accessToken } = await this.getAccessToken();
    const info = await this.oauth.getTokenInfo(accessToken);
    return { email: info.email };
  }

  /**
   * Fetches the user's configured web HTML signature for the given sendAs email address.
   * Returns explicit SignatureFetchResult covering success, empty signature, 403 scope issues, or API errors.
   */
  async getSendAsSignature(sendAsEmail: string): Promise<SignatureFetchResult> {
    try {
      const { accessToken } = await this.getAccessToken();
      const url = `https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs/${encodeURIComponent(sendAsEmail)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (res.status === 403 || res.status === 401) {
        return {
          status: 'insufficient_scope',
          message: 'Gmail authorization requires updated permissions. Reconnect Gmail to enable signature sync.'
        };
      }
      if (!res.ok) {
        return { status: 'error', message: `Gmail API request failed (HTTP ${res.status})` };
      }
      const data: any = await res.json().catch(() => ({}));
      const signature = data?.signature ? String(data.signature).trim() : '';
      if (signature) {
        return { status: 'success', signature };
      }
      return { status: 'empty' };
    } catch (err: any) {
      return { status: 'error', message: err?.message || 'Failed to fetch signature from Gmail.' };
    }
  }

  async sendMessage(options: SendMessageOptions): Promise<string> {
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

  private async buildRawMime(options: SendMessageOptions): Promise<string> {
    const hasAttachments = Array.isArray(options.attachments) && options.attachments.length > 0;
    const mixedBoundary = `----=_Part_Mixed_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const altBoundary = `----=_Part_Alt_${Date.now()}_${Math.random().toString(36).substring(2)}`;

    const headers = [
      `From: ${options.from}`,
      `To: ${options.to}`,
      `Subject: =?UTF-8?B?${Buffer.from(options.subject, 'utf8').toString('base64')}?=`,
      'MIME-Version: 1.0'
    ];

    if (hasAttachments) {
      headers.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);
      const parts: string[] = [];

      // Part 1: multipart/alternative (text + html)
      parts.push(`--${mixedBoundary}`);
      parts.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
      parts.push('');
      parts.push(`--${altBoundary}`);
      parts.push('Content-Type: text/plain; charset=UTF-8');
      parts.push('Content-Transfer-Encoding: 8bit');
      parts.push('');
      parts.push(options.text || '');
      if (options.html) {
        parts.push(`--${altBoundary}`);
        parts.push('Content-Type: text/html; charset=UTF-8');
        parts.push('Content-Transfer-Encoding: 8bit');
        parts.push('');
        parts.push(options.html);
      }
      parts.push(`--${altBoundary}--`);

      // Attachment parts
      for (const att of options.attachments!) {
        let base64Data = att.contentBase64 || '';
        if (!base64Data && att.path) {
          try {
            const fs = await import('fs');
            if (fs.existsSync(att.path)) {
              base64Data = fs.readFileSync(att.path).toString('base64');
            }
          } catch {
            // ignore
          }
        }
        if (!base64Data) {
          throw new Error(`Attachment file missing or unreadable: ${att.filename || att.path}`);
        }

        const contentType = att.contentType || 'application/octet-stream';
        const filename = att.filename || 'attachment';
        const safeFilename = filename.replace(/"/g, '');

        parts.push(`--${mixedBoundary}`);
        parts.push(`Content-Type: ${contentType}; name="${safeFilename}"`);
        parts.push(`Content-Disposition: attachment; filename="${safeFilename}"`);
        parts.push('Content-Transfer-Encoding: base64');
        parts.push('');
        // Break base64 lines into 76 chars per RFC 2045
        const chunks = base64Data.match(/.{1,76}/g) || [base64Data];
        parts.push(chunks.join('\r\n'));
      }
      parts.push(`--${mixedBoundary}--`);

      const fullMessage = `${headers.join('\r\n')}\r\n\r\n${parts.join('\r\n')}`;
      return Buffer.from(fullMessage, 'utf8').toString('base64url');
    }

    if (options.html) {
      headers.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
      const body = [
        `--${altBoundary}`,
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        '',
        options.text || '',
        `--${altBoundary}`,
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        '',
        options.html,
        `--${altBoundary}--`
      ].join('\r\n');
      const fullMessage = `${headers.join('\r\n')}\r\n\r\n${body}`;
      return Buffer.from(fullMessage, 'utf8').toString('base64url');
    }

    headers.push('Content-Type: text/plain; charset=UTF-8');
    headers.push('Content-Transfer-Encoding: 8bit');
    const fullMessage = `${headers.join('\r\n')}\r\n\r\n${options.text || ''}`;
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