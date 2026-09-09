import { EmailAccountModel } from '../../db/models/email-account.model.js';
import { UserTestRecipientModel } from '../../db/models/user-test-recipient.model.js';
import { CampaignModel } from '../../db/models/campaign.model.js';
import { ContactModel } from '../../db/models/contact.model.js';
import { EmailDeliveryModel } from '../../db/models/email-delivery.model.js';
import { EmailDeliveryRepository } from '../../repositories/email-delivery/email-delivery.repository.js';
import { EmailAccountRepository } from '../../repositories/email-account/email-account.repository.js';
import {
  plainTextToHtml,
  wrapHtmlWithDefaultTypography,
  normalizeEmailSignature,
  sanitizeSubject,
  htmlToPlainText,
  computeMessageFingerprint,
  computeAttachmentChecksums
} from '@leadforge/sdk';
import {
  ContactStatus,
  ContactEmailStatus,
  EmailFailureCategory,
  BounceCategory,
  SuppressionReason,
  classifyBounce,
  evaluateOutreachEligibility,
  generateTrackingToken,
  injectOpenTrackingPixel,
  rewriteLinksForClickTracking
} from '@leadforge/schema';
import {
  EmailDomainError,
  type SendEmailInput,
  type SendEmailResult
} from './types.js';
import { EmailAccountService } from './email-account.service.js';
import { SuppressionRepository } from '../../repositories/suppression/suppression.repository.js';
import { logger } from '../../config/index.js';
import crypto from 'crypto';

