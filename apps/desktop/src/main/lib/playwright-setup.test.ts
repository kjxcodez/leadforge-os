/**
 * Playwright Setup & Path Resolution Unit Test Suite
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import {
  getPlaywrightBrowsersPath,
  getHeadlessShellPath,
  resolvePlaywrightCliPath
} from './playwright-setup';

describe('Playwright Setup Utilities', () => {
  it('computes Windows headless shell path accurately', () => {
    const winExec =
      'C:\\Users\\TestUser\\AppData\\Roaming\\@leadforge\\desktop\\playwright-browsers\\chromium-1234\\chrome-win64\\chrome.exe';
    const winHeadless = getHeadlessShellPath(winExec);

    expect(winHeadless).toBeDefined();
    expect(winHeadless).toContain('chromium_headless_shell-1234');
    expect(winHeadless).toContain('chrome-headless-shell.exe');
  });

  it('resolves Playwright CLI path to existing script', () => {
    const cliPath = resolvePlaywrightCliPath();
    expect(cliPath).toBeDefined();
    expect(cliPath.endsWith('cli.js')).toBe(true);
    expect(existsSync(cliPath)).toBe(true);
  });

  it('computes Playwright browsers directory path', () => {
    const browsersPath = getPlaywrightBrowsersPath();
    expect(typeof browsersPath).toBe('string');
    expect(browsersPath).toContain('playwright-browsers');
  });
});
