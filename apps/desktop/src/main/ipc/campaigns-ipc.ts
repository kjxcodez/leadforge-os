import { safeRegister } from './helper';
import { getDatabase } from '../database/connection';
import { WorkspaceManager } from '../lib/workspace-manager';
import { LocalCRMRepository } from '../database/repositories/local-crm';
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
    const sdk = WorkspaceManager.getSdk();

    // Load target campaign to get sequenceId and status
    let campaign = db
      .prepare(
        `
      SELECT sequenceId, status FROM campaigns 
      WHERE id = ? AND workspaceId = ? AND deletedAt IS NULL
    `
      )
      .get(campaignId, runtime.workspaceId) as { sequenceId?: string | null | undefined; status?: string | null | undefined } | undefined;

    if (!campaign) {
      const serverCampaign = await sdk.campaigns.get(campaignId).catch(() => null);
      if (serverCampaign) {
        await LocalCRMRepository.saveFromServer('campaigns', serverCampaign);
        campaign = {
          sequenceId: serverCampaign.sequenceId ?? null,
          status: serverCampaign.status ?? null
        };
      }
    }

    if (!campaign) throw new Error(`Campaign "${campaignId}" not found or deleted.`);

    let sequenceId = campaign.sequenceId;
    if (!sequenceId) {
      const serverCampaign = await sdk.campaigns.get(campaignId).catch(() => null);
      if (serverCampaign?.sequenceId) {
        sequenceId = serverCampaign.sequenceId;
        await LocalCRMRepository.saveFromServer('campaigns', serverCampaign);
      }
    }

    if (!sequenceId) {
      throw new Error(`Campaign "${campaignId}" does not have an attached automation sequence. Please attach a sequence before enrolling contacts.`);
    }

    const isActive = campaign.status?.toUpperCase() === 'ACTIVE';
    const now = new Date().toISOString();
    const enrolledIds: string[] = [];

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

      const created = await sdk.executions.create({
        sequenceId,
        campaignId,
        workspaceId: runtime.workspaceId,
        contactId,
        status: isActive ? 'running' : 'paused',
        startedAt: now
      });

      await LocalCRMRepository.saveFromServer('sequence_executions', created);

      // If the campaign is already active, spawn the workflow job via SDK
      if (isActive) {
        try {
          await sdk.jobs.create({
            id: randomUUID(),
            type: 'automation:workflow',
            priority: 3,
            payload: {
              sequenceId: campaign.sequenceId,
              entityId: contactId,
              entityType: 'contact',
              executionId: created.id,
              workspaceId: runtime.workspaceId
            }
          });
        } catch (err) {
          console.warn('[IPC] Job creation note:', err);
        }
      }

      enrolledIds.push(created.id);
    }

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
      const sdk = WorkspaceManager.getSdk();
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
        }
      })();

      // Cancel pending jobs via SDK
      try {
        const jobsList = await sdk.jobs.list({ limit: 100 });
        const jobsToCancel = (jobsList.data || []).filter(
          (j: any) =>
            j.type === 'automation:workflow' &&
            j.payload?.executionId &&
            enrollmentIds.includes(j.payload.executionId) &&
            ['queued', 'starting', 'running', 'retrying'].includes(j.status)
        );
        for (const job of jobsToCancel) {
          await sdk.jobs.cancel(job.id).catch(() => {});
        }
      } catch (err) {
        console.warn('[IPC] Error cancelling jobs via SDK:', err);
      }

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
      const sdk = WorkspaceManager.getSdk();
      const now = new Date().toISOString();

      const toResume: Array<{ id: string; sequenceId: string; contactId: string; nextExecutionAt: string | null }> = [];

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
            toResume.push({ id, ...enroll });
          }
        }
      })();

      // Enqueue resumed jobs via SDK
      for (const item of toResume) {
        try {
          await sdk.jobs.create({
            id: randomUUID(),
            type: 'automation:workflow',
            priority: 3,
            payload: {
              sequenceId: item.sequenceId,
              entityId: item.contactId,
              entityType: 'contact',
              executionId: item.id,
              workspaceId: runtime.workspaceId
            }
          });
        } catch (err) {
          console.warn('[IPC] Error queueing resumed job:', err);
        }
      }

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
      const sdk = WorkspaceManager.getSdk();

      for (const id of enrollmentIds) {
        try {
          await sdk.executions.delete(id);
        } catch (err) {
          console.warn(`[IPC] Execution remote delete warning for ${id}:`, err);
        }

        // Soft delete execution record in SQLite cache
        await LocalCRMRepository.softDeleteFromServer('sequence_executions', runtime.workspaceId, id);
      }

      // Cancel any active background scheduler jobs for these executions
      try {
        const jobsList = await sdk.jobs.list({ limit: 100 });
        const jobsToCancel = (jobsList.data || []).filter(
          (j: any) =>
            j.type === 'automation:workflow' &&
            j.payload?.executionId &&
            enrollmentIds.includes(j.payload.executionId) &&
            ['queued', 'starting', 'running', 'retrying'].includes(j.status)
        );
        for (const job of jobsToCancel) {
          await sdk.jobs.cancel(job.id).catch(() => {});
        }
      } catch (err) {
        console.warn('[IPC] Error cancelling jobs via SDK:', err);
      }

      return { success: true, count: enrollmentIds.length };
    }
  );

  // 6. Get real-time campaign runtime health & scheduled jobs overview
  safeRegister('campaigns:runtime:overview', async (_event, { workspaceId, campaignId }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    const db = getDatabase(workspaceId);
    const sdk = WorkspaceManager.getSdk();

    let parsedJobs: any[] = [];
    try {
      const jobsList = await sdk.jobs.list({ limit: 100 });
      const activeJobs = (jobsList.data || []).filter(
        (j: any) =>
          j.type === 'automation:workflow' &&
          ['queued', 'starting', 'running', 'retrying'].includes(j.status)
      );

      parsedJobs = activeJobs.filter((job: any) => {
        if (!campaignId) return true;
        const execRow = db
          .prepare('SELECT campaignId FROM sequence_executions WHERE id = ?')
          .get(job.payload?.executionId) as any;
        return execRow?.campaignId === campaignId;
      });
    } catch {
      parsedJobs = [];
    }

    // Check waiting executions
    let waitQuery = `
      SELECT id, campaignId, sequenceId, contactId, currentStepIndex, status, nextExecutionAt, startedAt
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
    const sdk = WorkspaceManager.getSdk();
    const now = new Date().toISOString();

    // Load campaign record
    const campaign = db
      .prepare(`SELECT sequenceId, status FROM campaigns WHERE id = ? AND workspaceId = ? AND deletedAt IS NULL`)
      .get(campaignId, runtime.workspaceId) as { sequenceId: string; status: string } | undefined;

    if (!campaign) throw new Error(`Campaign "${campaignId}" not found or deleted.`);

    // 1. Set campaign status to ACTIVE authoritatively in MongoDB via SDK
    try {
      const updatedCampaign = await sdk.campaigns.update(campaignId, { status: 'ACTIVE' as any });
      if (updatedCampaign) {
        await LocalCRMRepository.saveFromServer('campaigns', updatedCampaign);
      }
    } catch (err) {
      console.warn(`[IPC] Server campaign status update warning for ${campaignId}:`, err);
      db.prepare(`UPDATE campaigns SET status = 'ACTIVE', updatedAt = ? WHERE id = ? AND workspaceId = ?`)
        .run(now, campaignId, runtime.workspaceId);
    }

    // 2. Fetch sequence_executions for this campaign that are not completed
    const enrollments = db
      .prepare(`SELECT id, contactId, nextExecutionAt, status FROM sequence_executions WHERE campaignId = ? AND UPPER(status) != 'COMPLETED' AND deletedAt IS NULL`)
      .all(campaignId) as Array<{ id: string; contactId: string; nextExecutionAt: string | null; status: string }>;

    let enqueuedJobsCount = 0;

    for (const enroll of enrollments) {
      if (enroll.status?.toUpperCase() === 'COMPLETED') continue;
      const isWaiting = enroll.nextExecutionAt && new Date(enroll.nextExecutionAt) > new Date();
      const newStatus = isWaiting ? 'WAITING' : 'RUNNING';

      db.prepare(`UPDATE sequence_executions SET status = ?, updatedAt = ? WHERE id = ?`).run(newStatus, now, enroll.id);

      if (!isWaiting) {
        try {
          await sdk.jobs.create({
            id: randomUUID(),
            type: 'automation:workflow',
            priority: 3,
            payload: {
              sequenceId: campaign.sequenceId,
              entityId: enroll.contactId,
              entityType: 'contact',
              executionId: enroll.id,
              workspaceId: runtime.workspaceId
            }
          });
          enqueuedJobsCount++;
        } catch (err) {
          console.warn('[IPC] Error queueing scheduled job:', err);
        }
      }
    }

    console.log(`[IPC] Campaign "${campaignId}" scheduled successfully. Enqueued ${enqueuedJobsCount} workflow job(s).`);
    return { success: true, campaignId, enqueuedJobsCount };
  });
}
