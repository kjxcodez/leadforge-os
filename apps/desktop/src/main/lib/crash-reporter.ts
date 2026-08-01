import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

/**
 * LocalCrashReporter records unexpected process failures, uncaught exceptions,
 * and promise rejections locally to assist with offline triaging.
 */
class LocalCrashReporterClass {
  private crashesDir: string = '';

  constructor() {
    try {
      this.crashesDir = path.join(app.getPath('userData'), 'crashes');
      if (!fs.existsSync(this.crashesDir)) {
        fs.mkdirSync(this.crashesDir, { recursive: true });
      }
    } catch {
      // Ignore if app context is missing during tests
    }
  }

  /**
   * Captures a process error and writes a structured crash report JSON to disk.
   */
  public report(error: any, source: string): void {
    try {
      if (!this.crashesDir) {
        this.crashesDir = path.join(app.getPath('userData'), 'crashes');
        if (!fs.existsSync(this.crashesDir)) {
          fs.mkdirSync(this.crashesDir, { recursive: true });
        }
      }

      const timestamp = new Date().toISOString();
      const filename = `crash-${Date.now()}.json`;
      const reportPath = path.join(this.crashesDir, filename);

      const crashInfo = {
        timestamp,
        source,
        message: error?.message || String(error),
        stack: error?.stack || null,
        process: {
          platform: process.platform,
          arch: process.arch,
          version: process.version,
          versions: process.versions,
          memoryUsage: process.memoryUsage()
        }
      };

      fs.writeFileSync(reportPath, JSON.stringify(crashInfo, null, 2), 'utf8');
      console.error(`[CrashReporter] Local crash report written to: ${reportPath}`);
    } catch (err) {
      console.error('[CrashReporter] Failed to write local crash report:', err);
    }
  }

  /**
   * Initializes exception listeners for the main process.
   */
  public initialize(): void {
    process.on('uncaughtException', (error) => {
      this.report(error, 'main:uncaught-exception');
    });

    process.on('unhandledRejection', (reason) => {
      this.report(reason, 'main:unhandled-rejection');
    });
  }
}

export const LocalCrashReporter = new LocalCrashReporterClass();
