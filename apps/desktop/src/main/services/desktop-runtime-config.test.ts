import assert from 'node:assert';
import { normalizeApiUrl, DEFAULT_PRODUCTION_API_URL, DEFAULT_DEVELOPMENT_API_URL } from '../lib/config.js';
import { resolveWorkerApiUrl } from '../workers/worker-host.js';
import type { JobContext } from '../../shared/types/job.js';

export async function runDesktopRuntimeConfigTests() {
  console.log('\n============================================================');
  console.log('--- DESKTOP RUNTIME CONFIGURATION REGRESSION TEST SUITE ---');
  console.log('============================================================\n');

  // ── 1. DEFAULT ENDPOINTS CONSTANTS ──────────────────────────────────────────
  console.log('[Test 1] Testing default development and production endpoints...');
  assert.strictEqual(
    DEFAULT_PRODUCTION_API_URL,
    'https://api.leadforge.kapiljangid.pro/api/v1',
    'DEFAULT_PRODUCTION_API_URL must match production server endpoint'
  );
  assert.strictEqual(
    DEFAULT_DEVELOPMENT_API_URL,
    'http://localhost:3001/api/v1',
    'DEFAULT_DEVELOPMENT_API_URL must match local development API endpoint'
  );
  console.log('✅ Default endpoint constants verified.');

  // ── 2. NORMALIZE API URL HELPER ────────────────────────────────────────────
  console.log('\n[Test 2] Testing normalizeApiUrl logic...');
  assert.strictEqual(
    normalizeApiUrl('http://localhost:3001'),
    'http://localhost:3001/api/v1',
    'Must append /api/v1 if missing'
  );
  assert.strictEqual(
    normalizeApiUrl('http://localhost:3001/'),
    'http://localhost:3001/api/v1',
    'Must trim trailing slashes before appending /api/v1'
  );
  assert.strictEqual(
    normalizeApiUrl('https://api.leadforge.kapiljangid.pro/api/v1'),
    'https://api.leadforge.kapiljangid.pro/api/v1',
    'Must preserve existing /api/v1'
  );
  assert.strictEqual(
    normalizeApiUrl('api.leadforge.kapiljangid.pro/api/v1'),
    'https://api.leadforge.kapiljangid.pro/api/v1',
    'Must prefix https:// if protocol is omitted'
  );
  assert.strictEqual(normalizeApiUrl(''), '', 'Empty input must return empty string');
  console.log('✅ normalizeApiUrl verified across edge cases.');

  // ── 3. WORKER API URL RESOLUTION (LOUD FAILURE & PRECEDENCE) ────────────────
  console.log('\n[Test 3] Testing resolveWorkerApiUrl contract...');

  // Mock JobContext with payload._config.apiUrl
  const mockCtxWithConfig: JobContext = {
    jobId: 'job_1',
    workspaceId: 'ws_1',
    payload: {
      _config: {
        apiUrl: 'https://custom-api.leadforge.io/api/v1'
      }
    },
    dbPath: ':memory:',
    updateProgress: () => {},
    emitLog: () => {},
    isCancelled: () => false,
    isPaused: () => false,
    saveCheckpoint: () => {},
    getCheckpoint: () => null
  };

  const resolved1 = resolveWorkerApiUrl(mockCtxWithConfig);
  assert.strictEqual(
    resolved1,
    'https://custom-api.leadforge.io/api/v1',
    'Must resolve apiUrl from payload._config'
  );

  // Mock JobContext with env fallback when _config is omitted
  const originalEnvApiUrl = process.env.API_URL;
  try {
    process.env.API_URL = 'http://localhost:3001/api/v1';
    const mockCtxWithoutConfig: JobContext = {
      jobId: 'job_2',
      workspaceId: 'ws_1',
      payload: {},
      dbPath: ':memory:',
      updateProgress: () => {},
      emitLog: () => {},
      isCancelled: () => false,
      isPaused: () => false,
      saveCheckpoint: () => {},
      getCheckpoint: () => null
    };
    const resolved2 = resolveWorkerApiUrl(mockCtxWithoutConfig);
    assert.strictEqual(
      resolved2,
      'http://localhost:3001/api/v1',
      'Must resolve from process.env.API_URL if payload._config is omitted'
    );
  } finally {
    process.env.API_URL = originalEnvApiUrl;
  }

  // Loud failure when both _config and process.env.API_URL are absent
  const mockCtxEmpty: JobContext = {
    jobId: 'job_3',
    workspaceId: 'ws_1',
    payload: {},
    dbPath: ':memory:',
    updateProgress: () => {},
    emitLog: () => {},
    isCancelled: () => false,
    isPaused: () => false,
    saveCheckpoint: () => {},
    getCheckpoint: () => null
  };

  const savedEnv = process.env.API_URL;
  delete process.env.API_URL;
  try {
    assert.throws(
      () => resolveWorkerApiUrl(mockCtxEmpty),
      /LeadForge could not determine the API server URL for this environment/,
      'Must throw loud descriptive error when API URL cannot be resolved'
    );
    console.log('✅ resolveWorkerApiUrl fails loudly when API URL is missing.');
  } finally {
    process.env.API_URL = savedEnv;
  }

  console.log('\n============================================================');
  console.log('--- ALL RUNTIME CONFIGURATION TESTS PASSED (3/3) ---');
  console.log('============================================================\n');
}

if (process.argv[1]?.includes('desktop-runtime-config.test')) {
  runDesktopRuntimeConfigTests().catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
}
