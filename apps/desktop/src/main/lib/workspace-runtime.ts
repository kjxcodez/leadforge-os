import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { LocalEventBus } from './event-bus';
import { getDatabase, closeDatabase } from '../database/connection';
import { runMigrations } from '../database/runner';
import { JobScheduler } from '../services/scheduler';
import { SyncEngine } from '../services/sync-engine';
import { EventBridge } from './event-bridge';
import { AutomationTriggerEvaluator } from '../services/automation-trigger';
import type { SdkClient } from '@leadforge/sdk';

/**
 * WorkspaceRuntime manages a single workspace isolated connection, local event bus,
 * and lifecycle engines (scheduler, sync, etc.).
 */
export class WorkspaceRuntime {
  public readonly workspaceId: string;
  public readonly sqliteDb: Database.Database;
  public readonly eventBus: LocalEventBus;
  private readonly scheduler: JobScheduler;
  private readonly syncEngine: SyncEngine;
  private readonly eventBridge: EventBridge;
  private readonly triggerEvaluator: AutomationTriggerEvaluator;
  private isRunning: boolean = false;

  constructor(workspaceId: string, sdk: SdkClient) {
    this.workspaceId = workspaceId;
    this.sqliteDb = getDatabase(workspaceId);
    this.eventBus = new LocalEventBus(workspaceId);
    this.scheduler = new JobScheduler(workspaceId, this.sqliteDb, this.eventBus);
    this.syncEngine = new SyncEngine(workspaceId, this.sqliteDb, this.eventBus, sdk);
    this.eventBridge = new EventBridge(this.eventBus);
    this.triggerEvaluator = new AutomationTriggerEvaluator(workspaceId, this.sqliteDb, this.eventBus);
  }

  /**
   * Initializes workspace-scoped database tables (runs migrations) and starts background engines.
   */
  public async start(): Promise<void> {
    if (this.isRunning) return;

    console.log(`[WorkspaceRuntime] Starting workspace runtime: ${this.workspaceId}`);
    
    // 1. Run migrations on the isolated database
    try {
      runMigrations(this.sqliteDb);
    } catch (err) {
      console.error(`[WorkspaceRuntime] Database migration failed for workspace ${this.workspaceId}:`, err);
      throw err;
    }

    // 2. Recover interrupted background jobs and waiting sequences before scheduler starts
    await this.recoverInterruptedJobs();

    // 3. Start Concurrency Scheduler
    await this.scheduler.start();

    // 4. Start Background Sync Engine
    await this.syncEngine.start();

    // 5. Start EventBridge to forward LocalEventBus events to the renderer process
    this.eventBridge.start();

    // 6. Start AutomationTriggerEvaluator to listen for CRM/job events and queue automation workflows
    this.triggerEvaluator.start();

    this.isRunning = true;
    console.log(`[WorkspaceRuntime] Workspace runtime "${this.workspaceId}" successfully booted.`);
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
      const jobs = this.sqliteDb.prepare(`
        SELECT id, type, status FROM jobs
        WHERE workspaceId = ? AND status IN ('running', 'starting', 'interrupted')
      `).all(this.workspaceId) as { id: string; type: string; status: string }[];

      let totalInterrupted = 0;
      let totalRecovered = 0;
      let totalSkipped = 0;
      let totalFailures = 0;

      const recoverableTypes = ['scraper:maps', 'crawler:website', 'enrich:website', 'automation:workflow'];

      for (const job of jobs) {
        try {
          totalInterrupted++;
          if (job.status === 'running' || job.status === 'starting') {
            // Transition stale running/starting jobs to interrupted
            this.sqliteDb.prepare(`
              UPDATE jobs
              SET status = 'interrupted', error = 'App restarted during execution', updatedAt = CURRENT_TIMESTAMP
              WHERE id = ?
            `).run(job.id);
          }

          if (recoverableTypes.includes(job.type)) {
            // Recoverable: transition from interrupted to queued
            this.sqliteDb.prepare(`
              UPDATE jobs
              SET status = 'queued', error = NULL, updatedAt = CURRENT_TIMESTAMP
              WHERE id = ?
            `).run(job.id);
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

      console.log(`[WorkspaceRuntime] Stale jobs recovery metrics — Found: ${totalInterrupted}, Recovered: ${totalRecovered}, Skipped: ${totalSkipped}, Failures: ${totalFailures}`);

      // Resume overdue waiting sequence executions (no regression in WAIT timer recovery)
      const overdueExecutions = this.sqliteDb.prepare(`
        SELECT id, currentStep FROM sequence_executions
        WHERE workspaceId = ? AND status = 'waiting' AND nextExecutionAt <= datetime('now')
      `).all(this.workspaceId) as { id: string; currentStep: number }[];

      for (const exec of overdueExecutions) {
        try {
          // Verify resume job does not already exist in active/pending states
          const existing = this.sqliteDb.prepare(`
            SELECT id FROM jobs
            WHERE workspaceId = ? AND type = 'automation:workflow'
              AND json_extract(payload, '$.executionId') = ?
              AND status IN ('queued', 'starting', 'running', 'retrying')
          `).get(this.workspaceId, exec.id);

          if (!existing) {
            this.sqliteDb.prepare(`
              INSERT INTO jobs (id, workspaceId, type, status, priority, payload, progress, retryCount, maxRetries, createdAt, updatedAt)
              VALUES (?, ?, 'automation:workflow', 'queued', 4, ?, 0, 0, 1, datetime('now'), datetime('now'))
            `).run(
              randomUUID(),
              this.workspaceId,
              JSON.stringify({ executionId: exec.id, resumeFrom: exec.currentStep })
            );
          }
        } catch (execErr) {
          console.error(`[WorkspaceRuntime] Failed to resume waiting execution ${exec.id}:`, execErr);
        }
      }
    } catch (err) {
      // General recovery failure should be logged but not abort workspace startup
      console.error('[WorkspaceRuntime] Error during recoverInterruptedJobs execution:', err);
    }
  }
}
