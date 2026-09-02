import { EmailAccountModel } from '../../db/models/email-account.model.js';
import { UserTestRecipientModel } from '../../db/models/user-test-recipient.model.js';
import { EmailDeliveryRepository } from '../../repositories/email-delivery/email-delivery.repository.js';
import { EmailAccountRepository } from '../../repositories/email-account/email-account.repository.js';
import { plainTextToHtml } from '@leadforge/sdk';
import {
  EmailDomainError,
  type SendEmailInput,
  type SendEmailResult
} from './types.js';
import { EmailAccountService } from './email-account.service.js';
import crypto from 'crypto';

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
    const hash = crypto
      .createHash('sha256')
      .update(`${this.workspaceId}:${input.accountId}:${input.to.toLowerCase().trim()}:${input.subject.trim()}`)
      .digest('hex')
      .substring(0, 32);
    return `send_${input.accountId}_${hash}`;
  }

  /**
   * Authoritative outbound send pipeline with atomic delivery reservation, Drive resolution,
   * rate limit enforcement, and ambiguous-send protection.
   */
  async send(input: SendEmailInput): Promise<SendEmailResult> {
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

    // 1. Atomic send slot reservation (prevents counter race conditions)
    const reservedAccount = await this.accountRepo.reserveSendSlot(input.accountId);
    if (!reservedAccount) {
      throw new EmailDomainError(
        'EMAIL_RATE_LIMITED',
        `Daily or hourly send limit reached for mailbox "${account.email}".`
      );
    }

    // 2. Derive deterministic idempotency key
    const idempotencyKey = this.generateDeterministicIdempotencyKey(input);

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
        snapshot: {
          accountId: input.accountId,
          senderEmail: account.email,
          recipientEmail: input.to,
          subject: input.subject,
          hasHtml: Boolean(input.html),
          attachmentCount: input.attachments?.length || 0
        }
      } as any);

      deliveryRecord = reservation.delivery;

      // If already sent in previous execution, return existing messageId without sending again
      if (reservation.isAlreadySent) {
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

    // 4. Process signature and HTML
    let finalHtml = input.html;
    if (!finalHtml && input.text) {
      finalHtml = plainTextToHtml(input.text);
    }
    if (input.useSignature !== false && finalHtml && account.signature) {
      if (!finalHtml.includes('class="gmail_signature"')) {
        finalHtml = `${finalHtml}<br/><hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 16px 0;" /><div class="gmail_signature">${account.signature}</div>`;
      }
    }

    // 5. Process and resolve Drive attachments
    const processedAttachments: any[] = [];
    if (Array.isArray(input.attachments)) {
      for (const att of input.attachments) {
        const attId = (att as any).id || (att as any).attachmentId;
        const fileId = (att as any).fileId;
        const hasDirectData = Boolean(att.contentBase64 || (att as any).data);

        if (!hasDirectData && (attId || fileId)) {
          const { AttachmentModel } = await import('../../db/models/attachment.model.js');
          const { GoogleDriveProvider } = await import('../google/drive.provider.js');
          const { GoogleAuthService } = await import('../google/auth.service.js');

          const query: any[] = [];
          if (attId && !attId.startsWith('att_')) query.push({ _id: attId });
          if (fileId) query.push({ fileId });
          if (attId) query.push({ fileId: attId });

          const attDoc = query.length > 0 ? await AttachmentModel.findOne({ $or: query }) : null;

          if (!attDoc) {
            // If attachment has neither data nor a valid Drive record, log warning and continue without failing the send
            console.warn(`[EmailService] Attachment "${att.filename || attId}" not found in Drive records; skipping attachment.`);
            continue;
          }

          const driveProvider = new GoogleDriveProvider(new GoogleAuthService());

          // Cross-connection verification if sender connection is different
          if (account.googleConnectionId && attDoc.googleConnectionId !== account.googleConnectionId) {
            const accessible = await driveProvider.verifyAccess(account.googleConnectionId, attDoc.fileId);
            if (!accessible) {
              await this.accountRepo.releaseSendSlot(input.accountId);
              const errMsg = `Sender "${account.email}" cannot access Drive attachment "${attDoc.filename}". The file was uploaded by a different Google connection.`;
              await this.deliveryRepo.failDelivery(deliveryRecord._id.toString(), errMsg, {
                classification: 'attachment_unauthorized',
                retryable: false
              });
              throw new EmailDomainError('DRIVE_ATTACHMENT_ACCESS_DENIED', errMsg);
            }
          }

          try {
            const buffer = await driveProvider.downloadFile(attDoc.googleConnectionId, attDoc.fileId);
            processedAttachments.push({
              filename: attDoc.filename,
              contentType: attDoc.mimeType,
              size: attDoc.size,
              data: buffer,
              contentBase64: buffer.toString('base64')
            });
          } catch (err: any) {
            await this.accountRepo.releaseSendSlot(input.accountId);
            const errMsg = `Failed to download attachment "${attDoc.filename}" from Google Drive: ${err.message}`;
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
            filename: att.filename,
            contentType: att.contentType || (att as any).mimeType || 'application/octet-stream',
            size: att.size,
            data: (att as any).data,
            contentBase64: att.contentBase64
          });
        }
      }
    }

    // 6. Build Provider & Dispatch Outbound Send
    const provider = await this.accounts.buildProvider(input.accountId);
    try {
      const result = await provider.send({
        ...input,
        from: input.from || account.email,
        attachments: processedAttachments,
        html: finalHtml
      });

      // 7. Finalize delivery in MongoDB ledger
      await this.deliveryRepo.finalizeDelivery(deliveryRecord._id.toString(), {
        providerMessageId: result.messageId,
        providerThreadId: (result as any).threadId || null,
        sentAt: new Date()
      });

      await EmailAccountModel.updateOne(
        { _id: input.accountId } as any,
        { lastVerifiedAt: new Date() }
      );

      return {
        messageId: result.messageId,
        threadId: (result as any).threadId || null,
        accepted: [input.to],
        sentAt: new Date()
      };
    } catch (err: any) {
      if (err.code === 'AMBIGUOUS_SEND_TIMEOUT') {
        // Critical Ambiguous Send: Network failed after dispatch. Do NOT release send slot or retry blindly!
        await this.deliveryRepo.markAmbiguous(
          deliveryRecord._id.toString(),
          err.message,
          'Network timeout during Gmail API transmission. Requires manual/reconciliation check.'
        );
        throw err;
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
          classification: err.classification || (isAuthError ? 'authentication' : 'provider_error'),
          retryable: err.retryable || false
        }
      );

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
        <div style="font-family: sans-serif; padding: 20px; line-height: 1.5; color: #111827;">
          <h2 style="color: #4f46e5; margin-bottom: 8px;">Mailbox Verification Successful</h2>
          <p>This is an automated test email confirming that your Gmail account <strong>${accountDoc.email}</strong> is properly connected via Google OAuth.</p>
          <p style="font-size: 12px; color: #6b7280; margin-top: 24px;">Sent securely from LeadForge OS</p>
        </div>
      `,
      useSignature: options.useSignature,
      attachments: options.attachments
    });

    const result: { messageId: string; sentTo: string; signatureNotice?: string } = {
      messageId: res.messageId,
      sentTo: normalizedTo
    };
    if (accountDoc.signature) {
      result.signatureNotice = 'Gmail signature included';
    }
    return result;
  }
}
