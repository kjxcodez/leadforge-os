import { safeRegister } from './helper';
import { WorkspaceManager } from '../lib/workspace-manager';
import { AppLogger } from '../lib/logger';

/**
 * Registers IPC channels for submitting, listing, and cancelling scheduler tasks via MongoDB SDK.
 */
export function registerSchedulerIpc() {
  // 1. Submit a background job (with idempotency and deduplication)
  safeRegister('scheduler:jobs:submit', async (_event, params) => {
    const {
      workspaceId,
      type,
      payload,
      priority = 1,
      maxRetries = 3,
      idempotencyKey = null
    } = params;
    if (!workspaceId) throw new Error('workspaceId is required to submit a job.');
    if (!type) throw new Error('type is required to submit a job.');

    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime || runtime.workspaceId !== workspaceId) {
      throw new Error(`Workspace runtime for "${workspaceId}" is not currently active.`);
    }

    const job = await runtime.sdk.jobs.create({
      id: params.id,
      type,
      priority,
      payload: payload || {},
      maxRetries,
      idempotencyKey: idempotencyKey || undefined
    });

    AppLogger.info(
      'JobScheduler',
      `Job "${job.id}" submitted via API (type: "${type}").`,
      workspaceId
    );

    return {
      deduplicated: false,
      job
    };
  });

  // 2. List all jobs inside a workspace
  safeRegister('scheduler:jobs:list', async (_event, { workspaceId }) => {
    if (!workspaceId) throw new Error('workspaceId is required to query jobs.');
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime || runtime.workspaceId !== workspaceId) {
      throw new Error(`Workspace runtime for "${workspaceId}" is not currently active.`);
    }

    const result = await runtime.sdk.jobs.list({ limit: 100 });
    return result.data;
  });

  // 3. Cancel a running/queued job
  safeRegister('scheduler:jobs:cancel', async (_event, { workspaceId, jobId }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    if (!jobId) throw new Error('jobId is required.');

    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime || runtime.workspaceId !== workspaceId) {
      throw new Error(`Workspace runtime for "${workspaceId}" is not currently active.`);
    }

    await runtime.scheduler.cancelJob(jobId);
    await runtime.sdk.jobs.cancel(jobId).catch(() => {});
    AppLogger.info('JobScheduler', `Cancelled job "${jobId}" via API.`, workspaceId);
  });

  // 4. Pause a running/queued job
  safeRegister('scheduler:jobs:pause', async (_event, { workspaceId, jobId }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    if (!jobId) throw new Error('jobId is required.');

    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime || runtime.workspaceId !== workspaceId) {
      throw new Error(`Workspace runtime for "${workspaceId}" is not currently active.`);
    }

    await runtime.scheduler.pauseJob(jobId);
    await runtime.sdk.jobs.updateStatus(jobId, { status: 'paused' }).catch(() => {});
    AppLogger.info('JobScheduler', `Paused job "${jobId}" via API.`, workspaceId);
  });

  // 5. Resume a paused job
  safeRegister('scheduler:jobs:resume', async (_event, { workspaceId, jobId }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    if (!jobId) throw new Error('jobId is required.');

    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime || runtime.workspaceId !== workspaceId) {
      throw new Error(`Workspace runtime for "${workspaceId}" is not currently active.`);
    }

    await runtime.sdk.jobs.updateStatus(jobId, { status: 'queued' });
    AppLogger.info('JobScheduler', `Resumed job "${jobId}" (queued) via API.`, workspaceId);
  });
}
