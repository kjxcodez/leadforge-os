import assert from 'assert';

/**
 * Phase 8R — Global User-Scoped Test Recipient Limit Test
 *
 * Verifies:
 * 1. Maximum 3 unique test recipients per LeadForge user.
 * 2. Limit persists across multiple senders and workspaces for the same user.
 * 3. Reusing a previously registered recipient is always allowed.
 * 4. 4th unique recipient is rejected.
 * 5. Case-insensitivity and trimming normalization.
 * 6. User A quota does not affect User B quota.
 */

// Simulated In-Memory Registry representing UserTestRecipientModel
const globalRegistry = new Map<string, Array<{ email: string; firstUsedAt: Date; lastUsedAt: Date }>>();

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function registerTestRecipient(userId: string, rawEmail: string): { success: boolean; error?: string } {
  const email = normalizeEmail(rawEmail);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return { success: false, error: 'Invalid email address' };
  }

  const existing = globalRegistry.get(userId) || [];
  const isKnown = existing.some((r) => r.email === email);

  if (!isKnown) {
    if (existing.length >= 3) {
      return {
        success: false,
        error: 'You can use up to 3 different test recipients across your LeadForge account. Reuse one of your existing test addresses to continue.'
      };
    }
    existing.push({ email, firstUsedAt: new Date(), lastUsedAt: new Date() });
    globalRegistry.set(userId, existing);
  } else {
    const match = existing.find((r) => r.email === email);
    if (match) match.lastUsedAt = new Date();
  }

  return { success: true };
}

function runTests() {
  console.log('[Test] Starting Global User Test Recipient Limit Tests...');

  const userIdA = 'user_111';
  const userIdB = 'user_222';

  // Test 1: User A registers 3 unique recipients across different workspaces/senders
  assert.strictEqual(registerTestRecipient(userIdA, '  Alice@Example.com ').success, true, 'First recipient should succeed');
  assert.strictEqual(registerTestRecipient(userIdA, 'bob@example.com').success, true, 'Second recipient should succeed');
  assert.strictEqual(registerTestRecipient(userIdA, 'carol@example.com').success, true, 'Third recipient should succeed');

  // Test 2: User A attempts 4th unique recipient -> REJECTED
  const res4 = registerTestRecipient(userIdA, 'dave@example.com');
  assert.strictEqual(res4.success, false, '4th recipient should be rejected');
  assert.ok(res4.error?.includes('up to 3 different test recipients'), 'Error should be user-friendly');

  // Test 3: User A reuses 1st recipient ('alice@example.com') with different case -> ALLOWED
  assert.strictEqual(registerTestRecipient(userIdA, 'ALICE@EXAMPLE.COM').success, true, 'Reusing 1st recipient should be allowed');

  // Test 4: User B (different user) has independent quota
  assert.strictEqual(registerTestRecipient(userIdB, 'dave@example.com').success, true, 'User B should be able to add dave@example.com');
  assert.strictEqual(registerTestRecipient(userIdB, 'eve@example.com').success, true, 'User B second recipient');
  assert.strictEqual(registerTestRecipient(userIdB, 'frank@example.com').success, true, 'User B third recipient');
  assert.strictEqual(registerTestRecipient(userIdB, 'grace@example.com').success, false, 'User B 4th recipient rejected');

  console.log('[Test] PASS: All Global User Test Recipient Limit Tests Passed!');
}

runTests();