export function classifyEmailFailure(err: any): {
  code: string;
  category: EmailFailureCategory;
  safeHumanMessage: string;
  technicalMessage: string;
  retryable: boolean;
  ambiguous: boolean;
  bounceCategory?: BounceCategory;
  isHardBounce?: boolean;
} {
  const code = err?.code || err?.name || 'EMAIL_SEND_FAILED';
  const msg = err?.message || String(err);
  const lowerMsg = msg.toLowerCase();

  // 1. Ambiguous Delivery / Network Timeout during send
  if (err?.code === 'AMBIGUOUS_SEND_TIMEOUT' || lowerMsg.includes('ambiguous_send_timeout')) {
    return {
      code,
      category: EmailFailureCategory.AMBIGUOUS,
      safeHumanMessage: 'Network connection timed out during send. Provider status is ambiguous.',
      technicalMessage: msg,
      retryable: false,
      ambiguous: true
    };
  }

  // 2. Permanent Authentication & Credential Revocation (Sender OAuth)
  if (
    err?.reauthRequired ||
    code === 'MAILBOX_REAUTH_REQUIRED' ||
    code === 'GMAIL_AUTH_REVOKED' ||
    code === 'UNAUTHORIZED' ||
    lowerMsg.includes('invalid_grant') ||
    lowerMsg.includes('invalid_client') ||
    lowerMsg.includes('revoked') ||
    lowerMsg.includes('token expired') ||
    lowerMsg.includes('insufficient_scope')
  ) {
    return {
      code,
      category: EmailFailureCategory.AUTH,
      safeHumanMessage: 'Gmail connection expired or was revoked. Please reconnect the mailbox in Settings.',
      technicalMessage: msg,
      retryable: false,
      ambiguous: false
    };
  }

  // 3. Rate Limits & Quota Exhaustion (429 Cooldown Path)
  if (
    code === 'PROVIDER_RATE_LIMITED' ||
    code === 'SENDER_RATE_LIMITED' ||
    code === 'EMAIL_RATE_LIMITED' ||
    err?.isRateLimit ||
    lowerMsg.includes('429') ||
    lowerMsg.includes('ratelimitexceeded') ||
    lowerMsg.includes('quotaexceeded') ||
    lowerMsg.includes('user-rate limit exceeded')
  ) {
    return {
      code,
      category: EmailFailureCategory.RATE_LIMIT,
      safeHumanMessage: 'Gmail sending rate limit reached. Outgoing message paused until cooldown expires.',
      technicalMessage: msg,
      retryable: true,
      ambiguous: false
    };
  }

  // 4. Outreach Policy & Safety Gates (Internal LeadForge policy)
  if (code === 'CAMPAIGN_NOT_ACTIVE' || code === 'CONTACT_NOT_ELIGIBLE') {
    return {
      code,
      category: EmailFailureCategory.POLICY,
      safeHumanMessage: 'Outreach policy prevented send: campaign is not active or contact is ineligible.',
      technicalMessage: msg,
      retryable: false,
      ambiguous: false
    };
  }

  // 5. Invalid Subject
  if (code === 'INVALID_SUBJECT') {
    return {
      code,
      category: EmailFailureCategory.INVALID_RECIPIENT,
      safeHumanMessage: 'Email subject was rejected as invalid (must not contain newlines or be empty).',
      technicalMessage: msg,
      retryable: false,
      ambiguous: false,
      isHardBounce: false
    };
  }

  // 6. Internal / Attachment Handling Failures
  if (typeof code === 'string' && (code.startsWith('ATTACHMENT_') || code.startsWith('DRIVE_'))) {
    return {
      code,
      category: EmailFailureCategory.INTERNAL,
      safeHumanMessage: `Attachment handling failed: ${msg}`,
      technicalMessage: msg,
      retryable: err?.retryable || false,
      ambiguous: false
    };
  }

  // 7. Transient Network Failures (Connection glitches to provider API)
  if (
    code === 'TRANSIENT_NETWORK_ERROR' ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND' ||
    code === 'EAI_AGAIN' ||
    code === 'ECONNREFUSED' ||
    lowerMsg.includes('econnreset') ||
    lowerMsg.includes('etimedout') ||
    lowerMsg.includes('enotfound') ||
    lowerMsg.includes('fetch failed') ||
    lowerMsg.includes('network error')
  ) {
    return {
      code,
      category: EmailFailureCategory.NETWORK,
      safeHumanMessage: 'Temporary network communication failure with email provider.',
      technicalMessage: msg,
      retryable: true,
      ambiguous: false
    };
  }

  // 8. Delegate to Canonical Bounce & Rejection Classifier
  const bounce = classifyBounce({ code, message: msg });
  if (bounce && bounce.category !== BounceCategory.UNKNOWN) {
    let category = EmailFailureCategory.PROVIDER;
    let retryable = !bounce.isPermanent;

    switch (bounce.category) {
      case BounceCategory.SPAM_REJECTION:
      case BounceCategory.POLICY_REJECTION:
      case BounceCategory.AUTHENTICATION_REJECTION:
        category = EmailFailureCategory.POLICY;
        retryable = false;
        break;

      case BounceCategory.MAILBOX_UNAVAILABLE:
      case BounceCategory.DOMAIN_UNAVAILABLE:
      case BounceCategory.HARD_BOUNCE:
        category = EmailFailureCategory.INVALID_RECIPIENT;
        retryable = false;
        break;

      case BounceCategory.RATE_LIMIT:
        category = EmailFailureCategory.RATE_LIMIT;
        retryable = true;
        break;

      case BounceCategory.SOFT_BOUNCE:
        category = EmailFailureCategory.PROVIDER;
        retryable = true;
        break;

      default:
        category = EmailFailureCategory.PROVIDER;
        retryable = Boolean(err?.retryable);
        break;
    }

    return {
      code: bounce.enhancedStatusCode || (bounce.statusCode ? String(bounce.statusCode) : code),
      category,
      safeHumanMessage: bounce.safeDescription || 'Email provider failed to dispatch outbound message.',
      technicalMessage: msg,
      retryable,
      ambiguous: false,
      bounceCategory: bounce.category,
      isHardBounce: bounce.isHardBounce
    };
  }

  // 9. Specific legacy address-level indicators not caught by numeric status codes
  if (
    code === 'INVALID_RECIPIENT' ||
    code === 'RECIPIENT_SUPPRESSED' ||
    lowerMsg.includes('address not found') ||
    lowerMsg.includes('recipient address was rejected')
  ) {
    return {
      code,
      category: EmailFailureCategory.INVALID_RECIPIENT,
      safeHumanMessage: 'Recipient address was rejected by provider as invalid or unroutable.',
      technicalMessage: msg,
      retryable: false,
      ambiguous: false,
      bounceCategory: BounceCategory.MAILBOX_UNAVAILABLE,
      isHardBounce: true
    };
  }

  // 10. Default unclassified provider failure
  return {
    code,
    category: EmailFailureCategory.PROVIDER,
    safeHumanMessage: 'Email provider failed to dispatch outbound message.',
    technicalMessage: msg,
    retryable: Boolean(err?.retryable),
    ambiguous: false,
    bounceCategory: BounceCategory.UNKNOWN,
    isHardBounce: false
  };
}

/**
 * EmailService owns email operations (send / sendTest / verify) on top of the
 * GmailProvider abstraction and authoritative EmailDelivery ledger in MongoDB.
 */
export class EmailService {
  private readonly accounts: EmailAccountService;
  private readonly deliveryRepo: EmailDeliveryRepository;
  private readonly accountRepo: EmailAccountRepository;

  constructor(
    private readonly workspaceId: string,
    private readonly userId?: string
  ) {
    this.accounts = new EmailAccountService(workspaceId);
    this.deliveryRepo = new EmailDeliveryRepository(workspaceId);
    this.accountRepo = new EmailAccountRepository(workspaceId);
  }

  static async getGlobalTestRecipients(userId: string): Promise<Array<{ email: string; firstUsedAt: Date; lastUsedAt: Date }>> {
    if (!userId) return [];
    const docs = await UserTestRecipientModel.find({ userId }).sort({ lastUsedAt: -1 }).limit(3);
    return docs.map((d) => ({
      email: d.email,
      firstUsedAt: d.firstUsedAt,
      lastUsedAt: d.lastUsedAt
    }));
  }

