import { type ChildProcess, fork } from 'child_process';
import { join } from 'path';
import { app } from 'electron';
import Database from 'better-sqlite3';
import { LocalEventBus } from '../lib/event-bus';
import { AppLogger } from '../lib/logger';
import type { JobPayload } from '../../shared/types/job';
import type { MainToWorkerMsg, WorkerToMainMsg } from '../../shared/types/ipc';

/**
 * JobScheduler ticks periodically to select queued background tasks from SQLite
 * and execute them in sandboxed child processes.
 */
export class JobScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private activeWorkers = new Map<string, ChildProcess>();
  /** Tracks pending hard-kill timeouts for soft-cancel fallback (TASK-008 / BC-005). */
  private cancelTimeouts = new Map<string, NodeJS.Timeout>();
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

    // Clear any pending hard-kill fallback timeouts before shutdown.
    for (const t of this.cancelTimeouts.values()) clearTimeout(t);
    this.cancelTimeouts.clear();

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

    // 1. Transition to 'starting' — forked but not yet confirmed initialised.
    //    Transition to 'running' happens when the worker sends { type: 'ready' }.
    //    BC-008: 'starting' is a new JobStatus value. Spec: worker_runtime_spec.md §4.2
    this.db.prepare(`
      UPDATE jobs
      SET status = 'starting', workerId = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(workerId, job.id);

    this.eventBus.publish('job:starting', { jobId: job.id, workerId });

    // 2. Fork the worker with a minimal, secure environment.
    //    BC-003: stdio changed from 'inherit' → piped, env is now a whitelist.
    const workerHostPath = join(__dirname, 'worker.js');
    const worker = fork(workerHostPath, [], {
      env: {
        WORKSPACES_DB_DIR: join(app.getPath('userData'), 'workspaces'),
        NODE_ENV: process.env.NODE_ENV,
      },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });

    // Pipe worker stdout / stderr into the Main-process AppLogger.
    worker.stdout?.on('data', (data: Buffer) => {
      AppLogger.info('WorkerHost', data.toString().trim(), this.workspaceId);
    });
    worker.stderr?.on('data', (data: Buffer) => {
      AppLogger.error('WorkerHost', data.toString().trim(), this.workspaceId);
    });

    this.activeWorkers.set(job.id, worker);

    // 3. Register all IPC message handlers BEFORE sending 'start', so no message
    //    can arrive between send and handler registration.
    worker.on('message', (rawMsg: unknown) => {
      const msg = rawMsg as WorkerToMainMsg;
      if (!msg || typeof msg !== 'object' || !('type' in msg)) return;

      switch (msg.type) {
        // ---------------------------------------------------------------
        // READY — worker initialised. Transition job from 'starting' → 'running'.
        // file_level_tasks items 4-5 / worker_runtime_spec.md §4.2
        // ---------------------------------------------------------------
        case 'ready':
          this.db.prepare(`
            UPDATE jobs
            SET status = 'running', startedAt = ?, updatedAt = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(new Date().toISOString(), job.id);
          this.eventBus.publish('job:started', { jobId: job.id, workerId });
          break;

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

        // ---------------------------------------------------------------
        // CHECKPOINT — plugin called ctx.saveCheckpoint(). Persist to SQLite.
        // file_level_tasks item 8 / worker_runtime_spec.md §4.2
        // ---------------------------------------------------------------
        case 'checkpoint':
          this.db.prepare(`
            UPDATE jobs
            SET checkpointData = ?, checkpointAt = ?, updatedAt = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(JSON.stringify(msg.data), new Date().toISOString(), job.id);
          break;

        // ---------------------------------------------------------------
        // PAUSED — worker has saved state and is exiting cleanly (exit 0).
        // file_level_tasks item 9 / worker_runtime_spec.md §4.2
        // ---------------------------------------------------------------
        case 'paused':
          this.db.prepare(`
            UPDATE jobs
            SET status = 'paused', checkpointData = ?, checkpointAt = ?, updatedAt = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(
            msg.checkpoint ? JSON.stringify(msg.checkpoint) : null,
            new Date().toISOString(),
            job.id
          );
          this.activeWorkers.delete(job.id);
          this.eventBus.publish('job:paused', { jobId: job.id });
          break;

        // ---------------------------------------------------------------
        // CANCELLED — worker cleaned up and is about to exit 0.
        // Clear the hard-kill fallback. The exit handler will not override
        // because it only escalates when status is 'running' or 'starting'.
        // file_level_tasks item 10 / worker_runtime_spec.md §3.3
        // ---------------------------------------------------------------
        case 'cancelled': {
          const hardKill = this.cancelTimeouts.get(job.id);
          if (hardKill) {
            clearTimeout(hardKill);
            this.cancelTimeouts.delete(job.id);
          }
          this.db.prepare(`
            UPDATE jobs
            SET status = 'cancelled', finishedAt = ?, updatedAt = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(new Date().toISOString(), job.id);
          this.activeWorkers.delete(job.id);
          this.eventBus.publish('job:cancelled', { jobId: job.id });
          break;
        }

        case 'success':
          this.handleJobSuccess(job.id, msg.result);
          break;

        case 'error':
          this.handleJobFailure(job.id, job.retryCount, job.maxRetries, msg.error);
          break;
      }
    });

    // 4. Crash / unexpected exit handler.
    //    Only escalates if the job was still 'running' or 'starting' — not if
    //    it cleanly exited via paused/cancelled/success paths.
    worker.on('exit', (code, signal) => {
      this.activeWorkers.delete(job.id);

      const current = this.db.prepare('SELECT status FROM jobs WHERE id = ?').get(job.id) as { status: string } | undefined;
      if (current && (current.status === 'running' || current.status === 'starting')) {
        const errorMsg = `Worker process exited abnormally with code ${code} (signal: ${signal})`;
        AppLogger.error('JobScheduler', `Job "${job.id}" worker crashed: ${errorMsg}`, this.workspaceId, { jobId: job.id });
        this.handleJobFailure(job.id, job.retryCount, job.maxRetries, errorMsg);
      }
    });

    // 5. Send 'start' — after handlers are registered, after activeWorkers is set.
    //    Build the payload, injecting _checkpoint for paused/interrupted job resumption.
    //    file_level_tasks item 18: Pass _checkpoint from checkpointData on re-dispatch.
    const parsedPayload = JSON.parse(job.payload || '{}');
    if (job.checkpointData) {
      try {
        parsedPayload._checkpoint = JSON.parse(job.checkpointData);
      } catch {
        // Malformed checkpoint data — start fresh without it.
      }
    }

    worker.send({
      command: 'start',
      jobId: job.id,
      workspaceId: this.workspaceId,
      type: job.type,
      payload: parsedPayload,
    } as MainToWorkerMsg);
  }

  private handleJobSuccess(jobId: string, result: any): void {
    AppLogger.info('JobScheduler', `Job "${jobId}" completed successfully.`, this.workspaceId, { jobId });

    this.db.prepare(`
      UPDATE jobs
      SET status = 'completed', progress = 100, finishedAt = ?, error = NULL, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(new Date().toISOString(), jobId);

    // BC-011: Do NOT kill the worker here — it already called process.exit(0)
    // after sending { type: 'success' }. The exit handler handles activeWorkers cleanup.
    this.activeWorkers.delete(jobId);

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
   * Request soft job cancellation via IPC.
   *
   * Sends { command: 'cancel' } to the worker. The worker cleans up at the next
   * checkpoint boundary and responds with { type: 'cancelled' }, which triggers
   * the DB update and event publish in the message handler above.
   *
   * If the worker does not acknowledge within 15 seconds, a SIGKILL hard-kill is issued.
   * For jobs with no active worker (queued state), status is updated directly.
   *
   * BC-005 / file_level_tasks items 10, 12: Replaces the previous SIGTERM-based cancel.
   * Windows-safe — does not rely on SIGTERM signal delivery.
   */
  public cancelJob(jobId: string): void {
    const worker = this.activeWorkers.get(jobId);
    if (worker) {
      AppLogger.warn('JobScheduler', `Sending cancel command to job "${jobId}"`, this.workspaceId, { jobId });

      // Soft cancel — let the worker clean up before exiting.
      worker.send({ command: 'cancel' } as MainToWorkerMsg);

      // Hard-kill fallback: force-kill if worker does not ack within 15 seconds.
      const hardKillTimeout = setTimeout(() => {
        if (this.activeWorkers.has(jobId)) {
          AppLogger.error('JobScheduler', `Hard-killing job "${jobId}" — cancel not acknowledged within 15s`, this.workspaceId, { jobId });
          const w = this.activeWorkers.get(jobId);
          w?.kill('SIGKILL');
          this.activeWorkers.delete(jobId);
          this.cancelTimeouts.delete(jobId);

          this.db.prepare(`
            UPDATE jobs
            SET status = 'cancelled', finishedAt = ?, updatedAt = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(new Date().toISOString(), jobId);

          this.eventBus.publish('job:cancelled', { jobId });
        }
      }, 15000);

      this.cancelTimeouts.set(jobId, hardKillTimeout);
    } else {
      // No active worker — job is queued or already terminal. Update DB directly.
      this.db.prepare(`
        UPDATE jobs
        SET status = 'cancelled', finishedAt = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(new Date().toISOString(), jobId);

      this.eventBus.publish('job:cancelled', { jobId });
    }
  }

  /**
   * Request that a running job pause at the next checkpoint boundary.
   *
   * The worker responds with { type: 'paused', checkpoint } and exits with code 0.
   * The 'paused' message handler above persists the checkpoint and updates status.
   * For queued jobs with no active worker, status is set to 'paused' directly.
   *
   * file_level_tasks item 11 / worker_runtime_spec.md §4.2
   */
  public pauseJob(jobId: string): void {
    const worker = this.activeWorkers.get(jobId);
    if (worker) {
      AppLogger.info('JobScheduler', `Sending pause command to job "${jobId}"`, this.workspaceId, { jobId });
      worker.send({ command: 'pause' } as MainToWorkerMsg);
    } else {
      // Job is not currently running — directly set queued jobs to paused.
      this.db.prepare(`
        UPDATE jobs
        SET status = 'paused', updatedAt = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'queued'
      `).run(jobId);
    }
  }
}
