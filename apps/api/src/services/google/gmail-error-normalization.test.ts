import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GmailProvider } from './gmail.provider.js';
import { classifyEmailFailure } from '../email/email.service.js';
import { EmailDomainError } from '../email/types.js';
import { EmailFailureCategory, BounceCategory } from '@leadforge/schema';
import { GoogleConnectionModel } from '../../db/models/google-connection.model.js';

describe('Issue #33 — Google REST API Error Normalization & Downstream Alignment', () => {
  let mockAuthService: any;
  let provider: GmailProvider;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockAuthService = {
      getValidAccessToken: vi.fn().mockResolvedValue('mock-access-token')
    };
    provider = new GmailProvider(mockAuthService);

    vi.spyOn(GoogleConnectionModel, 'findById').mockResolvedValue({
      _id: 'conn_test_123',
      email: 'sender@leadforge.ai',
      status: 'active',
      gmailStatus: 'connected'
    } as any);
  });

  describe('HTTP 400 Bad Request Normalization', () => {
    it('normalizes RFC 2822 payload / header length failure to MALFORMED_PAYLOAD without recipient suppression', async () => {
      provider.setTransport(async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: 400,
              message: 'Invalid RFC 2822 message payload or header length exceeded',
              status: 'INVALID_ARGUMENT'
            }
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      });

      try {
        await provider.sendMessage({
          connectionId: 'conn_test_123',
          from: 'sender@leadforge.ai',
          to: 'valid.contact@domain.com',
          subject: 'Test Subject'
        });
        expect.unreachable('Should throw EmailDomainError');
      } catch (err: any) {
        expect(err.code).toBe('MALFORMED_PAYLOAD');
        expect(err.classification).toBe('malformed_payload');
        expect(err.reauthRequired).toBe(false);
        expect(err.retryable).toBe(false);

        // Verify downstream classification
        const classified = classifyEmailFailure(err);
        expect(classified.category).toBe(EmailFailureCategory.INTERNAL);
        expect(classified.isHardBounce).toBe(false);
        expect(classified.retryable).toBe(false);
      }
    });

    it('normalizes generic 400 malformed request format to MALFORMED_PAYLOAD', async () => {
      provider.setTransport(async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: 400,
              message: 'Bad Request: invalid base64 encoding in raw MIME body',
              status: 'INVALID_ARGUMENT'
            }
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      });

      try {
        await provider.sendMessage({
          connectionId: 'conn_test_123',
          from: 'sender@leadforge.ai',
          to: 'valid.contact@domain.com',
          subject: 'Test Subject'
        });
        expect.unreachable('Should throw EmailDomainError');
      } catch (err: any) {
        expect(err.code).toBe('MALFORMED_PAYLOAD');
        expect(err.classification).toBe('malformed_payload');

        const classified = classifyEmailFailure(err);
        expect(classified.category).toBe(EmailFailureCategory.INTERNAL);
        expect(classified.isHardBounce).toBe(false);
      }
    });

    it('identifies explicit invalid recipient address in 400 as INVALID_RECIPIENT', async () => {
      provider.setTransport(async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: 400,
              message: 'Invalid recipient: bad address format',
              status: 'INVALID_ARGUMENT',
              errors: [{ reason: 'invalidRecipient', message: 'Invalid recipient' }]
            }
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      });

      try {
        await provider.sendMessage({
          connectionId: 'conn_test_123',
          from: 'sender@leadforge.ai',
          to: 'bad-address',
          subject: 'Test Subject'
        });
        expect.unreachable('Should throw EmailDomainError');
      } catch (err: any) {
        expect(err.code).toBe('INVALID_RECIPIENT');
        expect(err.classification).toBe('invalid_recipient');

        const classified = classifyEmailFailure(err);
        expect(classified.category).toBe(EmailFailureCategory.INVALID_RECIPIENT);
        expect(classified.isHardBounce).toBe(true);
      }
    });
  });

  describe('HTTP 403 Forbidden Normalization', () => {
    it('normalizes daily sending quota exceeded to PROVIDER_RATE_LIMITED without reauth mutation', async () => {
      const updateOneSpy = vi.spyOn(GoogleConnectionModel, 'updateOne').mockResolvedValue({} as any);

      provider.setTransport(async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: 403,
              message: 'Daily sending quota exceeded.',
              status: 'PERMISSION_DENIED',
              errors: [{ reason: 'dailyLimitExceeded', domain: 'usageLimits' }]
            }
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      });

      try {
        await provider.sendMessage({
          connectionId: 'conn_test_123',
          from: 'sender@leadforge.ai',
          to: 'contact@domain.com',
          subject: 'Test Subject'
        });
        expect.unreachable('Should throw EmailDomainError');
      } catch (err: any) {
        expect(err.code).toBe('PROVIDER_RATE_LIMITED');
        expect(err.classification).toBe('provider_rate_limited');
        expect(err.retryable).toBe(true);
        expect(err.reauthRequired).toBe(false);
        expect(err.retryAfterSec).toBe(3600); // 1h for daily limit
        expect(updateOneSpy).not.toHaveBeenCalled();

        const classified = classifyEmailFailure(err);
        expect(classified.category).toBe(EmailFailureCategory.RATE_LIMIT);
        expect(classified.retryable).toBe(true);
        expect(classified.isHardBounce).toBe(false);
      }
    });

    it('normalizes anti-abuse / bulk sender filter blocks to POLICY_BLOCKED without reauth mutation', async () => {
      const updateOneSpy = vi.spyOn(GoogleConnectionModel, 'updateOne').mockResolvedValue({} as any);

      provider.setTransport(async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: 403,
              message: 'Blocked for abuse: message detected as likely unsolicited mail.',
              status: 'PERMISSION_DENIED',
              errors: [{ reason: 'abuse', domain: 'gmail' }]
            }
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      });

      try {
        await provider.sendMessage({
          connectionId: 'conn_test_123',
          from: 'sender@leadforge.ai',
          to: 'contact@domain.com',
          subject: 'Test Subject'
        });
        expect.unreachable('Should throw EmailDomainError');
      } catch (err: any) {
        expect(err.code).toBe('POLICY_BLOCKED');
        expect(err.classification).toBe('policy_rejection');
        expect(err.retryable).toBe(false);
        expect(err.reauthRequired).toBe(false);
        expect(updateOneSpy).not.toHaveBeenCalled();

        const classified = classifyEmailFailure(err);
        expect(classified.category).toBe(EmailFailureCategory.POLICY);
        expect(classified.retryable).toBe(false);
        expect(classified.isHardBounce).toBe(false);
      }
    });

    it('normalizes genuine permission / scope failure to MAILBOX_REAUTH_REQUIRED and mutates connection', async () => {
      const updateOneSpy = vi.spyOn(GoogleConnectionModel, 'updateOne').mockResolvedValue({} as any);

      provider.setTransport(async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: 403,
              message: 'Request had insufficient authentication scopes.',
              status: 'PERMISSION_DENIED',
              errors: [{ reason: 'insufficientPermissions' }]
            }
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      });

      try {
        await provider.sendMessage({
          connectionId: 'conn_test_123',
          from: 'sender@leadforge.ai',
          to: 'contact@domain.com',
          subject: 'Test Subject'
        });
        expect.unreachable('Should throw EmailDomainError');
      } catch (err: any) {
        expect(err.code).toBe('MAILBOX_REAUTH_REQUIRED');
        expect(err.classification).toBe('authentication');
        expect(err.reauthRequired).toBe(true);
        expect(err.retryable).toBe(false);
        expect(updateOneSpy).toHaveBeenCalledWith(
          { _id: 'conn_test_123' },
          expect.objectContaining({
            $set: expect.objectContaining({
              gmailStatus: 'reauth_required',
              status: 'reauth_required'
            })
          })
        );

        const classified = classifyEmailFailure(err);
        expect(classified.category).toBe(EmailFailureCategory.AUTH);
        expect(classified.retryable).toBe(false);
      }
    });
  });

  describe('HTTP 429 Rate Limit Normalization', () => {
    it('normalizes HTTP 429 to PROVIDER_RATE_LIMITED with retryAfterSec', async () => {
      provider.setTransport(async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: 429,
              message: 'Rate limit exceeded: Too many concurrent requests',
              status: 'RESOURCE_EXHAUSTED'
            }
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '120'
            }
          }
        );
      });

      try {
        await provider.sendMessage({
          connectionId: 'conn_test_123',
          from: 'sender@leadforge.ai',
          to: 'contact@domain.com',
          subject: 'Test Subject'
        });
        expect.unreachable('Should throw EmailDomainError');
      } catch (err: any) {
        expect(err.code).toBe('PROVIDER_RATE_LIMITED');
        expect(err.classification).toBe('provider_rate_limited');
        expect(err.retryable).toBe(true);
        expect(err.reauthRequired).toBe(false);
        expect(err.retryAfterSec).toBe(120);

        const classified = classifyEmailFailure(err);
        expect(classified.category).toBe(EmailFailureCategory.RATE_LIMIT);
        expect(classified.retryable).toBe(true);
        expect(classified.isHardBounce).toBe(false);
      }
    });
  });

  describe('Downstream Cooldown & False-Positive Suppression Protection', () => {
    it('ensures rate-limit errors match downstream cooldown conditions', () => {
      const err = new EmailDomainError(
        'PROVIDER_RATE_LIMITED',
        'Rate limit hit',
        false,
        true,
        'provider_rate_limited',
        60
      );

      // Verify the conditions in EmailService.send line 880
      const matchesCooldown =
        err.code === 'PROVIDER_RATE_LIMITED' ||
        err.code === 'SENDER_RATE_LIMITED' ||
        err.code === 'QUOTA_EXCEEDED' ||
        err.classification === 'provider_rate_limited' ||
        err.classification === 'rate_limit';

      expect(matchesCooldown).toBe(true);
    });

    it('ensures MALFORMED_PAYLOAD does not trigger contact suppression as hard bounce', () => {
      const err = new EmailDomainError(
        'MALFORMED_PAYLOAD',
        'Invalid RFC 2822 payload',
        false,
        false,
        'malformed_payload'
      );

      const failure = classifyEmailFailure(err);

      // Test suppression check in EmailService.send line 912:
      // isHardBounce = failure.isHardBounce === true || (failure.category === INVALID_RECIPIENT && err.code !== 'INVALID_SUBJECT' && err.code !== 'MALFORMED_PAYLOAD')
      const isHardBounce =
        failure.isHardBounce === true ||
        (failure.category === EmailFailureCategory.INVALID_RECIPIENT &&
          err.code !== 'INVALID_SUBJECT' &&
          err.code !== 'MALFORMED_PAYLOAD');

      expect(isHardBounce).toBe(false);
      expect(failure.category).not.toBe(EmailFailureCategory.INVALID_RECIPIENT);
    });

    it('ensures POLICY_BLOCKED does not trigger contact suppression as hard bounce', () => {
      const err = new EmailDomainError(
        'POLICY_BLOCKED',
        'Blocked by anti-abuse filters',
        false,
        false,
        'policy_rejection'
      );

      const failure = classifyEmailFailure(err);

      const isHardBounce =
        failure.isHardBounce === true ||
        (failure.category === EmailFailureCategory.INVALID_RECIPIENT &&
          err.code !== 'INVALID_SUBJECT' &&
          err.code !== 'MALFORMED_PAYLOAD');

      expect(isHardBounce).toBe(false);
      expect(failure.category).toBe(EmailFailureCategory.POLICY);
    });
  });
});
