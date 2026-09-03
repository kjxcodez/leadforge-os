/**
 * LeadForge OS — Campaign Lifecycle & Outreach Eligibility Policy Tests
 */

import {
  evaluateOutreachEligibility,
  isValidCampaignTransition,
  isCampaignSendAuthorized,
  canTransitionContactStatus
} from './outreach-eligibility.js';
import { CampaignStatus, ContactStatus, ContactEmailStatus } from '../enums/index.js';

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed++;
    console.log(`[PASS] ${msg}`);
  } else {
    failed++;
    console.error(`[FAIL] ${msg}`);
  }
}

console.log('=================================================================');
console.log('RUNNING CAMPAIGN LIFECYCLE & ELIGIBILITY POLICY UNIT TESTS');
console.log('=================================================================\n');

// ── 1. Campaign State Machine Transitions ──
assert(isValidCampaignTransition(CampaignStatus.DRAFT, CampaignStatus.ACTIVE), 'DRAFT -> ACTIVE is valid');
assert(isValidCampaignTransition(CampaignStatus.DRAFT, CampaignStatus.STOPPED), 'DRAFT -> STOPPED is valid');
assert(!isValidCampaignTransition(CampaignStatus.DRAFT, CampaignStatus.COMPLETED), 'DRAFT -> COMPLETED is invalid');

assert(isValidCampaignTransition(CampaignStatus.ACTIVE, CampaignStatus.PAUSED), 'ACTIVE -> PAUSED is valid');
assert(isValidCampaignTransition(CampaignStatus.ACTIVE, CampaignStatus.STOPPED), 'ACTIVE -> STOPPED is valid');
assert(isValidCampaignTransition(CampaignStatus.ACTIVE, CampaignStatus.COMPLETED), 'ACTIVE -> COMPLETED is valid');

assert(isValidCampaignTransition(CampaignStatus.PAUSED, CampaignStatus.ACTIVE), 'PAUSED -> ACTIVE (resume) is valid');
assert(isValidCampaignTransition(CampaignStatus.PAUSED, CampaignStatus.STOPPED), 'PAUSED -> STOPPED is valid');

assert(!isValidCampaignTransition(CampaignStatus.STOPPED, CampaignStatus.ACTIVE), 'STOPPED -> ACTIVE is FORBIDDEN (terminal)');
assert(!isValidCampaignTransition(CampaignStatus.STOPPED, CampaignStatus.PAUSED), 'STOPPED -> PAUSED is FORBIDDEN (terminal)');
assert(!isValidCampaignTransition(CampaignStatus.COMPLETED, CampaignStatus.ACTIVE), 'COMPLETED -> ACTIVE is FORBIDDEN (terminal)');

// ── 2. Send Authorization ──
assert(isCampaignSendAuthorized(CampaignStatus.ACTIVE), 'ACTIVE campaign is send-authorized');
assert(!isCampaignSendAuthorized(CampaignStatus.PAUSED), 'PAUSED campaign is NOT send-authorized');
assert(!isCampaignSendAuthorized(CampaignStatus.STOPPED), 'STOPPED campaign is NOT send-authorized');
assert(!isCampaignSendAuthorized(CampaignStatus.DRAFT), 'DRAFT campaign is NOT send-authorized');
assert(!isCampaignSendAuthorized(null), 'Null status is NOT send-authorized');

// ── 3. Contact Outreach Eligibility ──
// Case A: Valid active eligible contact
{
  const res = evaluateOutreachEligibility({
    contact: { email: 'john@example.com', status: ContactStatus.NEW, emailStatus: ContactEmailStatus.VALID },
    campaign: { status: CampaignStatus.ACTIVE }
  });
  assert(res.eligible === true, 'Eligible contact in active campaign is approved');
}

// Case B: Missing email
{
  const res = evaluateOutreachEligibility({
    contact: { email: '', status: ContactStatus.NEW },
    campaign: { status: CampaignStatus.ACTIVE }
  });
  assert(res.eligible === false && res.reason === 'CONTACT_MISSING_EMAIL', 'Missing email is rejected');
}

