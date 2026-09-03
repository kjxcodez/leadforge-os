import { EmailDeliveryModel, type EmailDeliveryDocument } from '../../db/models/email-delivery.model.js';
import { EmailAccountModel } from '../../db/models/email-account.model.js';
import { ContactModel } from '../../db/models/contact.model.js';
import { SequenceExecutionModel } from '../../db/models/sequence-execution.model.js';
import { EmailEventRepository } from '../../repositories/email-event/email-event.repository.js';
import { EmailAccountRepository } from '../../repositories/email-account/email-account.repository.js';
import { EmailAccountService } from './email-account.service.js';
import { GoogleAuthService } from '../google/auth.service.js';
import { GmailProvider } from '../google/gmail.provider.js';
import {
  ContactStatus,
  EmailEventType,
  EmailFailureCategory,
  canTransitionContactStatus,
  generateEntityId,
  sanitizeHtmlForPreview
} from '@leadforge/schema';
import { EmailDomainError } from './types.js';
import { logger } from '../../config/index.js';

export interface ReconciliationResult {
  deliveryId: string;
  previousStatus: string;
  resolvedStatus: 'SENT' | 'FAILED' | 'AMBIGUOUS';
  matchedMessageId?: string | undefined;
  matchedThreadId?: string | undefined;
  notes: string;
}

export interface InboundPollResult {
  accountId: string;
  discoveredCount: number;
  processedCount: number;
  matchedCount: number;
  unmatchedCount: number;
  suppressedExecutionsCount: number;
}

export class ReconciliationService {
  private readonly accounts: EmailAccountService;
  private readonly accountRepo: EmailAccountRepository;
  private readonly gmailProvider: GmailProvider;

  constructor(
    private readonly workspaceId: string,
    gmailProvider?: GmailProvider
  ) {
    this.accounts = new EmailAccountService(workspaceId);
    this.accountRepo = new EmailAccountRepository(workspaceId);
    this.gmailProvider = gmailProvider || new GmailProvider(new GoogleAuthService());
  }

