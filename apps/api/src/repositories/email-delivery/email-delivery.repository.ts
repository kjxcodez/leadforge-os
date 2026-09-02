import { BaseRepository } from '../base/base.repository.js';
import { EmailDeliveryModel, type EmailDeliveryDocument } from '../../db/models/email-delivery.model.js';
import type { EmailDeliveryStatus, ReserveEmailDeliveryDto } from '@leadforge/schema';
import { generateEntityId } from '@leadforge/schema';
import { EmailDomainError } from '../../services/email/types.js';

export const VALID_DELIVERY_TRANSITIONS: Record<EmailDeliveryStatus, EmailDeliveryStatus[]> = {
  QUEUED: ['SENDING', 'SENT', 'FAILED', 'CANCELLED', 'SUPPRESSED'],
  SENDING: ['SENT', 'FAILED', 'RETRYING', 'AMBIGUOUS', 'CANCELLED'],
  RETRYING: ['SENDING', 'SENT', 'CANCELLED', 'FAILED'],
  AMBIGUOUS: ['SENT', 'FAILED', 'RETRYING', 'CANCELLED', 'SENDING'],
  FAILED: ['SENDING', 'RETRYING'], // Allow retry on failed deliveries
  SENT: [], // Terminal
  CANCELLED: ['QUEUED', 'SENDING'],
  SUPPRESSED: [] // Terminal
};

export class EmailDeliveryRepository extends BaseRepository<EmailDeliveryDocument> {
  constructor(workspaceId?: string) {
    super(EmailDeliveryModel, workspaceId);
  }

  /**
   * Finds delivery by unique idempotency key within workspace.
   */
  public async findByIdempotencyKey(idempotencyKey: string): Promise<EmailDeliveryDocument | null> {
    return this.findOne({ idempotencyKey });
  }

  /**
   * Enforces valid state machine transition.
   */
  public static validateTransition(currentStatus: EmailDeliveryStatus, nextStatus: EmailDeliveryStatus): boolean {
    if (currentStatus === nextStatus) return true;
    const allowed = VALID_DELIVERY_TRANSITIONS[currentStatus] || [];
    return allowed.includes(nextStatus);
  }

