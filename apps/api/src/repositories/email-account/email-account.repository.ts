import { BaseRepository } from '../base/base.repository.js';
import {
  EmailAccountModel,
  type EmailAccountDocument,
  type MailboxHealthState,
  type EmailAccountHealth
} from '../../db/models/email-account.model.js';
import { EMAIL_POLICY, resolveEffectivePolicy } from '../../constants/email-policy.js';
import { logger } from '../../config/index.js';

/**
 * Structured result when a send slot reservation is rejected.
 * Contains enough information for the caller to determine the correct retry time.
 */
export type ReservationRejectionReason =
  | 'MAILBOX_NOT_FOUND'
  | 'MAILBOX_NOT_ACTIVE'
  | 'PROVIDER_RATE_LIMITED'
  | 'MAILBOX_HEALTH_COOLDOWN'
  | 'MAILBOX_AUTH_REQUIRED'
  | 'MAILBOX_BLOCKED'
  | 'MAILBOX_CONCURRENCY_BUSY'
  | 'MIN_INTERVAL_THROTTLED'
  | 'HOURLY_QUOTA_EXCEEDED'
  | 'DAILY_QUOTA_EXCEEDED';

export interface SendSlotRejection {
  reason: ReservationRejectionReason;
  /** Seconds until the mailbox becomes available again. */
  retryAfterSec?: number;
  /** ISO timestamp of the next permitted send. */
  nextSendAt?: string;
}

export interface SendSlotResult {
  success: true;
  account: EmailAccountDocument;
}

export type ReservationResult = SendSlotResult | (SendSlotRejection & { success: false });

export class EmailAccountRepository extends BaseRepository<EmailAccountDocument> {
  constructor(workspaceId?: string) {
    super(EmailAccountModel, workspaceId);
  }

  public async findByEmail(email: string): Promise<EmailAccountDocument | null> {
    return this.findOne({ email: email.toLowerCase().trim() });
  }

  public async findActive(): Promise<EmailAccountDocument[]> {
    return this.findMany({ status: { $in: ['connected', 'active'] } as any });
  }

