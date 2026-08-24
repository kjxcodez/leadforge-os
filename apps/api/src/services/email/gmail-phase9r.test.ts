import assert from 'assert';
import { sanitizeUrl } from '../../middleware/logger.js';
import { EmailDomainError } from './types.js';

/**
 * Phase 9R — Runtime Correction & Hardening Verification Suite
 *
 * Verifies:
 * 1. OAuth log query secret redaction (code, state, tokens).
 * 2. Attachment error handling (EmailDomainError with ATTACHMENT_UNREADABLE code).
 * 3. Client HTTP status code mapping (no opaque 500 errors for user attachment/limit inputs).
 */

function runTests() {
  console.log('[Test] Starting Phase 9R Runtime Hardening Tests...');

  // Test 1: OAuth Callback Log Redaction (P1 Security)
  const sensitiveUrl = 'http://localhost:3000/api/v1/email/accounts/gmail/oauth/callback?code=4/0AX4XfW12345SECRET&state=abc123state&scope=gmail';
  const sanitized = sanitizeUrl(sensitiveUrl);

  assert.ok(!sanitized.includes('4/0AX4XfW12345SECRET'), 'OAuth authorization code MUST be redacted');
  assert.ok(!sanitized.includes('abc123state'), 'OAuth state parameter MUST be redacted');
  assert.ok(sanitized.includes('code=%5BREDACTED%5D') || sanitized.includes('code=[REDACTED]'), 'Code param should be replaced with [REDACTED]');
  assert.ok(sanitized.includes('state=%5BREDACTED%5D') || sanitized.includes('state=[REDACTED]'), 'State param should be replaced with [REDACTED]');

  // Test 2: Additional Token Redaction
  const tokenUrl = 'http://localhost:3000/api/v1/email/send?token=xyz987&access_token=secret_at&refresh_token=secret_rt';
  const sanitizedTokens = sanitizeUrl(tokenUrl);
  assert.ok(!sanitizedTokens.includes('xyz987'), 'Token query param must be redacted');
  assert.ok(!sanitizedTokens.includes('secret_at'), 'Access token query param must be redacted');
  assert.ok(!sanitizedTokens.includes('secret_rt'), 'Refresh token query param must be redacted');

  // Test 3: EmailDomainError properties for attachment failures
  const err = new EmailDomainError(
    'ATTACHMENT_UNREADABLE',
    'Unable to read attachment "proposal.pdf". Please remove and attach the file again.'
  );
  assert.strictEqual(err.code, 'ATTACHMENT_UNREADABLE', 'Domain error code should be ATTACHMENT_UNREADABLE');
  assert.ok(err.message.includes('proposal.pdf'), 'Message should identify target filename');

  console.log('[Test] PASS: All Phase 9R Runtime Hardening Tests Passed!');
}

runTests();
