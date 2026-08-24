import assert from 'assert';
import {
  GmailApiClient,
  GoogleOAuthClient,
  type GoogleTokenResponse,
  GoogleOAuthError
} from './providers/google-oauth.js';

/**
 * Phase 9 — Gmail OAuth Lifecycle & Refresh Verification Test
 *
 * Verifies:
 * 1. Automatic refresh when access token is missing or expired.
 * 2. In-flight Promise deduplication (prevents concurrent refresh stampedes).
 * 3. Token persistence via onTokenRefresh callback.
 * 4. Graceful reauth required status transition on invalid/revoked refresh token.
 */

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

async function runTests() {
  console.log('[Test] Starting Gmail OAuth Refresh Lifecycle Tests...');

  // Test 1: Valid access token does NOT trigger refresh
  const mockOAuth1 = new MockGoogleOAuthClient();
  let persistedTokens: any = null;
  const client1 = new GmailApiClient(
    mockOAuth1,
    {
      refreshToken: 'rt_123',
      accessToken: 'valid_access_token',
      tokenExpiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
    },
    async (tokens) => {
      persistedTokens = tokens;
    }
  );

  const res1 = await client1.getAccessToken();
  assert.strictEqual(res1.accessToken, 'valid_access_token', 'Should return existing valid token');
  assert.strictEqual(mockOAuth1.refreshCount, 0, 'No refresh call should be made for valid token');

  // Test 2: Expired access token triggers refresh and invokes onTokenRefresh callback
  const mockOAuth2 = new MockGoogleOAuthClient();
  const client2 = new GmailApiClient(
    mockOAuth2,
    {
      refreshToken: 'rt_123',
      accessToken: 'expired_access_token',
      tokenExpiresAt: new Date(Date.now() - 1000).toISOString() // Expired 1 second ago
    },
    async (tokens) => {
      persistedTokens = tokens;
    }
  );

  const res2 = await client2.getAccessToken();
  assert.strictEqual(res2.accessToken, 'refreshed_access_token_1', 'Should return new refreshed token');
  assert.strictEqual(mockOAuth2.refreshCount, 1, 'Should trigger exactly 1 refresh call');
  assert.ok(persistedTokens, 'onTokenRefresh callback should have been invoked');
  assert.strictEqual(persistedTokens.accessToken, 'refreshed_access_token_1', 'Persisted access token should match');

  // Test 3: Concurrent refresh stampede prevention (10 parallel calls trigger only 1 refresh)
  const mockOAuth3 = new MockGoogleOAuthClient();
  const client3 = new GmailApiClient(mockOAuth3, {
    refreshToken: 'rt_123',
    accessToken: 'expired_access_token',
    tokenExpiresAt: new Date(Date.now() - 1000).toISOString()
  });

  const results = await Promise.all([
    client3.getAccessToken(),
    client3.getAccessToken(),
    client3.getAccessToken(),
    client3.getAccessToken(),
    client3.getAccessToken(),
    client3.getAccessToken(),
    client3.getAccessToken(),
    client3.getAccessToken(),
    client3.getAccessToken(),
    client3.getAccessToken()
  ]);

  assert.strictEqual(mockOAuth3.refreshCount, 1, '10 concurrent calls should trigger ONLY 1 OAuth refresh call');
  for (const r of results) {
    assert.strictEqual(r.accessToken, 'refreshed_access_token_1', 'All concurrent calls should receive same refreshed token');
  }

  // Test 4: Revoked/Invalid refresh token throws GoogleOAuthError with reauthRequired = true
  const mockOAuth4 = new MockGoogleOAuthClient();
  mockOAuth4.shouldFail = true;
  const client4 = new GmailApiClient(mockOAuth4, {
    refreshToken: 'revoked_rt',
    accessToken: 'expired_access_token',
    tokenExpiresAt: new Date(Date.now() - 1000).toISOString()
  });

  try {
    await client4.getAccessToken();
    assert.fail('Should have thrown GoogleOAuthError for invalid grant');
  } catch (err: any) {
    assert.strictEqual(err.reauthRequired, true, 'Should mark reauthRequired = true on invalid_grant');
  }

  console.log('[Test] PASS: All Gmail OAuth Refresh Lifecycle Tests Passed!');
}

runTests().catch((err) => {
  console.error('[Test] FAIL: Gmail OAuth Refresh Lifecycle Test Failed:', err);
  process.exit(1);
});
