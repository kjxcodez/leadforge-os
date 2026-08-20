import Database from 'better-sqlite3';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { JobContext } from '../../../shared/types/job';
import {
  createMailProvider,
  type MailProvider,
  type MailProviderResolution
} from '../../mail';

// ── Types ────────────────────────────────────────────────────────────────────

interface ContactRecord {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  title: string | null;
  status: string | null;
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

interface SmtpCredentials {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  senderName: string;
  senderEmail: string;
}

interface OutreachCheckpoint {
  processedContactIds: string[];
  dispatchedCount: number;
  failureCount: number;
  skippedCount: number;
  currentIndex: number;
}

// ── Settings helpers ─────────────────────────────────────────────────────────

/**
 * Loads all settings rows for a workspace and returns them as a Map.
 */
function loadSettings(db: Database.Database, workspaceId: string): Map<string, string> {
  const rows = db
    .prepare(`SELECT key, value FROM settings WHERE workspaceId = ?`)
    .all(workspaceId) as { key: string; value: string }[];
  const map = new Map<string, string>();
  for (const row of rows) {
    if (row.key) map.set(row.key, row.value);
  }
  return map;
}

/**
 * Resolves a settings value by trying multiple key aliases in order,
 * returning the first non-null, non-empty match.
 */
function resolveSettingValue(
  secrets: Record<string, string> | undefined,
  settings: Map<string, string>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    if (
      secrets &&
      secrets[key] !== undefined &&
      secrets[key] !== null &&
      secrets[key].trim() !== ''
    ) {
      return secrets[key].trim();
    }
    const val = settings.get(key);
    if (val !== undefined && val !== null && val.trim() !== '') {
      return val.trim();
    }
  }
  return undefined;
}

// ── Template rendering ───────────────────────────────────────────────────────

/**
 * Replaces {{variable}} placeholders in a template string with contact field values.
 * Missing variables resolve to empty strings — never throws.
 */
