import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { BrowserWindow } from 'electron';
import { LocalEventBus } from './event-bus';
import { getDatabase, closeDatabase } from '../database/connection';
import { runMigrations } from '../database/runner';
import { JobScheduler } from '../services/scheduler';
import { SyncEngine } from '../services/sync-engine';
import { EventBridge } from './event-bridge';
import { AutomationTriggerEvaluator } from '../services/automation-trigger';
import type { SdkClient } from '@leadforge/sdk';

import { telemetry } from './telemetry';
import { UpdateManager } from '../services/updater';
import { updateSplashProgress } from './splash-window';

import { CacheHydrator } from '../services/cache-hydrator';

/**
 * WorkspaceRuntime manages a single workspace isolated connection, local event bus,
 * and lifecycle engines (scheduler, sync, etc.).
 */
export class WorkspaceRuntime {
  public readonly workspaceId: string;
  public readonly sqliteDb: Database.Database;
  public readonly eventBus: LocalEventBus;
  public readonly scheduler: JobScheduler;
  public readonly syncEngine: SyncEngine;
  public readonly eventBridge: EventBridge;
  public readonly triggerEvaluator: AutomationTriggerEvaluator;
  public readonly sdk: SdkClient;
  private isRunning: boolean = false;

  public startedAt: Date | null = null;
  public startupStartedAt: Date | null = null;
  public startupCompletedAt: Date | null = null;
  public startupDuration: number = 0;
  public lastRestart: Date | null = null;

  public databaseOpenDuration: number = 0;
  public migrationsDuration: number = 0;
  public schedulerDuration: number = 0;
  public syncDuration: number = 0;
  public automationDuration: number = 0;

  private static restartCounts = new Map<string, number>();

  public get restartCount(): number {
    return WorkspaceRuntime.restartCounts.get(this.workspaceId) || 0;
  }

  constructor(workspaceId: string, sdk: SdkClient) {
    this.workspaceId = workspaceId;
    this.sdk = sdk;
    const dbOpenStart = Date.now();
    this.sqliteDb = getDatabase(workspaceId);
    this.databaseOpenDuration = Date.now() - dbOpenStart;

    // Run migrations EAGERLY here — before constructing any service that pre-compiles
    // SQL prepared statements (e.g. AutomationTriggerEvaluator compiles SELECT FROM sequences
    // in its constructor, which crashes on a brand-new database with no tables yet).
    runMigrations(this.sqliteDb);

    this.eventBus = new LocalEventBus(workspaceId);
    this.scheduler = new JobScheduler(workspaceId, this.sqliteDb, this.eventBus);
    try {
      UpdateManager.getInstance().registerScheduler(this.scheduler);
    } catch {}
    this.syncEngine = new SyncEngine(workspaceId, this.sqliteDb, this.eventBus, sdk);
    this.eventBridge = new EventBridge(this.eventBus);
    this.triggerEvaluator = new AutomationTriggerEvaluator(
      workspaceId,
      this.sqliteDb,
      this.eventBus
    );
  }