  /**
   * Atomically reserves a delivery record before calling external provider.
   * Handles existing deliveries (idempotent no-op for SENT, conflict for active SENDING, claim for QUEUED/RETRYING/stale).
   */
  public async reserveDelivery(
    dto: ReserveEmailDeliveryDto
  ): Promise<{ delivery: EmailDeliveryDocument; isAlreadySent: boolean }> {
    const wsId = this.workspaceId;
    const now = new Date();
    const leaseDuration = dto.leaseDurationMs || 300000; // 5 minutes default
    const leaseExpiresAt = new Date(now.getTime() + leaseDuration);

    const existing = await this.findOne({ idempotencyKey: dto.idempotencyKey });

    if (existing) {
      if (existing.status === 'SENT' || existing.status === 'SUPPRESSED') {
        return { delivery: existing, isAlreadySent: true };
      }

      // If already in active SENDING state with valid lease, prevent concurrent duplicate execution
      if (
        existing.status === 'SENDING' &&
        existing.leaseExpiresAt &&
        new Date(existing.leaseExpiresAt).getTime() > now.getTime()
      ) {
        throw new EmailDomainError(
          'DELIVERY_ALREADY_RESERVED',
          `Delivery with idempotency key ${dto.idempotencyKey} is already actively being processed by another worker lease.`,
          false,
          true
        );
      }

      // Check transition validity
      if (!EmailDeliveryRepository.validateTransition(existing.status, 'SENDING')) {
        throw new EmailDomainError(
          'EMAIL_SEND_FAILED',
          `Cannot transition delivery ${existing._id} from status ${existing.status} to SENDING.`
        );
      }

      // Reclaim / transition to SENDING
      const updated = await this.atomicFindOneAndUpdate(
        { _id: existing._id },
        {
          $set: {
            status: 'SENDING',
            leaseExpiresAt,
            senderEmail: dto.senderEmail,
            recipientEmail: dto.recipientEmail,
            subject: dto.subject,
            snapshot: dto.snapshot || existing.snapshot,
            updatedAt: now
          },
          $inc: { attempt: 1 }
        }
      );

      return { delivery: updated!, isAlreadySent: false };
    }

    // Create fresh delivery in SENDING state
    try {
      const created = await this.create({
        _id: dto.id || generateEntityId(),
        workspaceId: wsId,
        campaignId: dto.campaignId || null,
        sequenceId: dto.sequenceId,
        executionId: dto.executionId,
        stepIndex: dto.stepIndex,
        contactId: dto.contactId,
        companyId: dto.companyId || null,
        accountId: dto.accountId,
        senderEmail: dto.senderEmail,
        recipientEmail: dto.recipientEmail,
        subject: dto.subject,
        status: 'SENDING',
        attempt: 1,
        idempotencyKey: dto.idempotencyKey,
        leaseExpiresAt,
        snapshot: dto.snapshot || null,
        createdAt: now,
        updatedAt: now
      } as any);

      return { delivery: created, isAlreadySent: false };
    } catch (err: any) {
      if (err.code === 11000 || /duplicate/i.test(err.message)) {
        // Race condition: another worker inserted concurrently. Re-fetch and check.
        const concurrentDoc = await this.findOne({ idempotencyKey: dto.idempotencyKey });
        if (concurrentDoc && (concurrentDoc.status === 'SENT' || concurrentDoc.status === 'SUPPRESSED')) {
          return { delivery: concurrentDoc, isAlreadySent: true };
        }
        throw new EmailDomainError(
          'DELIVERY_ALREADY_RESERVED',
          `Concurrent delivery creation conflict for idempotency key ${dto.idempotencyKey}.`,
          false,
          true
        );
      }
      throw err;
    }
  }