  /**
   * Atomically reserves a send slot against all policy constraints.
   *
   * This is a single-document atomic MongoDB operation (findOneAndUpdate with aggregation pipeline).
   * It replaces the old broken `$inc` approach that had no concurrency lease and no window semantics.
   *
   * Checks performed atomically (in order):
   *   1. Mailbox exists and is active (status = connected).
   *   2. Provider cooldown has expired (rateLimitedUntil <= now OR null).
   *   3. No active send lease (sendLeaseExpiresAt <= now OR null).
   *   4. Minimum inter-send interval has elapsed (nextSendAt <= now OR null).
   *   5. Evaluates hourly window — resets counter if window expired.
   *   6. Evaluates daily window — resets counter if window expired.
   *   7. Hourly quota not exceeded.
   *   8. Daily quota not exceeded.
   *   9. Increments counters, sets lastSentAt, nextSendAt, sendLeaseExpiresAt.
   *
   * Returns a structured rejection if any check fails — enabling the caller to distinguish
   * between all rejection reasons and compute the correct retry time.
   */
  public async reserveSendSlot(
    accountId: string,
    effectiveLimits: {
      dailyLimit: number;
      hourlyLimit: number;
      minSendIntervalMs: number;
      sendLeaseDurationMs: number;
    }
  ): Promise<ReservationResult> {
    const now = new Date();
    const nowMs = now.getTime();
    const { dailyLimit, hourlyLimit, minSendIntervalMs, sendLeaseDurationMs } = effectiveLimits;
    const leaseExpiry = new Date(nowMs + sendLeaseDurationMs);
    const nextSendAt = new Date(nowMs + minSendIntervalMs);
    const hourWindowDurationMs = 60 * 60 * 1000;
    const dayWindowDurationMs = 24 * 60 * 60 * 1000;

    // ── Single-Document Atomic Reservation ──────────────────────────────────
    // The filter atomically enforces all invariants before any mutation occurs:
    // 1. Mailbox is active/connected.
    // 2. Provider cooldown has expired.
    // 3. No active send lease exists (maxConcurrent = 1).
    // 4. Minimum inter-send interval has elapsed.
    // 5. Hourly window expired OR hourlySent < hourlyLimit.
    // 6. Daily window expired OR dailySent < dailyLimit.
    const atomicFilter: any = {
      _id: accountId,
      status: { $in: ['connected', 'active'] },
      $and: [
        {
          $or: [
            { 'health.state': { $exists: false } },
            { 'health.state': 'HEALTHY' }
          ]
        },
        {
          $or: [
            { 'health.cooldownUntil': { $exists: false } },
            { 'health.cooldownUntil': null },
            { 'health.cooldownUntil': { $lte: now } }
          ]
        },
        {
          $or: [
            { 'health.operatorActionRequired': { $exists: false } },
            { 'health.operatorActionRequired': false }
          ]
        },
        {
          $or: [
            { 'sendState.rateLimitedUntil': { $exists: false } },
            { 'sendState.rateLimitedUntil': null },
            { 'sendState.rateLimitedUntil': { $lte: now } }
          ]
        },
        {
          $or: [
            { 'sendState.sendLeaseExpiresAt': { $exists: false } },
            { 'sendState.sendLeaseExpiresAt': null },
            { 'sendState.sendLeaseExpiresAt': { $lte: now } }
          ]
        },
        {
          $or: [
            { 'sendState.lastSentAt': { $exists: false } },
            { 'sendState.lastSentAt': null },
            { 'sendState.nextSendAt': { $exists: false } },
            { 'sendState.nextSendAt': null },
            { 'sendState.nextSendAt': { $lte: now } }
          ]
        },
        {
          $or: [
            { 'sendState.hourlyResetAt': { $exists: false } },
            { 'sendState.hourlyResetAt': null },
            { 'sendState.hourlyResetAt': { $lte: now } },
            { 'sendState.hourlySent': { $exists: false } },
            { 'sendState.hourlySent': { $lt: hourlyLimit } }
          ]
        },
        {
          $or: [
            { 'sendState.dailyResetAt': { $exists: false } },
            { 'sendState.dailyResetAt': null },
            { 'sendState.dailyResetAt': { $lte: now } },
            { 'sendState.dailySent': { $exists: false } },
            { 'sendState.dailySent': { $lt: dailyLimit } }
          ]
        }
      ]
    };

    // Atomic update pipeline: resets expired windows or increments counters in place
    const atomicPipeline = [
      {
        $set: {
          'sendState.hourlyResetAt': {
            $cond: [
              {
                $or: [
                  { $eq: [{ $ifNull: ['$sendState.hourlyResetAt', null] }, null] },
                  { $lte: ['$sendState.hourlyResetAt', now] }
                ]
              },
              new Date(nowMs + hourWindowDurationMs),
              { $ifNull: ['$sendState.hourlyResetAt', new Date(nowMs + hourWindowDurationMs)] }
            ]
          },
          'sendState.hourlySent': {
            $cond: [
              {
                $or: [
                  { $eq: [{ $ifNull: ['$sendState.hourlyResetAt', null] }, null] },
                  { $lte: ['$sendState.hourlyResetAt', now] }
                ]
              },
              1,
              { $add: [{ $ifNull: ['$sendState.hourlySent', 0] }, 1] }
            ]
          },
          'sendState.dailyResetAt': {
            $cond: [
              {
                $or: [
                  { $eq: [{ $ifNull: ['$sendState.dailyResetAt', null] }, null] },
                  { $lte: ['$sendState.dailyResetAt', now] }
                ]
              },
              new Date(nowMs + dayWindowDurationMs),
              { $ifNull: ['$sendState.dailyResetAt', new Date(nowMs + dayWindowDurationMs)] }
            ]
          },
          'sendState.dailySent': {
            $cond: [
              {
                $or: [
                  { $eq: [{ $ifNull: ['$sendState.dailyResetAt', null] }, null] },
                  { $lte: ['$sendState.dailyResetAt', now] }
                ]
              },
              1,
              { $add: [{ $ifNull: ['$sendState.dailySent', 0] }, 1] }
            ]
          },
          'sendState.lastSentAt': now,
          'sendState.nextSendAt': nextSendAt,
          'sendState.sendLeaseExpiresAt': leaseExpiry,
          updatedAt: now
        }
      },
      {
        $set: {
          dailySent: '$sendState.dailySent',
          hourlySent: '$sendState.hourlySent'
        }
      }
    ];

    const updatedAccount = await this.atomicFindOneAndUpdate(atomicFilter, atomicPipeline);

    if (updatedAccount) {
      logger.debug(
        {
          accountId,
          workspaceId: this.workspaceId,
          hourlySent: updatedAccount.sendState?.hourlySent,
          hourlyLimit,
          dailySent: updatedAccount.sendState?.dailySent,
          dailyLimit,
          leaseExpiry: leaseExpiry.toISOString(),
          nextSendAt: nextSendAt.toISOString()
        },
        'reserveSendSlot: send slot reserved atomically'
      );
      return { success: true, account: updatedAccount };
    }

    // ── Diagnostic Inspection on Reservation Failure ──────────────────────────
    // The atomic operation rejected the reservation. Read the document to construct
    // the precise structured diagnostic rejection reason and accurate retry time.
    const currentAccount = await this.findOne({ _id: accountId } as any);

    if (!currentAccount) {
      return { success: false, reason: 'MAILBOX_NOT_FOUND' };
    }

    if (!['connected', 'active'].includes(currentAccount.status)) {
      return { success: false, reason: 'MAILBOX_NOT_ACTIVE' };
    }

    const health = currentAccount.health;
    if (health?.state === 'AUTH_REQUIRED' || currentAccount.status === 'reauth_required') {
      return { success: false, reason: 'MAILBOX_AUTH_REQUIRED' };
    }

    if (health?.state === 'BLOCKED' || health?.operatorActionRequired) {
      return { success: false, reason: 'MAILBOX_BLOCKED' };
    }

    if ((health?.state === 'COOLDOWN' || health?.state === 'DEGRADED') && health?.cooldownUntil && health.cooldownUntil > now) {
      const retryAfterSec = Math.max(1, Math.ceil((health.cooldownUntil.getTime() - nowMs) / 1000));
      return {
        success: false,
        reason: 'MAILBOX_HEALTH_COOLDOWN',
        retryAfterSec,
        nextSendAt: health.cooldownUntil.toISOString()
      };
    }

    const state = currentAccount.sendState;

    if (state?.rateLimitedUntil && state.rateLimitedUntil > now) {
      const retryAfterSec = Math.max(1, Math.ceil((state.rateLimitedUntil.getTime() - nowMs) / 1000));
      return {
        success: false,
        reason: 'PROVIDER_RATE_LIMITED',
        retryAfterSec,
        nextSendAt: state.rateLimitedUntil.toISOString()
      };
    }

    if (state?.sendLeaseExpiresAt && state.sendLeaseExpiresAt > now) {
      const retryAfterSec = Math.max(1, Math.ceil((state.sendLeaseExpiresAt.getTime() - nowMs) / 1000));
      return {
        success: false,
        reason: 'MAILBOX_CONCURRENCY_BUSY',
        retryAfterSec,
        nextSendAt: state.sendLeaseExpiresAt.toISOString()
      };
    }

    if (state?.nextSendAt && state.nextSendAt > now) {
      const retryAfterSec = Math.max(1, Math.ceil((state.nextSendAt.getTime() - nowMs) / 1000));
      return {
        success: false,
        reason: 'MIN_INTERVAL_THROTTLED',
        retryAfterSec,
        nextSendAt: state.nextSendAt.toISOString()
      };
    }

    const hourlyResetAt = state?.hourlyResetAt;
    const hourlySent = state?.hourlySent ?? 0;
    if (hourlyResetAt && hourlyResetAt > now && hourlySent >= hourlyLimit) {
      const retryAfterSec = Math.max(1, Math.ceil((hourlyResetAt.getTime() - nowMs) / 1000));
      return {
        success: false,
        reason: 'HOURLY_QUOTA_EXCEEDED',
        retryAfterSec,
        nextSendAt: hourlyResetAt.toISOString()
      };
    }

    const dailyResetAt = state?.dailyResetAt;
    const dailySent = state?.dailySent ?? 0;
    if (dailyResetAt && dailyResetAt > now && dailySent >= dailyLimit) {
      const retryAfterSec = Math.max(1, Math.ceil((dailyResetAt.getTime() - nowMs) / 1000));
      return {
        success: false,
        reason: 'DAILY_QUOTA_EXCEEDED',
        retryAfterSec,
        nextSendAt: dailyResetAt.toISOString()
      };
    }

    // Fallback race condition rejection
    return {
      success: false,
      reason: 'MAILBOX_CONCURRENCY_BUSY',
      retryAfterSec: 1,
      nextSendAt: new Date(nowMs + 1000).toISOString()
    };
  }

