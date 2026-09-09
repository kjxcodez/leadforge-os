import { describe, it, expect } from 'vitest';
import { emailDeliveryStatusSchema, emailDeliverySchema } from './delivery.js';

describe('emailDeliveryStatusSchema (Phase 1 Data Semantics)', () => {
  it('accepts RECEIVED status for inbound deliveries', () => {
    const result = emailDeliveryStatusSchema.safeParse('RECEIVED');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('RECEIVED');
    }
  });

  it('preserves all canonical outbound delivery statuses', () => {
    const canonicalStatuses = [
      'QUEUED',
      'SENDING',
      'SENT',
      'FAILED',
      'RETRYING',
      'AMBIGUOUS',
      'CANCELLED',
      'SUPPRESSED',
      'RECEIVED'
    ];

    for (const status of canonicalStatuses) {
      const result = emailDeliveryStatusSchema.safeParse(status);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(status);
      }
    }

    // Verify exact enum options list contains RECEIVED and all 9 statuses
    expect(emailDeliveryStatusSchema.options).toEqual(canonicalStatuses);
  });

  it('rejects unrecognized or legacy invalid delivery statuses', () => {
    const invalidStatuses = ['INVALID', 'UNKNOWN', 'DELIVERED', 'BOUNCED', 'OPENED', 'CLICKED'];
    for (const invalid of invalidStatuses) {
      const result = emailDeliveryStatusSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    }
  });

  it('validates a complete inbound delivery with direction INBOUND and status RECEIVED', () => {
    const validInboundRecord = {
      id: 'del_inbound_1234567890123456',
      workspaceId: 'ws_test12345678901234567',
      sequenceId: 'inbound-direct',
      executionId: 'inbound-direct',
      stepIndex: 0,
      contactId: 'con_test12345678901234567',
      accountId: 'acc_test12345678901234567',
      senderEmail: 'prospect@example.com',
      recipientEmail: 'outreach@mycompany.com',
      subject: 'Re: Quick inquiry',
      direction: 'INBOUND' as const,
      status: 'RECEIVED' as const,
      processingStatus: 'MATCHED' as const,
      idempotencyKey: 'idemp_inbound_test_123',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const parsed = emailDeliverySchema.safeParse(validInboundRecord);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.direction).toBe('INBOUND');
      expect(parsed.data.status).toBe('RECEIVED');
    }
  });
});
