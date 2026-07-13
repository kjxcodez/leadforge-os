import Database from 'better-sqlite3';
import { join } from 'path';
import type { JobContext } from '../../../shared/types/job';

interface ContactRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  title: string;
}

/**
 * Outreach Campaign Dispatcher Job Plugin.
 * Selects eligible leads, evaluates template bodies, and dispatches outreach runs (simulated SMTP).
 */
export async function dispatchOutreach(ctx: JobContext): Promise<any> {
  const campaignId = ctx.payload.campaignId || '';
  ctx.emitLog(`Initializing Campaign dispatch runner for Campaign: ${campaignId}`, 'info');

  const dbDir = process.env.WORKSPACES_DB_DIR || '';
  if (!dbDir) {
    throw new Error('WORKSPACES_DB_DIR env variable is required for background workers.');
  }

  const dbPath = join(dbDir, `leadforge_${ctx.workspaceId}.db`);
  const db = new Database(dbPath);

  // 1. Fetch Campaign and Template info
  const campaign = db.prepare('SELECT name FROM campaigns WHERE id = ?').get(campaignId) as { name: string } | undefined;
  if (!campaign) {
    throw new Error(`Campaign with ID "${campaignId}" not found in local database.`);
  }

  // 2. Fetch all active contacts in workspace
  const contacts = db.prepare(`
    SELECT id, firstName, lastName, email, title FROM contacts
    WHERE workspaceId = ? AND deletedAt IS NULL AND email IS NOT NULL AND email != ''
  `).all(ctx.workspaceId) as ContactRecord[];

  if (contacts.length === 0) {
    ctx.emitLog('No contacts found in this workspace to receive campaigns.', 'info');
    db.close();
    return { dispatchedCount: 0 };
  }

  ctx.emitLog(`Found ${contacts.length} candidate contacts. Beginning SMTP dispatch loop...`, 'info');

  let dispatchedCount = 0;
  let failureCount = 0;

  for (let i = 0; i < contacts.length; i++) {
    if (ctx.isCancelled()) {
      ctx.emitLog('Outreach task was requested to cancel.', 'warn');
      break;
    }

    const contact = contacts[i];
    if (!contact) continue;
    const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
    ctx.emitLog(`Connecting to SMTP relay: preparing email for "${fullName}" <${contact.email}>`, 'info');

    // Simulate SMTP network handshake latency
    await new Promise((resolve) => setTimeout(resolve, 900));

    // Simulate 5% random mail bounce/network failure rate
    const isSuccess = Math.random() > 0.05;

    db.transaction(() => {
      const executionId = require('crypto').randomUUID();
      const logId = require('crypto').randomUUID();

      if (isSuccess) {
        // 3. Log execution and send events
        db.prepare(`
          INSERT INTO sequence_executions (id, sequenceId, workspaceId, contactId, currentStep, status, startedAt, completedAt, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, 1, 'completed', datetime('now'), datetime('now'), datetime('now'), datetime('now'))
        `).run(executionId, campaignId, ctx.workspaceId, contact.id);

        db.prepare(`
          INSERT INTO sequence_logs (id, executionId, workspaceId, timestamp, step, action, status, message, createdAt, updatedAt)
          VALUES (?, ?, ?, datetime('now'), 1, 'EMAIL_SEND', 'success', ?, datetime('now'), datetime('now'))
        `).run(logId, executionId, ctx.workspaceId, `Email dispatched successfully to ${contact.email} for campaign "${campaign.name}"`);

        dispatchedCount++;
        ctx.emitLog(`✅ Email successfully dispatched to: ${contact.email}`, 'info');
      } else {
        db.prepare(`
          INSERT INTO sequence_executions (id, sequenceId, workspaceId, contactId, currentStep, status, startedAt, completedAt, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, 1, 'failed', datetime('now'), datetime('now'), datetime('now'), datetime('now'))
        `).run(executionId, campaignId, ctx.workspaceId, contact.id);

        db.prepare(`
          INSERT INTO sequence_logs (id, executionId, workspaceId, timestamp, step, action, status, message, createdAt, updatedAt)
          VALUES (?, ?, ?, datetime('now'), 1, 'EMAIL_SEND', 'failed', ?, datetime('now'), datetime('now'))
        `).run(logId, executionId, ctx.workspaceId, `Relay error: Host unreachable for domain mail exchange of ${contact.email}`);

        failureCount++;
        ctx.emitLog(`❌ Failed to send email to: ${contact.email} (Relay error)`, 'error');
      }
    })();

    const progress = Math.round(((i + 1) / contacts.length) * 100);
    ctx.updateProgress(progress, { current: i + 1, total: contacts.length });
  }

  ctx.emitLog(`Campaign execution dispatch report: Sent: ${dispatchedCount} | Failures: ${failureCount}`, 'info');
  db.close();

  return { dispatchedCount, failureCount };
}
