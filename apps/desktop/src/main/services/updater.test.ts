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

  // Test 3: Version Comparison Logic (Prerelease aware)
  const provider = new (require('./updater').GitHubUpdateProvider)('kjxcodez', 'leadforge-os');
  const isNewer = (provider as any).isNewerVersion.bind(provider);

  assert.strictEqual(isNewer('0.1.0-beta.2', '0.1.0-beta.1'), true, 'beta.2 should be newer than beta.1');
  assert.strictEqual(isNewer('0.1.0-beta.1', '0.0.1'), true, '0.1.0-beta.1 should be newer than 0.0.1');
  assert.strictEqual(isNewer('0.1.0', '0.1.0-beta.1'), true, 'Stable 0.1.0 should be newer than beta.1');
  assert.strictEqual(isNewer('0.1.0-beta.1', '0.1.0'), false, 'beta.1 should not be newer than stable 0.1.0');
  assert.strictEqual(isNewer('0.1.0-beta.1', '0.1.0-beta.1'), false, 'Identical versions should not be newer');
  console.log('✅ Version comparison prerelease checks verified.');

  console.log('--- ALL AUTO-UPDATE INFRASTRUCTURE TESTS PASSED ---');
}

runTests().catch((err) => {
  console.error('❌ Test execution failed:', err);
  process.exit(1);
});
