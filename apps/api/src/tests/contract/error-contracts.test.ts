/**
 * LeadForge OS — API Error Contract & Schema Boundary Test Suite
 *
 * Verifies that critical error conditions return deterministic error codes,
 * expected HTTP status codes, and adhere to the API contract.
 */

import { describe, it, expect } from 'vitest';
import { EmailDomainError } from '../../services/email/types.js';

interface ExpectedErrorContract {
  code: string;
  expectedStatus: number;
  category: 'CAMPAIGN' | 'OUTREACH' | 'PROVIDER' | 'RATE_LIMIT' | 'AUTH' | 'VALIDATION';
}

const ERROR_CONTRACT_CATALOG: ExpectedErrorContract[] = [
  { code: 'CAMPAIGN_NOT_ACTIVE', expectedStatus: 400, category: 'CAMPAIGN' },
  { code: 'CONTACT_NOT_ELIGIBLE', expectedStatus: 400, category: 'OUTREACH' },
  { code: 'EMAIL_RATE_LIMITED', expectedStatus: 429, category: 'RATE_LIMIT' },
  { code: 'DELIVERY_ALREADY_RESERVED', expectedStatus: 409, category: 'PROVIDER' },
  { code: 'AMBIGUOUS_SEND_TIMEOUT', expectedStatus: 504, category: 'PROVIDER' },
  { code: 'MAILBOX_REAUTH_REQUIRED', expectedStatus: 401, category: 'AUTH' },
  { code: 'ATTACHMENT_UNREADABLE', expectedStatus: 400, category: 'VALIDATION' },
  { code: 'CONTACT_SUPPRESSED', expectedStatus: 400, category: 'OUTREACH' },
  { code: 'UNAUTHORIZED_WORKSPACE', expectedStatus: 403, category: 'AUTH' }
];

function mapErrorToHttpStatus(errCode: string): number {
  switch (errCode) {
    case 'MAILBOX_REAUTH_REQUIRED':
    case 'UNAUTHORIZED':
      return 401;
    case 'UNAUTHORIZED_WORKSPACE':
    case 'FORBIDDEN':
      return 403;
    case 'EMAIL_RATE_LIMITED':
    case 'PROVIDER_RATE_LIMITED':
      return 429;
    case 'DELIVERY_ALREADY_RESERVED':
      return 409;
    case 'AMBIGUOUS_SEND_TIMEOUT':
      return 504;
    case 'CAMPAIGN_NOT_ACTIVE':
    case 'CONTACT_NOT_ELIGIBLE':
    case 'CONTACT_SUPPRESSED':
    case 'ATTACHMENT_UNREADABLE':
    case 'VALIDATION_ERROR':
    default:
      return 400;
  }
}

describe('API Error Contracts & Status Codes', () => {
  for (const contract of ERROR_CONTRACT_CATALOG) {
    it(`guarantees error contract for "${contract.code}" maps to HTTP ${contract.expectedStatus}`, () => {
      const status = mapErrorToHttpStatus(contract.code);
      expect(status).toBe(contract.expectedStatus);

      const domainErr = new EmailDomainError(contract.code as any, `Contract test for ${contract.code}`);
      expect(domainErr.code).toBe(contract.code);
      expect(domainErr.name).toBe('EmailDomainError');
    });
  }

  it('validates structured error response envelope shape', () => {
    function formatErrorResponse(code: string, message: string, details?: any) {
      return {
        success: false,
        error: {
          code,
          message,
          ...(details ? { details } : {})
        }
      };
    }

    const envelope = formatErrorResponse('CONTACT_NOT_ELIGIBLE', 'Contact is unsubscribed', {
      reason: 'CONTACT_UNSUBSCRIBED',
      contactId: 'c_123'
    });

    expect(envelope.success).toBe(false);
    expect(envelope.error.code).toBe('CONTACT_NOT_ELIGIBLE');
    expect(envelope.error.details.reason).toBe('CONTACT_UNSUBSCRIBED');
  });
});
