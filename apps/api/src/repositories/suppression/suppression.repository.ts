import {
  SuppressionModel,
  type SuppressionDocument
} from '../../db/models/suppression.model.js';
import {
  SuppressionReason,
  compareSuppressionPrecedence
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
   * Removes suppression for an email address (manual unsuppress).
   */
  public async unsuppress(email: string, removedBy?: string): Promise<boolean> {
    const cleanEmail = email.toLowerCase().trim();
    const res = await SuppressionModel.deleteOne({
      workspaceId: this.workspaceId,
      email: cleanEmail
    });

    logger.info(
      {
        workspaceId: this.workspaceId,
        email: cleanEmail,
        removedBy,
        deletedCount: res.deletedCount
      },
      'Unsuppressed email address'
    );

    return (res.deletedCount ?? 0) > 0;
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
