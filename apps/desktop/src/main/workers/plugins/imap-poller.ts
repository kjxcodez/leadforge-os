import Database from 'better-sqlite3';
import { ImapFlow } from 'imapflow';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { JobContext } from '../../../shared/types/job';

interface ImapCredentials {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
}

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

function getHeaderValue(headers: Buffer | undefined, headerName: string): string | null {
  if (!headers) return null;
  const text = headers.toString('utf8');
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line && line.toLowerCase().startsWith(`${headerName.toLowerCase()}:`)) {
      return line.substring(headerName.length + 1).trim();
    }
  }
  return null;
}

function extractMessageIds(text: string | null): string[] {
  if (!text) return [];
  const matches = text.match(/<[^>]+>/g);
  return matches ? matches.map((m) => m.trim()) : [];
}

/**
 * IMAP Inbox Poller Worker Plugin.
 * Connects to the workspace's configured IMAP server, polls the inbox for recent
 * incoming emails, and transitions any matching contacts to the 'REPLIED' stage.
 */
export async function pollImapReplies(ctx: JobContext): Promise<any> {
  ctx.emitLog('Initializing background IMAP reply poller.', 'info');

  const dbDir = process.env.WORKSPACES_DB_DIR || '';
  if (!dbDir) {
    throw new Error('WORKSPACES_DB_DIR env variable is required for background workers.');
  }

  const dbPath = join(dbDir, `leadforge_${ctx.workspaceId}.db`);
  const db = new Database(dbPath);

  let client: ImapFlow | null = null;

  try {
    const settings = loadSettings(db, ctx.workspaceId);

    // 1. Resolve IMAP configurations (with smart SMTP fallbacks)
    const smtpHost =
      resolveSettingValue(ctx.payload._secrets, settings, 'smtp.host', 'smtpHost', 'host') || '';
    const fallbackImapHost = smtpHost.toLowerCase().includes('smtp.')
      ? smtpHost.replace(/smtp\./i, 'imap.')
      : smtpHost
        ? `imap.${smtpHost}`
        : '';

    const host =
      resolveSettingValue(ctx.payload._secrets, settings, 'imap.host', 'imapHost') ||
      fallbackImapHost;
    const portStr = resolveSettingValue(ctx.payload._secrets, settings, 'imap.port', 'imapPort');
    const secureStr = resolveSettingValue(
      ctx.payload._secrets,
      settings,
      'imap.secure',
      'imapSecure'
    );
    const username =
      resolveSettingValue(
        ctx.payload._secrets,
        settings,
        'imap.username',
        'smtp.username',
        'smtp.user',
        'username'
      ) || '';
    const password =
      resolveSettingValue(
        ctx.payload._secrets,
        settings,
        'imap.password',
        'smtp.password',
        'smtp.pass',
        'password'
      ) || '';

    if (!host || !username || !password) {
      ctx.emitLog('IMAP connection skipped: Incomplete credentials configuration.', 'warn');
      db.close();
      return { status: 'skipped', reason: 'incomplete_credentials' };
    }

    const port = portStr ? parseInt(portStr, 10) : 993;
    const secure = secureStr !== undefined ? secureStr === 'true' : true;

    ctx.emitLog(`Connecting to IMAP server: ${host}:${port} (secure=${secure})`, 'info');

    client = new ImapFlow({
      host,
      port,
      secure,
      auth: {
        user: username,
        pass: password
      },
      logger: false // Suppress verbose imapflow library logging
    });

    await client.connect();
    ctx.emitLog('Successfully established IMAP server connection.', 'info');

    // 2. Open INBOX in Read-Only mode to parse messages safely
    const lock = await client.getMailboxLock('INBOX');
    let repliedContactsCount = 0;

    try {
      // Load active sequence executions to trace startedAt and sentMessageIds
      const activeExecutions = db
        .prepare(
          `
        SELECT se.id as executionId, se.startedAt, se.sentMessageIds, c.id as contactId, c.email
        FROM sequence_executions se
        JOIN contacts c ON se.contactId = c.id
        WHERE se.workspaceId = ? AND se.status IN ('running', 'waiting', 'queued') AND se.deletedAt IS NULL
          AND c.status IN ('CONTACTED', 'NEW') AND c.deletedAt IS NULL
      `
        )
        .all(ctx.workspaceId) as {
        executionId: string;
        startedAt: string | null;
        sentMessageIds: string | null;
        contactId: string;
        email: string;
      }[];

      if (activeExecutions.length === 0) {
        ctx.emitLog('No active outreach executions. Skipping inbox parse.', 'info');
      } else {
        ctx.emitLog(
          `Loaded ${activeExecutions.length} active executions for reply checks.`,
          'info'
        );

        // Fetch envelopes and headers of the last 150 messages in the INBOX
        ctx.emitLog('Fetching recent inbox message envelopes and headers...', 'info');
        const messages = await client.fetch('1:*', {
          envelope: true,
          headers: ['in-reply-to', 'references']
        });

        // Collect messages in array to process them
        const messageList: any[] = [];
        for await (const msg of messages) {
          messageList.push(msg);
        }

        // Process message list in reverse order (newest first)
        messageList.reverse();
        const limitCount = Math.min(messageList.length, 150);
        ctx.emitLog(`Scanning the ${limitCount} most recent emails in inbox.`, 'info');

        const matchedExecutionIds = new Set<string>();

        for (let i = 0; i < limitCount; i++) {
          const msg = messageList[i];
          const envelope = msg?.envelope;
          if (!envelope || !envelope.from || envelope.from.length === 0) continue;

          const senderEmail = (envelope.from[0].address || '').toLowerCase().trim();
          if (!senderEmail) continue;

          // Extract Message-ID headers for precise correlation (Priority 1 & 2)
          const inReplyToVal = envelope.inReplyTo || getHeaderValue(msg.headers, 'in-reply-to');
          const inReplyToIds = extractMessageIds(inReplyToVal);
          const referencesVal = getHeaderValue(msg.headers, 'references');
          const referencesIds = extractMessageIds(referencesVal);

          const allThreadRelMsgIds = new Set([...inReplyToIds, ...referencesIds]);

          // Attempt to correlate
          let correlatedExec: (typeof activeExecutions)[0] | undefined = undefined;

          // 1. Try correlating via In-Reply-To and References (Priorities 1 & 2)
          if (allThreadRelMsgIds.size > 0) {
            correlatedExec = activeExecutions.find((exec) => {
              if (!exec.sentMessageIds) return false;
              try {
                const sentIds = JSON.parse(exec.sentMessageIds) as string[];
                return Array.isArray(sentIds) && sentIds.some((sid) => allThreadRelMsgIds.has(sid));
              } catch {
                return false;
              }
            });
          }

          // 2. Try correlating via Sender Email + Date Fallback (Priority 4)
          if (!correlatedExec) {
            // Find active executions for this sender email
            const emailMatches = activeExecutions.filter(
              (exec) => exec.email.toLowerCase().trim() === senderEmail
            );
            if (emailMatches.length > 0) {
              // Assert date is greater than or equal to start date to filter out historical emails
              const msgDate = envelope.date ? new Date(envelope.date) : null;
              for (const match of emailMatches) {
                const startDate = match.startedAt ? new Date(match.startedAt) : null;
                if (msgDate && startDate && msgDate >= startDate) {
                  correlatedExec = match;
                  break;
                }
              }
            }
          }

          if (correlatedExec && !matchedExecutionIds.has(correlatedExec.executionId)) {
            ctx.emitLog(
              `Correlated reply from contact: ${correlatedExec.email} to execution: ${correlatedExec.executionId} (Subject: "${envelope.subject}")`,
              'info'
            );

            matchedExecutionIds.add(correlatedExec.executionId);
            const execId = correlatedExec.executionId;
            const contactId = correlatedExec.contactId;

            // Update contact status to REPLIED
            const now = new Date().toISOString();
            db.transaction(() => {
              db.prepare(
                `
                UPDATE contacts
                SET status = 'REPLIED', updatedAt = ?
                WHERE id = ? AND workspaceId = ?
              `
              ).run(now, contactId, ctx.workspaceId);

              // Update execution status to completed (spec: STOP Outreach)
              db.prepare(
                `
                UPDATE sequence_executions
                SET status = 'completed', replies = replies + 1, updatedAt = ?
                WHERE id = ?
              `
              ).run(now, execId);

              // Log transition to sync queue
              db.prepare(
                `
                INSERT INTO sync_queue (id, workspaceId, entityType, entityId, operation, payload, version, retryCount, lastError, createdAt, updatedAt)
                VALUES (?, ?, 'contacts', ?, 'UPDATE', ?, 1, 0, NULL, datetime('now'), datetime('now'))
              `
              ).run(
                randomUUID(),
                ctx.workspaceId,
                contactId,
                JSON.stringify({ id: contactId, workspaceId: ctx.workspaceId, status: 'REPLIED' })
              );

              // Add CRM activity log entry
              db.prepare(
                `
                INSERT INTO activities (id, workspaceId, entityType, entityId, type, description, createdAt, updatedAt)
                VALUES (?, ?, 'contact', ?, 'email_replied', ?, datetime('now'), datetime('now'))
              `
              ).run(
                randomUUID(),
                ctx.workspaceId,
                contactId,
                `Email reply detected from ${correlatedExec.email}. Subject: "${envelope.subject}". Contact status set to REPLIED.`
              );
            })();

            repliedContactsCount++;
          }
        }
      }
    } finally {
      lock.release();
    }

    ctx.emitLog(
      `IMAP poll complete. Detected and updated ${repliedContactsCount} contact reply/replies.`,
      'info'
    );
    await client.logout();
    db.close();

    return { status: 'success', repliedContactsCount };
  } catch (err: any) {
    ctx.emitLog(`IMAP Poller execution failed: ${err.message || err}`, 'error');
    if (client) {
      try {
        await client.logout();
      } catch {
        /* ignore */
      }
    }
    try {
      db.close();
    } catch {
      /* ignore */
    }
    throw err;
  }
}