// Case C: Unsubscribed contact
{
  const res = evaluateOutreachEligibility({
    contact: { email: 'unsub@example.com', status: ContactStatus.UNSUBSCRIBED },
    campaign: { status: CampaignStatus.ACTIVE }
  });
  assert(res.eligible === false && res.reason === 'CONTACT_UNSUBSCRIBED', 'Unsubscribed contact is rejected');
}

// Case D: Bounced contact
{
  const res = evaluateOutreachEligibility({
    contact: { email: 'bounced@example.com', status: ContactStatus.BOUNCED },
    campaign: { status: CampaignStatus.ACTIVE }
  });
  assert(res.eligible === false && res.reason === 'CONTACT_BOUNCED', 'Bounced contact is rejected');
}

// Case E: Do-not-contact contact
{
  const res = evaluateOutreachEligibility({
    contact: { email: 'dnc@example.com', status: ContactStatus.DO_NOT_CONTACT },
    campaign: { status: CampaignStatus.ACTIVE }
  });
  assert(res.eligible === false && res.reason === 'CONTACT_DO_NOT_CONTACT', 'Do-not-contact is rejected');
}

// Case F: Quarantined email candidate
{
  const res = evaluateOutreachEligibility({
    contact: { email: 'quarantined@example.com', status: ContactStatus.NEW, emailStatus: ContactEmailStatus.QUARANTINED },
    campaign: { status: CampaignStatus.ACTIVE }
  });
  assert(res.eligible === false && res.reason === 'EMAIL_QUARANTINED', 'Quarantined candidate is rejected');
}

// Case G: Third-party email
{
  const res = evaluateOutreachEligibility({
    contact: {
      email: 'vendor@agency.com',
      status: ContactStatus.NEW,
      emailStatus: ContactEmailStatus.VALID,
      emailMeta: { confidenceTier: 'third_party', domainMatched: false }
    },
    campaign: { status: CampaignStatus.ACTIVE }
  });
  assert(res.eligible === false && res.reason === 'EMAIL_THIRD_PARTY', 'Third-party candidate is rejected');
}

// Case H: Stopped campaign
{
  const res = evaluateOutreachEligibility({
    contact: { email: 'valid@example.com', status: ContactStatus.NEW, emailStatus: ContactEmailStatus.VALID },
    campaign: { status: CampaignStatus.STOPPED }
  });
  assert(res.eligible === false && res.reason === 'CAMPAIGN_STOPPED', 'Stopped campaign rejects send');
}

// Case I: Paused campaign
{
  const res = evaluateOutreachEligibility({
    contact: { email: 'valid@example.com', status: ContactStatus.NEW, emailStatus: ContactEmailStatus.VALID },
    campaign: { status: CampaignStatus.PAUSED }
  });
  assert(res.eligible === false && res.reason === 'CAMPAIGN_PAUSED', 'Paused campaign rejects send');
}

// Case J: Already contacted deduplication
{
  const res = evaluateOutreachEligibility({
    contact: { id: 'c-101', email: 'valid@example.com', status: ContactStatus.NEW, emailStatus: ContactEmailStatus.VALID },
    campaign: { status: CampaignStatus.ACTIVE },
    context: { alreadyContactedIds: new Set(['c-101']) }
  });
  assert(res.eligible === false && res.reason === 'ALREADY_CONTACTED', 'Already contacted ID is deduplicated');
}

// ── 4. Contact Status Monotonic Transitions ──
assert(canTransitionContactStatus(ContactStatus.NEW, ContactStatus.CONTACTED), 'NEW -> CONTACTED is valid');
assert(canTransitionContactStatus(ContactStatus.CONTACTED, ContactStatus.REPLIED), 'CONTACTED -> REPLIED is valid');
assert(canTransitionContactStatus(ContactStatus.CONTACTED, ContactStatus.UNSUBSCRIBED), 'CONTACTED -> UNSUBSCRIBED is valid');
assert(!canTransitionContactStatus(ContactStatus.UNSUBSCRIBED, ContactStatus.CONTACTED), 'UNSUBSCRIBED -> CONTACTED is FORBIDDEN');
assert(!canTransitionContactStatus(ContactStatus.BOUNCED, ContactStatus.CONTACTED), 'BOUNCED -> CONTACTED is FORBIDDEN');

console.log('\n=================================================================');
console.log(`TOTAL POLICY TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('=================================================================');

if (failed > 0) process.exit(1);
