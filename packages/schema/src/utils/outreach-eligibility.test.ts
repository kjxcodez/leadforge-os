/**
 * LeadForge OS — Campaign Lifecycle & Outreach Eligibility Policy Tests
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateOutreachEligibility,
  isValidCampaignTransition,
  isCampaignSendAuthorized,
  canTransitionContactStatus
} from './outreach-eligibility.js';
import { CampaignStatus, ContactStatus, ContactEmailStatus } from '../enums/index.js';

describe('Campaign State Machine Transitions', () => {
  it('allows valid lifecycle transitions', () => {
    expect(isValidCampaignTransition(CampaignStatus.DRAFT, CampaignStatus.ACTIVE)).toBe(true);
    expect(isValidCampaignTransition(CampaignStatus.DRAFT, CampaignStatus.STOPPED)).toBe(true);
    expect(isValidCampaignTransition(CampaignStatus.ACTIVE, CampaignStatus.PAUSED)).toBe(true);
    expect(isValidCampaignTransition(CampaignStatus.ACTIVE, CampaignStatus.STOPPED)).toBe(true);
    expect(isValidCampaignTransition(CampaignStatus.ACTIVE, CampaignStatus.COMPLETED)).toBe(true);
    expect(isValidCampaignTransition(CampaignStatus.PAUSED, CampaignStatus.ACTIVE)).toBe(true);
    expect(isValidCampaignTransition(CampaignStatus.PAUSED, CampaignStatus.STOPPED)).toBe(true);
  });

  it('forbids invalid transitions and enforces terminal states', () => {
    expect(isValidCampaignTransition(CampaignStatus.DRAFT, CampaignStatus.COMPLETED)).toBe(false);
    expect(isValidCampaignTransition(CampaignStatus.STOPPED, CampaignStatus.ACTIVE)).toBe(false);
    expect(isValidCampaignTransition(CampaignStatus.STOPPED, CampaignStatus.PAUSED)).toBe(false);
    expect(isValidCampaignTransition(CampaignStatus.COMPLETED, CampaignStatus.ACTIVE)).toBe(false);
  });
});

describe('Send Authorization Boundary', () => {
  it('only authorizes sending for ACTIVE campaigns', () => {
    expect(isCampaignSendAuthorized(CampaignStatus.ACTIVE)).toBe(true);
    expect(isCampaignSendAuthorized(CampaignStatus.PAUSED)).toBe(false);
    expect(isCampaignSendAuthorized(CampaignStatus.STOPPED)).toBe(false);
    expect(isCampaignSendAuthorized(CampaignStatus.DRAFT)).toBe(false);
    expect(isCampaignSendAuthorized(CampaignStatus.COMPLETED)).toBe(false);
    expect(isCampaignSendAuthorized(null)).toBe(false);
  });
});

describe('Contact Outreach Eligibility Policy', () => {
  it('approves eligible contact in active campaign', () => {
    const res = evaluateOutreachEligibility({
      contact: { email: 'john@example.com', status: ContactStatus.NEW, emailStatus: ContactEmailStatus.VALID },
      campaign: { status: CampaignStatus.ACTIVE }
    });
    expect(res.eligible).toBe(true);
  });

  it('rejects contact with missing email', () => {
    const res = evaluateOutreachEligibility({
      contact: { email: '', status: ContactStatus.NEW },
      campaign: { status: CampaignStatus.ACTIVE }
    });
    expect(res.eligible).toBe(false);
    expect(res.reason).toBe('CONTACT_MISSING_EMAIL');
  });

  it('rejects unsubscribed contact', () => {
    const res = evaluateOutreachEligibility({
      contact: { email: 'unsub@example.com', status: ContactStatus.UNSUBSCRIBED },
      campaign: { status: CampaignStatus.ACTIVE }
    });
    expect(res.eligible).toBe(false);
    expect(res.reason).toBe('CONTACT_UNSUBSCRIBED');
  });

  it('rejects bounced contact', () => {
    const res = evaluateOutreachEligibility({
      contact: { email: 'bounced@example.com', status: ContactStatus.BOUNCED },
      campaign: { status: CampaignStatus.ACTIVE }
    });
    expect(res.eligible).toBe(false);
    expect(res.reason).toBe('CONTACT_BOUNCED');
  });

  it('rejects do-not-contact contact', () => {
    const res = evaluateOutreachEligibility({
      contact: { email: 'dnc@example.com', status: ContactStatus.DO_NOT_CONTACT },
      campaign: { status: CampaignStatus.ACTIVE }
    });
    expect(res.eligible).toBe(false);
    expect(res.reason).toBe('CONTACT_DO_NOT_CONTACT');
  });

  it('rejects quarantined email candidate', () => {
    const res = evaluateOutreachEligibility({
      contact: { email: 'quarantined@example.com', status: ContactStatus.NEW, emailStatus: ContactEmailStatus.QUARANTINED },
      campaign: { status: CampaignStatus.ACTIVE }
    });
    expect(res.eligible).toBe(false);
    expect(res.reason).toBe('EMAIL_QUARANTINED');
  });

  it('rejects third-party domain candidate', () => {
    const res = evaluateOutreachEligibility({
      contact: {
        email: 'vendor@agency.com',
        status: ContactStatus.NEW,
        emailStatus: ContactEmailStatus.VALID,
        emailMeta: { confidenceTier: 'third_party', domainMatched: false }
      },
      campaign: { status: CampaignStatus.ACTIVE }
    });
    expect(res.eligible).toBe(false);
    expect(res.reason).toBe('EMAIL_THIRD_PARTY');
  });

  it('rejects contact when campaign is stopped', () => {
    const res = evaluateOutreachEligibility({
      contact: { email: 'valid@example.com', status: ContactStatus.NEW, emailStatus: ContactEmailStatus.VALID },
      campaign: { status: CampaignStatus.STOPPED }
    });
    expect(res.eligible).toBe(false);
    expect(res.reason).toBe('CAMPAIGN_STOPPED');
  });

  it('rejects contact when campaign is paused', () => {
    const res = evaluateOutreachEligibility({
      contact: { email: 'valid@example.com', status: ContactStatus.NEW, emailStatus: ContactEmailStatus.VALID },
      campaign: { status: CampaignStatus.PAUSED }
    });
    expect(res.eligible).toBe(false);
    expect(res.reason).toBe('CAMPAIGN_PAUSED');
  });

  it('deduplicates already contacted recipients', () => {
    const res = evaluateOutreachEligibility({
      contact: { id: 'c-101', email: 'valid@example.com', status: ContactStatus.NEW, emailStatus: ContactEmailStatus.VALID },
      campaign: { status: CampaignStatus.ACTIVE },
      context: { alreadyContactedIds: new Set(['c-101']) }
    });
    expect(res.eligible).toBe(false);
    expect(res.reason).toBe('ALREADY_CONTACTED');
  });
});

describe('Contact Status Monotonic Transitions', () => {
  it('permits valid contact progressions', () => {
    expect(canTransitionContactStatus(ContactStatus.NEW, ContactStatus.CONTACTED)).toBe(true);
    expect(canTransitionContactStatus(ContactStatus.CONTACTED, ContactStatus.REPLIED)).toBe(true);
    expect(canTransitionContactStatus(ContactStatus.CONTACTED, ContactStatus.UNSUBSCRIBED)).toBe(true);
  });

  it('forbids overriding terminal suppression states', () => {
    expect(canTransitionContactStatus(ContactStatus.UNSUBSCRIBED, ContactStatus.CONTACTED)).toBe(false);
    expect(canTransitionContactStatus(ContactStatus.BOUNCED, ContactStatus.CONTACTED)).toBe(false);
  });
});
