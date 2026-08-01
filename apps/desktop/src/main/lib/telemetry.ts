import { app } from 'electron';
import os from 'os';
import fs from 'fs';
import { join } from 'path';
import { getDatabase } from '../database/connection';

export interface StartupMetrics {
  appLaunchDuration: number;
  whenReadyDuration: number;
  sessionRestoreDuration: number;
  workspaceActivationDuration: number;

  // Renderer reported metrics
  rendererInitStart: number;
  reactMountTime: number;
  dashboardReadyTime: number;

  // Workspace specific durations (populated from runtime start)
  databaseOpenDuration: number;
  migrationsDuration: number;
  schedulerDuration: number;
  syncDuration: number;
  automationDuration: number;
}

class TelemetryTracker {
  // Compute approximate process start time from node process uptime
  public readonly processStartTime = Date.now() - Math.floor(process.uptime() * 1000);
  public whenReadyTime = 0;
  public sessionRestoreDuration = 0;
  public workspaceActivationDuration = 0;

  // Renderer timings
  public rendererInitStart = 0;
  public reactMountTime = 0;
  public dashboardReadyTime = 0;

  // Workspace-specific timings (updated by active runtime)
  public databaseOpenDuration = 0;
  public migrationsDuration = 0;
  public schedulerDuration = 0;
  public syncDuration = 0;
  public automationDuration = 0;

  public getMetrics(
    workspaceId?: string
  ): StartupMetrics & { memory: any; os: any; deadLetters: number } {
    const memory = process.memoryUsage();

    let deadLetters = 0;
    if (workspaceId) {
      try {
        const db = getDatabase(workspaceId);
        const tableCheck = db
          .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sync_dead_letter'")
          .get();
        if (tableCheck) {
          const row = db.prepare('SELECT COUNT(*) as count FROM sync_dead_letter').get() as any;
          deadLetters = row ? row.count : 0;
        }
      } catch (err) {
        // Ignore
      }
    }

    return {
      appLaunchDuration: this.whenReadyTime > 0 ? this.whenReadyTime - this.processStartTime : 0,
      whenReadyDuration: this.whenReadyTime > 0 ? this.whenReadyTime - this.processStartTime : 0,
      sessionRestoreDuration: this.sessionRestoreDuration,
      workspaceActivationDuration: this.workspaceActivationDuration,

      rendererInitStart: this.rendererInitStart,
      reactMountTime: this.reactMountTime,
      dashboardReadyTime: this.dashboardReadyTime,

      databaseOpenDuration: this.databaseOpenDuration,
      migrationsDuration: this.migrationsDuration,
      schedulerDuration: this.schedulerDuration,
      syncDuration: this.syncDuration,
      automationDuration: this.automationDuration,

      deadLetters,
      memory: {
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
        rss: memory.rss,
        external: memory.external
      },
      os: {
        platform: process.platform,
        arch: process.arch,
        cpus: os.cpus().length,
        freeMem: os.freemem(),
        totalMem: os.totalmem()
      }
    };
  }

  public saveAnalyticsMetricsLocal(workspaceId?: string): void {
    try {
      const dataPath = app.getPath('userData');
      const analyticsFile = join(dataPath, 'analytics.json');
      const metrics = this.getMetrics(workspaceId);

      let existing: any[] = [];
      if (fs.existsSync(analyticsFile)) {
        try {
          existing = JSON.parse(fs.readFileSync(analyticsFile, 'utf8'));
          if (!Array.isArray(existing)) existing = [];
        } catch {}
      }

      existing.push({
        timestamp: new Date().toISOString(),
        workspaceId: workspaceId || 'global',
        ...metrics
      });

      if (existing.length > 100) {
        existing.shift();
      }

      fs.writeFileSync(analyticsFile, JSON.stringify(existing, null, 2), 'utf8');
    } catch {}
  }
}

export const telemetry = new TelemetryTracker();
