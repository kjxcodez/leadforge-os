import { safeRegister } from './helper';
import { getDatabase } from '../database/connection';
import { WorkspaceManager } from '../lib/workspace-manager';

/**
 * Registers IPC channels for submitting, listing, and cancelling scheduler tasks.
 */
export function registerSchedulerIpc() {
  // 1. Submit a background job
  safeRegister('scheduler:jobs:submit', async (_event, params) => {
    const { workspaceId, type, payload, priority = 1, maxRetries = 3 } = params;
    if (!workspaceId) throw new Error('workspaceId is required to submit a job.');
    if (!type) throw new Error('type is required to submit a job.');

    const jobId = params.id || require('crypto').randomUUID();
    const db = getDatabase(workspaceId);

    db.prepare(`
      INSERT INTO jobs (id, workspaceId, type, status, priority, payload, progress, retryCount, maxRetries, createdAt, updatedAt)
      VALUES (?, ?, ?, 'queued', ?, ?, 0, 0, ?, datetime('now'), datetime('now'))
    `).run(
      jobId,
      workspaceId,
      type,
      priority,
      JSON.stringify(payload || {}),
      maxRetries
    );

    console.log(`[IPC] Job "${jobId}" of type "${type}" submitted to workspace "${workspaceId}".`);
    return { id: jobId, workspaceId, type, status: 'queued' };
  });

  // 2. List all jobs inside a workspace
  safeRegister('scheduler:jobs:list', async (_event, { workspaceId }) => {
    if (!workspaceId) throw new Error('workspaceId is required to query jobs.');
    const db = getDatabase(workspaceId);

    const rows = db.prepare(`
      SELECT * FROM jobs
      WHERE workspaceId = ?
      ORDER BY createdAt DESC
    `).all(workspaceId);

    return rows;
  });

  // 3. Cancel a running/queued job
  safeRegister('scheduler:jobs:cancel', async (_event, { workspaceId, jobId }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    if (!jobId) throw new Error('jobId is required.');

    const activeRuntime = WorkspaceManager.getActiveRuntime();
    if (activeRuntime && activeRuntime.workspaceId === workspaceId) {
      // Access the scheduler on the active runtime to trigger SIGTERM signal
      // and update the SQLite states
      (activeRuntime as any).scheduler.cancelJob(jobId);
      console.log(`[IPC] Sent cancellation request for running job: ${jobId}`);
      return;
    }

    // If the runtime is not active, we can still update its status in the DB directly
    const db = getDatabase(workspaceId);
    db.prepare(`
      UPDATE jobs
      SET status = 'cancelled', finishedAt = datetime('now'), updatedAt = datetime('now')
      WHERE id = ?
    `).run(jobId);

    console.log(`[IPC] Marked inactive job "${jobId}" as cancelled in database.`);
  });
}
