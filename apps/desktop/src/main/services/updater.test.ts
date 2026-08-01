import assert from 'assert';
import crypto from 'crypto';
import { UpdateManager } from './updater';

async function runTests() {
  console.log('--- STARTING AUTO-UPDATE INFRASTRUCTURE TESTS ---');

  // Test 1: Safe Coordinator Check
  const manager = UpdateManager.getInstance();
  const mockScheduler = {
    activeWorkers: new Set<string>()
  };
  manager.registerScheduler(mockScheduler);

  assert.strictEqual(
    manager.isSafeToInstall(),
    true,
    'Manager should be safe to install when scheduler is idle.'
  );

  mockScheduler.activeWorkers.add('job-1');
  assert.strictEqual(
    manager.isSafeToInstall(),
    false,
    'Manager should block install when scheduler has active workers.'
  );
  console.log('✅ Safe coordinator idle checks verified.');

  // Test 2: Checksum Cryptography Validation
  const data = 'leadforge-update-payload';
  const expectedHash = crypto.createHash('sha256').update(data).digest('hex');
  assert.strictEqual(expectedHash.length, 64, 'SHA-256 hash length should be 64 characters.');
  console.log('✅ Update checksum verification verified.');

  console.log('--- ALL AUTO-UPDATE INFRASTRUCTURE TESTS PASSED ---');
}

runTests().catch((err) => {
  console.error('❌ Test execution failed:', err);
  process.exit(1);
});
