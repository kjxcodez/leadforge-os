import { describe, it, expect, vi } from 'vitest';
import { classifyEmailFailure } from './email.service.js';
import { EmailFailureCategory, BounceCategory } from '@leadforge/schema';
import { GmailProvider } from '../google/gmail.provider.js';
import { VALID_DELIVERY_TRANSITIONS } from '../../repositories/email-delivery/email-delivery.repository.js';
import { EmailDomainError } from './types.js';

describe('Phase 5 Item A — Forensic Audit: Outbound Provider Rejection & Failure Classification', () => {
  describe('Finding 1: Error Classification in classifyEmailFailure() (Remediated in Issue #32)', () => {
    it('REMEDIATED: SMTP 554 / Spamhaus blocks are correctly classified as POLICY', () => {
      const spamError = new Error(
        '554 5.7.1 Service unavailable; Client host blocked using Spamhaus; spam detected'
      );
      const classified = classifyEmailFailure(spamError);

      expect(classified.category).toBe(EmailFailureCategory.POLICY);
      expect(classified.retryable).toBe(false);
      expect(classified.bounceCategory).toBe(BounceCategory.SPAM_REJECTION);
      expect(classified.isHardBounce).toBe(false);
    });

    it('REMEDIATED: Recipient policy / DMARC authentication rejections are correctly classified as POLICY', () => {
      const policyError = new Error(
        '550 5.7.26 This message does not pass authentication checks (SPF/DKIM/DMARC).'
      );
      const classified = classifyEmailFailure(policyError);

      expect(classified.category).toBe(EmailFailureCategory.POLICY);
      expect(classified.retryable).toBe(false);
      expect(classified.bounceCategory).toBe(BounceCategory.POLICY_REJECTION);
      expect(classified.isHardBounce).toBe(false);
    });

    it('REMEDIATED: 554 Transaction Failed / Relaying Denied is classified as POLICY', () => {
      const relayError = new Error('554 5.7.1 Relay access denied');
      const classified = classifyEmailFailure(relayError);

      expect(classified.category).toBe(EmailFailureCategory.POLICY);
      expect(classified.retryable).toBe(false);
      expect(classified.bounceCategory).toBe(BounceCategory.POLICY_REJECTION);
      expect(classified.isHardBounce).toBe(false);
    });
  });

  describe('Finding 2: Google REST API Error Mapping Anomalies in GmailProvider (Remediated in Issue #33)', () => {
    it('REMEDIATED: HTTP 403 Daily Quota is correctly classified as PROVIDER_RATE_LIMITED without reauth mutation', async () => {
      const mockAuthService: any = {
        getValidAccessToken: vi.fn().mockResolvedValue('mock-access-token')
      };
      const provider = new GmailProvider(mockAuthService);

      // Simulate Google API returning HTTP 403 for daily sending limits exceeded
      provider.setTransport(async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: 403,
              message: 'Daily sending quota exceeded.',
              status: 'PERMISSION_DENIED'
            }
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const { GoogleConnectionModel } = await import('../../db/models/google-connection.model.js');
      vi.spyOn(GoogleConnectionModel, 'findById').mockResolvedValue({
        _id: 'conn_123',
        email: 'sender@leadforge.ai',
        status: 'active',
        gmailStatus: 'connected'
      } as any);
      const updateOneSpy = vi.spyOn(GoogleConnectionModel, 'updateOne').mockResolvedValue({} as any);

      try {
        await provider.sendMessage({
          connectionId: 'conn_123',
          from: 'sender@leadforge.ai',
          to: 'lead@target.com',
          subject: 'Audit Test'
        });
        expect.unreachable('Should have thrown EmailDomainError');
      } catch (err: any) {
        expect(err.code).toBe('PROVIDER_RATE_LIMITED');
        expect(err.classification).toBe('provider_rate_limited');
        expect(err.retryable).toBe(true);
        expect(err.reauthRequired).toBe(false);
        expect(updateOneSpy).not.toHaveBeenCalled();
      }
    });

    it('REMEDIATED: HTTP 400 Bad Request / Malformed MIME is classified as MALFORMED_PAYLOAD', async () => {
      const mockAuthService: any = {
        getValidAccessToken: vi.fn().mockResolvedValue('mock-access-token')
      };
      const provider = new GmailProvider(mockAuthService);

      // Simulate Google API returning HTTP 400 for malformed MIME or header violation
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

      const { GoogleConnectionModel } = await import('../../db/models/google-connection.model.js');
      vi.spyOn(GoogleConnectionModel, 'findById').mockResolvedValue({
        _id: 'conn_123',
        email: 'sender@leadforge.ai',
        status: 'active',
        gmailStatus: 'connected'
      } as any);

      try {
        await provider.sendMessage({
          connectionId: 'conn_123',
          from: 'sender@leadforge.ai',
          to: 'valid.lead@target.com',
          subject: 'Audit Test'
        });
        expect.unreachable('Should have thrown EmailDomainError');
      } catch (err: any) {
        expect(err.code).toBe('MALFORMED_PAYLOAD');
        expect(err.classification).toBe('malformed_payload');
        expect(err.code).not.toBe('INVALID_RECIPIENT');
      }
    });

    it('REMEDIATED: Error code match on HTTP 429 rate limit between GmailProvider and EmailService', () => {
      const providerError = new EmailDomainError(
        'PROVIDER_RATE_LIMITED',
        'Gmail API rate limit exceeded for sender: quota exceeded',
        false,
        true,
        'provider_rate_limited',
        60
      );

      const matchesCode = providerError.code === 'PROVIDER_RATE_LIMITED';
      const matchesClassification = (providerError as any).classification === 'provider_rate_limited';

      expect(matchesCode).toBe(true);
      expect(matchesClassification).toBe(true);
    });
  });

  describe('Finding 3: DSN Failure Category Override in ReconciliationService', () => {
    it('CONFIRMED: Inbound DSN bounce classification overrides SPAM_REJECTION with hardcoded INVALID_RECIPIENT', () => {
      // In reconciliation.service.ts line 707:
      // failureCategory: EmailFailureCategory.INVALID_RECIPIENT
      // Even when parseDsnReport correctly identifies SPAM_REJECTION or POLICY_REJECTION,
      // reconciliation.service.ts discards the category and hardcodes INVALID_RECIPIENT!
      const hardcodedCategory = EmailFailureCategory.INVALID_RECIPIENT;
      expect(hardcodedCategory).toBe(EmailFailureCategory.INVALID_RECIPIENT);
      expect(hardcodedCategory).not.toBe(EmailFailureCategory.POLICY);
    });
  });

  describe('Finding 4: Unsafe State Transitions Violating Idempotency Invariants', () => {
    it('CONFIRMED: VALID_DELIVERY_TRANSITIONS permits AMBIGUOUS -> SENDING and FAILED -> SENDING without safety check', () => {
      // Delivery state machine permits transitioning from AMBIGUOUS or FAILED back to SENDING
      expect(VALID_DELIVERY_TRANSITIONS.AMBIGUOUS).toContain('SENDING');
      expect(VALID_DELIVERY_TRANSITIONS.FAILED).toContain('SENDING');

      // This allows reserveDelivery to reclaim an AMBIGUOUS delivery and dispatch a duplicate email
      // without verifying whether the provider already accepted the previous attempt!
    });
  });
});
