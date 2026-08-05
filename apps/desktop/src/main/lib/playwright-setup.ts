import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { fork } from 'child_process';
import { app } from 'electron';
import { AppLogger } from './logger';

/**
 * Returns the path where LeadForge OS stores its Playwright browser binaries.
 *
 * By setting PLAYWRIGHT_BROWSERS_PATH to a sub-directory inside Electron's
 * `userData` folder we get three benefits:
 *   1. Stable, predictable location that persists across app updates.
 *   2. Full write access — no admin / sudo required on any OS.
 *   3. Workers receive this path via fork() env so they always find the right binary.
 */
export function getPlaywrightBrowsersPath(): string {
  return join(app.getPath('userData'), 'playwright-browsers');
}

/**
 * Checks whether the Playwright Chromium headless-shell binary already exists
 * inside `getPlaywrightBrowsersPath()`.
 *
 * We probe using Playwright-core's own path-resolution API so we don't have to
 * hard-code platform-specific paths (Windows vs macOS vs Linux all differ).
 */
async function isBrowserInstalled(): Promise<boolean> {
  try {
    // playwright-core exposes a registry that knows the exact expected binary path.
    // This is the same check that `chromium.launch()` does internally before throwing.
    const playwrightCorePkg = require.resolve('playwright-core/package.json');
    const playwrightCoreDir = dirname(playwrightCorePkg);

    // Dynamically import playwright-core's internal browser paths utility.
    // This lets us avoid hard-coding versioned folder names (e.g. chromium-1228).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { chromium } = require('playwright-core');

    // Override the browsers path so the check targets our userData directory.
    process.env.PLAYWRIGHT_BROWSERS_PATH = getPlaywrightBrowsersPath();

    const executablePath: string = chromium.executablePath();
    AppLogger.info(
      'PlaywrightSetup',
      `Chromium executable expected at: ${executablePath}`
    );
    return existsSync(executablePath);
  } catch {
    // If anything fails (e.g. playwright-core not bundled) treat it as not installed.
    return false;
  }
}

/**
 * Runs `playwright-core install chromium` as a forked child process.
 *
 * Uses `playwright-core` (the dependency of `playwright`) directly so we don't
 * rely on npx being available in the end-user's environment. The CLI script is
 * always present next to `playwright-core` in node_modules.
 *
 * The PLAYWRIGHT_BROWSERS_PATH env variable ensures the binary is downloaded into
 * the app's userData directory — not the OS-wide cache.
 *
 * @param onProgress - Optional callback called with each line of stdout/stderr
 *                     so callers can forward installation progress to the UI.
 */
export async function installPlaywrightBrowsers(
  onProgress?: (line: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const playwrightCorePkg = require.resolve('playwright-core/package.json');
    const cliPath = join(dirname(playwrightCorePkg), 'cli.js');

    AppLogger.info(
      'PlaywrightSetup',
      `Installing Chromium browser via playwright-core CLI: ${cliPath}`
    );

    const browsersPath = getPlaywrightBrowsersPath();

    const child = fork(cliPath, ['install', 'chromium'], {
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: {
        ...process.env,
        PLAYWRIGHT_BROWSERS_PATH: browsersPath
      }
    });

    child.stdout?.on('data', (chunk: Buffer) => {
      const line = chunk.toString().trim();
      if (line) {
        AppLogger.info('PlaywrightSetup', line);
        onProgress?.(line);
      }
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      const line = chunk.toString().trim();
      if (line) {
        AppLogger.warn('PlaywrightSetup', line);
        onProgress?.(line);
      }
    });

    child.on('close', (code) => {
      if (code === 0) {
        AppLogger.info('PlaywrightSetup', 'Chromium browser installed successfully.');
        resolve();
      } else {
        const err = new Error(
          `playwright-core install chromium exited with code ${code}`
        );
        AppLogger.error('PlaywrightSetup', err.message, undefined, err);
        reject(err);
      }
    });

    child.on('error', (err) => {
      AppLogger.error('PlaywrightSetup', 'Failed to spawn playwright CLI', undefined, err);
      reject(err);
    });
  });
}

/**
 * Ensures Playwright's Chromium browser is present before any scraper jobs run.
 *
 * Called once during app startup (before the main window is shown).
 * If the binary is already present the function returns immediately (~0 ms).
 * If missing it performs a one-time download (~60–120 MB) — this typically
 * takes 30–90 s depending on network speed.
 *
 * @param onProgress - Forwarded to `installPlaywrightBrowsers` for UI updates.
 */
export async function ensurePlaywrightBrowsers(
  onProgress?: (line: string) => void
): Promise<void> {
  // Always set the env var so the current process and all subsequent child
  // processes look in the same app-controlled location.
  process.env.PLAYWRIGHT_BROWSERS_PATH = getPlaywrightBrowsersPath();

  const installed = await isBrowserInstalled();
  if (installed) {
    AppLogger.info('PlaywrightSetup', 'Chromium browser already present. Skipping installation.');
    return;
  }

  AppLogger.info(
    'PlaywrightSetup',
    'Chromium browser not found. Starting one-time installation...'
  );

  try {
    await installPlaywrightBrowsers(onProgress);
  } catch (err) {
    // Log but do not crash the app — scraper jobs will report an actionable error
    // if the browser is still missing when they run.
    AppLogger.error(
      'PlaywrightSetup',
      'Failed to auto-install Playwright Chromium browser. Scraper jobs may fail.',
      undefined,
      err
    );
  }
}
