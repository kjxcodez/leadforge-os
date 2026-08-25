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
          campaign.status === 'Active' ? 'running' : 'paused',
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
            status: campaign.status === 'Active' ? 'RUNNING' : 'PAUSED',
            startedAt: now
          })
        );

        // If the campaign is already active, spawn the workflow job in the queue immediately
        if (campaign.status === 'Active') {
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
          SET status = 'paused', updatedAt = ?
          WHERE id = ? AND campaignId = ? AND status IN ('running', 'queued', 'starting', 'waiting')
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
          WHERE id = ? AND campaignId = ? AND status = 'paused'
        `
            )
            .get(id, campaignId) as
            { sequenceId: string; contactId: string; nextExecutionAt: string | null } | undefined;

          if (!enroll) continue;

          const isWaiting = enroll.nextExecutionAt && new Date(enroll.nextExecutionAt) > new Date();
          const newStatus = isWaiting ? 'waiting' : 'running';

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

  // 5. Bulk Remove Enrollments
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

      db.transaction(() => {
        for (const id of enrollmentIds) {
          db.prepare(
            `
          UPDATE sequence_executions
          SET deletedAt = datetime('now'), updatedAt = datetime('now')
          WHERE id = ? AND campaignId = ?
        `
          ).run(id, campaignId);

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

  // 6. Queue and Jobs detailed monitor list
  safeRegister('scheduler:queue:list', async (_event, { workspaceId }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    const db = getDatabase(workspaceId);

    // Fetch all jobs for email queue display
    const jobs = db
      .prepare(
        `
      SELECT 
        j.id,
        j.id as jobId,
        j.type,
        j.status,
        j.retryCount,
        j.createdAt,
        j.updatedAt,
        j.payload,
        c.firstName,
        c.lastName,
        c.email,
        comp.name as companyName,
        camp.name as campaignName
      FROM jobs j
      LEFT JOIN sequence_executions se ON json_extract(j.payload, '$.executionId') = se.id
      LEFT JOIN contacts c ON se.contactId = c.id
      LEFT JOIN companies comp ON c.companyId = comp.id
      LEFT JOIN campaigns camp ON se.campaignId = camp.id
      WHERE j.workspaceId = ? AND j.type = 'automation:workflow'
      ORDER BY j.createdAt DESC
    `
      )
      .all(workspaceId) as any[];

    // Map payload into parsed objects
    const parsedJobs = jobs.map((j) => {
      try {
        j.payload = j.payload ? JSON.parse(j.payload) : {};
      } catch {
        j.payload = {};
      }
      return j;
    });

    // Fetch waiting/delayed executions
    const waitingExecutions = db
      .prepare(
        `
      SELECT 
        se.*,
        c.firstName,
        c.lastName,
        c.email,
        comp.name as companyName,
        s.name as sequenceName,
        camp.name as campaignName
      FROM sequence_executions se
      LEFT JOIN contacts c ON se.contactId = c.id
      LEFT JOIN companies comp ON c.companyId = comp.id
      LEFT JOIN sequences s ON se.sequenceId = s.id
      LEFT JOIN campaigns camp ON se.campaignId = camp.id
      WHERE se.workspaceId = ? AND se.status = 'waiting' AND se.deletedAt IS NULL
      ORDER BY se.nextExecutionAt ASC
    `
      )
      .all(workspaceId) as any[];

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

    // 1. Set campaign status to Active
    db.prepare(`UPDATE campaigns SET status = 'Active', updatedAt = ? WHERE id = ? AND workspaceId = ?`)
      .run(now, campaignId, runtime.workspaceId);

    // 2. Fetch sequence_executions for this campaign
    const enrollments = db
      .prepare(`SELECT id, contactId, nextExecutionAt FROM sequence_executions WHERE campaignId = ? AND deletedAt IS NULL`)
      .all(campaignId) as Array<{ id: string; contactId: string; nextExecutionAt: string | null }>;

    let enqueuedJobsCount = 0;

    db.transaction(() => {
      for (const enroll of enrollments) {
        const isWaiting = enroll.nextExecutionAt && new Date(enroll.nextExecutionAt) > new Date();
        const newStatus = isWaiting ? 'waiting' : 'running';

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
