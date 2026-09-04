import { describe, it, expect } from 'vitest';
import {
  classifyOperationFailure,
  operationRecordSchema,
  operationsHealthSummarySchema,
  operationTimelineEventSchema,
  operationsQueryDtoSchema
} from './operations.js';

describe('classifyOperationFailure', () => {
  it('classifies ambiguous delivery or AMBIGUOUS_SEND_TIMEOUT as requires_reconciliation', () => {
    const result1 = classifyOperationFailure({
      status: 'ambiguous',
      retryable: false,
      attempt: 1,
      maxAttempts: 3
    });
    expect(result1).toBe('requires_reconciliation');

    const result2 = classifyOperationFailure({
      status: 'failed',
      retryable: false,
      attempt: 1,
      maxAttempts: 3,
      errorCode: 'AMBIGUOUS_SEND_TIMEOUT'
    });
    expect(result2).toBe('requires_reconciliation');
  });

  it('classifies stale operations as requires_manual_intervention', () => {
    const result = classifyOperationFailure({
      status: 'running',
      retryable: true,
      attempt: 1,
      maxAttempts: 3,
      isStale: true
    });
    expect(result).toBe('requires_manual_intervention');
  });

  it('classifies retrying status as retry_scheduled', () => {
    const result = classifyOperationFailure({
      status: 'retrying',
      retryable: true,
      attempt: 2,
      maxAttempts: 5
    });
    expect(result).toBe('retry_scheduled');
  });

  it('classifies retryable failures below max attempts as auto_recovering', () => {
    const result = classifyOperationFailure({
      status: 'failed',
      retryable: true,
      attempt: 1,
      maxAttempts: 3
    });
    expect(result).toBe('auto_recovering');
  });

  it('classifies exhausted retryable failures as requires_manual_intervention', () => {
    const result = classifyOperationFailure({
      status: 'failed',
      retryable: true,
      attempt: 3,
      maxAttempts: 3
    });
    expect(result).toBe('requires_manual_intervention');
  });

  it('classifies non-retryable failures as permanent_failure', () => {
    const result = classifyOperationFailure({
      status: 'failed',
      retryable: false,
      attempt: 1,
      maxAttempts: 3
    });
    expect(result).toBe('permanent_failure');
  });
});

describe('Operations Zod Schemas Validation', () => {
  it('validates a complete OperationRecord', () => {
    const validRecord = {
      id: 'op_123',
      type: 'email:send',
      workspaceId: 'ws_abc',
      status: 'failed',
      createdAt: '2026-09-04T00:00:00.000Z',
      startedAt: '2026-09-04T00:00:01.000Z',
      attempt: 3,
      maxAttempts: 3,
      isStale: false,
      lastError: 'Permanent rejection 550',
      errorCode: 'RECIPIENT_NOT_FOUND',
      failureClass: 'permanent_failure',
      safeHumanMessage: 'The recipient address does not exist.',
      retryable: false,
      campaignId: 'camp_999',
      contactEmail: 'lead@target.com'
    };

    const parsed = operationRecordSchema.parse(validRecord);
    expect(parsed.id).toBe('op_123');
    expect(parsed.type).toBe('email:send');
    expect(parsed.retryable).toBe(false);
  });

  it('validates OperationsHealthSummary with all 8 subsystems', () => {
    const validHealth = {
      workspaceId: 'ws_abc',
      overallStatus: 'healthy',
      timestamp: '2026-09-04T00:00:00.000Z',
      subsystems: {
        api: { status: 'healthy', message: 'API responding', lastCheckedAt: '2026-09-04T00:00:00.000Z' },
        mongodb: { status: 'healthy', message: 'Connected', lastCheckedAt: '2026-09-04T00:00:00.000Z' },
        sqlite: { status: 'healthy', message: 'Read/Write OK', lastCheckedAt: '2026-09-04T00:00:00.000Z' },
        gmail: { status: 'healthy', message: 'Mailbox connected', lastCheckedAt: '2026-09-04T00:00:00.000Z' },
        scheduler: { status: 'healthy', message: 'Scheduler active', lastCheckedAt: '2026-09-04T00:00:00.000Z' },
        workers: { status: 'healthy', message: 'Workers active', lastCheckedAt: '2026-09-04T00:00:00.000Z' },
        inboundPolling: { status: 'healthy', message: 'Polling regular', lastCheckedAt: '2026-09-04T00:00:00.000Z' },
        reconciliation: { status: 'healthy', message: 'Reconciliation clean', lastCheckedAt: '2026-09-04T00:00:00.000Z' }
      },
      metrics: {
        activeOperationsCount: 0,
        failedOperationsCount: 2,
        staleOperationsCount: 0,
        retryingCount: 0,
        lastSuccessfulPollAt: '2026-09-04T00:00:00.000Z',
        lastSuccessfulReconciliationAt: '2026-09-04T00:00:00.000Z'
      }
    };

    const parsed = operationsHealthSummarySchema.parse(validHealth);
    expect(parsed.overallStatus).toBe('healthy');
    expect(Object.keys(parsed.subsystems)).toHaveLength(8);
  });

  it('validates OperationTimelineEvent schema and timestamps', () => {
    const event = {
      id: 'evt_1',
      operationId: 'op_123',
      correlationId: 'corr_xyz',
      eventName: 'email.send.accepted',
      timestamp: '2026-09-04T00:00:02.000Z',
      severity: 'info',
      message: 'Email accepted by Gmail API',
      details: { providerMessageId: 'msg_987' }
    };

    const parsed = operationTimelineEventSchema.parse(event);
    expect(parsed.eventName).toBe('email.send.accepted');
    expect(parsed.severity).toBe('info');
  });

  it('applies defaults and coerces parameters in OperationsQueryDto', () => {
    const query = {
      page: '2',
      limit: '25',
      isStale: 'true',
      retryable: 'false',
      status: 'failed'
    };

    const parsed = operationsQueryDtoSchema.parse(query);
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(25);
    expect(parsed.isStale).toBe(true);
    expect(parsed.retryable).toBe(false);
    expect(parsed.status).toBe('failed');
  });
});
