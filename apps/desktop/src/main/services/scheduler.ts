import { type ChildProcess, fork } from 'child_process';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { app } from 'electron';
import { is } from '@electron-toolkit/utils';
import Database from 'better-sqlite3';
import { LocalEventBus } from '../lib/event-bus';
import { AppLogger } from '../lib/logger';
import { decryptSecret } from '../lib/crypto';
import type { JobPayload, SchedulerConfig } from '../../shared/types/job';
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
  /** Tracks pending cancel resolvers to return a Promise from cancelJob. */
  private pendingCancels = new Map<string, () => void>();
  /**
   * Per-job heartbeat watchdog state.
   * Keyed by jobId. Cleared on every worker exit path to prevent interval leaks.
   * Spec: worker_runtime_spec.md §4.5 / AC-003 / TASK-010
   */
  private heartbeats = new Map<string, { intervalId: NodeJS.Timeout; lastPongAt: number }>();
  /** ms between ping commands sent to each active worker. Spec: worker_runtime_spec.md §4.5. */
  private readonly heartbeatIntervalMs = 10_000;
  /**
   * ms after the last pong at which the worker is considered stalled and killed.
   * Total worst-case detection = heartbeatIntervalMs + heartbeatTimeoutMs = 40s (AC-003.1).
   */
  private readonly heartbeatTimeoutMs = 30_000;
  /**
   * Total maximum active workers across all job types.
   * Default value used as the fallback when no 'scheduler:concurrency:global' key
   * exists in the settings table.
   * Spec: worker_runtime_spec.md §4.4 / AC-006 / TASK-013
   */
  private readonly defaultMaxConcurrency = 3;
  /**
   * Tracks the number of currently active workers for each job type.
   * Keyed by job type string (e.g. 'scraper:maps', 'crawler:website').
   * Incremented in runJob(). Decremented in every worker exit path.
   * Spec: AC-006 / TASK-013
   */
  private typeActiveCount = new Map<string, number>();

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

    // Reconcile stale jobs on startup
    try {
      // 1. Run SMTP settings automatic migration
      this.migrateLegacySmtpSettings();

      const staleJobs = this.db.prepare(`
        SELECT id, type, payload, retryCount, maxRetries FROM jobs
        WHERE workspaceId = ? AND status IN ('running', 'starting')
      `).all(this.workspaceId) as { id: string; type: string; payload: string; retryCount: number; maxRetries: number }[];

      for (const job of staleJobs) {
        let executionId: string | null = null;
        if (job.type === 'automation:workflow' && job.payload) {
          try {
            const p = JSON.parse(job.payload);
            executionId = p.executionId;
          } catch {
            // ignore
          }
        }

        if (job.retryCount < job.maxRetries) {
          this.db.prepare(`
            UPDATE jobs
            SET status = 'retrying', retryCount = retryCount + 1, lastError = 'Worker execution interrupted due to application restart.', updatedAt = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(job.id);

          if (executionId) {
            this.db.prepare(`
              UPDATE sequence_executions
              SET status = 'waiting', updatedAt = CURRENT_TIMESTAMP
              WHERE id = ? AND status IN ('running', 'starting')
            `).run(executionId);
          }
        } else {
          this.db.prepare(`
            UPDATE jobs
            SET status = 'failed', lastError = 'Worker execution interrupted due to application restart. Max retries exceeded.', updatedAt = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(job.id);

          if (executionId) {
            this.db.prepare(`
              UPDATE sequence_executions
              SET status = 'paused', lastError = 'Max retries exceeded due to restart interruption.', updatedAt = CURRENT_TIMESTAMP
              WHERE id = ? AND status IN ('running', 'starting')
            `).run(executionId);
          }
        }
      }

      // Transition any orphaned sequence executions stuck in running/starting back to waiting
      this.db.prepare(`
        UPDATE sequence_executions
        SET status = 'waiting', updatedAt = CURRENT_TIMESTAMP
        WHERE workspaceId = ? AND status IN ('running', 'starting')
          AND id NOT IN (
            SELECT json_extract(payload, '$.executionId') FROM jobs
            WHERE workspaceId = ? AND status IN ('queued', 'starting', 'running', 'retrying')
          )
      `).run(this.workspaceId, this.workspaceId);

      if (staleJobs.length > 0) {
        AppLogger.info('JobScheduler', `Reconciled ${staleJobs.length} stale starting/running jobs on startup.`, this.workspaceId);
      }
    } catch (err) {
      AppLogger.error('JobScheduler', 'Failed to reconcile stale jobs on startup', this.workspaceId, err);
    }

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

    for (const resolveCancel of this.pendingCancels.values()) resolveCancel();
    this.pendingCancels.clear();

    // Clear all heartbeat intervals before terminating workers.
    for (const jobId of [...this.heartbeats.keys()]) this.clearHeartbeat(jobId);

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
    this.typeActiveCount.clear(); // TASK-013: reset all per-type counts on stop
    AppLogger.info('JobScheduler', `Scheduler stopped for workspace: ${this.workspaceId}`, this.workspaceId);
  }

  /**
   * Ticks to evaluate job slots and dispatch pending items.
   */
  private tick(): void {
    // ─── Phase 1: Dispatch queued/retrying jobs ───────────────────────────
    try {
      const config = this.loadSchedulerConfig();
      const workerId = `worker-fork-${Date.now()}`;

      // Only evaluate dispatch if global concurrency cap is not exceeded
      if (this.activeWorkers.size < config.globalMaxConcurrency) {
        let job: JobPayload | undefined;

        this.db.transaction(() => {
          // Find next queued job, excluding types already at their per-type limit.
          // We fetch a small batch (LIMIT 10) and pick the first one that fits.
          // This avoids starvation when a high-priority type is at its limit.
          const candidates = this.db.prepare(`
            SELECT * FROM jobs
            WHERE workspaceId = ? AND status IN ('queued', 'retrying')
              AND (scheduledAt IS NULL OR scheduledAt <= datetime('now'))
            ORDER BY priority DESC, createdAt ASC
            LIMIT 10
          `).all(this.workspaceId) as JobPayload[];

          for (const candidate of candidates) {
            const typeLimit = config.typeLimits[candidate.type];
            if (typeLimit !== undefined) {
              // Per-type limit configured — check active count for this type.
              const activeForType = this.typeActiveCount.get(candidate.type) ?? 0;
              if (activeForType >= typeLimit) {
                // This type is at its limit — try the next candidate.
                continue;
              }
            }

            // Atomic lock/claim: update status to starting inside transaction
            const result = this.db.prepare(`
              UPDATE jobs
              SET status = 'starting', workerId = ?, updatedAt = CURRENT_TIMESTAMP
              WHERE id = ? AND status = ?
            `).run(workerId, candidate.id, candidate.status);

            if (result.changes > 0) {
              job = candidate;
              break;
            }
          }
        })();

        if (job) {
          this.runJob(job);
        }
      }
    } catch (err) {
      AppLogger.error('JobScheduler', 'Error in scheduler dispatch phase', this.workspaceId, err);
    }

    // ─── Phase 2: Resume waiting sequence executions ──────────────────────
    try {
      const dueExecutions = this.db.prepare(`
        SELECT id, sequenceId, currentStep, retryCount
        FROM sequence_executions
        WHERE workspaceId = ? 
          AND status = 'waiting' 
          AND nextExecutionAt <= datetime('now')
        LIMIT 5
      `).all(this.workspaceId) as { id: string; sequenceId: string; currentStep: number; retryCount?: number }[];

      for (const exec of dueExecutions) {
        try {
          // Check if a resume job is already queued, starting, running, or retrying
          const existing = this.db.prepare(`
            SELECT id FROM jobs
            WHERE workspaceId = ? AND type = 'automation:workflow'
              AND json_extract(payload, '$.executionId') = ?
              AND status IN ('queued', 'starting', 'running', 'retrying')
          `).get(this.workspaceId, exec.id);

          if (!existing) {
            const execRetryCount = exec.retryCount || 0;
            this.db.prepare(`
              INSERT INTO jobs (id, workspaceId, type, status, priority, payload, progress, retryCount, maxRetries, createdAt, updatedAt)
              VALUES (?, ?, 'automation:workflow', 'queued', 4, ?, 0, ?, 3, datetime('now'), datetime('now'))
            `).run(
              randomUUID(),
              this.workspaceId,
              JSON.stringify({ executionId: exec.id, resumeFrom: exec.currentStep, retryCount: execRetryCount }),
              execRetryCount
            );

            this.eventBus.publish('automation:queued', {
              executionId: exec.id,
              sequenceId: exec.sequenceId,
              workspaceId: this.workspaceId,
              entityId: '', // resolved inside worker
              currentStep: exec.currentStep,
              timestamp: new Date().toISOString()
            });
          }
        } catch (execErr) {
          AppLogger.error('JobScheduler', `Failed to queue resumption job for execution "${exec.id}"`, this.workspaceId, execErr);
        }
      }
    } catch (err) {
      AppLogger.error('JobScheduler', 'Error in scheduler wait-resume scan phase', this.workspaceId, err);
    }
  }

  /**
   * Reads concurrency configuration from the settings table.
   *
   * Keys in the settings table:
   *   `scheduler:concurrency:global`    → globalMaxConcurrency (integer string)
   *   `scheduler:concurrency:<jobType>` → per-type limit (integer string)
   *
   * Falls back to built-in defaults if keys are absent or malformed.
   * Called every tick so that setting changes take effect without restart.
   *
   * Defaults:
   *   global          = 3
   *   scraper:maps    = 1
   *   crawler:website = 2
   *
   * Spec: worker_runtime_spec.md §4.4 / AC-006 / TASK-013
   */
  private loadSchedulerConfig(): SchedulerConfig {
    const defaults: SchedulerConfig = {
      globalMaxConcurrency: this.defaultMaxConcurrency,
      typeLimits: {
        'scraper:maps': 1,
        'crawler:website': 2,
      },
    };

    try {
      const rows = this.db.prepare(`
        SELECT key, value FROM settings
        WHERE workspaceId = ? AND key LIKE 'scheduler:concurrency:%'
      `).all(this.workspaceId) as { key: string; value: string }[];

      if (rows.length === 0) return defaults;

      const config: SchedulerConfig = {
        globalMaxConcurrency: defaults.globalMaxConcurrency,
        typeLimits: { ...defaults.typeLimits },
      };

      for (const row of rows) {
        const parsed = parseInt(row.value, 10);
        if (isNaN(parsed) || parsed < 1) continue; // ignore malformed values

        if (row.key === 'scheduler:concurrency:global') {
          config.globalMaxConcurrency = parsed;
        } else {
          // Strip prefix to get the job type, e.g. 'scraper:maps'
          const jobType = row.key.replace('scheduler:concurrency:', '');
          config.typeLimits[jobType] = parsed;
        }
      }

      return config;
    } catch (err) {
      // If the settings table query fails for any reason, continue with defaults.
      AppLogger.warn('JobScheduler', 'Failed to load scheduler config from settings table — using defaults', this.workspaceId, err);
      return defaults;
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
      // Dev only: attach Node.js inspector on a random available port.
      // In production is.dev === false so execArgv is an empty array.
      // Spec: worker_runtime_spec.md §4.7 / TASK-009
      execArgv: is.dev ? ['--inspect=0'] : [],
    });

    // Pipe worker stdout / stderr into the Main-process AppLogger.
    worker.stdout?.on('data', (data: Buffer) => {
      AppLogger.info('WorkerHost', data.toString().trim(), this.workspaceId);
    });
    worker.stderr?.on('data', (data: Buffer) => {
      AppLogger.error('WorkerHost', data.toString().trim(), this.workspaceId);
    });

    this.activeWorkers.set(job.id, worker);

    // Track type-level active count. Decremented in every worker exit path.
    // Spec: AC-006 / TASK-013
    this.typeActiveCount.set(job.type, (this.typeActiveCount.get(job.type) ?? 0) + 1);

    // 3. Register all IPC message handlers BEFORE sending 'start', so no message
    //    can arrive between send and handler registration.
    worker.on('message', (rawMsg: unknown) => {
      const msg = rawMsg as any;
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
          // -----------------------------------------------------------------
          // Start heartbeat watchdog. Worker is now confirmed alive and must
          // respond to { command: 'ping' } within heartbeatTimeoutMs.
          // Spec: worker_runtime_spec.md §4.5 / AC-003 / TASK-010
          // -----------------------------------------------------------------
          this.heartbeats.set(job.id, {
            lastPongAt: Date.now(),
            intervalId: setInterval(() => {
              const state = this.heartbeats.get(job.id);
              if (!state) return; // already cleared on a clean exit path

              if (Date.now() - state.lastPongAt >= this.heartbeatTimeoutMs) {
                // Stall detected — worker has not responded within heartbeatTimeoutMs.
                AppLogger.error(
                  'JobScheduler',
                  `Heartbeat timeout for job "${job.id}" — no pong in ${this.heartbeatTimeoutMs}ms. Killing worker.`,
                  this.workspaceId,
                  { jobId: job.id }
                );
                this.clearHeartbeat(job.id);
                const w = this.activeWorkers.get(job.id);
                if (w) {
                  w.kill('SIGKILL');
                  this.activeWorkers.delete(job.id);
                }
                this.handleJobFailure(job.id, job.retryCount, job.maxRetries, 'Heartbeat timeout');
                this.eventBus.publish('job:heartbeat:timeout', { jobId: job.id });
              } else if (worker.connected) {
                // Worker is healthy — send ping to keep watchdog alive.
                worker.send({ command: 'ping' } as MainToWorkerMsg);
              }
            }, this.heartbeatIntervalMs),
          });
          break;

        // ---------------------------------------------------------------
        // PONG — worker responded to ping. Reset the watchdog timer.
        // Spec: worker_runtime_spec.md §4.5 / TASK-010
        // ---------------------------------------------------------------
        case 'pong': {
          const hb = this.heartbeats.get(job.id);
          if (hb) hb.lastPongAt = Date.now();
          break;
        }

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

        case 'notify': {
          const { Notification } = require('electron');
          if (Notification.isSupported()) {
            new Notification({ title: msg.title || 'LeadForge OS', body: msg.body }).show();
          }
          break;
        }

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
          this.clearHeartbeat(job.id);
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
          this.clearHeartbeat(job.id);
          this.db.prepare(`
            UPDATE jobs
            SET status = 'cancelled', finishedAt = ?, updatedAt = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(new Date().toISOString(), job.id);
          this.activeWorkers.delete(job.id);
          this.eventBus.publish('job:cancelled', { jobId: job.id });

          const resolveCancel = this.pendingCancels.get(job.id);
          if (resolveCancel) {
            resolveCancel();
            this.pendingCancels.delete(job.id);
          }
          break;
        }

        case 'success':
          this.handleJobSuccess(job.id, msg.result);
          break;

        case 'error':
          this.handleJobFailure(job.id, job.retryCount, job.maxRetries, msg.error);
          break;

        case 'automation_event':
          this.eventBus.publish((msg as any).event, (msg as any).payload);
          break;
      }
    });

    // 4. Crash / unexpected exit handler.
    //    Only escalates if the job was still 'running' or 'starting' — not if
    //    it cleanly exited via paused/cancelled/success paths.
    worker.on('exit', (code, signal) => {
      this.clearHeartbeat(job.id); // always clear on any exit, TASK-010
      this.activeWorkers.delete(job.id);
      this.decrementTypeCount(job.type); // TASK-013: release per-type slot

      const current = this.db.prepare('SELECT status FROM jobs WHERE id = ?').get(job.id) as { status: string } | undefined;
      if (current && (current.status === 'running' || current.status === 'starting')) {
        const errorMsg = `Worker process exited abnormally with code ${code} (signal: ${signal})`;
        AppLogger.error('JobScheduler', `Job "${job.id}" worker crashed: ${errorMsg}`, this.workspaceId, { jobId: job.id });
        this.handleJobFailure(job.id, job.retryCount, job.maxRetries, errorMsg);
      }

      const resolveCancel = this.pendingCancels.get(job.id);
      if (resolveCancel) {
        resolveCancel();
        this.pendingCancels.delete(job.id);
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

    // Inject decrypted secrets using the Principle of Least Privilege
    try {
      const secrets: Record<string, string> = {};
      if (job.type === 'automation:workflow') {
        // 1. Resolve specific SMTP/IMAP credentials of the campaign's connected account
        if (parsedPayload.executionId) {
          const execRow = this.db.prepare(`
            SELECT campaignId FROM sequence_executions WHERE id = ?
          `).get(parsedPayload.executionId) as { campaignId: string | null } | undefined;

          if (execRow?.campaignId) {
            const campRow = this.db.prepare(`
              SELECT sendingAccountId FROM campaigns WHERE id = ?
            `).get(execRow.campaignId) as { sendingAccountId: string | null } | undefined;

            if (campRow?.sendingAccountId) {
              const accRow = this.db.prepare(`
                SELECT smtpPassword, imapPassword FROM email_accounts WHERE id = ?
              `).get(campRow.sendingAccountId) as { smtpPassword: string | null; imapPassword: string | null } | undefined;

              if (accRow) {
                if (accRow.smtpPassword) {
                  secrets['smtp.password'] = decryptSecret(accRow.smtpPassword);
                }
                if (accRow.imapPassword) {
                  secrets['imap.password'] = decryptSecret(accRow.imapPassword);
                }
              }
            }
          }
        }

        // 2. Scan the sequence steps for any requested {{secret.xxx}} keys
        if (parsedPayload.sequenceId) {
          const seqRow = this.db.prepare(`
            SELECT steps FROM sequences WHERE id = ?
          `).get(parsedPayload.sequenceId) as { steps: string } | undefined;

          if (seqRow?.steps) {
            const stepsStr = seqRow.steps;
            const secretMatches = [...stepsStr.matchAll(/\{\{secret\.([^}]+)\}\}/g)];
            for (const match of secretMatches) {
              const rawKey = match[1] ? match[1].trim() : '';
              if (!rawKey) continue;
              const possibleKeys = [rawKey, `secret.${rawKey}`, `secrets.${rawKey}`];
              for (const pk of possibleKeys) {
                const row = this.db.prepare(`
                  SELECT value FROM settings WHERE workspaceId = ? AND key = ?
                `).get(this.workspaceId, pk) as { value: string } | undefined;
                if (row?.value) {
                  secrets[pk] = decryptSecret(row.value);
                  break;
                }
              }
            }
          }
        }
      } else if (job.type === 'outreach:campaign') {
        const campaignId = parsedPayload.campaignId;
        if (campaignId) {
          const campRow = this.db.prepare(`
            SELECT sendingAccountId FROM campaigns WHERE id = ?
          `).get(campaignId) as { sendingAccountId: string | null } | undefined;

          if (campRow?.sendingAccountId) {
            const accRow = this.db.prepare(`
              SELECT smtpHost, smtpPort, smtpSecure, smtpUsername, smtpPassword,
                     imapHost, imapPort, imapSecure, imapUsername, imapPassword
              FROM email_accounts WHERE id = ?
            `).get(campRow.sendingAccountId) as any;

            if (accRow) {
              secrets['smtp.host'] = accRow.smtpHost || '';
              secrets['smtp.port'] = String(accRow.smtpPort || 465);
              secrets['smtp.secure'] = accRow.smtpSecure || 'true';
              secrets['smtp.username'] = accRow.smtpUsername || '';
              secrets['smtp.password'] = decryptSecret(accRow.smtpPassword || '');
              
              secrets['imap.host'] = accRow.imapHost || '';
              secrets['imap.port'] = String(accRow.imapPort || 993);
              secrets['imap.secure'] = accRow.imapSecure || 'true';
              secrets['imap.username'] = accRow.imapUsername || '';
              secrets['imap.password'] = decryptSecret(accRow.imapPassword || '');
            }
          }
        }
      } else if (job.type === 'outreach:imap-poll' || job.type === 'imap-poll') {
        const accounts = this.db.prepare(`
          SELECT smtpHost, smtpPort, smtpSecure, smtpUsername, smtpPassword,
                 imapHost, imapPort, imapSecure, imapUsername, imapPassword
          FROM email_accounts WHERE workspaceId = ? AND deletedAt IS NULL
        `).all(this.workspaceId) as any[];

        if (accounts.length > 0) {
          let target = accounts[0];
          if (parsedPayload.accountId) {
            const match = accounts.find(a => a.id === parsedPayload.accountId);
            if (match) target = match;
          }
          if (target) {
            secrets['smtp.host'] = target.smtpHost || '';
            secrets['smtp.port'] = String(target.smtpPort || 465);
            secrets['smtp.secure'] = target.smtpSecure || 'true';
            secrets['smtp.username'] = target.smtpUsername || '';
            secrets['smtp.password'] = decryptSecret(target.smtpPassword || '');
            
            secrets['imap.host'] = target.imapHost || '';
            secrets['imap.port'] = String(target.imapPort || 993);
            secrets['imap.secure'] = target.imapSecure || 'true';
            secrets['imap.username'] = target.imapUsername || '';
            secrets['imap.password'] = decryptSecret(target.imapPassword || '');
          }
        }
      } else if (job.type.includes('linkedin') || job.type.includes('enrich')) {
        // LinkedIn / enrichment workers only need the linkedin cookie
        const row = this.db.prepare(`
          SELECT value FROM settings WHERE workspaceId = ? AND key = 'linkedin_li_at'
        `).get(this.workspaceId) as { value: string } | undefined;
        if (row?.value) {
          secrets['linkedin_li_at'] = decryptSecret(row.value);
        }
        const orRow = this.db.prepare(`
          SELECT value FROM settings WHERE workspaceId = ? AND key = 'openrouter_key'
        `).get(this.workspaceId) as { value: string } | undefined;
        if (orRow?.value) {
          secrets['openrouter_key'] = decryptSecret(orRow.value);
        }
      }
      parsedPayload._secrets = secrets;
    } catch (err) {
      AppLogger.error('JobScheduler', 'Failed to load secrets for worker payload', this.workspaceId, err);
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
    this.clearHeartbeat(jobId); // TASK-010: clear watchdog on success

    this.db.prepare(`
      UPDATE jobs
      SET status = 'completed', progress = 100, finishedAt = ?, error = NULL, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(new Date().toISOString(), jobId);

    // Auto-queue intelligence enrichment on website crawl completion
    try {
      const job = this.db.prepare('SELECT type, payload FROM jobs WHERE id = ?').get(jobId) as { type: string; payload: string } | undefined;
      if (job?.type === 'crawler:website') {
        const payload = JSON.parse(job.payload || '{}');
        const companyId = payload.companyId;
        if (companyId) {
          const newJobId = randomUUID();
          this.db.prepare(`
            INSERT INTO jobs (id, workspaceId, type, status, priority, payload, progress, retryCount, maxRetries, createdAt, updatedAt)
            VALUES (?, ?, 'enrich:intelligence', 'queued', 5, ?, 0, 0, 3, datetime('now'), datetime('now'))
          `).run(newJobId, this.workspaceId, JSON.stringify({ companyId }));
          AppLogger.info('JobScheduler', `Auto-queued enrich:intelligence job for Company: ${companyId}`, this.workspaceId);
        }
      }
    } catch (err) {
      AppLogger.error('JobScheduler', 'Failed to auto-queue intelligence enrichment after website crawl', this.workspaceId, err);
    }

    this.activeWorkers.delete(jobId);

    this.eventBus.publish('job:completed', { jobId, result });

    const resolveCancel = this.pendingCancels.get(jobId);
    if (resolveCancel) {
      resolveCancel();
      this.pendingCancels.delete(jobId);
    }
  }

  private handleJobFailure(jobId: string, currentRetry: number, maxRetries: number, error: string): void {
    this.clearHeartbeat(jobId); // TASK-010: clear watchdog on all failure paths
    const nextRetry = currentRetry + 1;
    const worker = this.activeWorkers.get(jobId);
    if (worker) {
      worker.kill('SIGTERM');
      this.activeWorkers.delete(jobId);
    }

    const job = this.db.prepare('SELECT type, payload FROM jobs WHERE id = ?').get(jobId) as { type: string; payload: string } | undefined;
    const isAutomation = job?.type === 'automation:workflow';

    if (isAutomation) {
      let executionId: string | undefined;
      try {
        executionId = JSON.parse(job?.payload || '{}').executionId;
      } catch {}

      if (executionId) {
        const exec = this.db.prepare('SELECT sequenceId, contactId, companyId, currentStep FROM sequence_executions WHERE id = ?').get(executionId) as { sequenceId: string; contactId: string | null; companyId: string | null; currentStep: number } | undefined;
        const sequenceId = exec?.sequenceId || 'unknown';
        const entityId = exec?.contactId || exec?.companyId || 'unknown';

        if (nextRetry <= maxRetries) {
          const delaySec = Math.pow(2, nextRetry);
          const nextRun = new Date(Date.now() + delaySec * 1000).toISOString();

          this.db.transaction(() => {
            this.db.prepare(`
              UPDATE sequence_executions
              SET status = 'waiting', nextExecutionAt = ?, retryCount = ?, updatedAt = CURRENT_TIMESTAMP
              WHERE id = ?
            `).run(nextRun, nextRetry, executionId);

            this.db.prepare(`
              INSERT INTO sequence_logs (id, executionId, workspaceId, timestamp, step, action, status, message, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, 'RETRY', 'failed', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).run(
              randomUUID(),
              executionId,
              this.workspaceId,
              new Date().toISOString(),
              exec?.currentStep || 0,
              `Worker process crashed/failed. Scheduling retry ${nextRetry}/${maxRetries} in ${delaySec} seconds. Error: ${error}`
            );

            this.db.prepare(`
              UPDATE jobs
              SET status = 'failed', error = ?, finishedAt = ?, updatedAt = CURRENT_TIMESTAMP
              WHERE id = ?
            `).run(error, new Date().toISOString(), jobId);
          })();

          this.eventBus.publish('automation:failed', {
            executionId,
            sequenceId,
            workspaceId: this.workspaceId,
            entityId,
            currentStep: exec?.currentStep || 0,
            workerPid: 0,
            error: `Worker crashed: ${error}. Retrying in ${delaySec}s`,
            timestamp: new Date().toISOString()
          });

          this.eventBus.publish('automation:waiting', {
            executionId,
            sequenceId,
            workspaceId: this.workspaceId,
            entityId,
            currentStep: exec?.currentStep || 0,
            workerPid: 0,
            timestamp: new Date().toISOString()
          });
        } else {
          // Permanent failure
          this.db.transaction(() => {
            this.db.prepare(`
              UPDATE sequence_executions
              SET status = 'failed', completedAt = CURRENT_TIMESTAMP, retryCount = ?, updatedAt = CURRENT_TIMESTAMP
              WHERE id = ?
            `).run(nextRetry, executionId);

            this.db.prepare(`
              INSERT INTO sequence_logs (id, executionId, workspaceId, timestamp, step, action, status, message, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, 'ERROR', 'failed', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).run(
              randomUUID(),
              executionId,
              this.workspaceId,
              new Date().toISOString(),
              exec?.currentStep || 0,
              `Worker crashed/failed permanently after ${maxRetries} retries. Error: ${error}`
            );

            this.db.prepare(`
              UPDATE jobs
              SET status = 'failed', error = ?, finishedAt = ?, updatedAt = CURRENT_TIMESTAMP
              WHERE id = ?
            `).run(error, new Date().toISOString(), jobId);

            // Release lock
            this.db.prepare('DELETE FROM automation_locks WHERE sequenceId = ? AND entityId = ?').run(sequenceId, entityId);
          })();

          this.eventBus.publish('automation:failed', {
            executionId,
            sequenceId,
            workspaceId: this.workspaceId,
            entityId,
            currentStep: exec?.currentStep || 0,
            workerPid: 0,
            error: `Worker crashed permanently: ${error}`,
            timestamp: new Date().toISOString()
          });
        }
      }
    } else {
      if (nextRetry <= maxRetries) {
        const delaySec = Math.pow(2, nextRetry);
        const scheduledAt = new Date(Date.now() + delaySec * 1000).toISOString();
        AppLogger.warn('JobScheduler', `Job "${jobId}" failed. Retrying (Attempt ${nextRetry}/${maxRetries}). Error: ${error}`, this.workspaceId, { jobId });
        this.db.prepare(`
          UPDATE jobs
          SET status = 'retrying', retryCount = ?, error = ?, scheduledAt = ?, updatedAt = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(nextRetry, error, scheduledAt, jobId);
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

    const resolveCancel = this.pendingCancels.get(jobId);
    if (resolveCancel) {
      resolveCancel();
      this.pendingCancels.delete(jobId);
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
  public cancelJob(jobId: string): Promise<void> {
    const worker = this.activeWorkers.get(jobId);
    if (worker) {
      AppLogger.warn('JobScheduler', `Sending cancel command to job "${jobId}"`, this.workspaceId, { jobId });

      // Soft cancel — let the worker clean up before exiting.
      worker.send({ command: 'cancel' } as MainToWorkerMsg);

      const cancelPromise = new Promise<void>((resolve) => {
        this.pendingCancels.set(jobId, resolve);
      });

      // Hard-kill fallback: force-kill if worker does not ack within 15 seconds.
      const hardKillTimeout = setTimeout(() => {
        if (this.activeWorkers.has(jobId)) {
          AppLogger.error('JobScheduler', `Hard-killing job "${jobId}" — cancel not acknowledged within 15s`, this.workspaceId, { jobId });
          const w = this.activeWorkers.get(jobId);
          w?.kill('SIGKILL');
          this.activeWorkers.delete(jobId);
          this.cancelTimeouts.delete(jobId);
          this.clearHeartbeat(jobId); // TASK-010: clear watchdog on hard-kill

          this.db.prepare(`
            UPDATE jobs
            SET status = 'cancelled', finishedAt = ?, updatedAt = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(new Date().toISOString(), jobId);

          this.eventBus.publish('job:cancelled', { jobId });

          const resolveCancel = this.pendingCancels.get(jobId);
          if (resolveCancel) {
            resolveCancel();
            this.pendingCancels.delete(jobId);
          }
        }
      }, 15000);

      this.cancelTimeouts.set(jobId, hardKillTimeout);
      return cancelPromise;
    } else {
      // No active worker — job is queued or already terminal. Update DB directly.
      this.db.prepare(`
        UPDATE jobs
        SET status = 'cancelled', finishedAt = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(new Date().toISOString(), jobId);

      this.eventBus.publish('job:cancelled', { jobId });
      return Promise.resolve();
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

  /**
   * Decrements the type-level active worker count for a job type.
   *
   * Idempotent — safe to call even if no count is tracked for the type.
   * The count is floored at 0 and removed from the map when it reaches zero
   * to prevent indefinite map growth.
   *
   * Must be called on every worker exit path, mirroring the increment in runJob().
   * Spec: AC-006 / TASK-013
   */
  private decrementTypeCount(jobType: string): void {
    const current = this.typeActiveCount.get(jobType) ?? 0;
    if (current <= 1) {
      this.typeActiveCount.delete(jobType);
    } else {
      this.typeActiveCount.set(jobType, current - 1);
    }
  }

  /**
   * Stops and removes the heartbeat watchdog for a job.
   *
   * Idempotent — safe to call multiple times for the same jobId.
   * Must be invoked on every worker exit path to prevent setInterval leaks.
   * Spec: worker_runtime_spec.md §4.5 / AC-003.4 (healthy workers not killed) / TASK-010
   */
  private clearHeartbeat(jobId: string): void {
    const hb = this.heartbeats.get(jobId);
    if (hb) {
      clearInterval(hb.intervalId);
      this.heartbeats.delete(jobId);
    }
  }

  /**
   * Automatically migrates legacy global SMTP/IMAP settings to the email_accounts table.
   * Resolves configuration divergence and guarantees single authoritative credentials.
   */
  private migrateLegacySmtpSettings(): void {
    try {
      const legacyPassRow = this.db.prepare(`
        SELECT value FROM settings WHERE workspaceId = ? AND key = 'smtp.password'
      `).get(this.workspaceId) as { value: string } | undefined;

      if (legacyPassRow && legacyPassRow.value) {
        const firstAccount = this.db.prepare(`
          SELECT id, email FROM email_accounts WHERE workspaceId = ? AND deletedAt IS NULL LIMIT 1
        `).get(this.workspaceId) as { id: string; email: string } | undefined;

        if (firstAccount) {
          const accountDetails = this.db.prepare(`
            SELECT smtpPassword FROM email_accounts WHERE id = ?
          `).get(firstAccount.id) as { smtpPassword: string } | undefined;

          if (!accountDetails?.smtpPassword) {
            const smtpHost = (this.db.prepare(`SELECT value FROM settings WHERE workspaceId = ? AND key = 'smtp.host'`).get(this.workspaceId) as { value: string } | undefined)?.value || 'smtp.gmail.com';
            const smtpPort = (this.db.prepare(`SELECT value FROM settings WHERE workspaceId = ? AND key = 'smtp.port'`).get(this.workspaceId) as { value: string } | undefined)?.value || '465';
            const smtpSecure = (this.db.prepare(`SELECT value FROM settings WHERE workspaceId = ? AND key = 'smtp.secure'`).get(this.workspaceId) as { value: string } | undefined)?.value || 'true';
            const imapHost = (this.db.prepare(`SELECT value FROM settings WHERE workspaceId = ? AND key = 'imap.host'`).get(this.workspaceId) as { value: string } | undefined)?.value || 'imap.gmail.com';
            const imapPort = (this.db.prepare(`SELECT value FROM settings WHERE workspaceId = ? AND key = 'imap.port'`).get(this.workspaceId) as { value: string } | undefined)?.value || '993';
            const imapSecure = (this.db.prepare(`SELECT value FROM settings WHERE workspaceId = ? AND key = 'imap.secure'`).get(this.workspaceId) as { value: string } | undefined)?.value || 'true';

            this.db.prepare(`
              UPDATE email_accounts
              SET smtpHost = ?, smtpPort = ?, smtpSecure = ?, smtpUsername = ?, smtpPassword = ?,
                  imapHost = ?, imapPort = ?, imapSecure = ?, imapUsername = ?, imapPassword = ?
              WHERE id = ?
            `).run(
              smtpHost,
              parseInt(smtpPort, 10) || 465,
              smtpSecure,
              firstAccount.email,
              legacyPassRow.value,
              imapHost,
              parseInt(imapPort, 10) || 993,
              imapSecure,
              firstAccount.email,
              legacyPassRow.value,
              firstAccount.id
            );

            AppLogger.info('JobScheduler', `Successfully migrated legacy SMTP credentials to email_account: ${firstAccount.email}`, this.workspaceId);
          }
        }
      }
    } catch (err) {
      AppLogger.error('JobScheduler', 'Failed to migrate legacy SMTP/IMAP settings on start', this.workspaceId, err);
    }
  }
}
