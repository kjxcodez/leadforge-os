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
  const rows = db.prepare(`SELECT key, value FROM settings WHERE workspaceId = ?`).all(workspaceId) as { key: string; value: string }[];
  const map = new Map<string, string>();
  for (const row of rows) {
    if (row.key) map.set(row.key, row.value);
  }
  return map;
}

function resolveSettingValue(secrets: Record<string, string> | undefined, settings: Map<string, string>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    if (secrets && secrets[key] !== undefined && secrets[key] !== null && secrets[key].trim() !== '') {
      return secrets[key].trim();
    }
    const val = settings.get(key);
    if (val !== undefined && val !== null && val.trim() !== '') {
      return val.trim();
    }
  }
  return undefined;
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
    const smtpHost = resolveSettingValue(ctx.payload._secrets, settings, 'smtp.host', 'smtpHost', 'host') || '';
    const fallbackImapHost = smtpHost.toLowerCase().includes('smtp.') 
      ? smtpHost.replace(/smtp\./i, 'imap.')
      : (smtpHost ? `imap.${smtpHost}` : '');

    const host = resolveSettingValue(ctx.payload._secrets, settings, 'imap.host', 'imapHost') || fallbackImapHost;
    const portStr = resolveSettingValue(ctx.payload._secrets, settings, 'imap.port', 'imapPort');
    const secureStr = resolveSettingValue(ctx.payload._secrets, settings, 'imap.secure', 'imapSecure');
    const username = resolveSettingValue(ctx.payload._secrets, settings, 'imap.username', 'smtp.username', 'smtp.user', 'username') || '';
    const password = resolveSettingValue(ctx.payload._secrets, settings, 'imap.password', 'smtp.password', 'smtp.pass', 'password') || '';

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
        pass: password,
      },
      logger: false, // Suppress verbose imapflow library logging
    });

    await client.connect();
    ctx.emitLog('Successfully established IMAP server connection.', 'info');

    // 2. Open INBOX in Read-Only mode to parse messages safely
    const lock = await client.getMailboxLock('INBOX');
    let repliedContactsCount = 0;

    try {
      // Find all contacts currently marked as CONTACTED or NEW
      const activeContacts = db.prepare(`
        SELECT id, firstName, lastName, email, status FROM contacts
        WHERE workspaceId = ? AND status IN ('CONTACTED', 'NEW') AND deletedAt IS NULL
      `).all(ctx.workspaceId) as { id: string; firstName: string | null; lastName: string | null; email: string; status: string }[];

      if (activeContacts.length === 0) {
        ctx.emitLog('No contacts are currently in CONTACTED or NEW stage. Skipping inbox parse.', 'info');
      } else {
        ctx.emitLog(`Loaded ${activeContacts.length} active outreach contacts for reply checks.`, 'info');

        const contactEmailMap = new Map<string, typeof activeContacts[0]>();
        for (const contact of activeContacts) {
          if (contact.email) {
            contactEmailMap.set(contact.email.toLowerCase().trim(), contact);
          }
        }

        // Fetch envelopes of the last 150 messages in the INBOX
        ctx.emitLog('Fetching recent inbox message envelopes...', 'info');
        const messages = await client.fetch('1:*', { envelope: true });
        
        // Collect messages in array to process them
        const messageList: any[] = [];
        for await (const msg of messages) {
          messageList.push(msg);
        }

        // Process message list in reverse order (newest first)
        messageList.reverse();
        const limitCount = Math.min(messageList.length, 150);
        ctx.emitLog(`Scanning the ${limitCount} most recent emails in inbox.`, 'info');

        for (let i = 0; i < limitCount; i++) {
          const msg = messageList[i];
          const envelope = msg?.envelope;
          if (!envelope || !envelope.from || envelope.from.length === 0) continue;

          const senderEmail = (envelope.from[0].address || '').toLowerCase().trim();
          if (!senderEmail) continue;

          const matchingContact = contactEmailMap.get(senderEmail);
          if (matchingContact) {
            ctx.emitLog(`Found reply from contact: ${matchingContact.email} ("${envelope.subject}")`, 'info');

            // Update contact status to REPLIED
            const now = new Date().toISOString();
            db.transaction(() => {
              db.prepare(`
                UPDATE contacts
                SET status = 'REPLIED', updatedAt = ?
                WHERE id = ? AND workspaceId = ?
              `).run(now, matchingContact.id, ctx.workspaceId);

              // Log transition to sync queue
              db.prepare(`
                INSERT INTO sync_queue (id, workspaceId, entityType, entityId, operation, payload, version, retryCount, lastError, createdAt, updatedAt)
                VALUES (?, ?, 'contacts', ?, 'UPDATE', ?, 1, 0, NULL, datetime('now'), datetime('now'))
              `).run(
                randomUUID(),
                ctx.workspaceId,
                matchingContact.id,
                JSON.stringify({ id: matchingContact.id, workspaceId: ctx.workspaceId, status: 'REPLIED' })
              );

              // Add CRM activity log entry
              db.prepare(`
                INSERT INTO activities (id, workspaceId, entityType, entityId, type, description, createdAt, updatedAt)
                VALUES (?, ?, 'contact', ?, 'email_replied', ?, datetime('now'), datetime('now'))
              `).run(
                randomUUID(),
                ctx.workspaceId,
                matchingContact.id,
                `Email reply detected from ${matchingContact.email}. Subject: "${envelope.subject}". Contact status set to REPLIED.`
              );
            })();

            repliedContactsCount++;
            // Remove contact from map to prevent double-processing in the same batch
            contactEmailMap.delete(senderEmail);
          }
        }
      }
    } finally {
      lock.release();
    }

    ctx.emitLog(`IMAP poll complete. Detected and updated ${repliedContactsCount} contact reply/replies.`, 'info');
    await client.logout();
    db.close();

    return { status: 'success', repliedContactsCount };
  } catch (err: any) {
    ctx.emitLog(`IMAP Poller execution failed: ${err.message || err}`, 'error');
    if (client) {
      try { await client.logout(); } catch { /* ignore */ }
    }
    try { db.close(); } catch { /* ignore */ }
    throw err;
  }
}