  /**
   * Releases a send slot when a send is aborted BEFORE provider dispatch or fails
   * with a non-ambiguous error (i.e. we can safely refund the quota).
   *
   * DO NOT call this after an ambiguous send timeout — the provider may have accepted the message.
   * DO NOT call this after a successful provider send — call clearSendLease() instead.
   */
  public async releaseSendSlot(accountId: string): Promise<void> {
    const now = new Date();
    const filter = this.applyScope({ _id: accountId } as any);

    await this.atomicFindOneAndUpdate(filter, {
      $set: {
        'sendState.sendLeaseExpiresAt': null,
        updatedAt: now
      },
      $inc: {
        'sendState.dailySent': -1,
        'sendState.hourlySent': -1,
        // Also decrement legacy flat fields
        dailySent: -1,
        hourlySent: -1
      }
    });

    logger.debug(
      { accountId, workspaceId: this.workspaceId },
      'releaseSendSlot: quota refunded and lease cleared'
    );
  }

  /**
   * Clears only the in-flight send lease after a successful provider send completes.
   * Does NOT decrement quota counters — the send was successfully accepted.
   */
  public async clearSendLease(accountId: string): Promise<void> {
    const filter = this.applyScope({ _id: accountId } as any);
    await this.atomicFindOneAndUpdate(filter, {
      $set: {
        'sendState.sendLeaseExpiresAt': null,
        updatedAt: new Date()
      }
    });

    logger.debug(
      { accountId, workspaceId: this.workspaceId },
      'clearSendLease: in-flight lease released after successful send'
    );
  }

