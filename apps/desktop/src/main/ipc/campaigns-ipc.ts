import { safeRegister } from './helper';
import { getDatabase } from '../database/connection';
import { WorkspaceManager } from '../lib/workspace-manager';
import { loadSession } from '../lib/session';
import { randomUUID } from 'crypto';

/**
 * Registers advanced campaign execution, batch enrollments, bulk transitions,
 * and real-time scheduler queue visibility IPC channels.
 */
export function registerCampaignsIpc(): void {
  // 1. Batch enroll contacts into a campaign
  safeRegister('campaigns:enroll', async (_event, { campaignId, contactIds }) => {
    if (!campaignId) throw new Error('campaignId is required.');
    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      throw new Error('contactIds must be a non-empty array.');
    }

    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');

    const db = getDatabase(runtime.workspaceId);

    // Load target campaign to get sequenceId and status
    const campaign = db
      .prepare(
        `
      SELECT sequenceId, status FROM campaigns 
      WHERE id = ? AND workspaceId = ? AND deletedAt IS NULL
    `
      )
      .get(campaignId, runtime.workspaceId) as { sequenceId: string; status: string } | undefined;

    if (!campaign) throw new Error(`Campaign "${campaignId}" not found or deleted.`);

    const isActive = campaign.status?.toUpperCase() === 'ACTIVE';
    const now = new Date().toISOString();
    const enrolledIds: string[] = [];

    db.transaction(() => {
      for (const contactId of contactIds) {
        // Idempotency check: prevent duplicate enrollments in the same campaign
        const existing = db
          .prepare(
            `
          SELECT id FROM sequence_executions
          WHERE campaignId = ? AND contactId = ? AND deletedAt IS NULL
        `
          )
          .get(campaignId, contactId);

        if (existing) continue;

        const enrollmentId = randomUUID();

        // Insert sequence_executions (Enrollment record)
        db.prepare(
          `
          INSERT INTO sequence_executions (
            id, sequenceId, campaignId, workspaceId, contactId, companyId,
            currentStep, currentStepName, status, startedAt, logs,
            emailsSent, replies, failures, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, NULL, 0, 'Initial', ?, ?, '[]', 0, 0, 0, ?, ?)
        `
        ).run(
          enrollmentId,
          campaign.sequenceId,
          campaignId,
          runtime.workspaceId,
          contactId,
          isActive ? 'RUNNING' : 'PAUSED',
          now,
          now,
          now
        );

        // Queue mutation to sync sequence execution to MongoDB
        db.prepare(
          `
          INSERT INTO sync_queue (id, workspaceId, entityType, entityId, operation, payload, version, retryCount, lastError, createdAt, updatedAt)
          VALUES (?, ?, 'sequence_executions', ?, 'CREATE', ?, 1, 0, NULL, datetime('now'), datetime('now'))
        `
        ).run(
          randomUUID(),
          runtime.workspaceId,
          enrollmentId,
          JSON.stringify({
            id: enrollmentId,
            sequenceId: campaign.sequenceId,
            campaignId,
            workspaceId: runtime.workspaceId,
            contactId,
            currentStep: 0,
            status: isActive ? 'RUNNING' : 'PAUSED',
            startedAt: now
          })
        );

        // If the campaign is already active, spawn the workflow job in the queue immediately
        if (isActive) {
          const jobId = randomUUID();
          db.prepare(
            `
            INSERT INTO jobs (id, workspaceId, type, status, priority, payload, progress, retryCount, maxRetries, createdAt, updatedAt)
            VALUES (?, ?, 'automation:workflow', 'queued', 3, ?, 0, 0, 3, datetime('now'), datetime('now'))
          `
          ).run(
            jobId,
            runtime.workspaceId,
            JSON.stringify({
              sequenceId: campaign.sequenceId,
              entityId: contactId,
              entityType: 'contact',
              executionId: enrollmentId,
              workspaceId: runtime.workspaceId
            })
          );
        }

        enrolledIds.push(enrollmentId);
      }
    })();

    console.log(`[IPC] Enrolled ${enrolledIds.length} contact(s) into campaign: ${campaignId}`);
    return { success: true, enrolledCount: enrolledIds.length };
  });

  // 2. List all enrollments for a campaign, enriched with contact and sequence info
  safeRegister('campaigns:enrollments:list', async (_event, { workspaceId, campaignId }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    if (!campaignId) throw new Error('campaignId is required.');

    const db = getDatabase(workspaceId);

    const rows = db
      .prepare(
        `
      SELECT 
        se.*,
        c.firstName,
        c.lastName,
        c.email,
        c.title as contactTitle,
        comp.name as companyName,
        comp.domain as companyDomain,
        s.name as sequenceName
      FROM sequence_executions se
      LEFT JOIN contacts c ON se.contactId = c.id
      LEFT JOIN companies comp ON c.companyId = comp.id
      LEFT JOIN sequences s ON se.sequenceId = s.id
      WHERE se.campaignId = ? AND se.deletedAt IS NULL
      ORDER BY se.createdAt DESC
    `
      )
      .all(campaignId) as any[];

    return rows.map((row) => {
      try {
        if (row.logs && typeof row.logs === 'string') {
          row.logs = JSON.parse(row.logs);
        }
      } catch {
        row.logs = [];
      }
      return row;
    });
  });

  // 3. Bulk Pause Enrollments
  safeRegister(
    'campaigns:bulk-pause-enrollments',
    async (_event, { campaignId, enrollmentIds }) => {
      if (!campaignId) throw new Error('campaignId is required.');
      if (!Array.isArray(enrollmentIds) || enrollmentIds.length === 0) {
        throw new Error('enrollmentIds must be a non-empty array.');
      }

      const runtime = WorkspaceManager.getActiveRuntime();
      if (!runtime) throw new Error('No active workspace runtime');
      const db = getDatabase(runtime.workspaceId);
      const now = new Date().toISOString();

      db.transaction(() => {
        for (const id of enrollmentIds) {
          db.prepare(
            `
          UPDATE sequence_executions
          SET status = 'PAUSED', updatedAt = ?
          WHERE id = ? AND campaignId = ? AND UPPER(status) IN ('RUNNING', 'QUEUED', 'STARTING', 'WAITING')
        `
          ).run(now, id, campaignId);

          // Cancel pending job
          db.prepare(
            `
          UPDATE jobs
          SET status = 'cancelled', updatedAt = datetime('now')
          WHERE workspaceId = ?
            AND type = 'automation:workflow'
            AND json_extract(payload, '$.executionId') = ?
            AND status IN ('queued', 'starting', 'running', 'retrying')
        `
          ).run(runtime.workspaceId, id);
        }
      })();

      return { success: true };
    }
  );

  // 4. Bulk Resume Enrollments
  safeRegister(
    'campaigns:bulk-resume-enrollments',
    async (_event, { campaignId, enrollmentIds }) => {
      if (!campaignId) throw new Error('campaignId is required.');
      if (!Array.isArray(enrollmentIds) || enrollmentIds.length === 0) {
        throw new Error('enrollmentIds must be a non-empty array.');
      }

      const runtime = WorkspaceManager.getActiveRuntime();
      if (!runtime) throw new Error('No active workspace runtime');
      const db = getDatabase(runtime.workspaceId);
      const now = new Date().toISOString();

      db.transaction(() => {
        for (const id of enrollmentIds) {
          const enroll = db
            .prepare(
              `
          SELECT sequenceId, contactId, nextExecutionAt FROM sequence_executions
          WHERE id = ? AND campaignId = ? AND UPPER(status) = 'PAUSED'
        `
            )
            .get(id, campaignId) as
            { sequenceId: string; contactId: string; nextExecutionAt: string | null } | undefined;

          if (!enroll) continue;

          const isWaiting = enroll.nextExecutionAt && new Date(enroll.nextExecutionAt) > new Date();
          const newStatus = isWaiting ? 'WAITING' : 'RUNNING';

          db.prepare(
            `
          UPDATE sequence_executions
          SET status = ?, updatedAt = ?
          WHERE id = ?
        `
          ).run(newStatus, now, id);

          if (!isWaiting) {
            const jobId = randomUUID();
            db.prepare(
              `
            INSERT INTO jobs (id, workspaceId, type, status, priority, payload, progress, retryCount, maxRetries, createdAt, updatedAt)
            VALUES (?, ?, 'automation:workflow', 'queued', 3, ?, 0, 0, 3, datetime('now'), datetime('now'))
          `
            ).run(
              jobId,
              runtime.workspaceId,
              JSON.stringify({
                sequenceId: enroll.sequenceId,
                entityId: enroll.contactId,
                entityType: 'contact',
                executionId: id,
                workspaceId: runtime.workspaceId
              })
            );
          }
        }
      })();

      return { success: true };
    }
  );

  // 5. Bulk Remove Enrollments (Hard delete or soft delete execution)
  safeRegister(
    'campaigns:bulk-remove-enrollments',
    async (_event, { campaignId, enrollmentIds }) => {
      if (!campaignId) throw new Error('campaignId is required.');
      if (!Array.isArray(enrollmentIds) || enrollmentIds.length === 0) {
        throw new Error('enrollmentIds must be a non-empty array.');
      }

      const runtime = WorkspaceManager.getActiveRuntime();
      if (!runtime) throw new Error('No active workspace runtime');
      const db = getDatabase(runtime.workspaceId);
      const now = new Date().toISOString();

      db.transaction(() => {
        for (const id of enrollmentIds) {
          // Soft delete execution record
          db.prepare(
            `
          UPDATE sequence_executions
          SET deletedAt = ?, updatedAt = ?
          WHERE id = ? AND campaignId = ?
        `
          ).run(now, now, id, campaignId);

          // Cancel any active background scheduler jobs for this execution
          db.prepare(
            `
          UPDATE jobs
          SET status = 'cancelled', updatedAt = datetime('now')
          WHERE workspaceId = ?
            AND type = 'automation:workflow'
            AND json_extract(payload, '$.executionId') = ?
            AND status IN ('queued', 'starting', 'running', 'retrying')
        `
          ).run(runtime.workspaceId, id);

          // Queue DELETE mutation for sync
          db.prepare(
            `
          INSERT INTO sync_queue (id, workspaceId, entityType, entityId, operation, payload, version, retryCount, lastError, createdAt, updatedAt)
          VALUES (?, ?, 'sequence_executions', ?, 'DELETE', '{}', 1, 0, NULL, datetime('now'), datetime('now'))
        `
          ).run(randomUUID(), runtime.workspaceId, id);
        }
      })();

      return { success: true, count: enrollmentIds.length };
    }
  );

  // 6. Get real-time campaign runtime health & scheduled jobs overview
  safeRegister('campaigns:runtime:overview', async (_event, { workspaceId, campaignId }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    const db = getDatabase(workspaceId);

    let query = `
      SELECT id, type, status, priority, payload, progress, retryCount, maxRetries, lastError, createdAt, updatedAt
      FROM jobs
      WHERE workspaceId = ? AND type = 'automation:workflow' AND status IN ('queued', 'starting', 'running', 'retrying')
      ORDER BY createdAt DESC
    `;
    const params: any[] = [workspaceId];

    const activeJobs = db.prepare(query).all(...params) as any[];

    // Parse and filter if campaignId is specified
    const parsedJobs = activeJobs
      .map((job) => {
        try {
          const payload = JSON.parse(job.payload || '{}');
          return { ...job, payload };
        } catch {
          return { ...job, payload: {} };
        }
      })
      .filter((job) => {
        if (!campaignId) return true;
        // Correlate with execution campaignId
        const execRow = db
          .prepare('SELECT campaignId FROM sequence_executions WHERE id = ?')
          .get(job.payload?.executionId) as any;
        return execRow?.campaignId === campaignId;
      });

    // Check waiting executions
    let waitQuery = `
      SELECT id, campaignId, sequenceId, contactId, currentStep, currentStepName, status, nextExecutionAt, startedAt
      FROM sequence_executions
      WHERE workspaceId = ? AND UPPER(status) = 'WAITING' AND deletedAt IS NULL
    `;
    const waitParams: any[] = [workspaceId];
    if (campaignId) {
      waitQuery += ' AND campaignId = ?';
      waitParams.push(campaignId);
    }
    const waitingExecutions = db.prepare(waitQuery).all(...waitParams) as any[];

    return {
      jobs: parsedJobs,
      waiting: waitingExecutions
    };
  });

  // 7. Schedule campaign locally
  safeRegister('campaigns:schedule', async (_event, campaignId) => {
    if (!campaignId) throw new Error('campaignId is required.');

    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');

    const db = getDatabase(runtime.workspaceId);
    const now = new Date().toISOString();

    // Load campaign record
    const campaign = db
      .prepare(`SELECT sequenceId, status FROM campaigns WHERE id = ? AND workspaceId = ? AND deletedAt IS NULL`)
      .get(campaignId, runtime.workspaceId) as { sequenceId: string; status: string } | undefined;

    if (!campaign) throw new Error(`Campaign "${campaignId}" not found or deleted.`);

    // 1. Set campaign status to ACTIVE
    db.prepare(`UPDATE campaigns SET status = 'ACTIVE', updatedAt = ? WHERE id = ? AND workspaceId = ?`)
      .run(now, campaignId, runtime.workspaceId);

    // 2. Fetch sequence_executions for this campaign that are not completed
    const enrollments = db
      .prepare(`SELECT id, contactId, nextExecutionAt, status FROM sequence_executions WHERE campaignId = ? AND UPPER(status) != 'COMPLETED' AND deletedAt IS NULL`)
      .all(campaignId) as Array<{ id: string; contactId: string; nextExecutionAt: string | null; status: string }>;

    let enqueuedJobsCount = 0;

    db.transaction(() => {
      for (const enroll of enrollments) {
        if (enroll.status?.toUpperCase() === 'COMPLETED') continue;
        const isWaiting = enroll.nextExecutionAt && new Date(enroll.nextExecutionAt) > new Date();
        const newStatus = isWaiting ? 'WAITING' : 'RUNNING';

        db.prepare(`UPDATE sequence_executions SET status = ?, updatedAt = ? WHERE id = ?`).run(newStatus, now, enroll.id);

        if (!isWaiting) {
          const existingJob = db
            .prepare(
              `SELECT id FROM jobs WHERE workspaceId = ? AND type = 'automation:workflow' AND json_extract(payload, '$.executionId') = ? AND status IN ('queued', 'running', 'starting', 'retrying')`
            )
            .get(runtime.workspaceId, enroll.id);

          if (!existingJob) {
            const jobId = randomUUID();
            db.prepare(
              `INSERT INTO jobs (id, workspaceId, type, status, priority, payload, progress, retryCount, maxRetries, createdAt, updatedAt)
               VALUES (?, ?, 'automation:workflow', 'queued', 3, ?, 0, 0, 3, datetime('now'), datetime('now'))`
            ).run(
              jobId,
              runtime.workspaceId,
              JSON.stringify({
                sequenceId: campaign.sequenceId,
                entityId: enroll.contactId,
                entityType: 'contact',
                executionId: enroll.id,
                workspaceId: runtime.workspaceId
              })
            );
            enqueuedJobsCount++;
          }
        }
      }
    })();

    console.log(`[IPC] Campaign "${campaignId}" scheduled successfully. Enqueued ${enqueuedJobsCount} workflow job(s).`);
    return { success: true, campaignId, enqueuedJobsCount };
  });
}
