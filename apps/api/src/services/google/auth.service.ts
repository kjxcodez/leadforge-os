import { env, logger } from '../../config/index.js';
import { encrypt, decrypt } from '../../utils/encryption.js';
import { GoogleConnectionModel, type GoogleConnectionDocument } from '../../db/models/google-connection.model.js';
import { EmailAccountModel } from '../../db/models/email-account.model.js';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

export const GMAIL_DEFAULT_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.settings.basic'
];

export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

export interface GoogleAuthOptions {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
}

export interface BuildAuthUrlParams {
  state: string;
  codeChallenge?: string;
  scopes?: string[];
  prompt?: string;
  loginHint?: string;
  redirectUri?: string;
}

export interface TokenExchangeResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
  scope: string;
}

export interface GoogleIdentityInfo {
  sub: string;
  email: string;
  name?: string | undefined;
  picture?: string | undefined;
  scope: string;
  expiresIn?: number | undefined;
}

export class GoogleAuthService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly defaultRedirectUri: string;
  private refreshPromises = new Map<string, Promise<string>>();

  constructor(options?: GoogleAuthOptions) {
    this.clientId = options?.clientId || env.GOOGLE_CLIENT_ID || '';
    this.clientSecret = options?.clientSecret || env.GOOGLE_CLIENT_SECRET || '';

    const baseUrl = env.BETTER_AUTH_URL.replace(/\/auth\/?$/, '');
    this.defaultRedirectUri = options?.redirectUri || `${baseUrl}/google-connections/oauth/callback`;
  }

  /**
   * Generates the Google OAuth consent URL.
   * Uses prompt='select_account consent' to permit multiple account authorization in the same browser.
   */
  public buildAuthUrl(params: BuildAuthUrlParams): string {
    const scopes = params.scopes && params.scopes.length > 0
      ? params.scopes
      : GMAIL_DEFAULT_SCOPES;

    const searchParams = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: params.redirectUri || this.defaultRedirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: params.prompt || 'select_account consent',
      include_granted_scopes: 'true',
      state: params.state
    });

    if (params.codeChallenge) {
      searchParams.set('code_challenge', params.codeChallenge);
      searchParams.set('code_challenge_method', 'S256');
    }

    if (params.loginHint) {
      searchParams.set('login_hint', params.loginHint);
    }

    return `https://accounts.google.com/o/oauth2/v2/auth?${searchParams.toString()}`;
  }

  /**
   * Exchanges authorization code for access & refresh tokens.
   */
  public async exchangeCodeForTokens(
    code: string,
    codeVerifier?: string,
    redirectUri?: string
  ): Promise<TokenExchangeResult> {
    const form: Record<string, string> = {
      grant_type: 'authorization_code',
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: redirectUri || this.defaultRedirectUri
    };

    if (codeVerifier) {
      form.code_verifier = codeVerifier;
    }

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form).toString()
    });

    const body: any = await res.json().catch(() => ({}));
    if (!res.ok || body.error) {
      logger.warn({ error: body.error, status: res.status }, 'Google token exchange error');
      throw new Error(`Google authorization code exchange failed (${body.error || res.status}): ${body.error_description || ''}`);
    }

    return {
      accessToken: body.access_token || '',
      refreshToken: body.refresh_token,
      expiresIn: Number(body.expires_in) || 3600,
      tokenType: body.token_type || 'Bearer',
      scope: body.scope || ''
    };
  }

  /**
   * Retrieves stable subject identifier (sub), email, and granted scopes.
   */
  public async getIdentityInfo(accessToken: string): Promise<GoogleIdentityInfo> {
    // 1. Resolve tokeninfo
    const tokenInfoRes = await fetch(`${GOOGLE_TOKENINFO_URL}?access_token=${encodeURIComponent(accessToken)}`);
    const tokenInfo: any = await tokenInfoRes.json().catch(() => ({}));

    if (!tokenInfoRes.ok || tokenInfo.error) {
      throw new Error(`Google token validation failed: ${tokenInfo.error || tokenInfoRes.status}`);
    }

    let sub = tokenInfo.sub || '';
    let email = tokenInfo.email || '';
    const scope = tokenInfo.scope || '';
    const expiresIn = Number(tokenInfo.expires_in) || 3600;

    let name: string | undefined;
    let picture: string | undefined;

    // 2. Fetch userinfo profile for name/avatar if available
    try {
      const userinfoRes = await fetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (userinfoRes.ok) {
        const profile: any = await userinfoRes.json().catch(() => ({}));
        if (!email && profile.email) email = profile.email;
        if (!sub && profile.id) sub = profile.id;
        name = profile.name;
        picture = profile.picture;
      }
    } catch {}

    if (!email) {
      throw new Error('Google did not return an email address for the authorized token.');
    }
    if (!sub) {
      throw new Error('Google did not return a stable subject identifier (sub) for the account.');
    }

    return {
      sub,
      email: email.toLowerCase().trim(),
      name,
      picture,
      scope,
      expiresIn
    };
  }

  /**
   * Acquires a valid, non-expired access token for the specified Google connection.
   * Automatically refreshes the token if expired or within 60s of expiration.
   * Deduplicates concurrent refresh requests for the same connectionId.
   */
  public async getValidAccessToken(connectionId: string): Promise<string> {
    const connection = await GoogleConnectionModel.findById(connectionId);
    if (!connection) {
      throw new Error(`Google Connection with id "${connectionId}" not found.`);
    }

    if (connection.status === 'disconnected') {
      throw new Error(`Google Connection "${connection.email}" is disconnected.`);
    }

    const now = Date.now();
    const expiresAt = connection.tokenExpiresAt ? new Date(connection.tokenExpiresAt).getTime() : 0;

    // If access token exists and has > 60s remaining, reuse it
    if (connection.encryptedAccessToken && expiresAt - now > 60_000) {
      return decrypt(connection.encryptedAccessToken);
    }

    // Deduplicate in-flight refresh promises for this connection
    if (this.refreshPromises.has(connectionId)) {
      return await this.refreshPromises.get(connectionId)!;
    }

    const refreshPromise = (async () => {
      try {
        const rawRefreshToken = decrypt(connection.encryptedRefreshToken);
        const form = new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: rawRefreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret
        });

        const res = await fetch(GOOGLE_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form.toString()
        });

        const body: any = await res.json().catch(() => ({}));
        if (!res.ok || body.error) {
          const isRevoked = body.error === 'invalid_grant' || body.error === 'invalid_client';
          if (isRevoked) {
            await GoogleConnectionModel.updateOne(
              { _id: connectionId },
              {
                $set: {
                  status: 'reauth_required',
                  gmailStatus: 'reauth_required',
                  driveStatus: connection.driveStatus === 'authorized' ? 'reauth_required' : connection.driveStatus,
                  lastError: 'Google authorization expired or was revoked'
                }
              }
            );
            await EmailAccountModel.updateMany(
              { googleConnectionId: connectionId },
              { $set: { status: 'reauth_required', lastError: 'Google authorization expired or was revoked' } }
            );
          }
          throw new Error(`Failed to refresh Google access token: ${body.error_description || body.error || res.status}`);
        }

        const newAccessToken = body.access_token || '';
        const newExpiresAt = new Date(Date.now() + (Number(body.expires_in) || 3600) * 1000);

        const updateSet: any = {
          encryptedAccessToken: encrypt(newAccessToken),
          tokenExpiresAt: newExpiresAt,
          lastVerifiedAt: new Date(),
          lastError: null
        };

        if (body.refresh_token) {
          updateSet.encryptedRefreshToken = encrypt(body.refresh_token);
        }

        if (body.scope) {
          const scopes = body.scope.split(' ').map((s: string) => s.trim()).filter(Boolean);
          updateSet.grantedScopes = scopes;
        }

        await GoogleConnectionModel.updateOne({ _id: connectionId }, { $set: updateSet });

        return newAccessToken;
      } finally {
        this.refreshPromises.delete(connectionId);
      }
    })();

    this.refreshPromises.set(connectionId, refreshPromise);
    return await refreshPromise;
  }

  /**
   * Revokes token with Google and updates connection & associated email accounts.
   */
  public async revokeConnection(connectionId: string): Promise<void> {
    const connection = await GoogleConnectionModel.findById(connectionId);
    if (!connection) return;

    try {
      const rawRefreshToken = decrypt(connection.encryptedRefreshToken);
      await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(rawRefreshToken)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
    } catch (err) {
      logger.warn({ err, connectionId }, 'Failed to revoke Google token with upstream server');
    }

    await GoogleConnectionModel.updateOne(
      { _id: connectionId },
      {
        $set: {
          status: 'disconnected',
          gmailStatus: 'revoked',
          driveStatus: connection.driveStatus === 'authorized' ? 'revoked' : connection.driveStatus,
          encryptedAccessToken: null,
          tokenExpiresAt: null,
          lastError: 'Revoked by user',
          updatedAt: new Date()
        }
      }
    );

    await EmailAccountModel.updateMany(
      { googleConnectionId: connectionId },
      { $set: { status: 'disconnected', lastError: 'Google account revoked' } }
    );
  }

  /**
   * Disconnects only Google Drive integration for a connection without touching Gmail.
   */
  public async disconnectDrive(connectionId: string): Promise<void> {
    const connection = await GoogleConnectionModel.findById(connectionId);
    if (!connection) return;

    const remainingScopes = (connection.grantedScopes || []).filter(
      (s: string) => !s.includes('drive')
    );

    const isGmailActive = connection.gmailStatus === 'connected';

    if (isGmailActive) {
      // Gmail is still connected: keep connection active, only mark Drive revoked
      await GoogleConnectionModel.updateOne(
        { _id: connectionId },
        {
          $set: {
            driveStatus: 'revoked',
            grantedScopes: remainingScopes,
            status: 'active',
            updatedAt: new Date()
          }
        }
      );
    } else {
      // Neither Gmail nor Drive are active: revoke connection completely
      await this.revokeConnection(connectionId);
    }
  }

  /**
   * Disconnects only Gmail integration for a connection without touching Google Drive.
   */
  public async disconnectGmail(connectionId: string): Promise<void> {
    const connection = await GoogleConnectionModel.findById(connectionId);
    if (!connection) return;

    const remainingScopes = (connection.grantedScopes || []).filter(
      (s: string) => !s.includes('gmail')
    );

    const isDriveActive = connection.driveStatus === 'authorized';

    if (isDriveActive) {
      // Drive is still authorized: keep connection active, only mark Gmail revoked
      await GoogleConnectionModel.updateOne(
        { _id: connectionId },
        {
          $set: {
            gmailStatus: 'revoked',
            grantedScopes: remainingScopes,
            status: 'active',
            updatedAt: new Date()
          }
        }
      );
    } else {
      // Neither Gmail nor Drive are active: revoke connection completely
      await this.revokeConnection(connectionId);
    }
  }

  /**
   * Disconnects a Google connection completely.
   */
  public async disconnectConnection(connectionId: string): Promise<void> {
    await this.revokeConnection(connectionId);
  }
}
