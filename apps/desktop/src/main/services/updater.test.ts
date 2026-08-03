import path from 'path';

// 1. Mock Electron immediately before importing modules that rely on it
const mockElectron = {
  app: {
    getPath: (name: string) => {
      return path.resolve(__dirname, '../../../../../report/temp-smoke');
    },
    getVersion: () => '1.0.0-beta.1',
    isPackaged: false,
    setAppUserModelId: () => {}
  },
  BrowserWindow: {
    getAllWindows: () => []
  },
  ipcMain: {
    on: () => {},
    handle: () => {}
  }
};

const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id: string) {
  if (id === 'electron') {
    return mockElectron;
  }
  return originalRequire.apply(this, arguments);
};

const assert = require('assert');
const crypto = require('crypto');
const { UpdateManager, GitHubUpdateProvider, compareVersions } = require('./updater');

// Mock fetch utility
const originalFetch = globalThis.fetch;
function mockFetch(responses: Record<string, any>) {
  globalThis.fetch = (url: any) => {
    const urlStr = String(url);
    for (const [key, val] of Object.entries(responses)) {
      if (urlStr.includes(key)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(typeof val === 'string' ? JSON.parse(val) : val),
          text: () => Promise.resolve(typeof val === 'string' ? val : JSON.stringify(val)),
          body: {
            getReader() {
              let sent = false;
              const buffer = Buffer.from(typeof val === 'string' ? val : JSON.stringify(val));
              return {
                async read() {
                  if (sent) return { done: true, value: undefined };
                  sent = true;
                  return { done: false, value: new Uint8Array(buffer) };
                }
              };
            }
          },
          headers: {
            get(name: string) {
              if (name.toLowerCase() === 'content-length') {
                const buffer = Buffer.from(typeof val === 'string' ? val : JSON.stringify(val));
                return String(buffer.length);
              }
              return null;
            }
          }
        } as any);
      }
    }
    return Promise.reject(new Error(`Unhandled mock fetch for URL: ${urlStr}`));
  };
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

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

  // Test 2: Version Comparison Logic (Prerelease aware)
  assert.strictEqual(
    compareVersions('0.1.0-beta.2', '0.1.0-beta.1') > 0,
    true,
    'beta.2 should be newer than beta.1'
  );
  assert.strictEqual(
    compareVersions('0.1.0-beta.1', '0.0.1') > 0,
    true,
    '0.1.0-beta.1 should be newer than 0.0.1'
  );
  assert.strictEqual(
    compareVersions('0.1.0', '0.1.0-beta.1') > 0,
    true,
    'Stable 0.1.0 should be newer than beta.1'
  );
  assert.strictEqual(
    compareVersions('0.1.0-beta.1', '0.1.0') < 0,
    true,
    'beta.1 should be older than stable 0.1.0'
  );
  assert.strictEqual(
    compareVersions('0.1.0-beta.1', '0.1.0-beta.1') === 0,
    true,
    'Identical versions should be equal'
  );
  console.log('✅ Version comparison prerelease checks verified.');

  // Test 3: Release Filtering and Sorting by Channel
  const provider = new GitHubUpdateProvider('kjxcodez', 'leadforge-os');

  const mockReleases = [
    {
      tag_name: 'v0.1.2',
      draft: false,
      prerelease: false,
      body: 'Old stable release',
      assets: [
        {
          name: 'LeadForge OS-0.1.2-win-x64.exe',
          browser_download_url: 'https://github.com/mock/0.1.2.exe'
        },
        { name: 'latest.yml', browser_download_url: 'https://github.com/mock/latest-old.yml' }
      ]
    },
    {
      tag_name: 'v1.0.0-beta.2',
      draft: false,
      prerelease: true,
      body: 'New pre-release version',
      assets: [
        {
          name: 'LeadForge OS-1.0.0-beta.2-win-x64.exe',
          browser_download_url: 'https://github.com/mock/1.0.0-beta.2.exe'
        },
        { name: 'latest.yml', browser_download_url: 'https://github.com/mock/latest-beta.yml' }
      ]
    },
    {
      tag_name: 'v0.1.3',
      draft: false,
      prerelease: false,
      body: 'Latest stable release',
      assets: [
        {
          name: 'LeadForge OS-0.1.3-win-x64.exe',
          browser_download_url: 'https://github.com/mock/0.1.3.exe'
        },
        { name: 'latest.yml', browser_download_url: 'https://github.com/mock/latest-stable.yml' }
      ]
    }
  ];

  // Stable channel check
  mockFetch({
    '/releases': mockReleases,
    '.sha256': 'mock-hash-value-here',
    'latest-old.yml': 'version: 0.1.2\nsha512: mock-old-sha512',
    'latest-beta.yml': 'version: 1.0.0-beta.2\nsha512: mock-beta-sha512',
    'latest-stable.yml': 'version: 0.1.3\nsha512: mock-stable-sha512'
  });

  // Querying with stable channel, currentVersion = 0.1.2
  // It should select v0.1.3 and ignore v1.0.0-beta.2 (because it's a prerelease)
  let result = await provider.checkForUpdate('0.1.2', 'stable');
  assert.strictEqual(result.updateAvailable, true, 'Update should be available on stable channel');
  assert.strictEqual(result.version, '0.1.3', 'Should select latest stable version 0.1.3');

  // Querying with stable channel, currentVersion = 0.1.3
  // It should say no update available, even though 1.0.0-beta.2 exists on GitHub
  result = await provider.checkForUpdate('0.1.3', 'stable');
  assert.strictEqual(
    result.updateAvailable,
    false,
    'No update should be found on stable channel when on latest stable'
  );

  // Beta channel check
  // Querying with beta channel, currentVersion = 0.1.3
  // It should select v1.0.0-beta.2
  result = await provider.checkForUpdate('0.1.3', 'beta');
  assert.strictEqual(result.updateAvailable, true, 'Update should be available on beta channel');
  assert.strictEqual(result.version, '1.0.0-beta.2', 'Should select latest beta version');

  console.log('✅ Channel filtering and semver sorting verified.');

  // Test 4: Checksum integrity and fallback check
  const testPayload = 'leadforge-update-payload';
  const sha256Hash = crypto.createHash('sha256').update(testPayload).digest('hex');
  const sha512HashB64 = crypto.createHash('sha512').update(testPayload).digest('base64');

  // Direct sha256 checksum asset matching
  mockFetch({
    '/releases': [
      {
        tag_name: 'v1.0.0',
        draft: false,
        prerelease: false,
        assets: [
          {
            name: 'LeadForge OS-1.0.0-win-x64.exe',
            browser_download_url: 'https://github.com/mock/installer.exe'
          },
          {
            name: 'LeadForge OS-1.0.0-win-x64.exe.sha256',
            browser_download_url: 'https://github.com/mock/installer.exe.sha256'
          }
        ]
      }
    ],
    'installer.exe.sha256': sha256Hash,
    'installer.exe': testPayload
  });

  result = await provider.checkForUpdate('0.9.0', 'stable');
  assert.strictEqual(result.checksum, sha256Hash, 'Should resolve SHA-256 checksum from asset');
  assert.strictEqual(result.checksumType, 'sha256', 'Checksum type should be sha256');

  // Fallback to latest.yml SHA-512 parsing
  mockFetch({
    '/releases': [
      {
        tag_name: 'v1.0.0',
        draft: false,
        prerelease: false,
        assets: [
          {
            name: 'LeadForge OS-1.0.0-win-x64.exe',
            browser_download_url: 'https://github.com/mock/installer.exe'
          },
          { name: 'latest.yml', browser_download_url: 'https://github.com/mock/latest.yml' }
        ]
      }
    ],
    'latest.yml': `version: 1.0.0\nsha512: ${sha512HashB64}\npath: LeadForge OS-1.0.0-win-x64.exe`,
    'installer.exe': testPayload
  });

  result = await provider.checkForUpdate('0.9.0', 'stable');
  assert.strictEqual(
    result.checksum,
    sha512HashB64,
    'Should resolve SHA-512 checksum from latest.yml'
  );
  assert.strictEqual(result.checksumType, 'sha512', 'Checksum type should be sha512');

  // Throw exception if no checksum is found
  mockFetch({
    '/releases': [
      {
        tag_name: 'v1.0.0',
        draft: false,
        prerelease: false,
        assets: [
          {
            name: 'LeadForge OS-1.0.0-win-x64.exe',
            browser_download_url: 'https://github.com/mock/installer.exe'
          }
        ]
      }
    ],
    'installer.exe': testPayload
  });

  await assert.rejects(
    provider.checkForUpdate('0.9.0', 'stable'),
    /Security Exception/,
    'Should throw a security exception if no checksum file/metadata is available'
  );

  console.log('✅ Checksum validation and fallback mechanisms verified.');

  // Test 5: State Machine and download validation
  mockFetch({
    '/releases': [
      {
        tag_name: 'v1.0.0',
        draft: false,
        prerelease: false,
        assets: [
          {
            name: 'LeadForge OS-1.0.0-win-x64.exe',
            browser_download_url: 'https://github.com/mock/installer.exe'
          },
          {
            name: 'LeadForge OS-1.0.0-win-x64.exe.sha256',
            browser_download_url: 'https://github.com/mock/installer.exe.sha256'
          }
        ]
      }
    ],
    'installer.exe.sha256': sha256Hash,
    'installer.exe': testPayload
  });

  manager.setProvider(provider);
  manager.setChannel('stable');

  // Verify transition to available
  const checkRes = await manager.check();
  assert.strictEqual(checkRes.updateAvailable, true);
  assert.strictEqual(manager.getStatus().status, 'available');

  // Verify download transitions and checksum success
  await manager.download();
  assert.strictEqual(
    manager.getStatus().status,
    'ready',
    'State should be ready after successful download and validation'
  );

  // Verify checksum failure deletes file and goes to error state
  mockFetch({
    '/releases': [
      {
        tag_name: 'v1.0.0',
        draft: false,
        prerelease: false,
        assets: [
          {
            name: 'LeadForge OS-1.0.0-win-x64.exe',
            browser_download_url: 'https://github.com/mock/installer.exe'
          },
          {
            name: 'LeadForge OS-1.0.0-win-x64.exe.sha256',
            browser_download_url: 'https://github.com/mock/installer.exe.sha256'
          }
        ]
      }
    ],
    'installer.exe.sha256': 'wrong-hash-value',
    'installer.exe': testPayload
  });

  await manager.check();
  await assert.rejects(
    manager.download(),
    /Checksum mismatch/,
    'Should throw error and fail download if hashes do not match'
  );
  assert.strictEqual(
    manager.getStatus().status,
    'error',
    'State should be error after checksum mismatch'
  );

  console.log('✅ Updater state machine transitions verified.');

  restoreFetch();
  console.log('--- ALL AUTO-UPDATE INFRASTRUCTURE TESTS PASSED ---');
}

runTests().catch((err) => {
  restoreFetch();
  console.error('❌ Test execution failed:', err);
  process.exit(1);
});