  /**
   * Generates a deterministic idempotency key for outbound sends if not explicitly supplied.
   */
  private generateDeterministicIdempotencyKey(input: SendEmailInput): string {
    if (input.idempotencyKey) return input.idempotencyKey;
    const executionPart = input.executionId || `send_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;
    const stepPart = input.stepIndex !== undefined ? `_step${input.stepIndex}` : '';
    const hash = crypto
      .createHash('sha256')
      .update(`${this.workspaceId}:${input.accountId}:${input.to.toLowerCase().trim()}:${input.subject.trim()}`)
      .digest('hex')
      .substring(0, 16);
    return `${executionPart}${stepPart}_${input.accountId}_${hash}`;
  }

  /**
   * Authoritative outbound send pipeline with atomic delivery reservation, Drive resolution,
   * rate limit enforcement, and ambiguous-send protection.
   */
  async send(input: SendEmailInput): Promise<SendEmailResult> {
    // 0. Pre-flight subject validation: do not allow empty subjects or CRLF injection
    if (input.subject && /[\r\n]/.test(input.subject)) {
      throw new EmailDomainError(
        'INVALID_SUBJECT',
        'Email subject is invalid: must not contain newline or carriage return characters.'
      );
    }
    const subjRes = sanitizeSubject(input.subject);
    if (!subjRes.isValid) {
      throw new EmailDomainError(
        'INVALID_SUBJECT',
        `Email subject is invalid: ${subjRes.error || 'must not be empty.'}.`
      );
    }
    input.subject = subjRes.sanitized;

    // 0a. Deterministic fallback plaintext body if only HTML was provided
    if (!input.text && input.html) {
      input.text = htmlToPlainText(input.html);
    }

    const account = await EmailAccountModel.findOne({
      _id: input.accountId,
      workspaceId: this.workspaceId
    } as any);

    if (!account) {
      throw new EmailDomainError('MAILBOX_NOT_FOUND', 'Email Account not found.');
    }

    if (account.status === 'reauth_required') {
      throw new EmailDomainError(
        'MAILBOX_REAUTH_REQUIRED',
        'Mailbox requires re-authentication. Reconnect your Gmail profile in settings.',
        true
      );
    }

    if (account.status === 'disconnected' || account.status === 'unsupported') {
      throw new EmailDomainError(
        'MAILBOX_NOT_SUPPORTED',
        `Mailbox "${account.email}" is in status "${account.status}". Only active Gmail accounts are supported.`
      );
    }

    // 0b. Pre-flight recipient validation: do not burn quota or reserve slots on malformed recipients!
    const { validateEmailStrict } = await import('@leadforge/schema');
    if (!validateEmailStrict(input.to)) {
      throw new EmailDomainError(
        'INVALID_RECIPIENT',
        `Invalid recipient email address: "${input.to}". Must be a valid RFC 5321 email.`
      );
    }

    // 0a. Pre-flight suppression check: block if recipient is suppressed in workspace (even for direct sends)
    const suppressionRepo = new SuppressionRepository(this.workspaceId);
    const isSuppressed = await suppressionRepo.isSuppressed(input.to);
    if (isSuppressed) {
      throw new EmailDomainError(
        'RECIPIENT_SUPPRESSED',
        `Recipient "${input.to}" is suppressed in this workspace and cannot receive outreach.`
      );
    }

    // 0a. Server-authoritative campaign send authorization check
    let campaignDoc: any = null;
    if (input.campaignId) {
      campaignDoc = await CampaignModel.findOne({ _id: input.campaignId, workspaceId: this.workspaceId });
      if (campaignDoc && campaignDoc.status !== 'ACTIVE') {
        throw new EmailDomainError(
          'CAMPAIGN_NOT_ACTIVE',
          `Campaign "${input.campaignId}" is in status "${campaignDoc.status}". Sending is not authorized.`
        );
      }
    }

    // 0b. Server-authoritative contact outreach eligibility check
    const normRecipient = input.to.toLowerCase().trim();
    let contactDoc: any = null;
    if (input.contactId && input.contactId !== 'direct-contact') {
      contactDoc = await ContactModel.findOne({ _id: input.contactId, workspaceId: this.workspaceId });
    } else {
      // Direct send fallback: lookup contact by recipient address (primary or additional)
      contactDoc = await ContactModel.findOne({
        workspaceId: this.workspaceId,
        $or: [{ email: normRecipient }, { 'additionalEmails.email': normRecipient }],
        deletedAt: null
      });
      if (contactDoc) {
        input.contactId = contactDoc._id.toString();
      }
    }

    if (contactDoc) {
      const eligibility = evaluateOutreachEligibility({
        contact: {
          id: contactDoc._id.toString(),
          email: normRecipient,
          bouncedEmail: contactDoc.status === 'BOUNCED' ? (contactDoc.email || null) : null,
          status: contactDoc.status,
          emailStatus: contactDoc.emailStatus,
          emailMeta: contactDoc.emailMeta as any,
          emailQuality: contactDoc.emailQuality as any
        },
        campaign: campaignDoc ? { id: campaignDoc._id.toString(), status: campaignDoc.status } : null
      });
      if (!eligibility.eligible) {
        throw new EmailDomainError(
          'CONTACT_NOT_ELIGIBLE',
          `Contact "${normRecipient}" is not eligible for outreach: ${eligibility.reason}.`
        );
      }
    }

    // 0c. Recipient concurrent dispatch guard: prevent parallel workers racing to dispatch to the exact same recipient simultaneously
    const activeSendingToRecipient = await EmailDeliveryModel.findOne({
      workspaceId: this.workspaceId,
      recipientEmail: normRecipient,
      status: 'SENDING',
      leaseExpiresAt: { $gt: new Date() }
    });
    if (activeSendingToRecipient) {
      throw new EmailDomainError(
        'DELIVERY_ALREADY_RESERVED',
        `An outbound message to recipient "${normRecipient}" is currently actively being dispatched by another worker lease.`,
        false,
        true
      );
    }

    // 1. Atomic send slot reservation (prevents counter race conditions)
    const effectiveLimits = await this.accountRepo.resolveEffectiveLimits(input.accountId);
    const reservation = await this.accountRepo.reserveSendSlot(input.accountId, effectiveLimits);
    if (!reservation.success) {
      if (reservation.reason === 'MAILBOX_AUTH_REQUIRED') {
        throw new EmailDomainError(
          'MAILBOX_REAUTH_REQUIRED',
          `Mailbox "${account.email}" requires re-authorization before dispatching outreach.`,
          true
        );
      }
      if (reservation.reason === 'MAILBOX_BLOCKED') {
        throw new EmailDomainError(
          'MAILBOX_NOT_AUTHORIZED',
          `Mailbox "${account.email}" is blocked due to repeated provider failures. Operator intervention required.`,
          false
        );
      }
      throw new EmailDomainError(
        'EMAIL_RATE_LIMITED',
        `Mailbox sending limit reached for "${account.email}": ${reservation.reason || 'send slot unavailable'}.`,
        false,
        true,
        undefined,
        reservation.retryAfterSec,
        reservation.nextSendAt,
        reservation.reason
      );
    }

    // 2. Derive deterministic idempotency key and composition fingerprint
    const idempotencyKey = this.generateDeterministicIdempotencyKey(input);
    const attachmentChecksums = computeAttachmentChecksums(input.attachments || []);
    const messageFingerprint = computeMessageFingerprint({
      workspaceId: this.workspaceId,
      senderEmail: account.email,
      recipientEmail: input.to,
      subject: input.subject,
      htmlBody: input.html || null,
      textBody: input.text || null,
      attachmentChecksums,
      templateId: input.templateId || null,
      templateVersion: input.templateVersion || null
    });

    // 3. Atomically reserve delivery in MongoDB ledger
    let deliveryRecord: any;
    try {
      const reservation = await this.deliveryRepo.reserveDelivery({
        workspaceId: this.workspaceId,
        accountId: input.accountId,
        campaignId: input.campaignId,
        sequenceId: input.sequenceId || 'direct-outreach',
        executionId: input.executionId || `direct-${Date.now()}`,
        stepIndex: input.stepIndex || 0,
        contactId: input.contactId || 'direct-contact',
        senderEmail: account.email,
        recipientEmail: input.to.toLowerCase().trim(),
        subject: input.subject,
        idempotencyKey,
        templateId: input.templateId || null,
        templateVersion: input.templateVersion || null,
        variablesSnapshot: input.variablesSnapshot || null,
        messageFingerprint,
        snapshot: {
          accountId: input.accountId,
          senderEmail: account.email,
          recipientEmail: input.to,
          subject: input.subject,
          hasHtml: Boolean(input.html),
          attachmentCount: input.attachments?.length || 0,
          templateId: input.templateId || null,
          templateVersion: input.templateVersion || null
        }
      } as any);

      deliveryRecord = reservation.delivery;

      // If already sent in previous execution, return existing messageId without sending again
      if (reservation.isAlreadySent) {
        logger.warn(
          {
            workspaceId: this.workspaceId,
            idempotencyKey,
            to: input.to,
            subject: input.subject,
            existingMessageId: deliveryRecord.providerMessageId
          },
          'Idempotency skip: delivery previously recorded as SENT in ledger'
        );
        await this.accountRepo.releaseSendSlot(input.accountId);
        return {
          messageId: deliveryRecord.providerMessageId || '',
          threadId: deliveryRecord.providerThreadId || null,
          accepted: [input.to],
          sentAt: deliveryRecord.sentAt || new Date()
        };
      }
    } catch (reserveErr: any) {
      await this.accountRepo.releaseSendSlot(input.accountId);
      throw reserveErr;
    }

    // 4. Process signature and HTML with Gmail default typography
    let finalHtml = input.html;
    if (!finalHtml && input.text) {
      finalHtml = plainTextToHtml(input.text);
    } else if (finalHtml) {
      finalHtml = wrapHtmlWithDefaultTypography(finalHtml);
    }

    if (input.useSignature !== false && finalHtml) {
      let signatureHtml = account.signature;

      // On-demand lazy fetch: If account has no signature stored yet and provider is Gmail, fetch once from Gmail API
      if (!signatureHtml && (account.provider === 'gmail' || account.provider === 'gmail_oauth')) {
        try {
          const provider: any = await this.accounts.buildProvider(input.accountId);
          if (provider && typeof provider.fetchSignature === 'function') {
            const fetched = await provider.fetchSignature();
            if (fetched) {
              const normalized = normalizeEmailSignature(fetched);
              signatureHtml = normalized;
              await EmailAccountModel.updateOne(
                { _id: input.accountId } as any,
                { signature: normalized }
              );
              account.signature = normalized;
              logger.info({ accountId: input.accountId }, 'Lazily fetched and stored Gmail signature on send');
            }
          }
        } catch (sigErr) {
          logger.warn({ sigErr, accountId: input.accountId }, 'Failed on-demand signature fetch in send()');
        }
      }

      if (signatureHtml && !finalHtml.includes('class="gmail_signature"')) {
        const cleanSig = normalizeEmailSignature(signatureHtml);
        finalHtml = `${finalHtml}<br/><span class="gmail_signature_prefix">-- </span><br/><div class="gmail_signature" dir="ltr" data-smartmail="gmail_signature">${cleanSig}</div>`;
      }
    }

    // 5. Process and resolve Drive attachments
    const processedAttachments: any[] = [];
    if (Array.isArray(input.attachments)) {
      const { AttachmentModel } = await import('../../db/models/attachment.model.js');
      const { GoogleDriveProvider } = await import('../google/drive.provider.js');
      const { GoogleAuthService } = await import('../google/auth.service.js');
      const driveProvider = new GoogleDriveProvider(new GoogleAuthService());

      for (const att of input.attachments) {
        const attId = (att as any).id || (att as any).attachmentId;
        let fileId = (att as any).fileId;
        const driveUrl = (att as any).driveUrl;

        // Fallback: extract fileId from driveUrl if fileId is not explicitly set
        if (!fileId && driveUrl && typeof driveUrl === 'string') {
          const match = driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || driveUrl.match(/id=([a-zA-Z0-9_-]+)/);
          if (match && match[1]) fileId = match[1];
        }

        const rawData = (att as any).data ?? (att as any).contentBase64 ?? (att as any).content;
        const hasDirectData = Boolean(
          Buffer.isBuffer(rawData) || (typeof rawData === 'string' && rawData.trim().length > 0)
        );

        if (!hasDirectData && (attId || fileId)) {
          const query: any[] = [];
          if (attId) query.push({ _id: attId });
          if (fileId) query.push({ fileId });
          if (attId && attId !== fileId) query.push({ fileId: attId });

          const attDoc = query.length > 0 ? await AttachmentModel.findOne({ $or: query }) : null;

          let connectionIdToUse = attDoc?.googleConnectionId || (att as any).googleConnectionId || account.googleConnectionId;
          const targetFileId = attDoc?.fileId || fileId;
          const filename = attDoc?.filename || att.filename || 'attachment';
          const contentType = attDoc?.mimeType || att.contentType || (att as any).mimeType || 'application/octet-stream';
          const size = attDoc?.size || att.size || 0;

          if (!targetFileId || !connectionIdToUse) {
            await this.accountRepo.releaseSendSlot(input.accountId);
            const errMsg = `Attachment "${filename}" lacks Google Drive file identity or connection.`;
            await this.deliveryRepo.failDelivery(deliveryRecord._id.toString(), errMsg, {
              classification: 'attachment_not_found',
              retryable: false
            });
            throw new EmailDomainError('ATTACHMENT_NOT_FOUND', errMsg);
          }

          // Cross-connection verification if sender connection is different and doc specifies connection
          if (account.googleConnectionId && attDoc && attDoc.googleConnectionId !== account.googleConnectionId) {
            const accessible = await driveProvider.verifyAccess(account.googleConnectionId, targetFileId);
            if (!accessible) {
              // If sender connection cannot access, try downloading using the originating connection
              const originAccessible = await driveProvider.verifyAccess(attDoc.googleConnectionId, targetFileId);
              if (originAccessible) {
                connectionIdToUse = attDoc.googleConnectionId;
              } else {
                await this.accountRepo.releaseSendSlot(input.accountId);
                const errMsg = `Sender "${account.email}" cannot access Drive attachment "${filename}". The file was uploaded by a different Google connection.`;
                await this.deliveryRepo.failDelivery(deliveryRecord._id.toString(), errMsg, {
                  classification: 'attachment_unauthorized',
                  retryable: false
                });
                throw new EmailDomainError('DRIVE_ATTACHMENT_ACCESS_DENIED', errMsg);
              }
            }
          }

          try {
            const buffer = await driveProvider.downloadFile(connectionIdToUse, targetFileId);
            if (!buffer || buffer.length === 0) {
              await this.accountRepo.releaseSendSlot(input.accountId);
              const errMsg = `Attachment "${filename}" downloaded from Google Drive is empty (0 bytes).`;
              await this.deliveryRepo.failDelivery(deliveryRecord._id.toString(), errMsg, {
                classification: 'attachment_binary_empty',
                retryable: false
              });
              throw new EmailDomainError('ATTACHMENT_BINARY_EMPTY', errMsg);
            }
            processedAttachments.push({
              filename,
              contentType,
              size: buffer.length || size,
              data: buffer,
              contentBase64: buffer.toString('base64')
            });
          } catch (err: any) {
            if (err instanceof EmailDomainError) throw err;
            await this.accountRepo.releaseSendSlot(input.accountId);
            const errMsg = `Failed to download attachment "${filename}" from Google Drive: ${err.message}`;
            await this.deliveryRepo.failDelivery(deliveryRecord._id.toString(), errMsg, {
              classification: 'attachment_download_failure',
              retryable: true
            });
            throw new EmailDomainError('DRIVE_DOWNLOAD_FAILED', errMsg);
          }
          continue;
        }

        if (hasDirectData) {
          processedAttachments.push({
            filename: att.filename || 'attachment',
            contentType: att.contentType || (att as any).mimeType || 'application/octet-stream',
            size: att.size || (Buffer.isBuffer(rawData) ? rawData.length : rawData.length * 0.75),
            data: rawData,
            contentBase64: Buffer.isBuffer(rawData) ? rawData.toString('base64') : rawData
          });
        } else {
          await this.accountRepo.releaseSendSlot(input.accountId);
          const errMsg = `Attachment "${att.filename || 'unknown'}" contains no binary payload and is not a valid Google Drive file.`;
          await this.deliveryRepo.failDelivery(deliveryRecord._id.toString(), errMsg, {
            classification: 'attachment_unreadable',
            retryable: false
          });
          throw new EmailDomainError('ATTACHMENT_UNREADABLE', errMsg);
        }
      }
    }

    // 6. Setup Tracking (open pixel & click redirect) and persist exact rendered outbound message
    const trackingBaseUrl =
      process.env.TRACKING_BASE_URL ||
      process.env.API_BASE_URL ||
      'http://localhost:3000';
    const openTrackingToken = deliveryRecord.openTrackingToken || generateTrackingToken();
    let clickTokens: Array<{ token: string; targetUrl: string }> = deliveryRecord.clickTrackingTokens?.length
      ? deliveryRecord.clickTrackingTokens
      : [];

    if (finalHtml) {
      const clickRes = rewriteLinksForClickTracking(finalHtml, trackingBaseUrl);
      finalHtml = clickRes.rewrittenHtml;
      if (!clickTokens.length) {
        clickTokens = clickRes.tokens;
      }
      finalHtml = injectOpenTrackingPixel(finalHtml, trackingBaseUrl, openTrackingToken);
    }

    // Persist exact rendered content & tracking metadata onto delivery record
    await EmailDeliveryModel.updateOne(
      { _id: deliveryRecord._id },
      {
        $set: {
          htmlBody: finalHtml || null,
          textBody: input.text || null,
          attachments: processedAttachments.map((a) => ({
            filename: a.filename,
            contentType: a.contentType,
            size: a.size || 0,
            fileId: a.fileId || null
          })),
          openTrackingToken,
          clickTrackingTokens: clickTokens,
          messageFingerprint
        }
      }
    );

    // 7. Build Provider & Dispatch Outbound Send
    const provider = await this.accounts.buildProvider(input.accountId);
    try {
      logger.info(
        {
          workspaceId: this.workspaceId,
          accountId: input.accountId,
          to: input.to,
          subject: input.subject,
          attachmentsCount: processedAttachments.length,
          idempotencyKey
        },
        'Invoking provider.send for email transmission'
      );

      const result = await provider.send({
        ...input,
        from: input.from || account.email,
        attachments: processedAttachments,
        html: finalHtml
      });

      // 8. Finalize delivery in MongoDB ledger
      await this.deliveryRepo.finalizeDelivery(deliveryRecord._id.toString(), {
        providerMessageId: result.messageId,
        providerThreadId: (result as any).threadId || null,
        sentAt: new Date()
      });

      // 9. Atomic contact lifecycle transition: CONTACTED only after provider acceptance
      if (input.contactId && input.contactId !== 'direct-contact') {
        try {
          await ContactModel.updateOne(
            {
              _id: input.contactId,
              workspaceId: this.workspaceId,
              status: { $nin: ['UNSUBSCRIBED', 'BOUNCED', 'DO_NOT_CONTACT', 'ARCHIVED'] }
            } as any,
            {
              $set: {
                status: ContactStatus.CONTACTED,
                lastContactedAt: new Date()
              }
            }
          );
        } catch (contactErr) {
          logger.warn({ contactErr, contactId: input.contactId }, 'Failed to transition contact to CONTACTED after send');
        }
      }

      // Release in-flight send lease on success (quota remains consumed)
      await this.accountRepo.clearSendLease(input.accountId);

      // Phase 18: Record send success to restore mailbox health to HEALTHY and reset failure counters
      await this.accountRepo.recordSendSuccess(input.accountId);

      await EmailAccountModel.updateOne(
        { _id: input.accountId } as any,
        { lastVerifiedAt: new Date() }
      );

      logger.info(
        {
          workspaceId: this.workspaceId,
          deliveryId: deliveryRecord._id.toString(),
          messageId: result.messageId,
          to: input.to,
          subject: input.subject
        },
        'Email successfully dispatched and finalized in delivery ledger'
      );

      return {
        messageId: result.messageId,
        threadId: (result as any).threadId || null,
        accepted: [input.to],
        sentAt: new Date()
      };
    } catch (err: any) {
      logger.error(
        {
          err,
          workspaceId: this.workspaceId,
          deliveryId: deliveryRecord?._id?.toString(),
          to: input.to,
          subject: input.subject,
          accountId: input.accountId
        },
        'Outbound email send failed in provider'
      );

      const failure = classifyEmailFailure(err);

      // Phase 18: Record provider failure against mailbox health
      // Note: INVALID_RECIPIENT is address-level and does NOT degrade or penalize the mailbox.
      if (failure.category !== EmailFailureCategory.INVALID_RECIPIENT) {
        let failureCat: 'AUTH' | 'RATE_LIMIT' | 'NETWORK' | 'INVALID_RECIPIENT' | 'AMBIGUOUS' | 'POLICY' = 'NETWORK';
        if (failure.category === EmailFailureCategory.AUTH) failureCat = 'AUTH';
        else if (failure.category === EmailFailureCategory.RATE_LIMIT) failureCat = 'RATE_LIMIT';
        else if (failure.category === EmailFailureCategory.AMBIGUOUS) failureCat = 'AMBIGUOUS';
        else if (failure.category === EmailFailureCategory.POLICY) failureCat = 'POLICY';

        await this.accountRepo.recordSendFailure(input.accountId, {
          category: failureCat,
          message: failure.safeHumanMessage || err.message,
          retryAfterSec: err.retryAfterSec
        });
      }

      if (err.code === 'AMBIGUOUS_SEND_TIMEOUT') {
        // Critical Ambiguous Send: Network failed after dispatch.
        // Clear in-flight lease so mailbox is not locked forever, but do NOT release quota or retry blindly!
        await this.accountRepo.clearSendLease(input.accountId);
        await this.deliveryRepo.markAmbiguous(
          deliveryRecord._id.toString(),
          err.message,
          'Network timeout during Gmail API transmission. Requires manual/reconciliation check.'
        );
        throw err;
      }

      // If provider rate limited (e.g. Google 429), set mailbox provider cooldown
      if (err.code === 'PROVIDER_RATE_LIMITED' || err.classification === 'provider_rate_limited') {
        const cooldownSec = err.retryAfterSec || 60;
        await this.accountRepo.setProviderCooldown(input.accountId, cooldownSec);
      }

      // Definite failure: release send slot and record failure in ledger
      await this.accountRepo.releaseSendSlot(input.accountId);

      const isAuthError = err instanceof EmailDomainError && err.reauthRequired;
      if (isAuthError) {
        await EmailAccountModel.updateOne(
          { _id: input.accountId } as any,
          { status: 'reauth_required', lastError: err.message }
        );
      }

      await this.deliveryRepo.failDelivery(
        deliveryRecord._id.toString(),
        err.message || String(err),
        {
          classification: err.classification || failure.category.toLowerCase(),
          failureCode: failure.code,
          failureCategory: failure.category,
          safeHumanMessage: failure.safeHumanMessage,
          technicalMessage: failure.technicalMessage,
          retryable: failure.retryable,
          ambiguous: failure.ambiguous
        }
      );

      // Phase 10: Automatic suppression & contact transition on permanent hard bounce
      const isHardBounce =
        failure.isHardBounce === true ||
        (failure.category === EmailFailureCategory.INVALID_RECIPIENT &&
          err.code !== 'INVALID_SUBJECT');

      if (isHardBounce) {
        try {
          await suppressionRepo.suppress(
            input.to,
            SuppressionReason.HARD_BOUNCE,
            'outbound_send_rejection',
            {
              failureCode: failure.code,
              technicalMessage: failure.technicalMessage,
              deliveryId: deliveryRecord._id.toString()
            }
          );

          if (input.contactId && input.contactId !== 'direct-contact') {
            const targetContact = await ContactModel.findOne({
              _id: input.contactId,
              workspaceId: this.workspaceId
            });

            if (targetContact) {
              const isPrimary = targetContact.email?.toLowerCase().trim() === input.to.toLowerCase().trim();
              if (isPrimary) {
                // Primary address hard bounced: mark contact status as BOUNCED
                await ContactModel.updateOne(
                  { _id: targetContact._id, workspaceId: this.workspaceId },
                  {
                    $set: {
                      status: ContactStatus.BOUNCED,
                      emailStatus: ContactEmailStatus.INVALID
                    }
                  }
                );
              } else {
                // Secondary address bounced: preserve primary address eligibility
                await ContactModel.updateOne(
                  { _id: targetContact._id, workspaceId: this.workspaceId },
                  {
                    $set: {
                      'emailMeta.secondaryBounce': {
                        email: input.to,
                        bouncedAt: new Date().toISOString(),
                        reason: failure.technicalMessage
                      }
                    }
                  }
                );
              }
            }
          }
        } catch (suppressErr) {
          logger.warn({ suppressErr, to: input.to }, 'Failed to record hard bounce suppression on outbound send failure');
        }
      }

      throw err;
    } finally {
      if (typeof provider.close === 'function') {
        provider.close();
      }
    }
  }

  /**
   * Reconciles stale sending deliveries in the workspace.
   */
  async reconcileStaleDeliveries(maxStaleAgeMs = 300000) {
    return this.deliveryRepo.reconcileStaleDeliveries(maxStaleAgeMs);
  }

  /**
   * Sends a test message to a user-specified recipient address.
   */
  async sendTest(
    accountId: string,
    options: {
      to: string;
      useSignature?: boolean;
      attachments?: Array<{
        filename: string;
        contentBase64?: string;
        path?: string;
        contentType?: string;
        size?: number;
      }>;
    }
  ): Promise<{ messageId: string; sentTo: string; signatureNotice?: string }> {
    const rawTo = options?.to || '';
    const normalizedTo = rawTo.trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!normalizedTo || !emailRegex.test(normalizedTo)) {
      throw new EmailDomainError('INVALID_RECIPIENT', 'Invalid recipient email address.');
    }

    const accountDoc = await EmailAccountModel.findOne({
      _id: accountId,
      workspaceId: this.workspaceId
    } as any);

    if (!accountDoc) {
      throw new EmailDomainError('MAILBOX_NOT_FOUND', 'Email Account not found.');
    }

    // Resolve global LeadForge User ID for quota boundary
    const targetUserId = this.userId || this.workspaceId;

    // Check global test recipients for targetUserId
    let userRecipients = await UserTestRecipientModel.find({ userId: targetUserId });

    if (userRecipients.length === 0) {
      const legacyAccounts = await EmailAccountModel.find({ workspaceId: this.workspaceId });
      const migrated: string[] = [];
      for (const acc of legacyAccounts) {
        if (Array.isArray(acc.testRecipients)) {
          for (const r of acc.testRecipients) {
            const norm = (r.email || '').trim().toLowerCase();
            if (norm && !migrated.includes(norm) && migrated.length < 3) {
              migrated.push(norm);
              await UserTestRecipientModel.create({
                userId: targetUserId,
                email: norm,
                firstUsedAt: r.firstUsedAt || new Date(),
                lastUsedAt: r.lastUsedAt || new Date()
              });
            }
          }
        }
      }
      userRecipients = await UserTestRecipientModel.find({ userId: targetUserId });
    }

    const existingRecipient = userRecipients.find((r) => r.email === normalizedTo);
    if (!existingRecipient && userRecipients.length >= 3) {
      throw new EmailDomainError(
        'TEST_RECIPIENT_LIMIT_REACHED',
        `Test email recipient limit reached (maximum 3 distinct recipients per LeadForge account). Currently used: ${userRecipients.map((r) => r.email).join(', ')}`
      );
    }

    if (existingRecipient) {
      await UserTestRecipientModel.updateOne(
        { _id: existingRecipient._id },
        { lastUsedAt: new Date() }
      );
    } else {
      await UserTestRecipientModel.create({
        userId: targetUserId,
        email: normalizedTo,
        firstUsedAt: new Date(),
        lastUsedAt: new Date()
      });
    }

    const res = await this.send({
      accountId,
      to: normalizedTo,
      subject: 'LeadForge OS — Mailbox Verification Test',
      idempotencyKey: `test_${accountId}_${Date.now()}_${crypto.randomUUID()}`,
      html: `
        <div dir="ltr">
          <div dir="ltr">
            <p class="MsoNormal" style="margin:0in 0in 8pt;line-height:107%;font-size:13pt;font-family:Calibri,sans-serif;color:#4f46e5;"><strong>Mailbox Verification Successful</strong></p>
            <p class="MsoNormal" style="margin:0in 0in 8pt;line-height:107%;font-size:11pt;font-family:Calibri,sans-serif;color:#111827;">This is an automated test email confirming that your Gmail account <strong>${accountDoc.email}</strong> is properly connected via Google OAuth.</p>
            <p class="MsoNormal" style="margin:0in 0in 8pt;line-height:107%;font-size:10pt;font-family:Calibri,sans-serif;color:#6b7280;">Sent securely from LeadForge OS</p>
          </div>
        </div>
      `,
      useSignature: options.useSignature,
      attachments: options.attachments
    });

    const refreshedAccount = await EmailAccountModel.findById(accountId);
    const hasSignature = Boolean(refreshedAccount?.signature);

    const result: { messageId: string; sentTo: string; signatureNotice?: string } = {
      messageId: res.messageId,
      sentTo: normalizedTo
    };
    if (options.useSignature !== false) {
      if (hasSignature) {
        result.signatureNotice = 'Gmail signature included';
      } else {
        result.signatureNotice = 'No signature detected in Gmail settings';
      }
    }
    return result;
  }
}
