import assert from 'assert';
import { SdkClient } from '@leadforge/sdk';

/**
 * Phase 10C-R4 — Worker Authentication Boundary Regression Unit Tests
 */
async function runTests() {
  console.log('[Desktop Test] Starting Worker Auth Boundary Tests...');

  // Test 1: SdkClient constructs Authorization Bearer and x-workspace-id headers correctly
  const mockToken = 'mock_session_token_12345';
  const mockWorkspaceId = 'ws_test_99999';

  let capturedHeaders: Record<string, string> = {};

  // Intercept fetch
  const originalFetch = global.fetch;
  (global as any).fetch = async (url: string, init?: RequestInit) => {
    capturedHeaders = (init?.headers as Record<string, string>) || {};
    return new Response(JSON.stringify({ success: true, data: { messageId: 'msg_test_001' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    const sdk = new SdkClient({
      baseUrl: 'http://localhost:3001/api/v1',
      token: mockToken,
      headers: {
        'x-workspace-id': mockWorkspaceId
      }
    });

    await sdk.outreach.sendEmail({
      accountId: 'acc_123',
      to: 'test@example.com',
      subject: 'Test Subject',
      html: '<p>Test</p>'
    });

    assert.strictEqual(
      capturedHeaders['Authorization'],
      `Bearer ${mockToken}`,
      'Authorization header MUST contain Bearer <token>'
    );
    assert.strictEqual(
      capturedHeaders['x-workspace-id'],
      mockWorkspaceId,
      'x-workspace-id header MUST match the provided workspace ID'
    );

    console.log('✅ Test 1 Passed: SdkClient correctly attaches Authorization and x-workspace-id headers.');

    // Test 2: Missing token throws SDK 401 response handling
    (global as any).fetch = async () => {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Unauthorized access. Please log in.' }
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const unauthSdk = new SdkClient({
      baseUrl: 'http://localhost:3001/api/v1',
      token: ''
    });

    try {
      await unauthSdk.outreach.sendEmail({
        accountId: 'acc_123',
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>'
      });
      assert.fail('Unauthenticated SDK request must throw SdkError with status 401');
    } catch (err: any) {
      assert.strictEqual(err.status, 401, 'Error status must be 401');
      assert.strictEqual(
        err.message,
        'Unauthorized access. Please log in.',
        'Error message must match API response'
      );
      console.log('✅ Test 2 Passed: Unauthenticated request is rejected with 401 SdkError.');
    }

    console.log('[Desktop Test] PASS: All Worker Auth Boundary Tests Passed!');
  } finally {
    (global as any).fetch = originalFetch;
  }
}

runTests();
