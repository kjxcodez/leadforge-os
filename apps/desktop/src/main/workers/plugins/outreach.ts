import type { JobContext } from '../../../shared/types/job';
import { SdkClient, renderCanonicalVariables, formatEmailBody, type CanonicalVariableContext } from '@leadforge/sdk';
import { generateEntityId } from '@leadforge/schema';
import { resolveWorkerApiUrl } from '../worker-host';

interface ContactRecord {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  title: string | null;
  status: string | null;
  companyId: string | null;
}

interface OutreachCheckpoint {
  processedContactIds: string[];
  dispatchedCount: number;
  failureCount: number;
  skippedCount: number;
  currentIndex: number;
}

/**
 * Outreach Campaign Dispatcher Job Plugin (Phase 7 - API/MongoDB-First).
 * Dispatches outreach emails through the API-owned EmailService via SdkClient.
 */
export async function dispatchOutreach(ctx: JobContext): Promise<any> {
  const campaignId: string = ctx.payload.campaignId || '';
  if (!campaignId) {
    throw new Error('Missing required payload field: campaignId.');
  }

  ctx.emitLog(`Initializing API-owned outreach dispatcher for Campaign: ${campaignId}`, 'info');

  // Initialize SDK client for API communication
  const apiUrl = resolveWorkerApiUrl(ctx);
  const authToken = ctx.payload._secrets?.sessionToken || process.env.LEADFORGE_API_TOKEN || '';
  const sdk = new SdkClient({
    baseUrl: apiUrl,
    token: authToken,
    headers: {
      'x-workspace-id': ctx.workspaceId
    }
  });

  // 1. Load email account from API
  const accounts = await sdk.outreach.listAccounts();
  const account = accounts.find((a: any) => a.status === 'connected') || accounts[0];

  if (!account) {
    throw new Error('No connected email account found in workspace. Please connect an email account in Settings → Email Accounts.');
  }

  const accountId = account.id;
  ctx.emitLog(`Using email account ${account.email} (id: ${accountId}) for outreach`, 'info');

  // 2. Load campaign from API
  let campaign: any = null;
  try {
    campaign = await sdk.campaigns.get(campaignId);
  } catch {
    campaign = { id: campaignId, name: `Campaign ${campaignId}` };
  }

  ctx.emitLog(`Campaign resolved: "${campaign.name}"`, 'info');

  // 3. Resolve email subject, body, and attachments
  let subject: string = ctx.payload.subject || '';
  let body: string = ctx.payload.body || '';
  let rawAttachments: any[] = ctx.payload.attachments || [];

  if (ctx.payload.templateId) {
    try {
      const templates = await sdk.outreach.listTemplates();
      const tpl = templates.find((t: any) => t.id === ctx.payload.templateId);
      if (tpl) {
        if (!subject) subject = tpl.subject;
        if (!body) body = tpl.body;
        if (!rawAttachments || rawAttachments.length === 0) {
          rawAttachments = Array.isArray(tpl.attachments)
            ? tpl.attachments
            : typeof tpl.attachments === 'string'
            ? JSON.parse(tpl.attachments)
            : [];
        }
      }
    } catch {}
  }

  if (!subject) subject = `Message from ${account.name || 'LeadForge'}`;
  if (!body) {
    body = `Hello {{firstName}},\n\nThis message was sent via LeadForge OS.\n\nBest regards,\n${account.name || 'LeadForge'}`;
  }

  // Process attachments
  const processedAttachments: any[] = [];
  if (Array.isArray(rawAttachments) && rawAttachments.length > 0) {
    const fs = await import('fs');
    for (const att of rawAttachments) {
      const filePath = att.storagePath || att.path;
      let contentBase64 = att.contentBase64 || '';
      if (!contentBase64 && filePath && fs.existsSync(filePath)) {
        contentBase64 = fs.readFileSync(filePath).toString('base64');
      }
      processedAttachments.push({
        id: att.id,
        fileId: att.fileId,
        driveUrl: att.driveUrl,
        googleConnectionId: att.googleConnectionId,
        provider: att.provider || 'google-drive',
        filename: att.filename || 'attachment',
        contentBase64,
        contentType: att.contentType || att.mimeType,
        size: att.size
      });
    }
  }

  // 4. Load eligible contacts from API or Campaign Audience
  let targetContactIds: Set<string> | null = null;
  if (campaign.audienceId) {
    try {
      ctx.emitLog(`Resolving audience membership for audience "${campaign.audienceId}"...`, 'info');
      const resolved = await sdk.audiences.resolve(campaign.audienceId);
      if (resolved && Array.isArray(resolved.contactIds)) {
        targetContactIds = new Set(resolved.contactIds);
        ctx.emitLog(`Audience resolved ${targetContactIds.size} eligible contact ID(s).`, 'info');
      }
    } catch (audErr) {
      ctx.emitLog(`Failed to resolve audience "${campaign.audienceId}": ${audErr}`, 'warn');
    }
  }

  const contactsRes = await sdk.contacts.list({});
  const rawContacts = Array.isArray(contactsRes) ? contactsRes : [];
  const contacts: ContactRecord[] = rawContacts
    .filter((c: any) => c.email && !['unsubscribed', 'bounced', 'do_not_contact'].includes(c.status))
    .filter((c: any) => !targetContactIds || targetContactIds.has(c.id))
    .map((c: any) => ({
      id: c.id,
      firstName: c.firstName || null,
      lastName: c.lastName || null,
      email: c.email,
      title: c.title || null,
      status: c.status || null,
      companyId: c.companyId || null
    }));

  if (contacts.length === 0) {
    ctx.emitLog(
      'No eligible contacts found for this campaign. All contacts have already been contacted, none match audience filter, or none exist.',
      'info'
    );
    return { dispatchedCount: 0, failureCount: 0, skippedCount: 0 };
  }

  ctx.emitLog(
    `Found ${contacts.length} eligible contact(s). Starting API email dispatch loop...`,
    'info'
  );

  // 5. Restore checkpoint if resuming
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

  // 6. Dispatch loop
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
      return { status: 'paused', dispatchedCount, failureCount, skippedCount, resumeIndex: i };
    }

    const contact = contacts[i];
    if (!contact) continue;

    if (processedContactIds.has(contact.id)) {
      skippedCount++;
      continue;
    }

    const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email;
    ctx.emitLog(`Preparing email for "${fullName}" <${contact.email}>`, 'info');

    let companyRow: any = null;
    if (contact.companyId) {
      try {
        companyRow = await sdk.companies.get(contact.companyId);
      } catch {}
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
            location: companyRow.location || companyRow.address || '',
            website: companyRow.website
          }
        : null,
      sender: {
        name: account.name || 'LeadForge',
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
    const formattedBody = formatEmailBody(renderedBody);

    const runIdentifier = ctx.jobId || (ctx.payload as any).executionId || 'run';
    const idempotencyKey = `campaign_${campaignId}_${runIdentifier}_${contact.id}_step0`;
    let messageId = '';
    let sendSuccess = false;
    let sendError = '';

    try {
      const res = await sdk.outreach.sendEmail({
        accountId,
        to: contact.email,
        subject: renderedSubject,
        text: formattedBody.text,
        html: formattedBody.html,
        useSignature: campaign.settings?.useSignature !== false,
        attachments: processedAttachments,
        idempotencyKey,
        campaignId,
        sequenceId: 'campaign-' + campaignId,
        executionId: 'exec-' + campaignId,
        stepIndex: 0,
        contactId: contact.id
      });

      messageId = res.messageId || '';
      sendSuccess = true;
      dispatchedCount++;
      ctx.emitLog(`✅ Email sent via API to ${contact.email} (messageId: ${messageId})`, 'info', {
        messageId,
        recipient: contact.email,
        subject: renderedSubject,
        campaignId,
        attachmentsCount: processedAttachments.length
      });
    } catch (err: any) {
      sendError = err.message || String(err);
      sendSuccess = false;
      failureCount++;
      ctx.emitLog(`❌ Failed to send email to ${contact.email}: ${sendError}`, 'error', {
        error: sendError,
        recipient: contact.email,
        subject: renderedSubject,
        campaignId
      });

      // Provider backoff if rate limited
      if (sendError.includes('RATE_LIMITED') || sendError.includes('rate limit') || sendError.includes('429')) {
        ctx.emitLog(`Provider rate limit reached. Backing off for 10 seconds before next send...`, 'warn');
        const rateLimitWaitStart = Date.now();
        while (Date.now() - rateLimitWaitStart < 10000) {
          if (ctx.isCancelled()) break;
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }

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

    // Steady pacing between consecutive sends with bounded jitter
    if (i < totalContacts - 1 && !ctx.isCancelled()) {
      const baseIntervalMs = typeof (campaign as any).settings?.sendIntervalSeconds === 'number'
        ? (campaign as any).settings.sendIntervalSeconds * 1000
        : 1500;
      const jitterMs = Math.floor(Math.random() * 600) - 300; // +/- 300ms jitter
      const sleepDuration = Math.max(800, baseIntervalMs + jitterMs);

      const startTime = Date.now();
      while (Date.now() - startTime < sleepDuration) {
        if (ctx.isCancelled()) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }

  ctx.emitLog(
    `Campaign dispatch complete — Sent: ${dispatchedCount} | Failed: ${failureCount} | Skipped: ${skippedCount}`,
    'info'
  );

  // False success protection: if all attempted sends failed, fail the job explicitly
  if (dispatchedCount === 0 && failureCount > 0) {
    const fatalMsg = `Campaign outreach failed: 0/${failureCount} emails were accepted by the provider.`;
    ctx.emitLog(`❌ ${fatalMsg}`, 'error');
    throw new Error(fatalMsg);
  }

  return { dispatchedCount, failureCount, skippedCount };
}