  /**
   * Records a provider rate-limit cooldown on the mailbox.
   * All subsequent reservation attempts from any worker will be rejected
   * until rateLimitedUntil elapses.
   *
   * @param accountId The mailbox to cooldown.
   * @param retryAfterSec Seconds until the cooldown expires (from the provider Retry-After header).
   */
  public async setProviderCooldown(accountId: string, retryAfterSec: number): Promise<void> {
    const rateLimitedUntil = new Date(Date.now() + retryAfterSec * 1000);
    const filter = this.applyScope({ _id: accountId } as any);

    await this.atomicFindOneAndUpdate(filter, {
      $set: {
        'sendState.sendLeaseExpiresAt': null,
        'sendState.rateLimitedUntil': rateLimitedUntil,
        'health.state': 'COOLDOWN',
        'health.cooldownUntil': rateLimitedUntil,
        'health.lastFailureCategory': 'RATE_LIMIT',
        'health.lastFailureAt': new Date(),
        updatedAt: new Date()
      }
    });

    logger.warn(
      {
        accountId,
        workspaceId: this.workspaceId,
        retryAfterSec,
        rateLimitedUntil: rateLimitedUntil.toISOString()
      },
      'setProviderCooldown: mailbox rate-limited by provider'
    );
  }

  /**
   * Restores mailbox health to HEALTHY after a successful send.
   * Resets consecutive failure counters and clears cooldowns.
   */
  public async recordSendSuccess(accountId: string): Promise<void> {
    const now = new Date();
    const filter = this.applyScope({ _id: accountId } as any);

    await this.atomicFindOneAndUpdate(filter, {
      $set: {
        'health.state': 'HEALTHY',
        'health.consecutiveFailures': 0,
        'health.failureWindowStart': null,
        'health.lastSuccessfulSendAt': now,
        'health.cooldownUntil': null,
        'health.operatorActionRequired': false,
        'health.operatorMessage': null,
        'sendState.rateLimitedUntil': null,
        updatedAt: now
      }
    });

    logger.debug(
      { accountId, workspaceId: this.workspaceId },
      'recordSendSuccess: mailbox health restored to HEALTHY'
    );
  }

