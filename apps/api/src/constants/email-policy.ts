/**
 * Platform-level email sending policy defaults and immutable safety ceilings.
 *
 * Defaults: configurable via environment or application config.
 * Ceilings: server-side immutable hard limits — never overridable by workspace or account.
 *
 * Policy resolution chain:
 *   Platform default → Workspace override → Email account override → Platform ceiling applied.
 *
 * The effective value is always: min(accountOrWorkspaceOverride ?? platformDefault, platformCeiling).
 */
export const EMAIL_POLICY = {
  /**
   * Platform defaults — applied when workspace and account have no override.
   */
  DEFAULTS: {
    DAILY_LIMIT: 200,
    HOURLY_LIMIT: 50,
    MIN_SEND_INTERVAL_MS: 1500,  // 1.5 seconds minimum between sends
    MAX_CONCURRENT: 1            // One in-flight send at a time per mailbox
  },

  /**
   * Platform ceilings — immutable hard limits; never overridable by workspace or account policy.
   * These are enforced inside reserveSendSlot() regardless of stored policy values.
   */
  CEILINGS: {
    DAILY_LIMIT: 2000,
    HOURLY_LIMIT: 200,
    MIN_SEND_INTERVAL_MS: 1000, // Floor: minSendIntervalMs can never be reduced below 1000ms
    MAX_CONCURRENT: 1          // Platform enforces exactly 1 concurrent send per mailbox (non-negotiable)
  },

  /**
   * Send lease duration: maximum time an in-flight provider call may hold the mailbox lease.
   * If the worker crashes while holding the lease, the mailbox becomes available after this period.
   */
  SEND_LEASE_DURATION_MS: 30_000  // 30 seconds
} as const;

/**
 * Effective policy resolution helper.
 * Applies: Math.min(override ?? platformDefault, platformCeiling).
 */
export function resolveEffectivePolicy(params: {
  accountDailyLimit?: number | null | undefined;
  accountHourlyLimit?: number | null | undefined;
  accountMinSendIntervalMs?: number | null | undefined;
  workspaceDailyLimit?: number | null | undefined;
  workspaceHourlyLimit?: number | null | undefined;
  workspaceMinSendIntervalMs?: number | null | undefined;
}): {
  dailyLimit: number;
  hourlyLimit: number;
  minSendIntervalMs: number;
  maxConcurrent: 1;
  sendLeaseDurationMs: number;
} {
  const { DEFAULTS, CEILINGS, SEND_LEASE_DURATION_MS } = EMAIL_POLICY;

  // Account override > workspace override > platform default, all subject to ceiling
  const rawDailyLimit =
    params.accountDailyLimit ??
    params.workspaceDailyLimit ??
    DEFAULTS.DAILY_LIMIT;

  const rawHourlyLimit =
    params.accountHourlyLimit ??
    params.workspaceHourlyLimit ??
    DEFAULTS.HOURLY_LIMIT;

  const rawMinInterval =
    params.accountMinSendIntervalMs ??
    params.workspaceMinSendIntervalMs ??
    DEFAULTS.MIN_SEND_INTERVAL_MS;

  return {
    dailyLimit: Math.min(rawDailyLimit, CEILINGS.DAILY_LIMIT),
    hourlyLimit: Math.min(rawHourlyLimit, CEILINGS.HOURLY_LIMIT),
    minSendIntervalMs: Math.max(rawMinInterval, CEILINGS.MIN_SEND_INTERVAL_MS),
    maxConcurrent: 1,  // Platform invariant
    sendLeaseDurationMs: SEND_LEASE_DURATION_MS
  };
}
