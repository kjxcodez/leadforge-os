import { type ChildProcess, fork } from 'child_process';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { app } from 'electron';
import type { SdkClient } from '@leadforge/sdk';
import type { Job } from '@leadforge/schema';

const isDev =
  process.env.NODE_ENV === 'development' ||
  (typeof app !== 'undefined' && app?.isPackaged === false);
import { LocalEventBus } from '../lib/event-bus';
import { AppLogger } from '../lib/logger';
import { decryptSecret } from '../lib/crypto';
import { loadSession } from '../lib/session';
import { loadConfig } from '../lib/config';
import { ProjectionService } from './projection-service';
import type { SchedulerConfig } from '../../shared/types/job';
import type { MainToWorkerMsg } from '../../shared/types/ipc';

interface GmailOAuthAccountRow {
  provider?: string | null;
  refreshToken?: string | null;
  accessToken?: string | null;
  tokenExpiresAt?: string | null;
  email?: string | null;
}

/**
 * Injects decrypted Gmail OAuth credentials into a worker job's `_secrets`.
 * Only gmail_oauth accounts receive these secrets (least privilege).
 */
function injectGmailOAuthSecrets(secrets: Record<string, string>, acc: GmailOAuthAccountRow): void {
  const isOAuth =
    (acc.provider || '').toLowerCase() === 'gmail_oauth' || Boolean(acc.refreshToken);
  if (!isOAuth) return;

  secrets['gmail.provider'] = 'gmail_oauth';
  secrets['gmail.user'] = acc.email || '';
}

export type SchedulerState =
  | 'STOPPED'
  | 'ACTIVE'
  | 'IDLE'
  | 'BACKING_OFF'
  | 'PAUSED_OFFLINE';

/**
 * JobScheduler acts as an ephemeral execution coordinator for background tasks,
 * dispatching jobs claimed atomically from the authoritative MongoDB store
 * into sandboxed child processes.
 */
export class JobScheduler {
  private timerId: NodeJS.Timeout | null = null;
  private isTickRunning = false;
  private state: SchedulerState = 'STOPPED';
  private consecutiveEmptyClaims = 0;
  private readonly activePollingInterval = 1500; // 1.5s when active work present
  private readonly baseIdleInterval = 2000; // 2s base idle
  private readonly maxIdleInterval = 15000; // 15s max backoff
  private currentInterval = 2000;
  private totalClaimRequests = 0;
  private activeWorkers = new Map<string, ChildProcess>();
  /** Tracks pending hard-kill timeouts for soft-cancel fallback. */
  private cancelTimeouts = new Map<string, NodeJS.Timeout>();
  /** Tracks pending cancel resolvers to return a Promise from cancelJob. */
  private pendingCancels = new Map<string, () => void>();
  /** Per-job heartbeat watchdog state. */
  private heartbeats = new Map<string, { intervalId: NodeJS.Timeout; lastPongAt: number }>();
  /** ms between ping commands sent to each active worker. */
  private readonly heartbeatIntervalMs = 10_000;
  /** ms after the last pong at which the worker is considered stalled and killed. */
  private readonly heartbeatTimeoutMs = 30_000;
  /** Total maximum active workers across all job types. */
  private readonly defaultMaxConcurrency = 3;
  /** Tracks the number of currently active workers for each job type. */
  private typeActiveCount = new Map<string, number>();
  /** Tracks terminal jobs to guard against duplicate completion callbacks or late crash events. */
  private terminalJobs = new Set<string>();

  constructor(
    private workspaceId: string,
    private sdk: SdkClient,
    private eventBus: LocalEventBus
  ) {}

  public get isActive(): boolean {
    return this.state !== 'STOPPED' && this.state !== 'PAUSED_OFFLINE';
  }

  public getState(): SchedulerState {
    return this.state;
  }

  public getCurrentInterval(): number {
    return this.currentInterval;
  }

  public getConsecutiveEmptyClaims(): number {
    return this.consecutiveEmptyClaims;
  }

  public getTotalClaimRequests(): number {
    return this.totalClaimRequests;
  }

