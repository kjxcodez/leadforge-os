import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { fork } from 'child_process';
import { app } from 'electron';
import { AppLogger } from './logger';

/**
 * Browser engine setup status descriptor.
 */
export interface BrowserEngineStatus {
  isInstalled: boolean;
  isInstalling: boolean;
  browsersPath: string;
  executablePath?: string | undefined;
  headlessPath?: string | undefined;
  lastError?: string | undefined;
}

let isInstalling = false;
let lastInstallError: string | undefined;

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
  if (app && typeof app.getPath === 'function') {
    return join(app.getPath('userData'), 'playwright-browsers');
  }
  const appData =
    process.env.APPDATA ||
    (process.platform === 'darwin'
      ? join(process.env.HOME || '', 'Library', 'Application Support')
      : join(process.env.HOME || '', '.config'));
  return join(appData, '@leadforge', 'desktop', 'playwright-browsers');
}

/**
 * Resolves the platform-specific Chrome Headless Shell executable path based on the
 * standard Chromium executable path returned by playwright-core.
 */
export function getHeadlessShellPath(execPath: string): string | null {
  const match = execPath.match(/chromium-(\d+)/);
  if (!match) return null;
  const rev = match[1];
  const baseDir = execPath.slice(0, execPath.indexOf(`chromium-${rev}`));

  if (process.platform === 'win32') {
    return join(
      baseDir,
      `chromium_headless_shell-${rev}`,
      'chrome-headless-shell-win64',
      'chrome-headless-shell.exe'
    );
  } else if (process.platform === 'darwin') {
    const arch = process.arch === 'arm64' ? 'mac-arm64' : 'mac-x64';
    return join(
      baseDir,
      `chromium_headless_shell-${rev}`,
      `chrome-headless-shell-${arch}`,
      'chrome-headless-shell'
    );
  } else {
    return join(
      baseDir,
      `chromium_headless_shell-${rev}`,
      'chrome-headless-shell-linux64',
      'chrome-headless-shell'
    );
  }
}

/**
 * Resolves the absolute path to playwright-core's CLI script (`cli.js`).
 * Handles development mode, unpacked ASAR archives (`app.asar.unpacked`), and
 * packaged application resource paths.
 */
export function resolvePlaywrightCliPath(): string {
  try {
    const playwrightCorePkg = require.resolve('playwright-core/package.json');
    const directCli = join(dirname(playwrightCorePkg), 'cli.js');

    if (existsSync(directCli)) {
      return directCli;
    }

    if (directCli.includes('app.asar')) {
      const unpackedCli = directCli.replace('app.asar', 'app.asar.unpacked');
      if (existsSync(unpackedCli)) {
        return unpackedCli;
      }
    }
  } catch {
    // Continue to fallbacks
  }

  // Check process.resourcesPath/app.asar.unpacked (packaged release structure)
  if (process.resourcesPath) {
    const unpackedInResources = join(
      process.resourcesPath,
      'app.asar.unpacked',
      'node_modules',
      'playwright-core',
      'cli.js'
    );
    if (existsSync(unpackedInResources)) {
      return unpackedInResources;
    }
  }

  // Fallback relative to app path
  try {
    if (app && typeof app.getAppPath === 'function') {
      const appDir = app.getAppPath();
      const unpackedInApp = join(
        appDir.replace('app.asar', 'app.asar.unpacked'),
        'node_modules',
        'playwright-core',
        'cli.js'
      );
      if (existsSync(unpackedInApp)) {
        return unpackedInApp;
      }
    }
  } catch {
    // Fallback below
  }

  return join(dirname(require.resolve('playwright-core/package.json')), 'cli.js');
}

/**
 * Checks whether both the Chromium binary and the headless-shell executable exist
 * inside `getPlaywrightBrowsersPath()`.
 */
export async function isBrowserInstalled(): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { chromium } = require('playwright-core');

    // Override the browsers path so the check targets our userData directory.
    process.env.PLAYWRIGHT_BROWSERS_PATH = getPlaywrightBrowsersPath();

    const executablePath: string = chromium.executablePath();
    const headlessPath = getHeadlessShellPath(executablePath);

    AppLogger.info(
      'PlaywrightSetup',
      `Checking browser binaries: Chrome="${executablePath}" | HeadlessShell="${headlessPath || 'unknown'}"`
    );

    const execExists = existsSync(executablePath);
    const headlessExists = headlessPath ? existsSync(headlessPath) : false;

    // Headless scraping jobs require the headless shell binary
    return execExists && headlessExists;
  } catch {
    return false;
  }
}

/**
 * Returns current browser engine diagnostic status.
 */
export async function getBrowserEngineStatus(): Promise<BrowserEngineStatus> {
  const browsersPath = getPlaywrightBrowsersPath();
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { chromium } = require('playwright-core');
    process.env.PLAYWRIGHT_BROWSERS_PATH = browsersPath;
    const executablePath: string = chromium.executablePath();
    const headlessPath = getHeadlessShellPath(executablePath);
    const installed = existsSync(executablePath) && (headlessPath ? existsSync(headlessPath) : false);

    return {
      isInstalled: installed,
      isInstalling,
      browsersPath,
      executablePath,
      headlessPath: headlessPath || undefined,
      lastError: lastInstallError
    };
  } catch (err: any) {
    return {
      isInstalled: false,
      isInstalling,
      browsersPath,
      lastError: err?.message || 'Failed to inspect browser binaries'
    };
  }
}

/**
 * Runs `playwright-core install chromium` as a forked child process.
 *
 * Uses `playwright-core` directly with `ELECTRON_RUN_AS_NODE: '1'` so the packaged
 * Electron runtime executes the CLI script as standard Node.js without requiring `npx`
 * or an external Node installation.
 *
 * @param onProgress - Optional callback called with each line of stdout/stderr.
 */
export async function installPlaywrightBrowsers(
  onProgress?: (line: string) => void
): Promise<void> {
  isInstalling = true;
  lastInstallError = undefined;

  return new Promise((resolve, reject) => {
    const cliPath = resolvePlaywrightCliPath();

    AppLogger.info(
      'PlaywrightSetup',
      `Installing Chromium browser via playwright-core CLI: ${cliPath}`
    );

    const browsersPath = getPlaywrightBrowsersPath();

    const child = fork(cliPath, ['install', 'chromium'], {
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
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
      isInstalling = false;
      if (code === 0) {
        AppLogger.info('PlaywrightSetup', 'Chromium browser installed successfully.');
        resolve();
      } else {
        const err = new Error(
          `playwright-core install chromium exited with code ${code}`
        );
        lastInstallError = err.message;
        AppLogger.error('PlaywrightSetup', err.message, undefined, err);
        reject(err);
      }
    });

    child.on('error', (err) => {
      isInstalling = false;
      lastInstallError = err.message;
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
 * If missing it performs a one-time download (~60–120 MB).
 *
 * @param onProgress - Forwarded to `installPlaywrightBrowsers` for UI updates.
 */
export async function ensurePlaywrightBrowsers(
  onProgress?: (line: string) => void
): Promise<void> {
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
  } catch (err: any) {
    lastInstallError = err?.message || 'Failed to auto-install Playwright Chromium browser';
    AppLogger.error(
      'PlaywrightSetup',
      'Failed to auto-install Playwright Chromium browser. Scraper jobs may fail.',
      undefined,
      err
    );
  }
}
