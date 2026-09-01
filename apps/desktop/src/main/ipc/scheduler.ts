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

    const sdk = WorkspaceManager.getActiveRuntime()?.workspaceId === workspaceId
      ? WorkspaceManager.getActiveRuntime()!.sdk
      : WorkspaceManager.getSdk();

    const job = await sdk.jobs.create({
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

    WorkspaceManager.wakeScheduler();

    return {
      deduplicated: false,
      job
    };
  });

  // 2. List queue (jobs + waiting sequence executions)
  safeRegister('scheduler:queue:list', async (_event, { workspaceId }) => {
    if (!workspaceId) throw new Error('workspaceId is required to query queue.');

    let jobs: any[] = [];
    try {
      const runtime = WorkspaceManager.getActiveRuntime();
      const sdk =
        runtime && runtime.workspaceId === workspaceId
          ? runtime.sdk
          : WorkspaceManager.getSdk();
      const result = await sdk.jobs.list({ limit: 100 }).catch(() => ({ data: [] }));
      jobs = Array.isArray(result?.data) ? result.data : [];
    } catch {
      jobs = [];
    }

    let waiting: any[] = [];
    try {
      const { getDatabase } = await import('../database/connection');
      const db = getDatabase(workspaceId);
      const rows = db
        .prepare(
          `SELECT 
            se.id, se.sequenceId, se.campaignId, se.contactId, se.companyId,
            se.status, se.currentStep, se.currentStepName, se.nextExecutionAt,
            se.createdAt, se.updatedAt,
            c.firstName, c.lastName, c.email as contactEmail,
            comp.name as companyName,
            s.name as sequenceName
           FROM sequence_executions se
           LEFT JOIN contacts c ON se.contactId = c.id
           LEFT JOIN companies comp ON se.companyId = comp.id
           LEFT JOIN sequences s ON se.sequenceId = s.id
           WHERE se.workspaceId = ? AND UPPER(se.status) = 'WAITING' AND se.deletedAt IS NULL
           ORDER BY se.nextExecutionAt ASC LIMIT 50`
        )
        .all(workspaceId) as any[];
      waiting = Array.isArray(rows) ? rows : [];
    } catch {
      waiting = [];
    }

    return {
      jobs,
      waiting
    };
  });

  // 2b. List all jobs inside a workspace (raw list)
  safeRegister('scheduler:jobs:list', async (_event, { workspaceId }) => {
    if (!workspaceId) throw new Error('workspaceId is required to query jobs.');
    const runtime = WorkspaceManager.getActiveRuntime();
    if (runtime && runtime.workspaceId === workspaceId) {
      const result = await runtime.sdk.jobs.list({ limit: 100 }).catch(() => ({ data: [] }));
      return result.data;
    }

    try {
      const sdk = WorkspaceManager.getSdk();
      const result = await sdk.jobs.list({ limit: 100 }).catch(() => ({ data: [] }));
      return result.data;
    } catch {
      return [];
    }
  });

  // 3. Cancel a running/queued job
  safeRegister('scheduler:jobs:cancel', async (_event, { workspaceId, jobId }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    if (!jobId) throw new Error('jobId is required.');

    const runtime = WorkspaceManager.getActiveRuntime();
    if (runtime && runtime.workspaceId === workspaceId) {
      await runtime.scheduler.cancelJob(jobId).catch(() => {});
    }

    const sdk = WorkspaceManager.getSdk();
    await sdk.jobs.cancel(jobId).catch(() => {});
    AppLogger.info('JobScheduler', `Cancelled job "${jobId}" via API.`, workspaceId);
  });

  // 4. Pause a running/queued job
  safeRegister('scheduler:jobs:pause', async (_event, { workspaceId, jobId }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    if (!jobId) throw new Error('jobId is required.');

    const runtime = WorkspaceManager.getActiveRuntime();
    if (runtime && runtime.workspaceId === workspaceId) {
      await runtime.scheduler.pauseJob(jobId).catch(() => {});
    }

    const sdk = WorkspaceManager.getSdk();
    await sdk.jobs.updateStatus(jobId, { status: 'paused' }).catch(() => {});
    AppLogger.info('JobScheduler', `Paused job "${jobId}" via API.`, workspaceId);
  });

  // 5. Resume a paused job
  safeRegister('scheduler:jobs:resume', async (_event, { workspaceId, jobId }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    if (!jobId) throw new Error('jobId is required.');

    const sdk = WorkspaceManager.getSdk();
    await sdk.jobs.updateStatus(jobId, { status: 'queued' }).catch(() => {});
    AppLogger.info('JobScheduler', `Resumed job "${jobId}" (queued) via API.`, workspaceId);
  });
}