  /**
   * Starts periodic polling loop and triggers startup recovery of stale leases.
   */
  public async start(): Promise<void> {
    if (this.state !== 'STOPPED') return;
    this.state = 'ACTIVE';
    this.consecutiveEmptyClaims = 0;
    this.currentInterval = this.baseIdleInterval;

    // Reconcile stale jobs on startup via authoritative MongoDB API
    try {
      const recoveryResult = await this.sdk.jobs.recover(60_000).catch((err) => {
        AppLogger.warn(
          'JobScheduler',
          `Startup job recovery call encountered warning: ${err.message || String(err)}`,
          this.workspaceId
        );
        return { recovered: 0, failed: 0 };
      });

      if (recoveryResult && (recoveryResult.recovered > 0 || recoveryResult.failed > 0)) {
        AppLogger.info(
          'JobScheduler',
          `Reconciled stale jobs on startup: ${recoveryResult.recovered} retried, ${recoveryResult.failed} failed.`,
          this.workspaceId
        );
      }
    } catch (err) {
      AppLogger.error(
        'JobScheduler',
        'Failed to reconcile stale jobs on startup',
        this.workspaceId,
        err
      );
    }

    this.scheduleNextTick(0);

    AppLogger.info(
      'JobScheduler',
      `Scheduler started for workspace: ${this.workspaceId}`,
      this.workspaceId
    );
  }

  /**
   * Immediately wakes up the scheduler to check for and claim newly submitted jobs.
   * Resets idle backoff to ACTIVE mode and executes a claim tick immediately (<50ms).
   */
  public wakeUp(): void {
    if (this.state === 'STOPPED' || this.state === 'PAUSED_OFFLINE') {
      return;
    }

    this.consecutiveEmptyClaims = 0;
    this.state = 'ACTIVE';
    this.currentInterval = this.activePollingInterval;
    this.scheduleNextTick(0);
  }

  /**
   * Pauses the scheduler loop during offline or degraded connectivity.
   */
  public pauseOffline(): void {
    if (this.state === 'STOPPED') return;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.state = 'PAUSED_OFFLINE';
    AppLogger.info('JobScheduler', 'Scheduler paused while connectivity is offline/degraded', this.workspaceId);
  }

  /**
   * Resumes the scheduler loop when connectivity is restored to ONLINE.
   */
  public resumeOnline(): void {
    if (this.state !== 'PAUSED_OFFLINE') return;
    this.state = 'ACTIVE';
    this.consecutiveEmptyClaims = 0;
    this.currentInterval = this.activePollingInterval;
    AppLogger.info('JobScheduler', 'Scheduler resumed following connection recovery', this.workspaceId);
    this.scheduleNextTick(0);
  }

  /**
   * Schedules the next polling tick with adaptive backoff calculation.
   */
  private scheduleNextTick(customDelay?: number): void {
    if (this.state === 'STOPPED' || this.state === 'PAUSED_OFFLINE') {
      return;
    }

    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }

    let delay: number;
    if (customDelay !== undefined) {
      delay = customDelay;
    } else if (this.activeWorkers.size > 0) {
      this.state = 'ACTIVE';
      this.consecutiveEmptyClaims = 0;
      this.currentInterval = this.activePollingInterval;
      delay = this.activePollingInterval;
    } else {
      if (this.consecutiveEmptyClaims === 0) {
        this.state = 'IDLE';
        this.currentInterval = this.baseIdleInterval; // 2s
      } else if (this.consecutiveEmptyClaims === 1) {
        this.state = 'BACKING_OFF';
        this.currentInterval = 4000; // 4s
      } else if (this.consecutiveEmptyClaims === 2) {
        this.state = 'BACKING_OFF';
        this.currentInterval = 8000; // 8s
      } else {
        this.state = 'BACKING_OFF';
        this.currentInterval = this.maxIdleInterval; // 15s
      }
      delay = this.currentInterval;
    }