  /**
   * Initializes workspace-scoped database tables (runs migrations) and starts background engines.
   */
  public async start(): Promise<void> {
    if (this.isRunning) return;

    this.startupStartedAt = new Date();
    this.lastRestart = this.startupStartedAt;

    // Increment restart count
    const prevCount = WorkspaceRuntime.restartCounts.get(this.workspaceId) || 0;
    WorkspaceRuntime.restartCounts.set(this.workspaceId, prevCount + 1);

    this.startedAt = new Date();

    console.log(`[WorkspaceRuntime] Starting workspace runtime: ${this.workspaceId}`);

    // Broadcast progress helper
    const sendBootProgress = (step: string, label: string) => {
      try {
        updateSplashProgress(step, label);
        BrowserWindow.getAllWindows().forEach((win) => {
          if (!win.isDestroyed()) {
            win.webContents.send('workspace:boot-progress', { step, label });
          }
        });
      } catch (err) {
        // Ignore
      }
    };

    sendBootProgress('database:open', '✓ Opening database');

    // 1. Run migrations on the isolated database
    sendBootProgress('database:migrations', '✓ Applying migrations');
    const migStart = Date.now();
    try {
      runMigrations(this.sqliteDb);
    } catch (err) {
      console.error(
        `[WorkspaceRuntime] Database migration failed for workspace ${this.workspaceId}:`,
        err
      );
      throw err;
    }
    this.migrationsDuration = Date.now() - migStart;

    // 2. Recover interrupted background jobs and waiting sequences before scheduler starts
    await this.recoverInterruptedJobs();

    // 3. Start Concurrency Scheduler
    sendBootProgress('scheduler:start', '✓ Starting scheduler');
    const schedStart = Date.now();
    await this.scheduler.start();
    this.schedulerDuration = Date.now() - schedStart;

    // 4. Start Background Sync Engine & Trigger Cache Hydration from MongoDB
    sendBootProgress('sync:start', '✓ Starting sync engine & cache hydrator');
    const syncStart = Date.now();
    await this.syncEngine.start();
    CacheHydrator.hydrateWorkspaceCache(this.workspaceId, this.sdk).catch((err) => {
      console.warn(`[WorkspaceRuntime] Workspace cache hydration error: ${err}`);
    });
    this.syncDuration = Date.now() - syncStart;

    // 5. Start EventBridge to forward LocalEventBus events to the renderer process
    this.eventBridge.start();

    // 6. Start AutomationTriggerEvaluator to listen for CRM/job events and queue automation workflows
    sendBootProgress('automation:start', '✓ Starting automation runtime');
    const autoStart = Date.now();
    this.triggerEvaluator.start();
    this.automationDuration = Date.now() - autoStart;

    this.isRunning = true;
    this.startupCompletedAt = new Date();
    this.startupDuration = this.startupCompletedAt.getTime() - this.startupStartedAt.getTime();

    // Update global telemetry with these workspace durations
    telemetry.databaseOpenDuration = this.databaseOpenDuration;
    telemetry.migrationsDuration = this.migrationsDuration;
    telemetry.schedulerDuration = this.schedulerDuration;
    telemetry.syncDuration = this.syncDuration;
    telemetry.automationDuration = this.automationDuration;

    telemetry.saveAnalyticsMetricsLocal(this.workspaceId);

    console.log(`[WorkspaceRuntime] Workspace runtime "${this.workspaceId}" successfully booted.`);
    sendBootProgress('ready', '✓ Ready');
  }

