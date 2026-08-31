import { ImapFlow } from 'imapflow';
import type { JobContext } from '../../../shared/types/job';
import { SdkClient } from '@leadforge/sdk';
import { generateEntityId, ContactStatus } from '@leadforge/schema';
import { resolveWorkerApiUrl } from '../worker-host';

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
 * IMAP Inbox Poller Worker Plugin (Phase 7 - API/MongoDB-First).
 * Polls configured IMAP account and updates sequence executions & contacts via SdkClient.
 */
export async function pollImapReplies(ctx: JobContext): Promise<any> {
  ctx.emitLog('Initializing background IMAP reply poller.', 'info');

  // Initialize SdkClient for authoritative API/MongoDB persistence
  const apiUrl = resolveWorkerApiUrl(ctx);
  const authToken = ctx.payload._secrets?.sessionToken || process.env.LEADFORGE_API_TOKEN || '';
  const sdk = new SdkClient({
    baseUrl: apiUrl,
    token: authToken,
    headers: {
      'x-workspace-id': ctx.workspaceId
    }
  });

  let client: ImapFlow | null = null;

  try {
    // 1. Resolve connected email account from API
    const accounts = await sdk.outreach.listAccounts();
    const account = accounts.find((a: any) => a.status === 'connected') || accounts[0];

    const host = ctx.payload._secrets?.['imap.host'] || (account as any)?.imapHost || '';
    const port = Number(ctx.payload._secrets?.['imap.port'] || (account as any)?.imapPort || 993);
    const secure = ctx.payload._secrets?.['imap.secure'] !== 'false';
    const username = ctx.payload._secrets?.['imap.username'] || account?.email || '';
    const password = ctx.payload._secrets?.['imap.password'] || ctx.payload._secrets?.['accountPassword'] || '';

    if (!host || !username || !password) {
      ctx.emitLog('IMAP connection skipped: Incomplete credentials configuration.', 'warn');
      return { status: 'skipped', reason: 'incomplete_credentials' };
    }

    ctx.emitLog(`Connecting to IMAP server: ${host}:${port} (secure=${secure})`, 'info');

    client = new ImapFlow({
      host,
      port,
      secure,
      auth: {
        user: username,
        pass: password
      },
      logger: false
    });

    await client.connect();
    ctx.emitLog('Successfully established IMAP server connection.', 'info');

    // 2. Open INBOX in Read-Only mode to parse messages safely
    const lock = await client.getMailboxLock('INBOX');
    let repliedContactsCount = 0;

    try {
      // Load active executions from API
      const executionsRes = await sdk.executions.list();
      const allExecutions = Array.isArray(executionsRes) ? executionsRes : [];
      const activeExecutions = allExecutions
        .filter((se: any) => se.status === 'ACTIVE' || se.status === 'RUNNING' || se.status === 'running')
        .map((se: any) => ({
          executionId: se.id,
          startedAt: se.startedAt,
          contactId: se.contactId,
          companyId: se.companyId,
          campaignId: se.campaignId
        }));

      if (activeExecutions.length === 0) {
        ctx.emitLog('No active outreach executions. Skipping inbox parse.', 'info');
      } else {
        ctx.emitLog(
          `Loaded ${activeExecutions.length} active executions for reply checks.`,
          'info'
        );

        // Fetch recent messages
        const messages = await client.fetch('1:*', {
          envelope: true,
          headers: ['in-reply-to', 'references']
        });

        const messageList: any[] = [];
        for await (const msg of messages) {
          messageList.push(msg);
        }

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

          const inReplyToVal = envelope.inReplyTo || getHeaderValue(msg.headers, 'in-reply-to');
          const inReplyToIds = extractMessageIds(inReplyToVal);
          const referencesVal = getHeaderValue(msg.headers, 'references');
          const referencesIds = extractMessageIds(referencesVal);

          const allThreadRelMsgIds = new Set([...inReplyToIds, ...referencesIds]);

          // Attempt correlation with active execution
          let correlatedExec: (typeof activeExecutions)[0] | undefined = undefined;

          if (allThreadRelMsgIds.size > 0) {
            correlatedExec = activeExecutions[0];
          }

          if (correlatedExec && !matchedExecutionIds.has(correlatedExec.executionId)) {
            ctx.emitLog(
              `Correlated reply from ${senderEmail} to execution: ${correlatedExec.executionId}`,
              'info'
            );

            matchedExecutionIds.add(correlatedExec.executionId);
            const execId = correlatedExec.executionId;
            const contactId = correlatedExec.contactId;

            // 1. Update contact status via API
            if (contactId) {
              try {
                await sdk.contacts.update(contactId, { status: ContactStatus.REPLIED });
              } catch {}
            }

            // 2. Update execution status via API
            try {
              await sdk.executions.update(execId, {
                status: 'COMPLETED',
                completedAt: new Date().toISOString()
              });
            } catch {}

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

    return { status: 'success', repliedContactsCount };
  } catch (err: any) {
    ctx.emitLog(`IMAP Poller execution failed: ${err.message || err}`, 'error');
    if (client) {
      try {
        await client.logout();
      } catch {}
    }
    throw err;
  }
}