  /**
   * Records a provider failure against mailbox health.
   * Implements bounded sliding failure window (15m), consecutive counters,
   * deterministic cooldowns, and escalation to DEGRADED, AUTH_REQUIRED, or BLOCKED.
   */
  public async recordSendFailure(
    accountId: string,
    failure: {
      category: 'AUTH' | 'RATE_LIMIT' | 'NETWORK' | 'INVALID_RECIPIENT' | 'AMBIGUOUS';
      message?: string;
      retryAfterSec?: number;
    }
  ): Promise<{ state: MailboxHealthState; cooldownUntil?: Date | null; operatorActionRequired: boolean }> {
    const now = new Date();
    const nowMs = now.getTime();
    const filter = this.applyScope({ _id: accountId } as any);
    const current = await this.findOne({ _id: accountId } as any);
    if (!current) {
      return { state: 'HEALTHY', operatorActionRequired: false };
    }

    const currentHealth = current.health || {
      state: 'HEALTHY',
      consecutiveFailures: 0,
      operatorActionRequired: false
    };

    // 15-minute sliding failure window
    const windowMs = 15 * 60 * 1000;
    const windowStart =
      currentHealth.failureWindowStart && nowMs - new Date(currentHealth.failureWindowStart).getTime() < windowMs
        ? currentHealth.failureWindowStart
        : now;

    const consecutiveFailures = (currentHealth.consecutiveFailures || 0) + 1;
    let nextState: MailboxHealthState = currentHealth.state || 'HEALTHY';
    let cooldownUntil: Date | null = null;
    let operatorActionRequired = false;
    let operatorMessage: string | null = null;

    if (failure.category === 'AUTH') {
      nextState = 'AUTH_REQUIRED';
      operatorActionRequired = true;
      operatorMessage = failure.message || 'Provider authorization invalid or revoked. Re-authentication required.';
    } else if (failure.category === 'RATE_LIMIT') {
      const cooldownSec = failure.retryAfterSec && failure.retryAfterSec > 0 ? failure.retryAfterSec : 300;
      nextState = 'COOLDOWN';
      cooldownUntil = new Date(nowMs + cooldownSec * 1000);
      operatorMessage = `Provider rate limit encountered. Cooldown active until ${cooldownUntil.toISOString()}.`;
    } else if (failure.category === 'NETWORK') {
      if (consecutiveFailures >= 5) {
        nextState = 'BLOCKED';
        operatorActionRequired = true;
        operatorMessage = `Mailbox blocked after ${consecutiveFailures} consecutive network failures.`;
      } else if (consecutiveFailures >= 3) {
        nextState = 'DEGRADED';
        cooldownUntil = new Date(nowMs + 5 * 60 * 1000); // 5-minute transient cooldown
        operatorMessage = `Mailbox degraded due to ${consecutiveFailures} consecutive network failures. Cooling down 5m.`;
      }
    } else if (failure.category === 'AMBIGUOUS') {
      if (consecutiveFailures >= 5) {
        nextState = 'BLOCKED';
        operatorActionRequired = true;
        operatorMessage = 'Mailbox blocked due to repeated ambiguous send outcomes.';
      }
    }

    const updateDoc: any = {
      $set: {
        'health.state': nextState,
        'health.consecutiveFailures': consecutiveFailures,
        'health.failureWindowStart': windowStart,
        'health.lastFailureAt': now,
        'health.lastFailureCategory': failure.category,
        'health.cooldownUntil': cooldownUntil,
        'health.operatorActionRequired': operatorActionRequired,
        'health.operatorMessage': operatorMessage,
        lastError: failure.message || `Provider failure (${failure.category})`,
        updatedAt: now
      }
    };

    if (failure.category === 'AUTH') {
      updateDoc.$set.status = 'reauth_required';
    }
    if (cooldownUntil) {
      updateDoc.$set['sendState.rateLimitedUntil'] = cooldownUntil;
    }

    await this.atomicFindOneAndUpdate(filter, updateDoc);

    logger.warn(
      {
        accountId,
        workspaceId: this.workspaceId,
        category: failure.category,
        consecutiveFailures,
        nextState,
        cooldownUntil: cooldownUntil?.toISOString(),
        operatorActionRequired
      },
      'recordSendFailure: mailbox health state updated'
    );

    return { state: nextState, cooldownUntil: cooldownUntil ?? null, operatorActionRequired };
  }