  /**
   * Finalizes delivery status upon successful send.
   */
  public async finalizeDelivery(
    id: string,
    result: { providerMessageId: string; providerThreadId?: string | null | undefined; sentAt?: Date | undefined }
  ): Promise<EmailDeliveryDocument> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new EmailDomainError('EMAIL_SEND_FAILED', `Delivery with id ${id} not found.`);
    }

    if (!EmailDeliveryRepository.validateTransition(existing.status, 'SENT')) {
      throw new EmailDomainError(
        'EMAIL_SEND_FAILED',
        `Invalid state transition: cannot transition delivery ${id} from ${existing.status} to SENT.`
      );
    }

    const updated = await this.atomicFindOneAndUpdate(
      { _id: id },
      {
        $set: {
          status: 'SENT',
          providerMessageId: result.providerMessageId,
          providerThreadId: result.providerThreadId || null,
          sentAt: result.sentAt || new Date(),
          leaseExpiresAt: null,
          error: null,
          updatedAt: new Date()
        }
      }
    );

    return updated!;
  }

  /**
   * Records failure or scheduled retry for delivery.
   */
  public async failDelivery(
    id: string,
    error: string,
    options?: {
      classification?: string;
      retryable?: boolean;
      nextRetryAt?: Date;
      maxRetries?: number;
    }
  ): Promise<EmailDeliveryDocument> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new EmailDomainError('EMAIL_SEND_FAILED', `Delivery with id ${id} not found.`);
    }

    const maxRetries = options?.maxRetries || 3;
    const isRetryable = options?.retryable && (existing.retryCount || 0) < maxRetries;
    const nextStatus: EmailDeliveryStatus = isRetryable ? 'RETRYING' : 'FAILED';

    if (!EmailDeliveryRepository.validateTransition(existing.status, nextStatus)) {
      throw new EmailDomainError(
        'EMAIL_SEND_FAILED',
        `Invalid state transition: cannot transition delivery ${id} from ${existing.status} to ${nextStatus}.`
      );
    }

    const updated = await this.atomicFindOneAndUpdate(
      { _id: id },
      {
        $set: {
          status: nextStatus,
          error,
          failureClassification: options?.classification || null,
          nextRetryAt: isRetryable ? options?.nextRetryAt || new Date(Date.now() + 60000) : null,
          leaseExpiresAt: null,
          updatedAt: new Date()
        },
        $inc: { retryCount: isRetryable ? 1 : 0 }
      }
    );

    return updated!;
  }

  /**
   * Marks a delivery as AMBIGUOUS when timeout or network disconnection occurs during sending.
   */
  public async markAmbiguous(id: string, error: string, notes?: string): Promise<EmailDeliveryDocument> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new EmailDomainError('EMAIL_SEND_FAILED', `Delivery with id ${id} not found.`);
    }

    if (!EmailDeliveryRepository.validateTransition(existing.status, 'AMBIGUOUS')) {
      throw new EmailDomainError(
        'EMAIL_SEND_FAILED',
        `Invalid state transition: cannot transition delivery ${id} from ${existing.status} to AMBIGUOUS.`
      );
    }

    const updated = await this.atomicFindOneAndUpdate(
      { _id: id },
      {
        $set: {
          status: 'AMBIGUOUS',
          error,
          failureClassification: 'ambiguous_timeout',
          reconciliationNotes: notes || 'Delivery reached ambiguous state during external transmission.',
          leaseExpiresAt: null,
          updatedAt: new Date()
        }
      }
    );

    return updated!;
  }

  /**
   * Scans and reconciles stale SENDING records whose lease has expired without confirmation.
   */
  public async reconcileStaleDeliveries(
    maxStaleAgeMs = 300000
  ): Promise<{ diagnosedCount: number; deliveries: EmailDeliveryDocument[] }> {
    const threshold = new Date(Date.now() - maxStaleAgeMs);
    const filter = this.applyScope({
      status: 'SENDING',
      $or: [
        { leaseExpiresAt: { $lt: new Date() } },
        { updatedAt: { $lt: threshold } }
      ]
    });

    const staleDocs = await this.model.find(filter);
    const reconciledDocs: EmailDeliveryDocument[] = [];

    for (const doc of staleDocs) {
      const updated = await this.atomicFindOneAndUpdate(
        { _id: doc._id, status: 'SENDING' },
        {
          $set: {
            status: 'AMBIGUOUS',
            failureClassification: 'stale_lease_timeout',
            reconciledAt: new Date(),
            reconciliationNotes: 'Automated reconciliation marked stale SENDING delivery with expired lease as AMBIGUOUS.',
            leaseExpiresAt: null,
            updatedAt: new Date()
          }
        }
      );
      if (updated) reconciledDocs.push(updated);
    }

    return { diagnosedCount: reconciledDocs.length, deliveries: reconciledDocs };
  }

  /**
   * Updates delivery status with state machine check.
   */
  public async updateDeliveryStatus(
    id: string,
    status: EmailDeliveryStatus,
    providerMessageId?: string | null,
    error?: string | null,
    sentAt?: Date | null
  ): Promise<EmailDeliveryDocument | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    if (!EmailDeliveryRepository.validateTransition(existing.status, status)) {
      throw new EmailDomainError(
        'EMAIL_SEND_FAILED',
        `Invalid state transition: cannot transition delivery ${id} from ${existing.status} to ${status}.`
      );
    }

    const updateSet: any = {
      status,
      updatedAt: new Date()
    };

    if (providerMessageId !== undefined) updateSet.providerMessageId = providerMessageId;
    if (error !== undefined) updateSet.error = error;
    if (sentAt !== undefined) updateSet.sentAt = sentAt;
    if (status === 'SENT' && !updateSet.sentAt) updateSet.sentAt = new Date();
    if (status === 'SENT' || status === 'FAILED' || status === 'AMBIGUOUS') updateSet.leaseExpiresAt = null;

    return this.atomicFindOneAndUpdate(
      { _id: id },
      {
        $set: updateSet,
        $inc: { attempt: status === 'RETRYING' ? 1 : 0 }
      }
    );
  }
}