    this.timerId = setTimeout(() => {
      this.tick().catch((err) => {
        AppLogger.error('JobScheduler', 'Unhandled error in scheduler tick', this.workspaceId, err);
      });
    }, delay);
  }

  /**
   * Stops the polling loop and terminates all active child workers.
   */
  public async stop(): Promise<void> {
    this.state = 'STOPPED';
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }

    // Clear any pending hard-kill fallback timeouts before shutdown.
    for (const t of this.cancelTimeouts.values()) clearTimeout(t);
    this.cancelTimeouts.clear();

    for (const resolveCancel of this.pendingCancels.values()) resolveCancel();
    this.pendingCancels.clear();

    // Clear all heartbeat intervals before terminating workers.
    for (const jobId of [...this.heartbeats.keys()]) this.clearHeartbeat(jobId);

    for (const [jobId, worker] of this.activeWorkers.entries()) {
      AppLogger.warn(
        'JobScheduler',
        `Terminating job "${jobId}" due to scheduler stop`,
        this.workspaceId
      );
      try {
        worker.kill('SIGTERM');
      } catch {}
    }
    this.activeWorkers.clear();
    this.typeActiveCount.clear();
    this.terminalJobs.clear();
    AppLogger.info(
      'JobScheduler',
      `Scheduler stopped for workspace: ${this.workspaceId}`,
      this.workspaceId
    );
  }

  /**
   * Ticks to evaluate job slots and claim pending items from MongoDB.
   */
  private async tick(): Promise<void> {
    if (this.isTickRunning) return;
    if (this.state === 'STOPPED' || this.state === 'PAUSED_OFFLINE') return;
    this.isTickRunning = true;

    try {
      const config = this.loadSchedulerConfig();
      const availableCapacity = config.globalMaxConcurrency - this.activeWorkers.size;

      if (availableCapacity > 0) {
        const supportedTypes = [
          'scraper:maps',
          'crawler:website',
          'enrich:website',
          'enrich:linkedin',
          'enrich:intelligence',
          'outreach:campaign',
          'automation:workflow',
          'outreach:imap-poll',
          'mock:test'
        ].filter((t) => {
          const limit = config.typeLimits[t] ?? 2;
          const current = this.typeActiveCount.get(t) ?? 0;
          return current < limit;
        });

        if (supportedTypes.length > 0) {
          const workerId = `desktop-${this.workspaceId.slice(0, 8)}-${Date.now()}-${randomUUID().slice(0, 4)}`;
          this.totalClaimRequests++;
          const claimed = await this.sdk.jobs.claim(supportedTypes, workerId).catch(() => null);

          if (claimed) {
            this.consecutiveEmptyClaims = 0;
            this.state = 'ACTIVE';
            this.runJob(claimed, workerId);

            // If capacity still remains, quickly schedule another tick to claim further jobs
            const remainingCapacity = config.globalMaxConcurrency - this.activeWorkers.size;
            if (remainingCapacity > 0) {
              this.scheduleNextTick(50);
              return;
            }
          } else {
            this.consecutiveEmptyClaims++;
          }
        }
      }
    } catch (err) {
      AppLogger.error('JobScheduler', 'Error in scheduler dispatch phase', this.workspaceId, err);
    } finally {
      this.isTickRunning = false;
      this.scheduleNextTick();
    }
  }

  /**
   * Reads concurrency configuration with default fallbacks.
   */
  private loadSchedulerConfig(): SchedulerConfig {
    return {
      globalMaxConcurrency: this.defaultMaxConcurrency,
      typeLimits: {
        'scraper:maps': 1,
        'crawler:website': 2,
        'enrich:intelligence': 2,
        'outreach:campaign': 2,
        'automation:workflow': 2
      }
    };
  }

  /**
   * Spawns worker process for a job.
   */
  private runJob(job: Job, workerId: string): void {
    AppLogger.info(
      'JobScheduler',
      `Launching job "${job.id}" of type "${job.type}"`,
      this.workspaceId,
      { jobId: job.id }
    );

    this.eventBus.publish('job:starting', { jobId: job.id, workerId });

    const config = loadConfig();
    const workerHostPath = join(__dirname, 'worker.js');
    const worker = fork(workerHostPath, [], {
      env: {
        WORKSPACES_DB_DIR: join(app.getPath('userData'), 'workspaces'),
        PLAYWRIGHT_BROWSERS_PATH:
          process.env.PLAYWRIGHT_BROWSERS_PATH ||
          join(app.getPath('userData'), 'playwright-browsers'),
        API_URL: config.apiUrl,
        NODE_ENV: process.env.NODE_ENV
      },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      execArgv: isDev ? ['--inspect=0'] : []
    });

    worker.stdout?.on('data', (data: Buffer) => {
      AppLogger.info('WorkerHost', data.toString().trim(), this.workspaceId);
    });
    worker.stderr?.on('data', (data: Buffer) => {
      AppLogger.error('WorkerHost', data.toString().trim(), this.workspaceId);
    });

    this.activeWorkers.set(job.id, worker);
    this.typeActiveCount.set(job.type, (this.typeActiveCount.get(job.type) ?? 0) + 1);

    // Register all IPC message handlers
    worker.on('message', async (rawMsg: unknown) => {
      const msg = rawMsg as any;
      if (!msg || typeof msg !== 'object' || !('type' in msg)) return;

      switch (msg.type) {
        case 'ready':
          await this.sdk.jobs
            .updateStatus(job.id, { status: 'running', workerId })
            .catch((err) => {
              AppLogger.error(
                'JobScheduler',
                `Failed to mark job "${job.id}" running: ${err.message}`,
                this.workspaceId
              );
            });
          this.eventBus.publish('job:started', { jobId: job.id, workerId });

          // Start heartbeat watchdog
          this.heartbeats.set(job.id, {
            lastPongAt: Date.now(),
            intervalId: setInterval(async () => {
              const state = this.heartbeats.get(job.id);
              if (!state) return;

              if (Date.now() - state.lastPongAt >= this.heartbeatTimeoutMs) {
                AppLogger.error(
                  'JobScheduler',
                  `Heartbeat timeout for job "${job.id}" — no pong in ${this.heartbeatTimeoutMs}ms. Killing worker.`,
                  this.workspaceId,
                  { jobId: job.id }
                );
                this.clearHeartbeat(job.id);
                const w = this.activeWorkers.get(job.id);
                if (w) {
                  try {
                    w.kill('SIGKILL');
                  } catch {}
                  this.activeWorkers.delete(job.id);
                }
                this.handleJobFailure(job.id, job.retryCount, job.maxRetries, 'Heartbeat timeout', workerId);
                this.eventBus.publish('job:heartbeat:timeout', { jobId: job.id });
              } else if (worker.connected) {
                worker.send({ command: 'ping' } as MainToWorkerMsg);
                await this.sdk.jobs.heartbeat(job.id, workerId).catch(() => {});
              }
            }, this.heartbeatIntervalMs)
          });
          break;

        case 'pong': {
          const hb = this.heartbeats.get(job.id);
          if (hb) hb.lastPongAt = Date.now();
          break;
        }

        case 'progress':
          await this.sdk.jobs
            .checkpoint(job.id, {
              progress: msg.progress,
              checkpointData: msg.metadata || {},
              workerId
            })
            .catch(() => {});
          this.eventBus.publish('job:progress', {
            jobId: job.id,
            progress: msg.progress,
            metadata: msg.metadata
          });
          break;

        case 'log':
          AppLogger.log({
            workspaceId: this.workspaceId,
            workerId,
            severity: msg.severity || 'info',
            task: job.type,
            message: msg.message,
            metadata: msg.meta
          });
          break;

        case 'notify': {
          const { Notification } = require('electron');
          if (Notification.isSupported()) {
            new Notification({ title: msg.title || 'LeadForge OS', body: msg.body }).show();
          }
          break;
        }

        case 'checkpoint':
          await this.sdk.jobs
            .checkpoint(job.id, {
              progress: job.progress || 0,
              checkpointData: msg.data,
              workerId
            })
            .catch(() => {});
          break;

        case 'paused':
          this.clearHeartbeat(job.id);
          this.activeWorkers.delete(job.id);
          this.decrementTypeCount(job.type);
          await this.sdk.jobs
            .updateStatus(job.id, { status: 'paused', workerId })
            .catch(() => {});
          this.eventBus.publish('job:paused', { jobId: job.id });
          break;

        case 'cancelled': {
          const hardKill = this.cancelTimeouts.get(job.id);
          if (hardKill) {
            clearTimeout(hardKill);
            this.cancelTimeouts.delete(job.id);
          }
          this.clearHeartbeat(job.id);
          this.activeWorkers.delete(job.id);
          this.decrementTypeCount(job.type);
          await this.sdk.jobs.cancel(job.id).catch(() => {});
          this.eventBus.publish('job:cancelled', { jobId: job.id });

          const resolveCancel = this.pendingCancels.get(job.id);
          if (resolveCancel) {
            resolveCancel();
            this.pendingCancels.delete(job.id);
          }
          break;
        }

        case 'success':
          this.handleJobSuccess(job.id, msg.result, workerId, job.type, job.payload);
          break;

        case 'error':
          this.handleJobFailure(job.id, job.retryCount, job.maxRetries, msg.error, workerId);
          break;

        case 'automation_event':
          this.eventBus.publish((msg as any).event, (msg as any).payload);
          break;
      }
    });

    // Crash / unexpected exit handler
    worker.on('exit', (code, signal) => {
      this.clearHeartbeat(job.id);
      this.activeWorkers.delete(job.id);
      this.decrementTypeCount(job.type);

      const errorMsg = `Worker process exited abnormally with code ${code} (signal: ${signal})`;
      if (code !== 0 && code !== null) {
        AppLogger.error(
          'JobScheduler',
          `Job "${job.id}" worker crashed: ${errorMsg}`,
          this.workspaceId,
          { jobId: job.id }
        );
        this.handleJobFailure(job.id, job.retryCount, job.maxRetries, errorMsg, workerId);
      }

      const resolveCancel = this.pendingCancels.get(job.id);
      if (resolveCancel) {
        resolveCancel();
        this.pendingCancels.delete(job.id);
      }
    });

    // Build payload and inject decrypted secrets
    const parsedPayload = typeof job.payload === 'object' && job.payload !== null ? { ...job.payload } : {};
    if (job.checkpointData) {
      parsedPayload._checkpoint = job.checkpointData;
    }

    try {
      const secrets: Record<string, string> = {};
      const activeSession = loadSession();
      if (activeSession?.accessToken) {
        secrets['sessionToken'] = activeSession.accessToken;
      }
      parsedPayload._secrets = secrets;
      parsedPayload._config = {
        apiUrl: config.apiUrl
      };
    } catch (err) {
      AppLogger.error(
        'JobScheduler',
        'Failed to load secrets for worker payload',
        this.workspaceId,
        err
      );
    }

    worker.send({
      command: 'start',
      jobId: job.id,
      workspaceId: this.workspaceId,
      type: job.type,
      payload: parsedPayload
    } as MainToWorkerMsg);
  }

  private async handleJobSuccess(
    jobId: string,
    result: any,
    workerId?: string,
    jobType?: string,
    payload?: any
  ): Promise<void> {
    if (this.terminalJobs.has(jobId)) {
      return;
    }
    this.terminalJobs.add(jobId);

    AppLogger.info('JobScheduler', `Job "${jobId}" completed successfully.`, this.workspaceId, {
      jobId
    });
    this.clearHeartbeat(jobId);

    await this.sdk.jobs.complete(jobId, workerId).catch((err) => {
      AppLogger.error('JobScheduler', `Failed to complete job "${jobId}": ${err.message}`, this.workspaceId);
    });

    // Auto-queue intelligence enrichment on website crawl completion
    try {
      if (jobType === 'crawler:website' && payload?.companyId) {
        await this.sdk.jobs.create({
          type: 'enrich:intelligence',
          priority: 5,
          payload: { companyId: payload.companyId }
        });
        AppLogger.info(
          'JobScheduler',
          `Auto-queued enrich:intelligence job for Company: ${payload.companyId}`,
          this.workspaceId
        );
      }
    } catch (err) {
      AppLogger.error(
        'JobScheduler',
        'Failed to auto-queue intelligence enrichment after website crawl',
        this.workspaceId,
        err
      );
    }

    this.activeWorkers.delete(jobId);
    if (jobType) this.decrementTypeCount(jobType);

    // Reconcile worker mutations authoritatively into workspace SQLite projection
    await ProjectionService.reconcileJobOutcome(
      this.workspaceId,
      jobType,
      payload,
      result,
      this.sdk
    ).catch((projErr) => {
      AppLogger.warn('JobScheduler', `Projection reconciliation note: ${projErr.message}`, this.workspaceId);
    });

    const entityId = payload?.entityId || payload?.companyId || payload?.contactId || '';
    const entityType = payload?.entityType || (payload?.companyId ? 'company' : payload?.contactId ? 'contact' : '');

    this.eventBus.publish('job:completed', {
      jobId,
      jobType,
      type: jobType,
      entityId,
      entityType,
      result,
      payload
    });

    const resolveCancel = this.pendingCancels.get(jobId);
    if (resolveCancel) {
      resolveCancel();
      this.pendingCancels.delete(jobId);
    }
  }

  private async handleJobFailure(
    jobId: string,
    currentRetry: number,
    maxRetries: number,
    error: string,
    workerId?: string
  ): Promise<void> {
    if (this.terminalJobs.has(jobId)) {
      return;
    }

    this.clearHeartbeat(jobId);
    const nextRetry = currentRetry + 1;
    const worker = this.activeWorkers.get(jobId);
    if (worker) {
      try {
        worker.kill('SIGTERM');
      } catch {}
      this.activeWorkers.delete(jobId);
    }

    if (nextRetry <= maxRetries) {
      const delaySec = Math.min(Math.pow(2, nextRetry), 60);
      const scheduledAt = new Date(Date.now() + delaySec * 1000);
      AppLogger.warn(
        'JobScheduler',
        `Job "${jobId}" failed. Retrying (Attempt ${nextRetry}/${maxRetries}). Error: ${error}`,
        this.workspaceId,
        { jobId }
      );
      await this.sdk.jobs
        .updateStatus(jobId, {
          status: 'retrying',
          workerId,
          error,
          scheduledAt
        })
        .catch(() => {});
      this.eventBus.publish('job:failed', { jobId, error, willRetry: true });
    } else {
      this.terminalJobs.add(jobId);
      AppLogger.error(
        'JobScheduler',
        `Job "${jobId}" failed permanently after ${maxRetries} retries. Error: ${error}`,
        this.workspaceId,
        { jobId }
      );
      await this.sdk.jobs.fail(jobId, error, workerId).catch(() => {});
      this.eventBus.publish('job:failed', { jobId, error, willRetry: false });
    }

    const resolveCancel = this.pendingCancels.get(jobId);
    if (resolveCancel) {
      resolveCancel();
      this.pendingCancels.delete(jobId);
    }
  }

  /**
   * Request soft job cancellation via IPC and API.
   */
  public async cancelJob(jobId: string): Promise<void> {
    const worker = this.activeWorkers.get(jobId);
    if (worker) {
      AppLogger.warn('JobScheduler', `Sending cancel command to job "${jobId}"`, this.workspaceId, {
        jobId
      });

      worker.send({ command: 'cancel' } as MainToWorkerMsg);

      const cancelPromise = new Promise<void>((resolve) => {
        this.pendingCancels.set(jobId, resolve);
      });

      const hardKillTimeout = setTimeout(async () => {
        if (this.activeWorkers.has(jobId)) {
          AppLogger.error(
            'JobScheduler',
            `Hard-killing job "${jobId}" — cancel not acknowledged within 15s`,
            this.workspaceId,
            { jobId }
          );
          const w = this.activeWorkers.get(jobId);
          try {
            w?.kill('SIGKILL');
          } catch {}
          this.activeWorkers.delete(jobId);
          this.cancelTimeouts.delete(jobId);
          this.clearHeartbeat(jobId);

          await this.sdk.jobs.cancel(jobId).catch(() => {});
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
      await this.sdk.jobs.cancel(jobId).catch(() => {});
      this.eventBus.publish('job:cancelled', { jobId });
    }
  }

  /**
   * Request that a running job pause at the next checkpoint boundary.
   */
  public async pauseJob(jobId: string): Promise<void> {
    const worker = this.activeWorkers.get(jobId);
    if (worker) {
      AppLogger.info('JobScheduler', `Sending pause command to job "${jobId}"`, this.workspaceId, {
        jobId
      });
      worker.send({ command: 'pause' } as MainToWorkerMsg);
    } else {
      await this.sdk.jobs.updateStatus(jobId, { status: 'paused' }).catch(() => {});
    }
  }

  private decrementTypeCount(jobType: string): void {
    const current = this.typeActiveCount.get(jobType) ?? 0;
    if (current <= 1) {
      this.typeActiveCount.delete(jobType);
    } else {
      this.typeActiveCount.set(jobType, current - 1);
    }
  }

  private clearHeartbeat(jobId: string): void {
    const hb = this.heartbeats.get(jobId);
    if (hb) {
      clearInterval(hb.intervalId);
      this.heartbeats.delete(jobId);
    }
  }
}