  /**
   * Reconciles an individual AMBIGUOUS delivery record against Gmail.
   * Atomically acquires a reconciliation lease to prevent concurrent worker execution.
   */
  public async reconcileAmbiguousDelivery(deliveryId: string): Promise<ReconciliationResult> {
    const now = new Date();

    // 1. Atomic lease acquisition using $and to wrap multiple $or clauses
    const delivery = await EmailDeliveryModel.findOneAndUpdate(
      {
        _id: deliveryId,
        workspaceId: this.workspaceId,
        status: 'AMBIGUOUS',
        $and: [
          {
            $or: [
              { reconciliationLeaseExpiresAt: null },
              { reconciliationLeaseExpiresAt: { $lt: now } }
            ]
          },
          {
            $or: [
              { nextReconciliationAt: null },
              { nextReconciliationAt: { $lte: now } }
            ]
          }
        ]
      },
      {
        $set: {
          reconciliationLeaseExpiresAt: new Date(now.getTime() + 60000) // 1-minute lease
        },
        $inc: { reconciliationAttempts: 1 }
      },
      { new: true }
    );

    if (!delivery) {
      return {
        deliveryId,
        previousStatus: 'UNKNOWN',
        resolvedStatus: 'AMBIGUOUS',
        notes: 'Delivery could not be claimed: currently leased by another worker or not eligible for reconciliation.'
      };
    }

    try {
      const account = await EmailAccountModel.findOne({
        _id: delivery.accountId,
        workspaceId: this.workspaceId
      });

      const connectionId = account?.connectionId || account?.googleConnectionId;
      if (!account || !connectionId) {
        // Mailbox deleted or lacks Google connection
        await EmailDeliveryModel.updateOne(
          { _id: delivery._id },
          {
            $set: {
              reconciliationLeaseExpiresAt: null,
              reconciliationNotes: 'Reconciliation deferred: Mailbox connection missing or unlinked.'
            }
          }
        );
        return {
          deliveryId,
          previousStatus: delivery.status,
          resolvedStatus: 'AMBIGUOUS',
          notes: 'Sending mailbox connection missing'
        };
      }

      const attemptTime = delivery.sentAt?.getTime() || delivery.createdAt.getTime();
      const attemptAgeMs = Date.now() - attemptTime;
      const afterTimestampSec = Math.max(0, Math.floor(attemptTime / 1000) - 180); // 3 mins before send
      const beforeTimestampSec = Math.floor(attemptTime / 1000) + 1200; // 20 mins after send

      logger.info(
        {
          deliveryId: delivery._id.toString(),
          recipient: delivery.recipientEmail,
          sender: delivery.senderEmail,
          subject: delivery.subject
        },
        'Reconciliation worker querying Gmail sent folder'
      );

      // Search Gmail with collision-resistant query: in:sent to:recipient from:sender subject:"exact subject"
      const candidates = await this.gmailProvider.searchSentMessages(connectionId, {
        recipientEmail: delivery.recipientEmail,
        senderEmail: delivery.senderEmail,
        subject: delivery.subject,
        afterTimestampSec,
        beforeTimestampSec
      });

      // Filter and correlate candidates
      const validMatches: Array<{ id: string; threadId: string; date: Date }> = [];
      const normRecipient = (delivery.recipientEmail || '').toLowerCase().trim();
      const normSender = (delivery.senderEmail || '').toLowerCase().trim();
      const normSubject = (delivery.subject || '').toLowerCase().trim();

      for (const cand of candidates) {
        const detail = await this.gmailProvider.getMessage(connectionId, cand.id).catch(() => null);
        if (!detail) continue;

        const toMatch = (detail.headers.to || '').toLowerCase().includes(normRecipient);
        const fromMatch = (detail.headers.from || '').toLowerCase().includes(normSender);
        const subMatch = (detail.headers.subject || '').toLowerCase().trim() === normSubject;

        if (toMatch && fromMatch && subMatch) {
          // Verify this Gmail messageId is NOT already assigned to a DIFFERENT delivery in this workspace
          const alreadyClaimed = await EmailDeliveryModel.findOne({
            workspaceId: this.workspaceId,
            providerMessageId: cand.id,
            _id: { $ne: delivery._id }
          });

          if (!alreadyClaimed) {
            validMatches.push({
              id: cand.id,
              threadId: cand.threadId || detail.threadId,
              date: detail.internalDate || new Date()
            });
          }
        }
      }

      // Case A: Exactly ONE verified matching message found in Gmail sent folder
      if (validMatches.length === 1) {
        const match = validMatches[0]!;
        await EmailDeliveryModel.updateOne(
          { _id: delivery._id },
          {
            $set: {
              status: 'SENT',
              providerMessageId: match.id,
              providerThreadId: match.threadId,
              sentAt: match.date,
              reconciledAt: new Date(),
              reconciliationNotes: 'Reconciled: matching sent message verified in Gmail sent folder.',
              reconciliationLeaseExpiresAt: null
            }
          }
        );

        // Update contact state to CONTACTED (only if eligible)
        if (delivery.contactId && delivery.contactId !== 'direct-contact') {
          await ContactModel.updateOne(
            {
              _id: delivery.contactId,
              workspaceId: this.workspaceId,
              status: { $nin: ['UNSUBSCRIBED', 'BOUNCED', 'DO_NOT_CONTACT', 'ARCHIVED', 'REPLIED'] }
            } as any,
            {
              $set: {
                status: ContactStatus.CONTACTED,
                lastContactedAt: match.date
              }
            }
          );
        }

        logger.info(
          {
            deliveryId: delivery._id.toString(),
            providerMessageId: match.id,
            providerThreadId: match.threadId
          },
          'Reconciled ambiguous send to SENT'
        );

        return {
          deliveryId,
          previousStatus: 'AMBIGUOUS',
          resolvedStatus: 'SENT',
          matchedMessageId: match.id,
          matchedThreadId: match.threadId,
          notes: 'Message confirmed in Gmail sent folder.'
        };
      }

      // Case B: No matching messages found in Gmail
      if (validMatches.length === 0) {
        const maxAttempts = 3;
        const maxAgeMs = 15 * 60 * 1000; // 15 minutes
        const currentAttempts = delivery.reconciliationAttempts || 1;

        if (currentAttempts < maxAttempts && attemptAgeMs < maxAgeMs) {
          // Bounded retry: Provider indexing might be delayed, keep AMBIGUOUS and retry in 2 minutes
          const nextRetry = new Date(Date.now() + 120000);
          await EmailDeliveryModel.updateOne(
            { _id: delivery._id },
            {
              $set: {
                nextReconciliationAt: nextRetry,
                reconciliationLeaseExpiresAt: null,
                reconciliationNotes: `Attempt ${currentAttempts}/${maxAttempts}: message not yet indexed by Gmail. Retrying at ${nextRetry.toISOString()}.`
              }
            }
          );

          return {
            deliveryId,
            previousStatus: 'AMBIGUOUS',
            resolvedStatus: 'AMBIGUOUS',
            notes: `Message not found yet. Scheduled retry #${currentAttempts + 1}.`
          };
        } else {
          // Definitively absent: After max attempts or > 15 mins without appearing in Gmail sent folder, conclude send failed
          await EmailDeliveryModel.updateOne(
            { _id: delivery._id },
            {
              $set: {
                status: 'FAILED',
                failureClassification: 'reconciliation_verified_unsent',
                failureCode: 'SEND_VERIFIED_ABSENT',
                failureCategory: EmailFailureCategory.PROVIDER,
                safeHumanMessage: 'Message was verified absent from Gmail sent folder after network timeout.',
                technicalMessage: `Reconciliation verified message was not accepted by Gmail after ${currentAttempts} checks over ${Math.round(attemptAgeMs / 1000)}s.`,
                reconciledAt: new Date(),
                reconciliationNotes: 'Reconciliation concluded send failed: message was never dispatched.',
                reconciliationLeaseExpiresAt: null
              }
            }
          );

          // Release the provisional sending slot quota
          await this.accountRepo.releaseSendSlot(delivery.accountId);

          logger.warn(
            {
              deliveryId: delivery._id.toString(),
              attempts: currentAttempts,
              attemptAgeSec: Math.round(attemptAgeMs / 1000)
            },
            'Reconciled ambiguous send to FAILED (verified absent, quota released)'
          );

          return {
            deliveryId,
            previousStatus: 'AMBIGUOUS',
            resolvedStatus: 'FAILED',
            notes: 'Verified absent from Gmail sent folder. Marked FAILED and quota released.'
          };
        }
      }

      // Case C: Multiple matching candidates found (collision ambiguity)
      await EmailDeliveryModel.updateOne(
        { _id: delivery._id },
        {
          $set: {
            reconciliationLeaseExpiresAt: null,
            nextReconciliationAt: new Date(Date.now() + 300000), // Backoff 5 mins
            reconciliationNotes: `Ambiguous collision: found ${validMatches.length} matching sent messages in Gmail. Requires manual review.`
          }
        }
      );

      logger.warn(
        { deliveryId: delivery._id.toString(), candidateCount: validMatches.length },
        'Ambiguous collision during reconciliation: multiple candidates matched'
      );

      return {
        deliveryId,
        previousStatus: 'AMBIGUOUS',
        resolvedStatus: 'AMBIGUOUS',
        notes: `Collision: ${validMatches.length} matching messages found. Maintained AMBIGUOUS.`
      };
    } catch (err: any) {
      // Clear lease so delivery is not blocked indefinitely
      await EmailDeliveryModel.updateOne(
        { _id: delivery._id },
        {
          $set: {
            reconciliationLeaseExpiresAt: null,
            reconciliationNotes: `Reconciliation error: ${err.message || String(err)}`
          }
        }
      );
      throw err;
    }
  }

