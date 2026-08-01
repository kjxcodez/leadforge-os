import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';
import type { LocalEventBus } from '../../lib/event-bus';
import type { SchedulerGateway, ToolResult, ExecutionContext } from '@leadforge/agent-core';

export class SchedulerGatewayImpl implements SchedulerGateway {
  private readonly db: Database.Database;
  private readonly eventBus: LocalEventBus;

  constructor(db: Database.Database, eventBus: LocalEventBus) {
    this.db = db;
    this.eventBus = eventBus;
  }

  /**
   * Submits a background worker task and returns the queued Job ID immediately.
   */
  public async submit(
    jobType: string,
    payload: unknown,
    context: ExecutionContext
  ): Promise<string> {
    const jobId = context.jobId || randomUUID();

    this.db
      .prepare(
        `
      INSERT INTO jobs (id, workspaceId, type, status, priority, payload, progress, retryCount, maxRetries, createdAt, updatedAt)
      VALUES (?, ?, ?, 'queued', 5, ?, 0, 0, 3, datetime('now'), datetime('now'))
    `
      )
      .run(jobId, context.workspaceId, jobType, JSON.stringify(payload || {}));

    return jobId;
  }

  /**
   * Submits a background worker task and awaits its eventual success/failure outcome.
   */
  public async submitAndAwait<TInput = unknown, TOutput = unknown>(
    jobType: string,
    payload: TInput,
    context: ExecutionContext
  ): Promise<ToolResult<TOutput>> {
    const startedAt = new Date().toISOString();
    const startTime = Date.now();
    const jobId = context.jobId || randomUUID();

    try {
      await this.submit(jobType, payload, { ...context, jobId });
    } catch (dbErr: any) {
      return {
        success: false,
        error: {
          code: 'SCHEDULER_ERROR',
          message: `Database submission failed: ${dbErr.message}`,
          isRetryable: true
        },
        metadata: {
          startedAt,
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - startTime,
          attempt: 1,
          workspaceId: context.workspaceId,
          traceId: context.traceId,
          jobId,
          cached: false,
          retryCount: 0
        }
      };
    }

    return new Promise<ToolResult<TOutput>>((resolve) => {
      let unsubscribeCompleted: () => void;
      let unsubscribeFailed: () => void;
      let unsubscribeCancelled: () => void;

      const cleanup = () => {
        unsubscribeCompleted();
        unsubscribeFailed();
        unsubscribeCancelled();
      };

      const timeoutMs = 600_000; // 10 minute safeguard timeout
      const timeoutTimer = setTimeout(() => {
        cleanup();
        resolve({
          success: false,
          error: {
            code: 'TIMEOUT',
            message: `Tool execution timed out after ${timeoutMs}ms`,
            isRetryable: false
          },
          metadata: {
            startedAt,
            completedAt: new Date().toISOString(),
            durationMs: Date.now() - startTime,
            attempt: 1,
            workspaceId: context.workspaceId,
            traceId: context.traceId,
            jobId,
            cached: false,
            retryCount: 0
          }
        });
      }, timeoutMs);

      if (context.abortSignal) {
        if (context.abortSignal.aborted) {
          clearTimeout(timeoutTimer);
          cleanup();
          resolve({
            success: false,
            error: {
              code: 'CANCELLED_BY_USER',
              message: 'Tool execution was aborted.',
              isRetryable: false
            },
            metadata: {
              startedAt,
              completedAt: new Date().toISOString(),
              durationMs: Date.now() - startTime,
              attempt: 1,
              workspaceId: context.workspaceId,
              traceId: context.traceId,
              jobId,
              cached: false,
              retryCount: 0
            }
          });
          return;
        }

        context.abortSignal.addEventListener('abort', () => {
          clearTimeout(timeoutTimer);
          cleanup();
          resolve({
            success: false,
            error: {
              code: 'CANCELLED_BY_USER',
              message: 'Tool execution was aborted.',
              isRetryable: false
            },
            metadata: {
              startedAt,
              completedAt: new Date().toISOString(),
              durationMs: Date.now() - startTime,
              attempt: 1,
              workspaceId: context.workspaceId,
              traceId: context.traceId,
              jobId,
              cached: false,
              retryCount: 0
            }
          });
        });
      }

      unsubscribeCompleted = this.eventBus.subscribe('job:completed', (event) => {
        if (event.payload.jobId === jobId) {
          clearTimeout(timeoutTimer);
          cleanup();
          resolve({
            success: true,
            data: event.payload.result as TOutput,
            metadata: {
              startedAt,
              completedAt: new Date().toISOString(),
              durationMs: Date.now() - startTime,
              attempt: 1,
              workspaceId: context.workspaceId,
              traceId: context.traceId,
              jobId,
              cached: false,
              retryCount: 0
            }
          });
        }
      });

      unsubscribeFailed = this.eventBus.subscribe('job:failed', (event) => {
        if (event.payload.jobId === jobId) {
          clearTimeout(timeoutTimer);
          cleanup();
          resolve({
            success: false,
            error: {
              code: 'WORKER_ERROR',
              message: event.payload.error || 'Worker execution failed',
              isRetryable: true
            },
            metadata: {
              startedAt,
              completedAt: new Date().toISOString(),
              durationMs: Date.now() - startTime,
              attempt: 1,
              workspaceId: context.workspaceId,
              traceId: context.traceId,
              jobId,
              cached: false,
              retryCount: 0
            }
          });
        }
      });

      unsubscribeCancelled = this.eventBus.subscribe('job:cancelled', (event) => {
        if (event.payload.jobId === jobId) {
          clearTimeout(timeoutTimer);
          cleanup();
          resolve({
            success: false,
            error: {
              code: 'CANCELLED_BY_USER',
              message: 'Job was cancelled.',
              isRetryable: false
            },
            metadata: {
              startedAt,
              completedAt: new Date().toISOString(),
              durationMs: Date.now() - startTime,
              attempt: 1,
              workspaceId: context.workspaceId,
              traceId: context.traceId,
              jobId,
              cached: false,
              retryCount: 0
            }
          });
        }
      });
    });
  }

  /**
   * Cancels a queued or running background job.
   */
  public async cancel(jobId: string, workspaceId: string): Promise<void> {
    try {
      const { WorkspaceManager } = require('../../lib/workspace-manager');
      const runtime = WorkspaceManager.getActiveRuntime();
      if (runtime && runtime.workspaceId === workspaceId) {
        await runtime.scheduler.cancelJob(jobId);
        return;
      }
    } catch {
      // workspace manager not initialized or other shell error
    }

    this.db
      .prepare(
        `
      UPDATE jobs
      SET status = 'cancelled', finishedAt = datetime('now'), updatedAt = datetime('now')
      WHERE id = ?
    `
      )
      .run(jobId);
  }

  /**
   * Queries the current status of a background job.
   */
  public async status(
    jobId: string,
    workspaceId: string
  ): Promise<
    | 'queued'
    | 'running'
    | 'waiting'
    | 'retrying'
    | 'paused'
    | 'cancelled'
    | 'completed'
    | 'failed'
    | 'interrupted'
    | 'unknown'
  > {
    const row = this.db
      .prepare('SELECT status FROM jobs WHERE id = ? AND workspaceId = ?')
      .get(jobId, workspaceId) as { status: string } | undefined;
    return (row?.status as any) || 'unknown';
  }
}
