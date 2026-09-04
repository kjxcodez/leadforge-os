import { z } from 'zod';

export const operationTypeSchema = z.enum([
  'campaign:execution',
  'email:send',
  'email:reconciliation',
  'gmail:reply-poll',
  'delivery:retry',
  'sequence:execution',
  'scraper:maps',
  'crawler:website',
  'enrich:website',
  'enrich:linkedin',
  'enrich:intelligence',
  'automation:workflow'
]);
export type OperationType = z.infer<typeof operationTypeSchema>;

export const operationStatusSchema = z.enum([
  'queued',
  'running',
  'retrying',
  'completed',
  'failed',
  'ambiguous',
  'stale',
  'cancelled'
]);
export type OperationStatus = z.infer<typeof operationStatusSchema>;

export const failureClassSchema = z.enum([
  'auto_recovering',
  'retry_scheduled',
  'requires_reconciliation',
  'requires_manual_intervention',
  'permanent_failure'
]);
export type FailureClass = z.infer<typeof failureClassSchema>;

export const subsystemHealthStatusSchema = z.enum([
  'healthy',
  'degraded',
  'failed',
  'unknown',
  'not_connected'
]);
export type SubsystemHealthStatus = z.infer<typeof subsystemHealthStatusSchema>;

export const subsystemHealthSchema = z.object({
  status: subsystemHealthStatusSchema,
  message: z.string(),
  lastCheckedAt: z.string(),
  latencyMs: z.number().nullable().optional(),
  details: z.record(z.any()).nullable().optional()
});
export type SubsystemHealth = z.infer<typeof subsystemHealthSchema>;

export const operationsHealthSummarySchema = z.object({
  workspaceId: z.string(),
  overallStatus: subsystemHealthStatusSchema,
  timestamp: z.string(),
  subsystems: z.object({
    api: subsystemHealthSchema,
    mongodb: subsystemHealthSchema,
    sqlite: subsystemHealthSchema,
    gmail: subsystemHealthSchema,
    scheduler: subsystemHealthSchema,
    workers: subsystemHealthSchema,
    inboundPolling: subsystemHealthSchema,
    reconciliation: subsystemHealthSchema
  }),
  metrics: z.object({
    activeOperationsCount: z.number(),
    failedOperationsCount: z.number(),
    staleOperationsCount: z.number(),
    retryingCount: z.number(),
    lastSuccessfulPollAt: z.string().nullable().optional(),
    lastSuccessfulReconciliationAt: z.string().nullable().optional()
  })
});
export type OperationsHealthSummary = z.infer<typeof operationsHealthSummarySchema>;

export const operationRecordSchema = z.object({
  id: z.string(),
  type: operationTypeSchema,
  workspaceId: z.string(),
  status: operationStatusSchema,
  createdAt: z.string(),
  startedAt: z.string().nullable().optional(),
  finishedAt: z.string().nullable().optional(),
  durationMs: z.number().nullable().optional(),
  attempt: z.number(),
  maxAttempts: z.number(),
  nextRetryAt: z.string().nullable().optional(),
  lastHeartbeatAt: z.string().nullable().optional(),
  isStale: z.boolean(),

  // Failure / Diagnostics
  lastError: z.string().nullable().optional(),
  errorCode: z.string().nullable().optional(),
  failureClass: failureClassSchema.nullable().optional(),
  safeHumanMessage: z.string().nullable().optional(),
  technicalMessage: z.string().nullable().optional(),
  retryable: z.boolean(),

  // Correlation & Context
  correlationId: z.string().nullable().optional(),
  campaignId: z.string().nullable().optional(),
  campaignName: z.string().nullable().optional(),
  contactId: z.string().nullable().optional(),
  contactEmail: z.string().nullable().optional(),
  deliveryId: z.string().nullable().optional(),
  sequenceExecutionId: z.string().nullable().optional(),
  provider: z.string().nullable().optional(),
  providerMessageId: z.string().nullable().optional(),

  // Metadata
  metadata: z.record(z.any()).nullable().optional()
});
export type OperationRecord = z.infer<typeof operationRecordSchema>;

export const operationTimelineEventSchema = z.object({
  id: z.string(),
  operationId: z.string(),
  correlationId: z.string().nullable().optional(),
  eventName: z.string(),
  timestamp: z.string(),
  severity: z.enum(['info', 'warn', 'error']),
  message: z.string(),
  details: z.record(z.any()).nullable().optional()
});
export type OperationTimelineEvent = z.infer<typeof operationTimelineEventSchema>;

const coerceQueryBoolean = z.preprocess((val) => {
  if (typeof val === 'string') {
    if (val.toLowerCase() === 'true') return true;
    if (val.toLowerCase() === 'false') return false;
  }
  return val;
}, z.boolean().optional());

export const operationsQueryDtoSchema = z.object({
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(50),
  status: z.string().optional(),
  type: z.string().optional(),
  failureClass: z.string().optional(),
  search: z.string().optional(),
  isStale: coerceQueryBoolean,
  retryable: coerceQueryBoolean,
  campaignId: z.string().optional(),
  contactId: z.string().optional()
});
export type OperationsQueryDto = z.infer<typeof operationsQueryDtoSchema>;

export const retryOperationDtoSchema = z.object({
  force: z.boolean().optional().default(false)
});
export type RetryOperationDto = z.infer<typeof retryOperationDtoSchema>;

/**
 * Classifies an operation failure into an actionable failure class.
 */
export function classifyOperationFailure(params: {
  status: OperationStatus;
  retryable: boolean;
  attempt: number;
  maxAttempts: number;
  isStale?: boolean;
  errorCode?: string | null;
}): FailureClass {
  const { status, retryable, attempt, maxAttempts, isStale, errorCode } = params;

  if (status === 'ambiguous' || errorCode === 'AMBIGUOUS_SEND_TIMEOUT') {
    return 'requires_reconciliation';
  }

  if (isStale) {
    return 'requires_manual_intervention';
  }

  if (status === 'retrying') {
    return 'retry_scheduled';
  }

  if (status === 'failed' || status === 'cancelled') {
    if (retryable && attempt < maxAttempts) {
      return 'auto_recovering';
    }
    if (retryable && attempt >= maxAttempts) {
      return 'requires_manual_intervention';
    }
    return 'permanent_failure';
  }

  return 'auto_recovering';
}
