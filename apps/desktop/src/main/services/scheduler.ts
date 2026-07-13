import { type ChildProcess, fork } from 'child_process';
import { join } from 'path';
import { app } from 'electron';
import Database from 'better-sqlite3';
import { LocalEventBus } from '../lib/event-bus';
import { AppLogger } from '../lib/logger';
import type { JobPayload } from '../../shared/types/job';

/**
 * JobScheduler ticks periodically to select queued background tasks from SQLite
 * and execute them in sandboxed child processes.
 */
export class JobScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private activeWorkers = new Map<string, ChildProcess>();
  private maxConcurrency = 3;

  constructor(
    private workspaceId: string,
    private db: Database.Database,
    private eventBus: LocalEventBus
  ) {}

  /**
   * Starts periodic polling loop.
   */
  public async start(): Promise<void> {
    if (this.intervalId) return;

    this.intervalId = setInterval(() => this.tick(), 1000);
    AppLogger.info('JobScheduler', `Scheduler started for workspace: ${this.workspaceId}`, this.workspaceId);
  }

  /**
   * Stops the polling loop and terminates all active child workers.
   */
  public async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    for (const [jobId, worker] of this.activeWorkers.entries()) {
      AppLogger.warn('JobScheduler', `Terminating job "${jobId}" due to scheduler stop`, this.workspaceId);
      worker.kill('SIGTERM');

      this.db.prepare(`
        UPDATE jobs
        SET status = 'interrupted', updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(jobId);
    }
    this.activeWorkers.clear();
    AppLogger.info('JobScheduler', `Scheduler stopped for workspace: ${this.workspaceId}`, this.workspaceId);
  }

  /**
   * Ticks to evaluate job slots and dispatch pending items.
   */
  private tick(): void {
    try {
      if (this.activeWorkers.size >= this.maxConcurrency) {
        return;
      }

      const job = this.db.prepare(`
        SELECT * FROM jobs
        WHERE workspaceId = ? AND status IN ('queued', 'retrying')
        ORDER BY priority DESC, createdAt ASC
        LIMIT 1
      `).get(this.workspaceId) as JobPayload | undefined;

      if (!job) return;

      this.runJob(job);
    } catch (err) {
      AppLogger.error('JobScheduler', 'Error in scheduler execution tick', this.workspaceId, err);
    }
  }

  /**
   * Spawns worker process for a job.
   */
  private runJob(job: JobPayload): void {
    const workerId = `worker-fork-${Date.now()}`;
    AppLogger.info('JobScheduler', `Launching job "${job.id}" of type "${job.type}"`, this.workspaceId, { jobId: job.id });

    // 1. Update DB to running state
    this.db.prepare(`
      UPDATE jobs
      SET status = 'running', workerId = ?, startedAt = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(workerId, new Date().toISOString(), job.id);

    this.eventBus.publish('job:started', { jobId: job.id, workerId });

    // 2. Fork worker host child process
    const workerHostPath = join(__dirname, 'worker.js');
    const worker = fork(workerHostPath, [], {
      env: {
        ...process.env,
        WORKSPACES_DB_DIR: join(app.getPath('userData'), 'workspaces'),
      },
      stdio: 'inherit',
    });

    this.activeWorkers.set(job.id, worker);

    worker.send({
      command: 'start',
      jobId: job.id,
      workspaceId: this.workspaceId,
      type: job.type,
      payload: JSON.parse(job.payload || '{}'),
    });

    // 3. Coordinate IPC messaging channels
    worker.on('message', (msg: any) => {
      if (!msg || typeof msg !== 'object') return;

      switch (msg.type) {
        case 'progress':
          this.db.prepare(`
            UPDATE jobs
            SET progress = ?, updatedAt = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(msg.progress, job.id);
          this.eventBus.publish('job:progress', { jobId: job.id, progress: msg.progress, metadata: msg.metadata });
          break;

        case 'log':
          AppLogger.log({
            workspaceId: this.workspaceId,
            workerId,
            severity: msg.severity || 'info',
            task: job.type,
            message: msg.message,
            metadata: msg.meta,
          });
          break;

        case 'success':
          this.handleJobSuccess(job.id, msg.result);
          break;

        case 'error':
          this.handleJobFailure(job.id, job.retryCount, job.maxRetries, msg.error);
          break;
      }
    });

    // 4. Handle exit codes and crash signals
    worker.on('exit', (code, signal) => {
      this.activeWorkers.delete(job.id);

      const current = this.db.prepare('SELECT status FROM jobs WHERE id = ?').get(job.id) as { status: string } | undefined;
      if (current && current.status === 'running') {
        const errorMsg = `Worker process exited abnormally with code ${code} (signal: ${signal})`;
        AppLogger.error('JobScheduler', `Job "${job.id}" worker crashed: ${errorMsg}`, this.workspaceId, { jobId: job.id });
        this.handleJobFailure(job.id, job.retryCount, job.maxRetries, errorMsg);
      }
    });
  }

  private handleJobSuccess(jobId: string, result: any): void {
    AppLogger.info('JobScheduler', `Job "${jobId}" completed successfully.`, this.workspaceId, { jobId });

    this.db.prepare(`
      UPDATE jobs
      SET status = 'completed', progress = 100, finishedAt = ?, error = NULL, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(new Date().toISOString(), jobId);

    const worker = this.activeWorkers.get(jobId);
    if (worker) {
      worker.kill('SIGTERM');
      this.activeWorkers.delete(jobId);
    }

    this.eventBus.publish('job:completed', { jobId, result });
  }

  private handleJobFailure(jobId: string, currentRetry: number, maxRetries: number, error: string): void {
    const nextRetry = currentRetry + 1;
    const worker = this.activeWorkers.get(jobId);
    if (worker) {
      worker.kill('SIGTERM');
      this.activeWorkers.delete(jobId);
    }

    if (nextRetry <= maxRetries) {
      AppLogger.warn('JobScheduler', `Job "${jobId}" failed. Retrying (Attempt ${nextRetry}/${maxRetries}). Error: ${error}`, this.workspaceId, { jobId });
      this.db.prepare(`
        UPDATE jobs
        SET status = 'retrying', retryCount = ?, error = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(nextRetry, error, jobId);
      this.eventBus.publish('job:failed', { jobId, error, willRetry: true });
    } else {
      AppLogger.error('JobScheduler', `Job "${jobId}" failed permanently after ${maxRetries} retries. Error: ${error}`, this.workspaceId, { jobId });
      this.db.prepare(`
        UPDATE jobs
        SET status = 'failed', error = ?, finishedAt = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(error, new Date().toISOString(), jobId);
      this.eventBus.publish('job:failed', { jobId, error, willRetry: false });
    }
  }

  /**
   * Request job cancellation.
   */
  public cancelJob(jobId: string): void {
    const worker = this.activeWorkers.get(jobId);
    if (worker) {
      AppLogger.warn('JobScheduler', `Cancelling running job: ${jobId}`, this.workspaceId);
      worker.kill('SIGTERM');
      this.activeWorkers.delete(jobId);
    }

    this.db.prepare(`
      UPDATE jobs
      SET status = 'cancelled', finishedAt = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(new Date().toISOString(), jobId);

    this.eventBus.publish('job:cancelled', { jobId });
  }
}
