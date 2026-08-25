import Database from 'better-sqlite3';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { JobContext } from '../../../shared/types/job';
import { SdkClient, renderCanonicalVariables, type CanonicalVariableContext } from '@leadforge/sdk';

// ── Types ────────────────────────────────────────────────────────────────────

interface ContactRecord {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  title: string | null;
  status: string | null;
  companyId: string | null;
}

interface EmailAccountRecord {
  id: string;
  email: string;
  name: string;
  status: string;
  dailyLimit: number;
  hourlyLimit: number;
  dailySent: number;
  hourlySent: number;
  signature: string | null;
}

interface OutreachCheckpoint {
  processedContactIds: string[];
  dispatchedCount: number;
  failureCount: number;
  skippedCount: number;
  currentIndex: number;
}

// ── Main plugin ──────────────────────────────────────────────────────────────

/**
 * Outreach Campaign Dispatcher Job Plugin.
 *
 * Dispatches outreach emails through the API-owned EmailService via SdkClient.
 * Reads contacts and campaign templates locally, enforces limits, logs sequence execution
 * results to local SQLite, and delegates actual delivery to the server-side Gmail API.
 */
export async function dispatchOutreach(ctx: JobContext): Promise<any> {
  const campaignId: string = ctx.payload.campaignId || '';
  if (!campaignId) {
    throw new Error('Missing required payload field: campaignId.');
  }

  ctx.emitLog(`Initializing API-owned outreach dispatcher for Campaign: ${campaignId}`, 'info');

  const dbDir = process.env.WORKSPACES_DB_DIR || '';
  if (!dbDir) {
    throw new Error('WORKSPACES_DB_DIR env variable is required for background workers.');
  }

  const dbPath = join(dbDir, `leadforge_${ctx.workspaceId}.db`);
  const db = new Database(dbPath);

  try {
    // Initialize SDK client for API communication
    const apiUrl = process.env.API_URL || 'https://api.leadforge.kapiljangid.pro/api/v1';
    const authToken = ctx.payload._secrets?.sessionToken || process.env.SESSION_TOKEN || '';
    const sdk = new SdkClient({
      baseUrl: apiUrl,
      token: authToken,
      headers: {
        'x-workspace-id': ctx.workspaceId
      }
    });

    // ── 1. Load email account for sender account ID ────────────────────────
    const account = db
      .prepare(
        `
      SELECT id, email, name, status, dailyLimit, hourlyLimit, dailySent, hourlySent, signature
      FROM email_accounts
      WHERE workspaceId = ? AND status = 'connected' AND deletedAt IS NULL
      ORDER BY createdAt ASC
      LIMIT 1
    `
      )
      .get(ctx.workspaceId) as EmailAccountRecord | undefined;

    if (!account) {
      throw new Error('No connected Gmail account found in workspace. Please connect a Gmail account in Settings → Email Accounts.');
    }

    const accountId = account.id;
    ctx.emitLog(`Using Gmail account ${account.email} (id: ${accountId}) for outreach`, 'info');

    // ── 2. Load campaign ──────────────────────────────────────────────────
    const campaign = db
      .prepare(
        `SELECT id, name FROM campaigns WHERE id = ? AND workspaceId = ? AND deletedAt IS NULL`
      )
      .get(campaignId, ctx.workspaceId) as { id: string; name: string } | undefined;

    if (!campaign) {
      throw new Error(`Campaign "${campaignId}" not found or deleted in local database.`);
    }

    ctx.emitLog(`Campaign resolved: "${campaign.name}"`, 'info');

    // ── 3. Resolve email subject and body ─────────────────────────────────
    let subject: string = ctx.payload.subject || '';
    let body: string = ctx.payload.body || '';

    if ((!subject || !body) && ctx.payload.templateId) {
      const tpl = db
        .prepare(
          `SELECT subject, body FROM templates WHERE id = ? AND workspaceId = ? AND deletedAt IS NULL`
        )
        .get(ctx.payload.templateId, ctx.workspaceId) as
        { subject: string; body: string } | undefined;

      if (tpl) {
        if (!subject) subject = tpl.subject;
        if (!body) body = tpl.body;
      }
    }

    if (!subject || !body) {
      const fallbackTpl = db
        .prepare(
          `SELECT subject, body FROM templates WHERE workspaceId = ? AND deletedAt IS NULL ORDER BY createdAt ASC LIMIT 1`
        )
        .get(ctx.workspaceId) as { subject: string; body: string } | undefined;

      if (fallbackTpl) {
        if (!subject) subject = fallbackTpl.subject;
        if (!body) body = fallbackTpl.body;
      }
    }

    if (!subject) subject = `Message from ${account.name || 'LeadForge'}`;
    if (!body)
      body = `Hello {{firstName}},\n\nThis message was sent via LeadForge OS.\n\nBest regards,\n${account.name || 'LeadForge'}`;

    // ── 4. Load eligible contacts ────────────────────────────────────────
    const contacts = db
      .prepare(
        `
      SELECT id, firstName, lastName, email, title, status, companyId
      FROM contacts
      WHERE workspaceId = ?
        AND deletedAt IS NULL
        AND email IS NOT NULL
        AND email != ''
        AND status NOT IN ('unsubscribed', 'bounced', 'do_not_contact')
        AND id NOT IN (
          SELECT contactId FROM sequence_executions
          WHERE sequenceId = ? AND status = 'completed' AND workspaceId = ?
        )
      ORDER BY priority DESC, createdAt ASC
    `
      )
      .all(ctx.workspaceId, campaignId, ctx.workspaceId) as ContactRecord[];

    if (contacts.length === 0) {
      ctx.emitLog(
        'No eligible contacts found for this campaign. All contacts have already been contacted or none exist.',
        'info'
      );
      db.close();
      return { dispatchedCount: 0, failureCount: 0, skippedCount: 0 };
    }

    ctx.emitLog(
      `Found ${contacts.length} eligible contact(s). Starting API email dispatch loop...`,
      'info'
    );

    // ── 5. Restore checkpoint if resuming ─────────────────────────────────
    const savedCheckpoint = ctx.getCheckpoint() as OutreachCheckpoint | null;
    const processedContactIds: Set<string> = new Set(savedCheckpoint?.processedContactIds || []);
    let dispatchedCount = savedCheckpoint?.dispatchedCount || 0;
    let failureCount = savedCheckpoint?.failureCount || 0;
    let skippedCount = savedCheckpoint?.skippedCount || 0;
    let startIndex = savedCheckpoint?.currentIndex || 0;

    if (startIndex > 0) {
      ctx.emitLog(
        `Resuming from checkpoint at index ${startIndex} (${processedContactIds.size} contacts already processed).`,
        'info'
      );
    }

    // ── 6. Dispatch loop ──────────────────────────────────────────────────
    const totalContacts = contacts.length;

    for (let i = startIndex; i < totalContacts; i++) {
      if (ctx.isCancelled()) {
        ctx.emitLog(`Outreach cancelled at contact ${i + 1}/${totalContacts}.`, 'warn');
        break;
      }

      if (ctx.isPaused()) {
        ctx.emitLog(
          `Outreach paused at contact ${i + 1}/${totalContacts}. Saving checkpoint...`,
          'info'
        );
        ctx.saveCheckpoint({
          processedContactIds: Array.from(processedContactIds),
          dispatchedCount,
          failureCount,
          skippedCount,
          currentIndex: i
        } satisfies OutreachCheckpoint);
        db.close();
        return { status: 'paused', dispatchedCount, failureCount, skippedCount, resumeIndex: i };
      }

      const contact = contacts[i];
      if (!contact) continue;

      if (processedContactIds.has(contact.id)) {
        skippedCount++;
        continue;
      }

      const fullName =
        `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email;
      ctx.emitLog(`Preparing email for "${fullName}" <${contact.email}>`, 'info');

      let companyRow: any = null;
      if (contact.companyId) {
        companyRow = db
          .prepare(
            `SELECT id, name, domain, industry, location, website FROM companies WHERE id = ? AND workspaceId = ?`
          )
          .get(contact.companyId, ctx.workspaceId);
      }

      const renderCtx: CanonicalVariableContext = {
        contact: {
          id: contact.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          title: contact.title,
          status: contact.status
        },
        company: companyRow
          ? {
              id: companyRow.id,
              name: companyRow.name,
              domain: companyRow.domain || companyRow.website,
              industry: companyRow.industry,
              location: companyRow.location,
              website: companyRow.website
            }
          : null,
        sender: {
          name: account.name,
          email: account.email
        },
        sequence: {
          name: campaign.name
        },
        workspace: {
          id: ctx.workspaceId
        }
      };

      const renderedSubject = renderCanonicalVariables(subject, renderCtx);
      const renderedBody = renderCanonicalVariables(body, renderCtx);
      const isHtml = renderedBody.trim().startsWith('<') && /<[a-z][\s\S]*>/i.test(renderedBody);

      const executionId = randomUUID();
      const logId = randomUUID();
      let messageId = '';
      let sendSuccess = false;
      let sendError = '';

      try {
        const res = await sdk.outreach.sendEmail({
          accountId,
          to: contact.email,
          subject: renderedSubject,
          ...(isHtml ? { html: renderedBody } : { text: renderedBody })
        });

        messageId = res.messageId || '';
        sendSuccess = true;
        ctx.emitLog(`✅ Email sent via API to ${contact.email} (messageId: ${messageId})`, 'info');
      } catch (err: any) {
        sendError = err.message || String(err);
        sendSuccess = false;
        ctx.emitLog(`❌ Failed to send email to ${contact.email}: ${sendError}`, 'error');
      }

      // ── 7. Write sequence_execution and sequence_log atomically ──────────
      const now = new Date().toISOString();

      db.transaction(() => {
        if (sendSuccess) {
          db.prepare(
            `
            INSERT INTO sequence_executions
              (id, sequenceId, workspaceId, contactId, currentStep, status, startedAt, completedAt, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, 1, 'completed', ?, ?, ?, ?)
          `
          ).run(executionId, campaignId, ctx.workspaceId, contact.id, now, now, now, now);

          db.prepare(
            `
            INSERT INTO sequence_logs
              (id, executionId, workspaceId, timestamp, step, action, status, message, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, 1, 'EMAIL_SEND', 'success', ?, ?, ?)
          `
          ).run(
            logId,
            executionId,
            ctx.workspaceId,
            now,
            `Email dispatched to ${contact.email} for campaign "${campaign.name}". MessageId: ${messageId}`,
            now,
            now
          );

          dispatchedCount++;

          db.prepare(
            `
            UPDATE email_accounts
            SET dailySent = dailySent + 1, hourlySent = hourlySent + 1, updatedAt = ?
            WHERE id = ?
          `
          ).run(now, accountId);
        } else {
          db.prepare(
            `
            INSERT INTO sequence_executions
              (id, sequenceId, workspaceId, contactId, currentStep, status, startedAt, completedAt, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, 1, 'failed', ?, ?, ?, ?)
          `
          ).run(executionId, campaignId, ctx.workspaceId, contact.id, now, now, now, now);

          db.prepare(
            `
            INSERT INTO sequence_logs
              (id, executionId, workspaceId, timestamp, step, action, status, message, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, 1, 'EMAIL_SEND', 'failed', ?, ?, ?)
          `
          ).run(
            logId,
            executionId,
            ctx.workspaceId,
            now,
            `Failed to send email to ${contact.email}: ${sendError}`,
            now,
            now
          );

          failureCount++;
        }
      })();

      processedContactIds.add(contact.id);

      const progress = Math.round(((i + 1) / totalContacts) * 100);
      ctx.updateProgress(progress, {
        current: i + 1,
        total: totalContacts,
        description: `Sent: ${dispatchedCount} | Failed: ${failureCount} | Skipped: ${skippedCount}`
      });

      if ((i + 1) % 10 === 0) {
        ctx.saveCheckpoint({
          processedContactIds: Array.from(processedContactIds),
          dispatchedCount,
          failureCount,
          skippedCount,
          currentIndex: i + 1
        } satisfies OutreachCheckpoint);
        ctx.emitLog(`Checkpoint saved after ${i + 1} contact(s).`, 'info');
      }
    }

    ctx.emitLog(
      `Campaign dispatch complete — Sent: ${dispatchedCount} | Failed: ${failureCount} | Skipped: ${skippedCount}`,
      'info'
    );

    db.close();
    return { dispatchedCount, failureCount, skippedCount };
  } catch (err) {
    try {
      db.close();
    } catch {
      /* ignore */
    }
    throw err;
  }
}
