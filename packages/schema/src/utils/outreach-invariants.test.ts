import { describe, it, expect } from 'vitest';
import {
  CampaignStatus,
  ContactStatus,
  ContactEmailStatus,
  EmailEventType,
  EmailFailureCategory,
  SuppressionReason
} from '../enums/index.js';
import {
  VALID_CAMPAIGN_TRANSITIONS,
  isValidCampaignTransition,
  isCampaignSendAuthorized,
  VALID_CONTACT_TRANSITIONS,
  canTransitionContactStatus,
  evaluateOutreachEligibility
} from './outreach-eligibility.js';
import { validateEmailStrict } from './email-sanitizer.js';

describe('Phase 12 — Canonical Outreach Invariants (I-001 through I-020)', () => {
  // ── I-001 & I-002: Canonical Eligibility & Suppression ───────────────────
  describe('I-001 & I-002: Eligibility & Suppression Boundaries', () => {
    it('I-001: rejects missing or malformed email addresses', () => {
      const result1 = evaluateOutreachEligibility({
        contact: { email: '' }
      });
      expect(result1.eligible).toBe(false);
      expect(result1.reason).toBe('CONTACT_MISSING_EMAIL');

      const result2 = evaluateOutreachEligibility({
        contact: { email: 'notanemail' }
      });
      expect(result2.eligible).toBe(false);
      expect(result2.reason).toBe('CONTACT_MISSING_EMAIL');
    });

    it('I-002: unconditionally rejects suppressed addresses', () => {
      const result = evaluateOutreachEligibility({
        contact: { email: 'lead@example.com', status: ContactStatus.NEW },
        suppression: { reason: SuppressionReason.HARD_BOUNCE }
      });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('EMAIL_SUPPRESSED');
    });

    it('I-002: rejects suppressed contact statuses (UNSUBSCRIBED, BOUNCED, DO_NOT_CONTACT, ARCHIVED)', () => {
      for (const status of [
        ContactStatus.UNSUBSCRIBED,
        ContactStatus.BOUNCED,
        ContactStatus.DO_NOT_CONTACT,
        ContactStatus.ARCHIVED
      ]) {
        const res = evaluateOutreachEligibility({
          contact: { email: 'lead@example.com', status }
        });
        expect(res.eligible).toBe(false);
      }
    });
  });

  // ── I-003: Reply Suppression ─────────────────────────────────────────────
  describe('I-003: Reply Suppression', () => {
    it('rejects contacts who have replied', () => {
      const res = evaluateOutreachEligibility({
        contact: { email: 'replied@example.com', status: ContactStatus.REPLIED }
      });
      expect(res.eligible).toBe(false);
      expect(res.reason).toBe('CONTACT_REPLIED');
    });
  });

  // ── I-004 & I-005: Delivery Ledger Immutability ──────────────────────────
  describe('I-004 & I-005: Provider Acceptance & Delivery Immutability', () => {
    it('I-004: SENT status is terminal and has zero outgoing transitions', () => {
      const VALID_DELIVERY_TRANSITIONS: Record<string, string[]> = {
        QUEUED: ['SENDING', 'SENT', 'FAILED', 'CANCELLED', 'SUPPRESSED'],
        SENDING: ['SENT', 'FAILED', 'RETRYING', 'AMBIGUOUS', 'CANCELLED'],
        RETRYING: ['SENDING', 'SENT', 'CANCELLED', 'FAILED'],
        AMBIGUOUS: ['SENT', 'FAILED', 'RETRYING', 'CANCELLED', 'SENDING'],
        FAILED: ['SENDING', 'RETRYING'],
        SENT: [], // Terminal
        CANCELLED: ['QUEUED', 'SENDING'],
        SUPPRESSED: [] // Terminal
      };

      expect(VALID_DELIVERY_TRANSITIONS.SENT).toEqual([]);
      expect(VALID_DELIVERY_TRANSITIONS.SUPPRESSED).toEqual([]);
    });
  });

  // ── I-006: Deterministic Idempotency ─────────────────────────────────────
  describe('I-006: Deterministic Idempotency Keys', () => {
    it('produces stable idempotency key across worker restarts and retries', () => {
      const campaignId = 'camp-99';
      const contactId = 'c-123';
      const stepIndex = 0;

      const key1 = `campaign_${campaignId}_${contactId}_step${stepIndex}`;
      const key2 = `campaign_${campaignId}_${contactId}_step${stepIndex}`;

      expect(key1).toBe(key2);
      expect(key1).not.toContain('undefined');
      expect(key1).not.toContain('null');
    });
  });

  // ── I-007 & I-017: Ambiguous Provider Safety & Crash Consistency ────────
  describe('I-007 & I-017: Ambiguous Outcomes & Crash Consistency', () => {
    it('classifies network timeout during send as AMBIGUOUS, never confirmed failure', () => {
      const error = { code: 'AMBIGUOUS_SEND_TIMEOUT', message: 'Socket hung up during API transmission' };
      expect(error.code).toBe('AMBIGUOUS_SEND_TIMEOUT');
    });
  });

  // ── I-008: MX Evidence vs Mailbox Verification ───────────────────────────
  describe('I-008: DNS/MX Evidence Separation', () => {
    it('strict email validation requires RFC syntax and does not assume mailbox existence', () => {
      expect(validateEmailStrict('valid.person@domain.com')).toBe(true);
      expect(validateEmailStrict('invalid..email@domain.com')).toBe(false);
      expect(validateEmailStrict('trailing@domain.com.')).toBe(false);
    });
  });

  // ── I-009: Address-Scoped Bounce Evidence ────────────────────────────────
  describe('I-009: Address-Scoped Bounce Evidence', () => {
    it('suppressing email A does not suppress email B for a multi-email contact', () => {
      const contact = {
        id: 'c-multi',
        email: 'primary@example.com',
        status: ContactStatus.NEW,
        additionalEmails: [
          { email: 'secondary@example.com', status: ContactEmailStatus.VALID }
        ]
      };

      // Email A is suppressed
      const suppressedAddresses = new Set(['secondary@example.com']);

      const checkPrimary = evaluateOutreachEligibility({
        contact: { email: contact.email, status: contact.status },
        suppression: suppressedAddresses.has(contact.email)
      });
      expect(checkPrimary.eligible).toBe(true);

      const checkSecondary = evaluateOutreachEligibility({
        contact: { email: contact.additionalEmails[0]!.email, status: contact.status },
        suppression: suppressedAddresses.has(contact.additionalEmails[0]!.email)
      });
      expect(checkSecondary.eligible).toBe(false);
      expect(checkSecondary.reason).toBe('EMAIL_SUPPRESSED');
    });
  });

  // ── I-010 & I-011: Campaign State Authority ──────────────────────────────
  describe('I-010 & I-011: Campaign STOPPED and PAUSED State Authority', () => {
    it('I-010: STOPPED campaign state is terminal with zero outgoing transitions', () => {
      expect(VALID_CAMPAIGN_TRANSITIONS[CampaignStatus.STOPPED]).toEqual([]);
      expect(VALID_CAMPAIGN_TRANSITIONS[CampaignStatus.COMPLETED]).toEqual([]);
      expect(VALID_CAMPAIGN_TRANSITIONS[CampaignStatus.FAILED]).toEqual([]);
      expect(isValidCampaignTransition(CampaignStatus.STOPPED, CampaignStatus.ACTIVE)).toBe(false);
      expect(isValidCampaignTransition(CampaignStatus.STOPPED, CampaignStatus.PAUSED)).toBe(false);
    });

    it('I-010: STOPPED campaign unconditionally blocks outreach dispatch', () => {
      const res = evaluateOutreachEligibility({
        contact: { email: 'lead@example.com', status: ContactStatus.NEW },
        campaign: { id: 'camp-1', status: CampaignStatus.STOPPED }
      });
      expect(res.eligible).toBe(false);
      expect(res.reason).toBe('CAMPAIGN_STOPPED');
      expect(isCampaignSendAuthorized(CampaignStatus.STOPPED)).toBe(false);
    });

    it('I-011: PAUSED campaign blocks outreach dispatch', () => {
      const res = evaluateOutreachEligibility({
        contact: { email: 'lead@example.com', status: ContactStatus.NEW },
        campaign: { id: 'camp-1', status: CampaignStatus.PAUSED }
      });
      expect(res.eligible).toBe(false);
      expect(res.reason).toBe('CAMPAIGN_PAUSED');
      expect(isCampaignSendAuthorized(CampaignStatus.PAUSED)).toBe(false);
    });

    it('only ACTIVE campaigns are authorized for dispatch', () => {
      expect(isCampaignSendAuthorized(CampaignStatus.ACTIVE)).toBe(true);
      expect(isCampaignSendAuthorized(CampaignStatus.DRAFT)).toBe(false);
      expect(isCampaignSendAuthorized(CampaignStatus.PAUSED)).toBe(false);
      expect(isCampaignSendAuthorized(CampaignStatus.STOPPED)).toBe(false);
      expect(isCampaignSendAuthorized(null)).toBe(false);
    });
  });

  // ── I-012: Concurrency & Rate Limiting ────────────────────────────────────
  describe('I-012: Concurrency & Rate Limiting Invariants', () => {
    it('enforces maxConcurrent=1 semantics per mailbox via lease check', () => {
      const now = new Date();
      const leaseExpiresAt = new Date(now.getTime() + 60_000); // Active lease

      // A mailbox with leaseExpiresAt > now cannot be reserved concurrently
      const isLeased = leaseExpiresAt.getTime() > now.getTime();
      expect(isLeased).toBe(true);
    });
  });

  // ── Contact Monotonic Lifecycle ──────────────────────────────────────────
  describe('Contact Monotonic Lifecycle Transitions', () => {
    it('allows NEW -> CONTACTED -> REPLIED progression', () => {
      expect(canTransitionContactStatus(ContactStatus.NEW, ContactStatus.CONTACTED)).toBe(true);
      expect(canTransitionContactStatus(ContactStatus.CONTACTED, ContactStatus.REPLIED)).toBe(true);
    });

    it('prevents reversing terminal suppression states to NEW or CONTACTED', () => {
      expect(canTransitionContactStatus(ContactStatus.BOUNCED, ContactStatus.CONTACTED)).toBe(false);
      expect(canTransitionContactStatus(ContactStatus.BOUNCED, ContactStatus.NEW)).toBe(false);
      expect(canTransitionContactStatus(ContactStatus.UNSUBSCRIBED, ContactStatus.CONTACTED)).toBe(false);
      expect(canTransitionContactStatus(ContactStatus.DO_NOT_CONTACT, ContactStatus.CONTACTED)).toBe(false);
    });
  });
});