  /**
   * Shuts down background polling, closes database file lock cleanly.
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log(`[WorkspaceRuntime] Stopping workspace runtime: ${this.workspaceId}`);

    // 1. Stop Concurrency Scheduler
    await this.scheduler.stop();

    // 2. Stop Background Sync Engine
    await this.syncEngine.stop();

    // 3. Stop EventBridge event forwarding to prevent memory leaks
    this.eventBridge.stop();

    // 4. Stop AutomationTriggerEvaluator before clearing the event bus
    this.triggerEvaluator.stop();

    // 5. Clear event bus listeners
    this.eventBus.clear();

    // 5. Close SQLite file handle pool connection
    closeDatabase(this.workspaceId);

    this.isRunning = false;
    console.log(`[WorkspaceRuntime] Workspace runtime "${this.workspaceId}" stopped cleanly.`);
  }

  /**
   * Automatically recovers jobs that were running/starting when the application crashed
   * or was force-closed. Restores auto-recoverable types to 'queued'. Non-recoverable
   * types (e.g. outreach:campaign) remain as 'interrupted'.
   *
   * Also recovers overdue waiting sequence executions by queueing automation:workflow jobs.
   *
   * Spec: job_lifecycle_spec.md §6 / TASK-016
   */
  private async recoverInterruptedJobs(): Promise<void> {
    try {
      // Find all stale jobs that were running/starting or already interrupted
      const jobs = this.sqliteDb
        .prepare(
          `
        SELECT id, type, status FROM jobs
        WHERE workspaceId = ? AND status IN ('running', 'starting', 'interrupted')
      `
        )
        .all(this.workspaceId) as { id: string; type: string; status: string }[];

      let totalInterrupted = 0;
      let totalRecovered = 0;
      let totalSkipped = 0;
      let totalFailures = 0;

      const recoverableTypes = [
        'scraper:maps',
        'crawler:website',
        'enrich:website',
        'enrich:intelligence',
        'automation:workflow'
      ];

      for (const job of jobs) {
        try {
          totalInterrupted++;
          if (job.status === 'running' || job.status === 'starting') {
            // Transition stale running/starting jobs to interrupted
            this.sqliteDb
              .prepare(
                `
              UPDATE jobs
              SET status = 'interrupted', error = 'App restarted during execution', updatedAt = CURRENT_TIMESTAMP
              WHERE id = ?
            `
              )
              .run(job.id);
          }

          if (recoverableTypes.includes(job.type)) {
            // Recoverable: transition from interrupted to queued
            this.sqliteDb
              .prepare(
                `
              UPDATE jobs
              SET status = 'queued', error = NULL, updatedAt = CURRENT_TIMESTAMP
              WHERE id = ?
            `
              )
              .run(job.id);
            totalRecovered++;
          } else {
            // Non-recoverable: leave as interrupted
            totalSkipped++;
          }
        } catch (jobErr) {
          totalFailures++;
          console.error(`[WorkspaceRuntime] Failed to recover job ${job.id}:`, jobErr);
        }
      }

      console.log(
        `[WorkspaceRuntime] Stale jobs recovery metrics — Found: ${totalInterrupted}, Recovered: ${totalRecovered}, Skipped: ${totalSkipped}, Failures: ${totalFailures}`
      );

      // ─── Sequence Executions Crash Recovery ──────────────────────────────
      const activeExecutions = this.sqliteDb
        .prepare(
          `
        SELECT id, sequenceId, currentStep, status, retryCount, contactId, companyId
        FROM sequence_executions
        WHERE workspaceId = ? AND status IN ('running', 'queued')
      `
        )
        .all(this.workspaceId) as {
        id: string;
        sequenceId: string;
        currentStep: number;
        status: string;
        retryCount: number;
        contactId: string | null;
        companyId: string | null;
      }[];

      for (const exec of activeExecutions) {
        try {
          // Check associated job
          const job = this.sqliteDb
            .prepare(
              `
            SELECT id, status, type FROM jobs
            WHERE workspaceId = ? AND type = 'automation:workflow'
              AND json_extract(payload, '$.executionId') = ?
            ORDER BY createdAt DESC LIMIT 1
          `
            )
            .get(this.workspaceId, exec.id) as
            { id: string; status: string; type: string } | undefined;

          const entityId = exec.contactId || exec.companyId || 'unknown';

          if (job) {
            if (job.status === 'failed') {
              // Stale job is permanently failed -> update execution status to failed
              this.sqliteDb
                .prepare(
                  `
                UPDATE sequence_executions
                SET status = 'failed', completedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
                WHERE id = ?
              `
                )
                .run(exec.id);

              this.sqliteDb
                .prepare(
                  `
                INSERT INTO sequence_logs (id, executionId, workspaceId, timestamp, step, action, status, message, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, 'RECOVERY', 'failed', 'Execution marked failed because associated job failed during shutdown.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              `
                )
                .run(
                  randomUUID(),
                  exec.id,
                  this.workspaceId,
                  new Date().toISOString(),
                  exec.currentStep
                );

              // Release execution lock on failure
              this.sqliteDb
                .prepare('DELETE FROM automation_locks WHERE sequenceId = ? AND entityId = ?')
                .run(exec.sequenceId, entityId);
            } else if (job.status === 'cancelled') {
              this.sqliteDb
                .prepare(
                  `
                UPDATE sequence_executions
                SET status = 'cancelled', completedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
                WHERE id = ?
              `
                )
                .run(exec.id);

              // Release lock
              this.sqliteDb
                .prepare('DELETE FROM automation_locks WHERE sequenceId = ? AND entityId = ?')
                .run(exec.sequenceId, entityId);
            } else if (job.status === 'completed') {
              this.sqliteDb
                .prepare(
                  `
                UPDATE sequence_executions
                SET status = 'completed', completedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
                WHERE id = ?
              `
                )
                .run(exec.id);

              // Release lock
              this.sqliteDb
                .prepare('DELETE FROM automation_locks WHERE sequenceId = ? AND entityId = ?')
                .run(exec.sequenceId, entityId);
            } else {
              // Job is in starting/running/interrupted/queued/retrying state -> recoverable
              // The job status will be moved to queued by the job recovery system above,
              // so we just keep the execution in its current state (running/queued) and increment recovery count.
              this.sqliteDb
                .prepare(
                  `
                UPDATE sequence_executions
                SET recoveryCount = recoveryCount + 1, updatedAt = CURRENT_TIMESTAMP
                WHERE id = ?
              `
                )
                .run(exec.id);

              this.eventBus.publish('automation:recovered', {
                executionId: exec.id,
                sequenceId: exec.sequenceId,
                workspaceId: this.workspaceId,
                entityId,
                currentStep: exec.currentStep,
                timestamp: new Date().toISOString()
              });
            }
          } else {
            // Orphaned execution: no associated job exists
            // Recover by inserting a new queued job
            const newJobId = randomUUID();
            const execRetryCount = exec.retryCount || 0;

            this.sqliteDb.transaction(() => {
              this.sqliteDb
                .prepare(
                  `
                INSERT INTO jobs (id, workspaceId, type, status, priority, payload, progress, retryCount, maxRetries, createdAt, updatedAt)
                VALUES (?, ?, 'automation:workflow', 'queued', 4, ?, 0, ?, 3, datetime('now'), datetime('now'))
              `
                )
                .run(
                  newJobId,
                  this.workspaceId,
                  JSON.stringify({
                    executionId: exec.id,
                    resumeFrom: exec.currentStep,
                    retryCount: execRetryCount
                  }),
                  execRetryCount
                );

              this.sqliteDb
                .prepare(
                  `
                UPDATE sequence_executions
                SET status = 'queued', recoveryCount = recoveryCount + 1, updatedAt = CURRENT_TIMESTAMP
                WHERE id = ?
              `
                )
                .run(exec.id);

              this.sqliteDb
                .prepare(
                  `
                INSERT INTO sequence_logs (id, executionId, workspaceId, timestamp, step, action, status, message, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, 'RECOVERY', 'success', 'Orphaned execution recovered. Queued new workflow job.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              `
                )
                .run(
                  randomUUID(),
                  exec.id,
                  this.workspaceId,
                  new Date().toISOString(),
                  exec.currentStep
                );
            })();

            this.eventBus.publish('automation:recovered', {
              executionId: exec.id,
              sequenceId: exec.sequenceId,
              workspaceId: this.workspaceId,
              entityId,
              currentStep: exec.currentStep,
              timestamp: new Date().toISOString()
            });
          }
        } catch (execErr) {
          console.error(
            `[WorkspaceRuntime] Failed to recover sequence execution ${exec.id}:`,
            execErr
          );
        }
      }

      // Resume overdue waiting sequence executions (no regression in WAIT timer recovery)
      const overdueExecutions = this.sqliteDb
        .prepare(
          `
        SELECT id, sequenceId, currentStep FROM sequence_executions
        WHERE workspaceId = ? AND status = 'waiting' AND nextExecutionAt <= datetime('now')
      `
        )
        .all(this.workspaceId) as { id: string; sequenceId: string; currentStep: number }[];

      for (const exec of overdueExecutions) {
        try {
          // Verify resume job does not already exist in active/pending states
          const existing = this.sqliteDb
            .prepare(
              `
            SELECT id FROM jobs
            WHERE workspaceId = ? AND type = 'automation:workflow'
              AND json_extract(payload, '$.executionId') = ?
              AND status IN ('queued', 'starting', 'running', 'retrying')
          `
            )
            .get(this.workspaceId, exec.id);

          if (!existing) {
            this.sqliteDb
              .prepare(
                `
              INSERT INTO jobs (id, workspaceId, type, status, priority, payload, progress, retryCount, maxRetries, createdAt, updatedAt)
              VALUES (?, ?, 'automation:workflow', 'queued', 4, ?, 0, 0, 1, datetime('now'), datetime('now'))
            `
              )
              .run(
                randomUUID(),
                this.workspaceId,
                JSON.stringify({ executionId: exec.id, resumeFrom: exec.currentStep })
              );

            this.eventBus.publish('automation:queued', {
              executionId: exec.id,
              sequenceId: exec.sequenceId,
              workspaceId: this.workspaceId,
              entityId: '',
              currentStep: exec.currentStep,
              timestamp: new Date().toISOString()
            });
          }
        } catch (execErr) {
          console.error(
            `[WorkspaceRuntime] Failed to resume waiting execution ${exec.id}:`,
            execErr
          );
        }
      }
    } catch (err) {
      // General recovery failure should be logged but not abort workspace startup
      console.error('[WorkspaceRuntime] Error during recoverInterruptedJobs execution:', err);
    }
  }
}