  /**
   * Scans and reconciles all eligible AMBIGUOUS deliveries for the workspace.
   */
  public async reconcileAllAmbiguous(limit = 10): Promise<ReconciliationResult[]> {
    const now = new Date();
    const candidates = await EmailDeliveryModel.find({
      workspaceId: this.workspaceId,
      status: 'AMBIGUOUS',
      $and: [
        {
          $or: [
            { reconciliationLeaseExpiresAt: null },
            { reconciliationLeaseExpiresAt: { $lt: now } }
          ]
        },
        {
          $or: [
            { nextReconciliationAt: null },
            { nextReconciliationAt: { $lte: now } }
          ]
        }
      ]
    })
      .sort({ createdAt: 1 })
      .limit(limit);

    const results: ReconciliationResult[] = [];
    for (const cand of candidates) {
      try {
        const res = await this.reconcileAmbiguousDelivery(cand._id.toString());
        results.push(res);
      } catch (err: any) {
        logger.error({ err, deliveryId: cand._id.toString() }, 'Failed to reconcile ambiguous delivery');
      }
    }

    return results;
  }

  /**
   * Ingests and correlates inbound email replies received by a specific email account.
   */
  public async pollInboundRepliesForAccount(accountId: string): Promise<InboundPollResult> {
    const account = await EmailAccountModel.findOne({
      _id: accountId,
      workspaceId: this.workspaceId
    });

    const connectionId = account?.connectionId || account?.googleConnectionId;
    if (!account || !connectionId) {
      throw new EmailDomainError('MAILBOX_NOT_FOUND', `Account ${accountId} not found or missing connection.`);
    }

    // Default window: last poll time, or up to 7 days back on first run
    const sinceDate = account.lastInboundPollAt || new Date(Date.now() - 7 * 86400000);
    const afterTimestampSec = Math.floor(sinceDate.getTime() / 1000);

    logger.info(
      { accountId, email: account.email, afterTimestampSec },
      'Polling Gmail for inbound replies'
    );

    const messages = await this.gmailProvider.listInboundMessages(connectionId, {
      afterTimestampSec,
      maxResults: 25
    });

    let processedCount = 0;
    let matchedCount = 0;
    let unmatchedCount = 0;
    let suppressedExecutionsCount = 0;

    const eventRepo = new EmailEventRepository(this.workspaceId);

    for (const item of messages) {
      const idempotencyKey = `inbound_${accountId}_${item.id}`;

      // Idempotency: skip if already ingested
      const existing = await EmailDeliveryModel.findOne({
        workspaceId: this.workspaceId,
        idempotencyKey
      });

      if (existing) {
        continue;
      }

      processedCount++;
      const detail = await this.gmailProvider.getMessage(connectionId, item.id).catch(() => null);
      if (!detail) continue;

      // Extract sender address from "From" header
      const fromRaw = detail.headers.from || '';
      const emailMatch = fromRaw.match(/<([^>]+)>/) || fromRaw.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      const normalizedFrom = (emailMatch?.[1] || fromRaw).toLowerCase().trim();

      // Skip self-sent messages
      if (normalizedFrom === (account.email || '').toLowerCase().trim()) {
        continue;
      }

      // ── Hierarchical Correlation ──────────────────────────────────────────
      let matchedDelivery: EmailDeliveryDocument | null = null;
      let matchConfidence: 'thread' | 'header' | 'contact' | 'none' = 'none';

      // 1. Thread ID Correlation (Strongest)
      if (item.threadId) {
        matchedDelivery = await EmailDeliveryModel.findOne({
          workspaceId: this.workspaceId,
          direction: 'OUTBOUND',
          providerThreadId: item.threadId
        }).sort({ sentAt: -1 });

        if (matchedDelivery) {
          matchConfidence = 'thread';
        }
      }

      // 2. Message Header Correlation (In-Reply-To / References)
      if (!matchedDelivery) {
        const headerRefs: string[] = [];
        if (detail.headers.inReplyTo) headerRefs.push(detail.headers.inReplyTo);
        if (Array.isArray(detail.headers.references)) headerRefs.push(...detail.headers.references);

        for (const ref of headerRefs) {
          const cleanRef = ref.replace(/[<>]/g, '').trim();
          matchedDelivery = await EmailDeliveryModel.findOne({
            workspaceId: this.workspaceId,
            direction: 'OUTBOUND',
            $or: [
              { providerMessageId: cleanRef },
              { providerMessageId: ref }
            ]
          });

          if (matchedDelivery) {
            matchConfidence = 'header';
            break;
          }
        }
      }

      // 3. Sender Contact Correlation (Fallback)
      let contactDoc = null;
      if (!matchedDelivery) {
        contactDoc = await ContactModel.findOne({
          workspaceId: this.workspaceId,
          email: normalizedFrom,
          deletedAt: null
        });

        if (contactDoc) {
          matchedDelivery = await EmailDeliveryModel.findOne({
            workspaceId: this.workspaceId,
            contactId: contactDoc._id.toString(),
            direction: 'OUTBOUND',
            status: 'SENT'
          }).sort({ sentAt: -1 });

          if (matchedDelivery) {
            matchConfidence = 'contact';
          }
        }
      } else if (matchedDelivery.contactId) {
        contactDoc = await ContactModel.findOne({
          _id: matchedDelivery.contactId,
          workspaceId: this.workspaceId
        });
      }

      // ── Persist Inbound Message ───────────────────────────────────────────
      const safeHtml = detail.bodyHtml ? sanitizeHtmlForPreview(detail.bodyHtml) : null;
      const safeText = detail.bodyText || null;
      const incomingDate = detail.internalDate || new Date();

      if (matchedDelivery && contactDoc) {
        matchedCount++;

        // Save matched inbound message in unified ledger
        await EmailDeliveryModel.create({
          workspaceId: this.workspaceId,
          direction: 'INBOUND',
          status: 'SENT',
          idempotencyKey,
          matchedDeliveryId: matchedDelivery._id.toString(),
          contactId: contactDoc._id.toString(),
          campaignId: matchedDelivery.campaignId || null,
          sequenceId: matchedDelivery.sequenceId || 'inbound-direct',
          executionId: matchedDelivery.executionId || 'inbound-direct',
          stepIndex: (matchedDelivery.stepIndex || 0) + 1,
          accountId: account._id.toString(),
          senderEmail: normalizedFrom,
          recipientEmail: account.email,
          subject: detail.headers.subject || '(No Subject)',
          htmlBody: safeHtml,
          textBody: safeText,
          provider: 'gmail',
          providerMessageId: item.id,
          providerThreadId: item.threadId,
          inReplyTo: detail.headers.inReplyTo || null,
          references: detail.headers.references || [],
          matchConfidence,
          processingStatus: 'MATCHED',
          sentAt: incomingDate
        });

        // Record immutable REPLIED event
        const dedupeKey = `reply_${this.workspaceId}_${item.id}`;
        await eventRepo.recordEvent({
          deliveryId: matchedDelivery._id.toString(),
          contactId: contactDoc._id.toString(),
          campaignId: matchedDelivery.campaignId || null,
          type: EmailEventType.REPLIED,
          occurredAt: incomingDate,
          metadata: {
            providerMessageId: item.id,
            providerThreadId: item.threadId,
            from: normalizedFrom,
            subject: detail.headers.subject,
            matchConfidence
          },
          dedupeKey
        });

        // Update parent delivery
        await EmailDeliveryModel.updateOne(
          { _id: matchedDelivery._id },
          {
            $set: {
              hasReply: true,
              lastRepliedAt: incomingDate
            },
            $inc: { replyCount: 1 }
          }
        );

        // Monotonic Contact Status Transition: NEW / CONTACTED -> REPLIED
        if (canTransitionContactStatus(contactDoc.status, ContactStatus.REPLIED)) {
          await ContactModel.updateOne(
            {
              _id: contactDoc._id,
              workspaceId: this.workspaceId,
              status: { $nin: ['UNSUBSCRIBED', 'BOUNCED', 'DO_NOT_CONTACT', 'ARCHIVED'] }
            } as any,
            {
              $set: {
                status: ContactStatus.REPLIED,
                lastRepliedAt: incomingDate
              }
            }
          );
        }

        // ── Sequence Outreach Suppression (Phase 6S) ─────────────────────────
        // Cancel/complete any active/waiting sequence executions for this contact
        const cancelled = await SequenceExecutionModel.updateMany(
          {
            workspaceId: this.workspaceId,
            contactId: contactDoc._id.toString(),
            status: { $in: ['active', 'running', 'waiting', 'pending', 'WAITING', 'ACTIVE', 'RUNNING', 'PENDING'] }
          },
          {
            $set: {
              status: 'completed',
              completedAt: new Date(),
              nextExecutionAt: null
            },
            $inc: { replies: 1 },
            $push: {
              logs: {
                timestamp: new Date(),
                level: 'info',
                message: 'Sequence execution halted: contact replied to email outreach.',
                step: matchedDelivery.stepIndex
              }
            }
          }
        );

        suppressedExecutionsCount += cancelled.modifiedCount;

        logger.info(
          {
            inboundMessageId: item.id,
            contactId: contactDoc._id.toString(),
            matchedDeliveryId: matchedDelivery._id.toString(),
            matchConfidence
          },
          'Successfully ingested and matched inbound email reply'
        );
      } else {
        // Unmatched incoming email: ingest with UNMATCHED status without guessing
        unmatchedCount++;

        await EmailDeliveryModel.create({
          workspaceId: this.workspaceId,
          direction: 'INBOUND',
          status: 'SENT',
          idempotencyKey,
          matchedDeliveryId: null,
          contactId: contactDoc ? contactDoc._id.toString() : 'unmatched-contact',
          campaignId: null,
          sequenceId: 'inbound-direct',
          executionId: 'inbound-direct',
          stepIndex: 0,
          accountId: account._id.toString(),
          senderEmail: normalizedFrom,
          recipientEmail: account.email,
          subject: detail.headers.subject || '(No Subject)',
          htmlBody: safeHtml,
          textBody: safeText,
          provider: 'gmail',
          providerMessageId: item.id,
          providerThreadId: item.threadId,
          inReplyTo: detail.headers.inReplyTo || null,
          references: detail.headers.references || [],
          matchConfidence: 'none',
          processingStatus: 'UNMATCHED',
          sentAt: incomingDate
        });

        logger.info(
          { inboundMessageId: item.id, from: normalizedFrom },
          'Ingested unmatched inbound email (preserved without contact mutation)'
        );
      }
    }

    // Update mailbox lastInboundPollAt
    await EmailAccountModel.updateOne(
      { _id: accountId },
      { $set: { lastInboundPollAt: new Date() } }
    );

    return {
      accountId,
      discoveredCount: messages.length,
      processedCount,
      matchedCount,
      unmatchedCount,
      suppressedExecutionsCount
    };
  }

  /**
   * Polls inbound replies across all connected email accounts in the workspace.
   */
  public async pollAllInboundReplies(): Promise<InboundPollResult[]> {
    const accounts = await EmailAccountModel.find({
      workspaceId: this.workspaceId,
      status: 'connected'
    });

    const results: InboundPollResult[] = [];
    for (const acc of accounts) {
      try {
        const res = await this.pollInboundRepliesForAccount(acc._id.toString());
        results.push(res);
      } catch (err: any) {
        logger.error({ err, accountId: acc._id.toString() }, 'Failed to poll inbound replies for account');
      }
    }

    return results;
  }
}
