/**
 * Gmail OAuth Lifecycle & Token Refresh Unit Test Suite
 */

import { describe, it, expect } from 'vitest';
import {
  GmailApiClient,
  GoogleOAuthClient,
  type GoogleTokenResponse,
  GoogleOAuthError
} from './providers/google-oauth.js';

class MockGoogleOAuthClient extends GoogleOAuthClient {
  public refreshCount = 0;
  public shouldFail = false;

  constructor() {
    super({ clientId: 'mock-client', clientSecret: 'mock-secret', redirectUri: 'http://localhost' });
  }

  override async refreshAccessToken(_refreshToken: string): Promise<GoogleTokenResponse> {
    this.refreshCount++;
    if (this.shouldFail) {
      throw new GoogleOAuthError('Token request failed (invalid_grant)', true);
    }
    return {
      accessToken: `refreshed_access_token_${this.refreshCount}`,
      refreshToken: 'same_refresh_token',
      tokenType: 'Bearer',
      expiresIn: 3600,
      scope: 'https://www.googleapis.com/auth/gmail.send'
    };
  }
}

describe('Gmail OAuth Lifecycle & Refresh Suite', () => {
  it('returns valid existing access token without triggering refresh', async () => {
    const mockOAuth = new MockGoogleOAuthClient();
    const client = new GmailApiClient(
      mockOAuth,
      {
        refreshToken: 'rt_123',
        accessToken: 'valid_access_token',
        tokenExpiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
      },
      async () => {}
    );

    const res = await client.getAccessToken();
    expect(res.accessToken).toBe('valid_access_token');
    expect(mockOAuth.refreshCount).toBe(0);
  });

  it('triggers refresh and invokes onTokenRefresh callback when token is expired', async () => {
    const mockOAuth = new MockGoogleOAuthClient();
    let persistedTokens: any = null;

    const client = new GmailApiClient(
      mockOAuth,
      {
        refreshToken: 'rt_123',
        accessToken: 'expired_access_token',
        tokenExpiresAt: new Date(Date.now() - 1000).toISOString()
      },
      async (tokens) => {
        persistedTokens = tokens;
      }
    );

    const res = await client.getAccessToken();
    expect(res.accessToken).toBe('refreshed_access_token_1');
    expect(mockOAuth.refreshCount).toBe(1);
    expect(persistedTokens).not.toBeNull();
    expect(persistedTokens.accessToken).toBe('refreshed_access_token_1');
  });

  it('prevents concurrent refresh stampedes by deduplicating in-flight promises', async () => {
    const mockOAuth = new MockGoogleOAuthClient();
    const client = new GmailApiClient(mockOAuth, {
      refreshToken: 'rt_123',
      accessToken: 'expired_access_token',
      tokenExpiresAt: new Date(Date.now() - 1000).toISOString()
    });

    const results = await Promise.all([
      client.getAccessToken(),
      client.getAccessToken(),
      client.getAccessToken(),
      client.getAccessToken(),
      client.getAccessToken(),
      client.getAccessToken(),
      client.getAccessToken(),
      client.getAccessToken(),
      client.getAccessToken(),
      client.getAccessToken()
    ]);

    expect(mockOAuth.refreshCount).toBe(1);
    for (const r of results) {
      expect(r.accessToken).toBe('refreshed_access_token_1');
    }
  });

  it('marks reauthRequired = true on revoked or invalid refresh token', async () => {
    const mockOAuth = new MockGoogleOAuthClient();
    mockOAuth.shouldFail = true;

    const client = new GmailApiClient(mockOAuth, {
      refreshToken: 'revoked_rt',
      accessToken: 'expired_access_token',
      tokenExpiresAt: new Date(Date.now() - 1000).toISOString()
    });

    await expect(client.getAccessToken()).rejects.toMatchObject({
      reauthRequired: true
    });
  });
});