function renderTemplate(template: string, contact: ContactRecord, campaignName: string): string {
  return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_match, variable: string) => {
    switch (variable) {
      case 'firstName':
        return contact.firstName || '';
      case 'lastName':
        return contact.lastName || '';
      case 'fullName':
        return `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
      case 'email':
        return contact.email || '';
      case 'title':
        return contact.title || '';
      case 'campaign':
        return campaignName || '';
      default:
        return '';
    }
  });
}

// ── Main plugin ──────────────────────────────────────────────────────────────

/**
 * Outreach Campaign Dispatcher Job Plugin — TASK-020.
 *
 * Replaces the simulated outreach plugin with a real SMTP dispatch pipeline
 * using Nodemailer. Reads credentials from the workspace settings table,
 * respects daily/hourly send limits from email_accounts, and logs results to
 * sequence_executions and sequence_logs.
 *
 * Supports checkpoint, pause, resume, and cancellation per the job lifecycle spec.
 */
export async function dispatchOutreach(ctx: JobContext): Promise<any> {
  const campaignId: string = ctx.payload.campaignId || '';
  if (!campaignId) {
    throw new Error('Missing required payload field: campaignId.');
  }

  ctx.emitLog(`Initializing outreach campaign dispatcher for Campaign: ${campaignId}`, 'info');

  const dbDir = process.env.WORKSPACES_DB_DIR || '';
  if (!dbDir) {
    throw new Error('WORKSPACES_DB_DIR env variable is required for background workers.');
  }

  const dbPath = join(dbDir, `leadforge_${ctx.workspaceId}.db`);
  const db = new Database(dbPath);

  try {
    // ── 1. Load SMTP credentials from settings table ──────────────────────

    const settings = loadSettings(db, ctx.workspaceId);

    const host = resolveSettingValue(
      ctx.payload._secrets,
      settings,
      'smtp.host',
      'smtpHost',
      'host'
    );
    const portStr = resolveSettingValue(
      ctx.payload._secrets,
      settings,
      'smtp.port',
      'smtpPort',
      'port'
    );
    const secureStr = resolveSettingValue(
      ctx.payload._secrets,
      settings,
      'smtp.secure',
      'smtpSecure',
      'secure'
    );
    const username = resolveSettingValue(
      ctx.payload._secrets,
      settings,
      'smtp.username',
      'smtp.user',
      'smtpUsername',
      'username'
    );
    const password = resolveSettingValue(
      ctx.payload._secrets,
      settings,
      'smtp.password',
      'smtp.pass',
      'smtpPassword',
      'password'
    );
    let senderName =
      resolveSettingValue(
        ctx.payload._secrets,
        settings,
        'smtp.senderName',
        'smtpSenderName',
        'senderName'
      ) || 'LeadForge OS';
    let senderEmail =
      resolveSettingValue(
        ctx.payload._secrets,
        settings,
        'smtp.senderEmail',
        'smtpSenderEmail',
        'senderEmail'
      ) || username;

    const gmailRefreshToken = ctx.payload._secrets?.['gmail.refreshToken'];

    const port = portStr ? parseInt(portStr, 10) : 465;
    const secure = secureStr !== undefined ? secureStr === 'true' : port === 465;

    let providerResolution: MailProviderResolution;

    if (gmailRefreshToken) {
      // Gmail OAuth mailbox — tokens already decrypted and injected by the scheduler.
      const gmailClientId = ctx.payload._secrets?.['gmail.clientId'] || '';
      const gmailClientSecret = ctx.payload._secrets?.['gmail.clientSecret'] || '';
      if (!gmailClientId || !gmailClientSecret) {
        throw new Error(
          'Gmail OAuth client credentials are not configured. ' +
            'Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to apps/desktop/.env.'
        );
      }

      const gmailUser = ctx.payload._secrets?.['gmail.user'] || senderEmail || username;
      providerResolution = {
        kind: 'gmail_oauth',
        gmail: {
          user: gmailUser,
          clientId: gmailClientId,
          clientSecret: gmailClientSecret,
          refreshToken: gmailRefreshToken,
          accessToken: ctx.payload._secrets?.['gmail.accessToken'] || undefined,
          tokenExpiresAt: ctx.payload._secrets?.['gmail.tokenExpiresAt'] || undefined
        }
      };

      // Prefer the OAuth mailbox email for the sender address.
      if (gmailUser && !senderEmail) senderEmail = gmailUser;

      ctx.emitLog(`Gmail OAuth mailbox resolved for sending as ${gmailUser}`, 'info');
    } else {
      // Validate required SMTP credentials
      if (!host || !username || !password) {
        throw new Error(
          'Incomplete SMTP configuration in workspace settings. ' +
            'Required keys: smtp.host, smtp.username, smtp.password. ' +
            'Cannot dispatch outreach campaign without valid SMTP credentials.'
        );
      }

      providerResolution = {
        kind: 'smtp',
        smtp: {
          host,
          port,
          secure,
          username,
          password
        }
      };

      ctx.emitLog(
        `SMTP configuration resolved: ${host}:${port} (secure=${secure}) as ${senderEmail}`,
        'info'
      );
    }

    const smtpCredentials: SmtpCredentials = {
      host: host || '',
      port,
      secure,
      username: username || '',
      password: password || '',
      senderName: senderName || 'LeadForge OS',
      senderEmail: senderEmail || username || ''
    };

    // ── 2. Load email account for rate limiting ───────────────────────────

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

    let dailyLimit = Infinity;
    let hourlyLimit = Infinity;
    let dailySent = 0;
    let hourlySent = 0;
    let accountId: string | null = null;

    if (account) {
      dailyLimit = account.dailyLimit > 0 ? account.dailyLimit : Infinity;
      hourlyLimit = account.hourlyLimit > 0 ? account.hourlyLimit : Infinity;
      dailySent = account.dailySent || 0;
      hourlySent = account.hourlySent || 0;
      accountId = account.id;
      ctx.emitLog(
        `Rate limits loaded from account ${account.email}: daily=${dailyLimit}, hourly=${hourlyLimit}`,
        'info'
      );
    } else {
      ctx.emitLog('No connected email account found. Rate limiting will not be enforced.', 'warn');
    }

    // ── 3. Load campaign ──────────────────────────────────────────────────

    const campaign = db
      .prepare(
        `SELECT id, name FROM campaigns WHERE id = ? AND workspaceId = ? AND deletedAt IS NULL`
      )
      .get(campaignId, ctx.workspaceId) as { id: string; name: string } | undefined;

    if (!campaign) {
      throw new Error(`Campaign "${campaignId}" not found or deleted in local database.`);
    }

    ctx.emitLog(`Campaign resolved: "${campaign.name}"`, 'info');

    // ── 4. Resolve email subject and body ─────────────────────────────────

    // Priority: payload.subject/body > payload.templateId lookup > templates table first match
    let subject: string = ctx.payload.subject || '';
    let body: string = ctx.payload.body || '';

    if ((!subject || !body) && ctx.payload.templateId) {
      // Try to load from templates table if templateId is provided in payload
      const tpl = db
        .prepare(
          `SELECT subject, body FROM templates WHERE id = ? AND workspaceId = ? AND deletedAt IS NULL`
        )
        .get(ctx.payload.templateId, ctx.workspaceId) as
        { subject: string; body: string } | undefined;

      if (tpl) {
        if (!subject) subject = tpl.subject;
        if (!body) body = tpl.body;
        ctx.emitLog(`Template loaded from database (id: ${ctx.payload.templateId})`, 'info');
      }
    }

    if (!subject || !body) {
      // Last resort: use first available template for this workspace
      const fallbackTpl = db
        .prepare(
          `SELECT subject, body FROM templates WHERE workspaceId = ? AND deletedAt IS NULL ORDER BY createdAt ASC LIMIT 1`
        )
        .get(ctx.workspaceId) as { subject: string; body: string } | undefined;

      if (fallbackTpl) {
        if (!subject) subject = fallbackTpl.subject;
        if (!body) body = fallbackTpl.body;
        ctx.emitLog(
          'Template subject/body resolved from first available workspace template.',
          'info'
        );
      }
    }

    if (!subject) subject = `Message from ${senderName}`;
    if (!body)
      body = `Hello {{firstName}},\n\nThis message was sent via LeadForge OS.\n\nBest regards,\n${senderName}`;

    // ── 5. Load pending contacts (excluding already-sent, unsubscribed, bounced) ──

    const contacts = db
      .prepare(
        `
      SELECT id, firstName, lastName, email, title, status
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
      `Found ${contacts.length} eligible contact(s). Starting SMTP dispatch loop...`,
      'info'
    );

    // ── 6. Restore checkpoint if resuming ─────────────────────────────────

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

    // ── 7. Build mail provider (SMTP or Gmail OAuth) ──────────────────────

    const provider: MailProvider = createMailProvider(providerResolution);

    // Verify the provider before starting the loop
    try {
      await provider.verify();
      ctx.emitLog(
        `${provider.kind === 'gmail_oauth' ? 'Gmail OAuth' : 'SMTP'} connection verified successfully.`,
        'info'
      );
    } catch (verifyErr: any) {
      provider.close();
      db.close();
      throw new Error(
        `${provider.kind === 'gmail_oauth' ? 'Gmail OAuth' : 'SMTP'} connection verification failed: ${
          verifyErr.message || verifyErr
        }`
      );
    }

    // ── 8. Dispatch loop ──────────────────────────────────────────────────

    const totalContacts = contacts.length;

    for (let i = startIndex; i < totalContacts; i++) {
      // Cancellation check
      if (ctx.isCancelled()) {
        ctx.emitLog(`Outreach cancelled at contact ${i + 1}/${totalContacts}.`, 'warn');
        break;
      }

      // Pause check — save checkpoint and exit cleanly
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
        provider.close();
        db.close();
        return { status: 'paused', dispatchedCount, failureCount, skippedCount, resumeIndex: i };
      }

      const contact = contacts[i];
      if (!contact) continue;

      // Skip if already processed in a previous run or current session
      if (processedContactIds.has(contact.id)) {
        skippedCount++;
        continue;
      }

      // Rate limit enforcement
      if (dailySent >= dailyLimit) {
        ctx.emitLog(`Daily send limit reached (${dailyLimit}). Stopping dispatch.`, 'warn');
        break;
      }
      if (hourlySent >= hourlyLimit) {
        ctx.emitLog(`Hourly send limit reached (${hourlyLimit}). Stopping dispatch.`, 'warn');
        break;
      }

      const fullName =
        `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email;
      ctx.emitLog(`Preparing email for "${fullName}" <${contact.email}>`, 'info');

      // Render template variables for this contact
      const renderedSubject = renderTemplate(subject, contact, campaign.name);
      const renderedBody = renderTemplate(body, contact, campaign.name);

      const isHtml = renderedBody.trim().startsWith('<') && /<[a-z][\s\S]*>/i.test(renderedBody);

      const executionId = randomUUID();
      const logId = randomUUID();
      let messageId = '';
      let sendSuccess = false;
      let sendError = '';

      try {
        const info = await provider.send({
          from: `"${smtpCredentials.senderName}" <${smtpCredentials.senderEmail}>`,
          to: contact.email,
          subject: renderedSubject,
          ...(isHtml ? { html: renderedBody } : { text: renderedBody })
        });

        messageId = info.messageId || '';
        sendSuccess = true;
        ctx.emitLog(`✅ Email sent to ${contact.email} (messageId: ${messageId})`, 'info');
      } catch (err: any) {
        sendError = err.message || String(err);
        sendSuccess = false;
        ctx.emitLog(`❌ Failed to send email to ${contact.email}: ${sendError}`, 'error');
      }

      // ── 9. Write sequence_execution and sequence_log atomically ──────────

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
          dailySent++;
          hourlySent++;

          // Update account counters in SQLite if account record exists
          if (accountId) {
            db.prepare(
              `
              UPDATE email_accounts
              SET dailySent = dailySent + 1, hourlySent = hourlySent + 1, updatedAt = ?
              WHERE id = ?
            `
            ).run(now, accountId);
          }
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

      // Update progress after each send
      const progress = Math.round(((i + 1) / totalContacts) * 100);
      ctx.updateProgress(progress, {
        current: i + 1,
        total: totalContacts,
        description: `Sent: ${dispatchedCount} | Failed: ${failureCount} | Skipped: ${skippedCount}`
      });

      // Autosave checkpoint every 10 contacts
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

    // ── 10. Cleanup ───────────────────────────────────────────────────────

    provider.close();

    ctx.emitLog(
      `Campaign dispatch complete — Sent: ${dispatchedCount} | Failed: ${failureCount} | Skipped: ${skippedCount}`,
      'info'
    );

    db.close();
    return { dispatchedCount, failureCount, skippedCount };
  } catch (err) {
    // Ensure DB is closed on any unhandled error
    try {
      db.close();
    } catch {
      /* ignore close error */
    }
    throw err;
  }
}
