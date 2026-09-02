import assert from 'node:assert';
import { existsSync } from 'node:fs';
import {
  getPlaywrightBrowsersPath,
  getHeadlessShellPath,
  resolvePlaywrightCliPath
} from './playwright-setup';

console.log('[Test] Running Playwright Setup Tests...');

// 1. Test getHeadlessShellPath Windows resolution
const winExec =
  'C:\\Users\\TestUser\\AppData\\Roaming\\@leadforge\\desktop\\playwright-browsers\\chromium-1234\\chrome-win64\\chrome.exe';
const winHeadless = getHeadlessShellPath(winExec);
assert.ok(winHeadless, 'Should compute win headless shell path');
assert.ok(
  winHeadless.includes('chromium_headless_shell-1234'),
  'Should contain versioned headless folder'
);
assert.ok(
  winHeadless.includes('chrome-headless-shell.exe'),
  'Should target chrome-headless-shell.exe'
);

// 2. Test resolvePlaywrightCliPath
const cliPath = resolvePlaywrightCliPath();
assert.ok(cliPath, 'CLI path should not be empty');
assert.ok(
  cliPath.endsWith('cli.js'),
  `CLI path should end with cli.js, got ${cliPath}`
);
assert.ok(
  existsSync(cliPath),
  `Resolved CLI script must exist on disk: ${cliPath}`
);

// 3. Test getPlaywrightBrowsersPath
const browsersPath = getPlaywrightBrowsersPath();
assert.ok(browsersPath, 'Browsers path should be valid string');
assert.ok(
  browsersPath.includes('playwright-browsers'),
  'Browsers path should contain playwright-browsers folder'
);

console.log('[Test] All Playwright Setup tests passed!');
