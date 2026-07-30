import { safeRegister } from './helper';
import { LocalCRMRepository } from '../database/repositories/local-crm';
import { getDatabase } from '../database/connection';
import { WorkspaceManager } from '../lib/workspace-manager';

/**
 * Registers CRM entities (companies, contacts, campaigns, activities) IPC channels
 * targeting the local SQLite database.
 */
export function registerCrmIpc() {
  // Companies
  safeRegister('companies:list', async (_event, { workspaceId, filter }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    return LocalCRMRepository.findMany('companies', workspaceId, filter);
  });

  safeRegister('companies:get', async (_event, { workspaceId, id }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    if (!id) throw new Error('id is required.');
    return LocalCRMRepository.findById('companies', workspaceId, id);
  });

  safeRegister('companies:create', async (_event, record) => {
    if (!record.workspaceId) throw new Error('workspaceId is required.');
    return LocalCRMRepository.save('companies', record);
  });

  safeRegister('companies:update', async (_event, { id, dto }) => {
    if (!dto.workspaceId) throw new Error('workspaceId is required.');
    return LocalCRMRepository.save('companies', { ...dto, id });
  });

  safeRegister('companies:delete', async (_event, { workspaceId, id }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    if (!id) throw new Error('id is required.');
    return LocalCRMRepository.softDelete('companies', workspaceId, id);
  });

  // Contacts
  safeRegister('contacts:list', async (_event, { workspaceId, filter }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    return LocalCRMRepository.findMany('contacts', workspaceId, filter);
  });

  safeRegister('contacts:get', async (_event, { workspaceId, id }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    if (!id) throw new Error('id is required.');
    return LocalCRMRepository.findById('contacts', workspaceId, id);
  });

  safeRegister('contacts:create', async (_event, record) => {
    if (!record.workspaceId) throw new Error('workspaceId is required.');
    return LocalCRMRepository.save('contacts', record);
  });

  safeRegister('contacts:update', async (_event, { id, dto }) => {
    if (!dto.workspaceId) throw new Error('workspaceId is required.');
    return LocalCRMRepository.save('contacts', { ...dto, id });
  });

  safeRegister('contacts:delete', async (_event, { workspaceId, id }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    if (!id) throw new Error('id is required.');
    return LocalCRMRepository.softDelete('contacts', workspaceId, id);
  });

  // Campaigns
  safeRegister('campaigns:list', async (_event, { workspaceId, filter }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    const campaigns = await LocalCRMRepository.findMany('campaigns', workspaceId, filter);
    const db = getDatabase(workspaceId);

    // Enrich campaigns with aggregate stats and auto-calculated statuses
    for (const campaign of campaigns) {
      const stats = db.prepare(`
        SELECT 
          COUNT(id) as total,
          SUM(CASE WHEN status IN ('running', 'queued', 'starting') THEN 1 ELSE 0 END) as running,
          SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) as waiting,
          SUM(CASE WHEN status IN ('replied', 'REPLIED') THEN 1 ELSE 0 END) as replied,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) as paused,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
        FROM sequence_executions
        WHERE campaignId = ? AND deletedAt IS NULL
      `).get(campaign.id) as { total: number; running: number; waiting: number; replied: number; failed: number; paused: number; completed: number };

      campaign.contactsCount = stats.total;
      campaign.runningCount = stats.running;
      campaign.waitingCount = stats.waiting;
      campaign.repliedCount = stats.replied;
      campaign.failedCount = stats.failed;
      campaign.pausedCount = stats.paused;
      campaign.completedCount = stats.completed;

      // Auto-calculate campaign status unless it's explicitly 'Draft' or 'Archived'
      if (campaign.status !== 'Draft' && campaign.status !== 'Archived') {
        if (stats.total === 0) {
          campaign.status = 'Draft';
        } else if (stats.running > 0 || stats.waiting > 0) {
          campaign.status = 'Active';
        } else if (stats.paused > 0) {
          campaign.status = 'Paused';
        } else if (stats.total > 0 && (stats.completed + stats.replied + stats.failed === stats.total)) {
          campaign.status = 'Completed';
        } else {
          campaign.status = campaign.status || 'Draft';
        }
        
        // Save the updated status to the database so it's persisted
        db.prepare('UPDATE campaigns SET status = ?, updatedAt = datetime(\'now\') WHERE id = ?').run(campaign.status, campaign.id);
      }
    }

    return campaigns;
  });

  safeRegister('campaigns:get', async (_event, { workspaceId, id }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    if (!id) throw new Error('id is required.');
    const campaign = await LocalCRMRepository.findById('campaigns', workspaceId, id);
    if (!campaign) return null;

    const db = getDatabase(workspaceId);
    const stats = db.prepare(`
      SELECT 
        COUNT(id) as total,
        SUM(CASE WHEN status IN ('running', 'queued', 'starting') THEN 1 ELSE 0 END) as running,
        SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) as waiting,
        SUM(CASE WHEN status IN ('replied', 'REPLIED') THEN 1 ELSE 0 END) as replied,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) as paused,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM sequence_executions
      WHERE campaignId = ? AND deletedAt IS NULL
    `).get(campaign.id) as { total: number; running: number; waiting: number; replied: number; failed: number; paused: number; completed: number };

    campaign.contactsCount = stats.total;
    campaign.runningCount = stats.running;
    campaign.waitingCount = stats.waiting;
    campaign.repliedCount = stats.replied;
    campaign.failedCount = stats.failed;
    campaign.pausedCount = stats.paused;
    campaign.completedCount = stats.completed;

    return campaign;
  });

  safeRegister('campaigns:create', async (_event, record) => {
    if (!record.workspaceId) throw new Error('workspaceId is required.');
    return LocalCRMRepository.save('campaigns', {
      ...record,
      status: record.status || 'Draft',
    });
  });

  safeRegister('campaigns:update', async (_event, { id, dto }) => {
    if (!dto.workspaceId) throw new Error('workspaceId is required.');
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');

    const db = getDatabase(runtime.workspaceId);
    const oldCampaign = db.prepare(`SELECT status, sequenceId FROM campaigns WHERE id = ? AND workspaceId = ?`).get(id, runtime.workspaceId) as { status: string, sequenceId: string } | undefined;

    // Perform save
    const record = await LocalCRMRepository.save('campaigns', { ...dto, id });

    // Handle Status Change Cascade effects
    if (oldCampaign && dto.status && oldCampaign.status !== dto.status) {
      const now = new Date().toISOString();
      if (dto.status === 'Active') {
        // Transition paused enrollments to running/waiting
        const pausedEnrollments = db.prepare(`
          SELECT id, contactId, nextExecutionAt FROM sequence_executions
          WHERE campaignId = ? AND status = 'paused' AND deletedAt IS NULL
        `).all(id) as { id: string; contactId: string; nextExecutionAt: string | null }[];

        db.transaction(() => {
          for (const enroll of pausedEnrollments) {
            const isWaiting = enroll.nextExecutionAt && new Date(enroll.nextExecutionAt) > new Date();
            const newStatus = isWaiting ? 'waiting' : 'running';

            db.prepare(`
              UPDATE sequence_executions
              SET status = ?, updatedAt = ?
              WHERE id = ?
            `).run(newStatus, now, enroll.id);

            if (!isWaiting) {
              const jobId = require('crypto').randomUUID();
              db.prepare(`
                INSERT INTO jobs (id, workspaceId, type, status, priority, payload, progress, retryCount, maxRetries, createdAt, updatedAt)
                VALUES (?, ?, 'automation:workflow', 'queued', 3, ?, 0, 0, 3, datetime('now'), datetime('now'))
              `).run(
                jobId,
                runtime.workspaceId,
                JSON.stringify({
                  sequenceId: oldCampaign.sequenceId,
                  entityId: enroll.contactId,
                  entityType: 'contact',
                  executionId: enroll.id,
                  workspaceId: runtime.workspaceId
                })
              );
            }
          }
        })();
      } else if (dto.status === 'Paused') {
        // Transition active/waiting enrollments to paused and cancel active jobs
        db.transaction(() => {
          db.prepare(`
            UPDATE sequence_executions
            SET status = 'paused', updatedAt = ?
            WHERE campaignId = ? AND status IN ('running', 'queued', 'starting', 'waiting') AND deletedAt IS NULL
          `).run(now, id);

          db.prepare(`
            UPDATE jobs
            SET status = 'cancelled', updatedAt = datetime('now')
            WHERE workspaceId = ?
              AND type = 'automation:workflow'
              AND json_extract(payload, '$.executionId') IN (
                SELECT id FROM sequence_executions WHERE campaignId = ?
              )
              AND status IN ('queued', 'starting', 'running', 'retrying')
          `).run(runtime.workspaceId, id);
        })();
      }
    }

    return record;
  });

  safeRegister('campaigns:delete', async (_event, { workspaceId, id }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    if (!id) throw new Error('id is required.');
    return LocalCRMRepository.softDelete('campaigns', workspaceId, id);
  });

  // Activities log
  safeRegister('activities:list', async (_event, { workspaceId, filter }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    return LocalCRMRepository.findMany('activities', workspaceId, filter);
  });

  safeRegister('intelligence:get', async (_event, { workspaceId, companyId }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    if (!companyId) throw new Error('companyId is required.');

    const db = getDatabase(workspaceId);
    
    const companyIntelligence = db.prepare('SELECT * FROM company_intelligence WHERE companyId = ?').get(companyId);
    const websiteIntelligence = db.prepare('SELECT * FROM website_intelligence WHERE companyId = ?').get(companyId);
    const contactIntelligences = db.prepare(`
      SELECT ci.*, c.firstName, c.lastName, c.title
      FROM contact_intelligence ci
      JOIN contacts c ON c.id = ci.contactId
      WHERE c.companyId = ?
    `).all(companyId);
    const opportunityScore = db.prepare('SELECT * FROM opportunity_scores WHERE companyId = ?').get(companyId);

    const safeParse = (str: any) => {
      if (!str) return [];
      try { return JSON.parse(str); } catch { return []; }
    };

    return {
      companyIntelligence: companyIntelligence ? {
        ...companyIntelligence,
        techStack: safeParse((companyIntelligence as any).techStack),
        growthSignals: safeParse((companyIntelligence as any).growthSignals),
        hiringSignals: safeParse((companyIntelligence as any).hiringSignals),
        missingInformation: safeParse((companyIntelligence as any).missingInformation)
      } : null,
      websiteIntelligence: websiteIntelligence ? {
        ...websiteIntelligence,
        buyingSignals: safeParse((websiteIntelligence as any).buyingSignals),
        seoSignals: safeParse((websiteIntelligence as any).seoSignals),
        technicalIssues: safeParse((websiteIntelligence as any).technicalIssues),
        productsServices: safeParse((websiteIntelligence as any).productsServices),
        testimonialsCaseStudies: safeParse((websiteIntelligence as any).testimonialsCaseStudies)
      } : null,
      contactIntelligences: contactIntelligences.map((c: any) => ({
        ...c,
        personalizationOpportunities: safeParse(c.personalizationOpportunities)
      })),
      opportunityScore: opportunityScore || null
    };
  });

  safeRegister('intelligence:trigger', async (_event, { workspaceId, companyId }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    if (!companyId) throw new Error('companyId is required.');

    const db = getDatabase(workspaceId);
    const jobId = require('crypto').randomUUID();
    
    db.prepare(`
      INSERT INTO jobs (id, workspaceId, type, status, priority, payload, progress, retryCount, maxRetries, createdAt, updatedAt)
      VALUES (?, ?, 'enrich:intelligence', 'queued', 5, ?, 0, 0, 3, datetime('now'), datetime('now'))
    `).run(jobId, workspaceId, JSON.stringify({ companyId }));

    return { success: true, jobId };
  });
}