  /**
   * Resets mailbox health to HEALTHY (operator manual reset).
   */
  public async resetHealthState(accountId: string): Promise<void> {
    const now = new Date();
    const filter = this.applyScope({ _id: accountId } as any);

    await this.atomicFindOneAndUpdate(filter, {
      $set: {
        'health.state': 'HEALTHY',
        'health.consecutiveFailures': 0,
        'health.failureWindowStart': null,
        'health.cooldownUntil': null,
        'health.operatorActionRequired': false,
        'health.operatorMessage': null,
        'sendState.rateLimitedUntil': null,
        status: 'connected',
        lastError: null,
        updatedAt: now
      }
    });

    logger.info(
      { accountId, workspaceId: this.workspaceId },
      'resetHealthState: mailbox reset to HEALTHY by operator'
    );
  }

  /**
   * Evaluates if a mailbox is currently eligible to dispatch outreach.
   */
  public static isMailboxEligibleForDispatch(account: EmailAccountDocument | any): {
    eligible: boolean;
    reason?: string;
    retryAfterSec?: number;
  } {
    if (!account) {
      return { eligible: false, reason: 'MAILBOX_NOT_FOUND' };
    }
    if (!['connected', 'active'].includes(account.status)) {
      return { eligible: false, reason: 'MAILBOX_NOT_ACTIVE' };
    }

    const now = Date.now();
    const health = account.health;

    if (health) {
      if (health.operatorActionRequired || health.state === 'BLOCKED') {
        return { eligible: false, reason: 'MAILBOX_BLOCKED' };
      }
      if (health.state === 'AUTH_REQUIRED' || account.status === 'reauth_required') {
        return { eligible: false, reason: 'MAILBOX_AUTH_REQUIRED' };
      }
      if (health.cooldownUntil) {
        const cooldownEnd = new Date(health.cooldownUntil).getTime();
        if (cooldownEnd > now) {
          const retryAfterSec = Math.max(1, Math.ceil((cooldownEnd - now) / 1000));
          return { eligible: false, reason: 'MAILBOX_HEALTH_COOLDOWN', retryAfterSec };
        }
      }
    }

    const sendState = account.sendState;
    if (sendState?.rateLimitedUntil) {
      const rateLimitedUntil = new Date(sendState.rateLimitedUntil).getTime();
      if (rateLimitedUntil > now) {
        const retryAfterSec = Math.max(1, Math.ceil((rateLimitedUntil - now) / 1000));
        return { eligible: false, reason: 'PROVIDER_RATE_LIMITED', retryAfterSec };
      }
    }

    return { eligible: true };
  }

  /**
   * Loads effective policy for a mailbox.
   * Reads sendPolicy from the account document and resolves against platform defaults/ceilings.
   */
  public async resolveEffectiveLimits(accountId: string): Promise<{
    dailyLimit: number;
    hourlyLimit: number;
    minSendIntervalMs: number;
    maxConcurrent: 1;
    sendLeaseDurationMs: number;
  }> {
    const account = await this.findOne({ _id: accountId } as any);
    if (!account) {
      return resolveEffectivePolicy({});
    }

    let wsOutreachPolicy: any = null;
    if (this.workspaceId) {
      const { WorkspaceModel } = await import('../../db/models/workspace.model.js');
      const ws = await WorkspaceModel.findById(this.workspaceId);
      wsOutreachPolicy = ws?.settings?.outreachPolicy;
    }

    return resolveEffectivePolicy({
      accountDailyLimit: account.sendPolicy?.dailyLimit,
      accountHourlyLimit: account.sendPolicy?.hourlyLimit,
      accountMinSendIntervalMs: account.sendPolicy?.minSendIntervalMs,
      workspaceDailyLimit: wsOutreachPolicy?.dailyLimit,
      workspaceHourlyLimit: wsOutreachPolicy?.hourlyLimit,
      workspaceMinSendIntervalMs: wsOutreachPolicy?.minSendIntervalMs
    });
  }
}
