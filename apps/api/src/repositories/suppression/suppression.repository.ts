import {
  SuppressionModel,
  type SuppressionDocument
} from '../../db/models/suppression.model.js';
import { ContactModel } from '../../db/models/contact.model.js';
import {
  SuppressionReason,
  compareSuppressionPrecedence,
  ContactStatus,
  ContactEmailStatus
} from '@leadforge/schema';
import { logger } from '../../config/index.js';

export class SuppressionRepository {
  constructor(private readonly workspaceId: string) {}

  /**
   * Checks if an email is actively suppressed in the workspace.
   */
  public async isSuppressed(email: string): Promise<boolean> {
    if (!email) return false;
    const cleanEmail = email.toLowerCase().trim();
    const count = await SuppressionModel.countDocuments({
      workspaceId: this.workspaceId,
      email: cleanEmail
    });
    return count > 0;
  }

  /**
   * Retrieves suppression details for a specific email address.
   */
  public async getSuppression(email: string): Promise<SuppressionDocument | null> {
    if (!email) return null;
    const cleanEmail = email.toLowerCase().trim();
    return SuppressionModel.findOne({
      workspaceId: this.workspaceId,
      email: cleanEmail
    });
  }

  /**
   * Records a suppression for an email address while strictly enforcing suppression precedence.
   * A weaker suppression reason (e.g. HARD_BOUNCE) can never overwrite a stronger existing
   * reason (e.g. DO_NOT_CONTACT or UNSUBSCRIBED).
   */
  public async suppress(
    email: string,
    reason: SuppressionReason,
    source = 'system',
    evidence: Record<string, any> | null = null,
    suppressedBy: string | null = null,
    notes: string | null = null
  ): Promise<SuppressionDocument> {
    const cleanEmail = email.toLowerCase().trim();
    const existing = await SuppressionModel.findOne({
      workspaceId: this.workspaceId,
      email: cleanEmail
    });

    if (existing) {
      // Enforce Precedence: Only upgrade to stronger reason, never downgrade
      const comparison = compareSuppressionPrecedence(reason, existing.reason);
      const targetReason = comparison > 0 ? reason : existing.reason;

      const mergedEvidence = {
        ...(existing.evidence || {}),
        ...(evidence || {}),
        lastUpdatedReason: reason,
        lastUpdatedAt: new Date().toISOString()
      };

      existing.reason = targetReason;
      existing.source = comparison >= 0 ? source : existing.source;
      existing.evidence = mergedEvidence;
      if (notes) existing.notes = notes;
      if (suppressedBy) existing.suppressedBy = suppressedBy;
      await existing.save();

      logger.info(
        {
          workspaceId: this.workspaceId,
          email: cleanEmail,
          targetReason,
          existingReason: existing.reason
        },
        'Updated existing suppression record with precedence enforcement'
      );

      return existing;
    }

    const created = await SuppressionModel.create({
      workspaceId: this.workspaceId,
      email: cleanEmail,
      reason,
      source,
      evidence,
      suppressedAt: new Date(),
      suppressedBy,
      notes
    });

    logger.info(
      {
        workspaceId: this.workspaceId,
        email: cleanEmail,
        reason,
        source
      },
      'Created new email suppression record'
    );

    return created;
  }

  /**
   * Removes suppression for an email address (manual unsuppress) and synchronizes
   * contact eligibility if the contact has no remaining active suppressions (UNSUPPRESS-13).
   */
  public async unsuppress(
    email: string,
    removedBy?: string
  ): Promise<{ unsuppressed: boolean; email: string; restoredContactIds: string[] }> {
    const cleanEmail = email.toLowerCase().trim();
    const res = await SuppressionModel.deleteOne({
      workspaceId: this.workspaceId,
      email: cleanEmail
    });

    const deleted = (res.deletedCount ?? 0) > 0;
    const restoredContactIds: string[] = [];

    // UNSUPPRESS-13: Synchronize contact lifecycle and address eligibility
    if (deleted) {
      try {
        const matchingContacts = await ContactModel.find({
          workspaceId: this.workspaceId,
          $or: [{ email: cleanEmail }, { 'additionalEmails.email': cleanEmail }],
          deletedAt: null
        });

        for (const contact of matchingContacts) {
          // Check if contact has other suppressed emails
          const otherEmails: string[] = [];
          if (contact.email && contact.email.toLowerCase().trim() !== cleanEmail) {
            otherEmails.push(contact.email.toLowerCase().trim());
          }
          if (Array.isArray((contact as any).additionalEmails)) {
            for (const add of (contact as any).additionalEmails) {
              const addClean = (add?.email || '').toLowerCase().trim();
              if (addClean && addClean !== cleanEmail) {
                otherEmails.push(addClean);
              }
            }
          }

          let hasOtherSuppression = false;
          if (otherEmails.length > 0) {
            const otherSuppCount = await SuppressionModel.countDocuments({
              workspaceId: this.workspaceId,
              email: { $in: otherEmails }
            });
            hasOtherSuppression = otherSuppCount > 0;
          }

          // Narrowest restoration: only restore if no other suppressions exist
          // and contact was blocked by BOUNCED or INVALID emailStatus
          if (!hasOtherSuppression) {
            const currentStatus = contact.status;
            // Higher priority states: REPLIED, UNSUBSCRIBED, DO_NOT_CONTACT are strictly protected
            const isProtected =
              currentStatus === ContactStatus.REPLIED ||
              currentStatus === ContactStatus.UNSUBSCRIBED ||
              currentStatus === ContactStatus.DO_NOT_CONTACT ||
              currentStatus === ContactStatus.ARCHIVED;

            const updates: any = {};
            if (contact.emailStatus === ContactEmailStatus.INVALID) {
              updates.emailStatus = ContactEmailStatus.VALID;
            }

            if (!isProtected && currentStatus === ContactStatus.BOUNCED) {
              // Restore to CONTACTED (if contacted previously) or NEW
              updates.status = contact.lastContactedAt ? ContactStatus.CONTACTED : ContactStatus.NEW;
            }

            if (Object.keys(updates).length > 0) {
              await ContactModel.updateOne(
                { _id: contact._id, workspaceId: this.workspaceId },
                { $set: updates }
              );
              restoredContactIds.push(contact._id.toString());
            }
          }
        }
      } catch (contactErr) {
        logger.warn(
          { contactErr, email: cleanEmail, workspaceId: this.workspaceId },
          'Error updating contact status during unsuppression'
        );
      }
    }

    logger.info(
      {
        workspaceId: this.workspaceId,
        email: cleanEmail,
        removedBy,
        deletedCount: res.deletedCount,
        restoredContactIds
      },
      'Unsuppressed email address and synchronized contact eligibility'
    );

    return {
      unsuppressed: deleted,
      email: cleanEmail,
      restoredContactIds
    };
  }

  /**
   * Lists suppressions for the workspace.
   */
  public async listSuppressions(filter: {
    reason?: string | undefined;
    limit?: number | undefined;
    skip?: number | undefined;
  } = {}): Promise<{ items: SuppressionDocument[]; total: number }> {
    const query: any = { workspaceId: this.workspaceId };
    if (filter.reason) {
      query.reason = filter.reason;
    }

    const limit = Math.min(filter.limit || 50, 200);
    const skip = filter.skip || 0;

    const [items, total] = await Promise.all([
      SuppressionModel.find(query).sort({ suppressedAt: -1 }).skip(skip).limit(limit),
      SuppressionModel.countDocuments(query)
    ]);

    return { items, total };
  }
}
