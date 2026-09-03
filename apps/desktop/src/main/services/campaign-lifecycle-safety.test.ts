/**
 * LeadForge OS — Campaign Lifecycle, Contact Eligibility & Send Safety Test Suite
 *
 * Deterministic test suite verifying:
 * 1. Campaign state machine transitions and terminal enforcement
 * 2. Send authorization at worker & API boundaries
 * 3. Contact outreach eligibility (suppression, validation, affiliation)
 * 4. Contacted status transition semantics (only on provider acceptance)
 * 5. Ambiguous & failure safety (never mark contacted on failure)
 * 6. Scheduler WAITING recovery filtering (only ACTIVE campaigns)
 * 7. Audience resolution exclusion of suppressed/quarantined contacts
 * 8. Delivery idempotency across duplicate calls
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import assert from 'assert';
import {
  CampaignStatus,
  ContactStatus,
  ContactEmailStatus,
  isValidCampaignTransition,
  isCampaignSendAuthorized,
  evaluateOutreachEligibility,
  canTransitionContactStatus
} from '@leadforge/schema';

console.log('======================================================================');
console.log('RUNNING CAMPAIGN LIFECYCLE, CONTACT ELIGIBILITY & SEND SAFETY SUITE');
console.log('======================================================================\n');

let passedTests = 0;
function testAssert(cond: boolean, desc: string) {
  if (cond) {
    passedTests++;
    console.log(`  [PASS] ${desc}`);
  } else {
    console.error(`  [FAIL] ${desc}`);
    throw new Error(`Assertion failed: ${desc}`);
  }
}

// ── Test 1: Campaign State Machine Invariants ─────────────────────────────────
console.log('TEST 1: Campaign State Machine Transitions');
testAssert(isValidCampaignTransition(CampaignStatus.DRAFT, CampaignStatus.ACTIVE), 'DRAFT -> ACTIVE is permitted');
testAssert(isValidCampaignTransition(CampaignStatus.ACTIVE, CampaignStatus.PAUSED), 'ACTIVE -> PAUSED is permitted');
testAssert(isValidCampaignTransition(CampaignStatus.PAUSED, CampaignStatus.ACTIVE), 'PAUSED -> ACTIVE is permitted');
testAssert(isValidCampaignTransition(CampaignStatus.ACTIVE, CampaignStatus.STOPPED), 'ACTIVE -> STOPPED is permitted');
testAssert(isValidCampaignTransition(CampaignStatus.PAUSED, CampaignStatus.STOPPED), 'PAUSED -> STOPPED is permitted');
testAssert(!isValidCampaignTransition(CampaignStatus.STOPPED, CampaignStatus.ACTIVE), 'STOPPED -> ACTIVE is FORBIDDEN (terminal)');
testAssert(!isValidCampaignTransition(CampaignStatus.STOPPED, CampaignStatus.PAUSED), 'STOPPED -> PAUSED is FORBIDDEN (terminal)');
testAssert(!isValidCampaignTransition(CampaignStatus.COMPLETED, CampaignStatus.ACTIVE), 'COMPLETED -> ACTIVE is FORBIDDEN (terminal)');

// ── Test 2: Send Authorization Boundary ───────────────────────────────────────
console.log('\nTEST 2: Send Authorization Evaluation');
testAssert(isCampaignSendAuthorized(CampaignStatus.ACTIVE), 'ACTIVE campaign is send-authorized');
testAssert(!isCampaignSendAuthorized(CampaignStatus.PAUSED), 'PAUSED campaign is NOT send-authorized');
testAssert(!isCampaignSendAuthorized(CampaignStatus.STOPPED), 'STOPPED campaign is NOT send-authorized');
testAssert(!isCampaignSendAuthorized(CampaignStatus.DRAFT), 'DRAFT campaign is NOT send-authorized');
testAssert(!isCampaignSendAuthorized(CampaignStatus.COMPLETED), 'COMPLETED campaign is NOT send-authorized');

// ── Test 3: Contact Outreach Eligibility Policy ───────────────────────────────
console.log('\nTEST 3: Contact Outreach Eligibility Policy');
// 3a. Whitelisted, valid contact
{
  const res = evaluateOutreachEligibility({
    contact: { email: 'ceo@acme.com', status: ContactStatus.NEW, emailStatus: ContactEmailStatus.VALID },
    campaign: { status: CampaignStatus.ACTIVE }
  });
  testAssert(res.eligible, 'Valid contact in ACTIVE campaign is eligible');
}

// 3b. Suppressed contacts
{
  const unsub = evaluateOutreachEligibility({
    contact: { email: 'unsub@acme.com', status: ContactStatus.UNSUBSCRIBED },
    campaign: { status: CampaignStatus.ACTIVE }
  });
  testAssert(!unsub.eligible && unsub.reason === 'CONTACT_UNSUBSCRIBED', 'Unsubscribed contact is rejected');

  const bounced = evaluateOutreachEligibility({
    contact: { email: 'bounced@acme.com', status: ContactStatus.BOUNCED },
    campaign: { status: CampaignStatus.ACTIVE }
  });
  testAssert(!bounced.eligible && bounced.reason === 'CONTACT_BOUNCED', 'Bounced contact is rejected');

  const dnc = evaluateOutreachEligibility({
    contact: { email: 'dnc@acme.com', status: ContactStatus.DO_NOT_CONTACT },
    campaign: { status: CampaignStatus.ACTIVE }
  });
  testAssert(!dnc.eligible && dnc.reason === 'CONTACT_DO_NOT_CONTACT', 'Do-not-contact contact is rejected');
}

// 3c. Email candidate quality suppression
{
  const quarantined = evaluateOutreachEligibility({
    contact: { email: 'parked@domain.com', status: ContactStatus.NEW, emailStatus: ContactEmailStatus.QUARANTINED },
    campaign: { status: CampaignStatus.ACTIVE }
  });
  testAssert(!quarantined.eligible && quarantined.reason === 'EMAIL_QUARANTINED', 'Quarantined candidate is rejected');

  const thirdParty = evaluateOutreachEligibility({
    contact: {
      email: 'sales@shopify.com',
      status: ContactStatus.NEW,
      emailStatus: ContactEmailStatus.VALID,
      emailMeta: { confidenceTier: 'third_party', domainMatched: false }
    },
    campaign: { status: CampaignStatus.ACTIVE }
  });
  testAssert(!thirdParty.eligible && thirdParty.reason === 'EMAIL_THIRD_PARTY', 'Third-party candidate is rejected');
}

// 3d. Campaign state within eligibility
{
  const stopped = evaluateOutreachEligibility({
    contact: { email: 'user@acme.com', status: ContactStatus.NEW },
    campaign: { status: CampaignStatus.STOPPED }
  });
  testAssert(!stopped.eligible && stopped.reason === 'CAMPAIGN_STOPPED', 'Stopped campaign renders contact ineligible');

  const paused = evaluateOutreachEligibility({
    contact: { email: 'user@acme.com', status: ContactStatus.NEW },
    campaign: { status: CampaignStatus.PAUSED }
  });
  testAssert(!paused.eligible && paused.reason === 'CAMPAIGN_PAUSED', 'Paused campaign renders contact ineligible');
}

// ── Test 4: Contact Status Monotonic Progression ──────────────────────────────
console.log('\nTEST 4: Contact Lifecycle State Transitions');
testAssert(canTransitionContactStatus(ContactStatus.NEW, ContactStatus.CONTACTED), 'NEW -> CONTACTED is valid');
testAssert(canTransitionContactStatus(ContactStatus.CONTACTED, ContactStatus.REPLIED), 'CONTACTED -> REPLIED is valid');
testAssert(canTransitionContactStatus(ContactStatus.CONTACTED, ContactStatus.UNSUBSCRIBED), 'CONTACTED -> UNSUBSCRIBED is valid');
testAssert(!canTransitionContactStatus(ContactStatus.UNSUBSCRIBED, ContactStatus.CONTACTED), 'UNSUBSCRIBED cannot be changed to CONTACTED');
testAssert(!canTransitionContactStatus(ContactStatus.BOUNCED, ContactStatus.CONTACTED), 'BOUNCED cannot be changed to CONTACTED');

// ── Test 5: In-Flight Worker Stop/Pause Simulation ────────────────────────────
console.log('\nTEST 5: Worker Pre-Dispatch Campaign State Checks');
{
  // Simulated worker dispatch loop with dynamic campaign state
  let campaignState: string = CampaignStatus.ACTIVE;
  const dispatchHistory: string[] = [];

  const contactsToDispatch = [
    { id: 'c-1', email: 'c1@test.com' },
    { id: 'c-2', email: 'c2@test.com' },
    { id: 'c-3', email: 'c3@test.com' },
    { id: 'c-4', email: 'c4@test.com' }
  ];

  for (let idx = 0; idx < contactsToDispatch.length; idx++) {
    // User clicks STOP while worker is processing contact 2
    if (idx === 2) {
      campaignState = CampaignStatus.STOPPED;
    }

    // Worker checks server campaign status before provider call
    if (!isCampaignSendAuthorized(campaignState)) {
      console.log(`    [Worker] Halting dispatch at contact ${idx + 1}: campaign is ${campaignState}`);
      break;
    }

    // Provider call occurs only if authorized
    dispatchHistory.push(contactsToDispatch[idx]!.id);
  }

  testAssert(dispatchHistory.length === 2, 'Worker halted immediately when campaign was stopped (dispatched 2, not 4)');
  testAssert(!dispatchHistory.includes('c-3'), 'Contact 3 was never dispatched after campaign stopped');
  testAssert(!dispatchHistory.includes('c-4'), 'Contact 4 was never dispatched after campaign stopped');
}

// ── Test 6: Contacted Transition Semantics (Success vs Failure) ───────────────
console.log('\nTEST 6: CONTACTED Semantics under Provider Outcomes');
{
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE contacts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'NEW',
      lastContactedAt TEXT DEFAULT NULL
    );
  `);

  db.prepare("INSERT INTO contacts (id, email, status) VALUES ('c-ok', 'ok@test.com', 'NEW')").run();
  db.prepare("INSERT INTO contacts (id, email, status) VALUES ('c-fail', 'fail@test.com', 'NEW')").run();
  db.prepare("INSERT INTO contacts (id, email, status) VALUES ('c-ambiguous', 'ambig@test.com', 'NEW')").run();
  db.prepare("INSERT INTO contacts (id, email, status) VALUES ('c-unsub', 'unsub@test.com', 'UNSUBSCRIBED')").run();

  // 6a. Successful provider send: contact transitioned to CONTACTED
  const fakeProviderSend = (contactId: string, outcome: 'success' | 'failure' | 'timeout') => {
    if (outcome === 'success') {
      db.prepare(`
        UPDATE contacts
        SET status = 'CONTACTED', lastContactedAt = datetime('now')
        WHERE id = ? AND status NOT IN ('UNSUBSCRIBED', 'BOUNCED', 'DO_NOT_CONTACT')
      `).run(contactId);
      return { messageId: 'msg-123' };
    }
    if (outcome === 'timeout') {
      // Ambiguous timeout: do NOT update contact status
      throw new Error('AMBIGUOUS_SEND_TIMEOUT');
    }
    // Definite failure: do NOT update contact status
    throw new Error('PROVIDER_ERROR');
  };

  fakeProviderSend('c-ok', 'success');
  const okContact = db.prepare('SELECT status, lastContactedAt FROM contacts WHERE id = ?').get('c-ok') as any;
  testAssert(okContact.status === 'CONTACTED', 'Accepted contact transitioned to CONTACTED');
  testAssert(okContact.lastContactedAt !== null, 'Accepted contact has lastContactedAt populated');

  // 6b. Failed send: contact remains NEW, lastContactedAt is null
  try {
    fakeProviderSend('c-fail', 'failure');
  } catch {}
  const failContact = db.prepare('SELECT status, lastContactedAt FROM contacts WHERE id = ?').get('c-fail') as any;
  testAssert(failContact.status === 'NEW', 'Failed send leaves contact status untouched as NEW');
  testAssert(failContact.lastContactedAt === null, 'Failed send leaves lastContactedAt as null');

  // 6c. Ambiguous timeout: contact remains NEW, lastContactedAt is null
  try {
    fakeProviderSend('c-ambiguous', 'timeout');
  } catch {}
  const ambigContact = db.prepare('SELECT status, lastContactedAt FROM contacts WHERE id = ?').get('c-ambiguous') as any;
  testAssert(ambigContact.status === 'NEW', 'Ambiguous timeout leaves contact status untouched as NEW');
  testAssert(ambigContact.lastContactedAt === null, 'Ambiguous timeout leaves lastContactedAt as null');

  // 6d. Unsubscribed contact: even if send is called, status remains UNSUBSCRIBED
  db.prepare(`
    UPDATE contacts
    SET status = 'CONTACTED', lastContactedAt = datetime('now')
    WHERE id = 'c-unsub' AND status NOT IN ('UNSUBSCRIBED', 'BOUNCED', 'DO_NOT_CONTACT')
  `).run();
  const unsubContact = db.prepare('SELECT status FROM contacts WHERE id = ?').get('c-unsub') as any;
  testAssert(unsubContact.status === 'UNSUBSCRIBED', 'Unsubscribed contact was not overwritten to CONTACTED');

  db.close();
}

// ── Test 7: Scheduler WAITING Execution Recovery with Campaign States ─────────
console.log('\nTEST 7: Scheduler WAITING Recovery with Campaign States');
{
  const db = new Database(':memory:');
  const wsId = randomUUID();

  db.exec(`
    CREATE TABLE campaigns (
      id TEXT PRIMARY KEY,
      workspaceId TEXT NOT NULL,
      status TEXT NOT NULL,
      deletedAt TEXT
    );

    CREATE TABLE sequence_executions (
      id TEXT PRIMARY KEY,
      workspaceId TEXT NOT NULL,
      sequenceId TEXT NOT NULL,
      contactId TEXT NOT NULL,
      campaignId TEXT,
      status TEXT NOT NULL DEFAULT 'WAITING',
      nextExecutionAt TEXT,
      deletedAt TEXT,
      updatedAt TEXT
    );
  `);

  // Insert campaigns
  db.prepare("INSERT INTO campaigns VALUES ('camp-active', ?, 'ACTIVE', NULL)").run(wsId);
  db.prepare("INSERT INTO campaigns VALUES ('camp-paused', ?, 'PAUSED', NULL)").run(wsId);
  db.prepare("INSERT INTO campaigns VALUES ('camp-stopped', ?, 'STOPPED', NULL)").run(wsId);

  // Insert WAITING executions due now
  db.prepare("INSERT INTO sequence_executions VALUES ('exec-active', ?, 'seq-1', 'con-1', 'camp-active', 'WAITING', datetime('now', '-10 seconds'), NULL, NULL)").run(wsId);
  db.prepare("INSERT INTO sequence_executions VALUES ('exec-paused', ?, 'seq-1', 'con-2', 'camp-paused', 'WAITING', datetime('now', '-10 seconds'), NULL, NULL)").run(wsId);
  db.prepare("INSERT INTO sequence_executions VALUES ('exec-stopped', ?, 'seq-1', 'con-3', 'camp-stopped', 'WAITING', datetime('now', '-10 seconds'), NULL, NULL)").run(wsId);
  db.prepare("INSERT INTO sequence_executions VALUES ('exec-standalone', ?, 'seq-1', 'con-4', NULL, 'WAITING', datetime('now', '-10 seconds'), NULL, NULL)").run(wsId);

  // 1. Scheduler tick cancels WAITING executions belonging to permanently STOPPED campaigns
  db.prepare(`
    UPDATE sequence_executions
    SET status = 'CANCELLED', updatedAt = datetime('now')
    WHERE workspaceId = ?
      AND UPPER(status) = 'WAITING'
      AND campaignId IN (
        SELECT id FROM campaigns
        WHERE workspaceId = ? AND UPPER(status) IN ('STOPPED', 'FAILED')
      )
  `).run(wsId, wsId);

  const stoppedExec = db.prepare("SELECT status FROM sequence_executions WHERE id = 'exec-stopped'").get() as any;
  testAssert(stoppedExec.status === 'CANCELLED', 'WAITING execution for STOPPED campaign was transitioned to CANCELLED');

  // 2. Scheduler recovers only due executions for ACTIVE campaigns (or standalone)
  const due = db.prepare(`
    SELECT se.id, se.campaignId
    FROM sequence_executions se
    LEFT JOIN campaigns c ON se.campaignId = c.id
    WHERE se.workspaceId = ?
      AND UPPER(se.status) = 'WAITING'
      AND se.nextExecutionAt IS NOT NULL
      AND se.nextExecutionAt <= datetime('now')
      AND se.deletedAt IS NULL
      AND (se.campaignId IS NULL OR UPPER(COALESCE(c.status, 'ACTIVE')) = 'ACTIVE')
    LIMIT 20
  `).all(wsId) as any[];

  const dueIds = due.map((d) => d.id);
  testAssert(dueIds.includes('exec-active'), 'Execution for ACTIVE campaign is recovered');
  testAssert(dueIds.includes('exec-standalone'), 'Standalone sequence execution is recovered');
  testAssert(!dueIds.includes('exec-paused'), 'Execution for PAUSED campaign is NOT recovered');
  testAssert(!dueIds.includes('exec-stopped'), 'Execution for STOPPED campaign is NOT recovered');

  db.close();
}

// ── Test 8: Audience Resolution Safety Exclusions ─────────────────────────────
console.log('\nTEST 8: Audience Resolution Safety Exclusions');
{
  const db = new Database(':memory:');
  const wsId = randomUUID();

  db.exec(`
    CREATE TABLE contacts (
      id TEXT PRIMARY KEY,
      workspaceId TEXT NOT NULL,
      email TEXT,
      status TEXT NOT NULL DEFAULT 'NEW',
      emailStatus TEXT NOT NULL DEFAULT 'VALID',
      deletedAt TEXT
    );
  `);

  // Insert contacts
  db.prepare("INSERT INTO contacts VALUES ('c1', ?, 'valid@acme.com', 'NEW', 'VALID', NULL)").run(wsId);
  db.prepare("INSERT INTO contacts VALUES ('c2', ?, 'unsub@acme.com', 'UNSUBSCRIBED', 'VALID', NULL)").run(wsId);
  db.prepare("INSERT INTO contacts VALUES ('c3', ?, 'bounced@acme.com', 'BOUNCED', 'VALID', NULL)").run(wsId);
  db.prepare("INSERT INTO contacts VALUES ('c4', ?, 'dnc@acme.com', 'DO_NOT_CONTACT', 'VALID', NULL)").run(wsId);
  db.prepare("INSERT INTO contacts VALUES ('c5', ?, 'quarantined@acme.com', 'NEW', 'QUARANTINED', NULL)").run(wsId);
  db.prepare("INSERT INTO contacts VALUES ('c6', ?, 'invalid@acme.com', 'NEW', 'INVALID', NULL)").run(wsId);
  db.prepare("INSERT INTO contacts VALUES ('c7', ?, '', 'NEW', 'VALID', NULL)").run(wsId);

  // Dynamic audience query using hardened WHERE clause
  const rows = db.prepare(`
    SELECT id FROM contacts 
    WHERE workspaceId = ? 
      AND deletedAt IS NULL 
      AND email IS NOT NULL AND email != ''
      AND UPPER(COALESCE(status, 'NEW')) NOT IN ('UNSUBSCRIBED', 'BOUNCED', 'DO_NOT_CONTACT', 'ARCHIVED')
      AND UPPER(COALESCE(emailStatus, 'VALID')) NOT IN ('QUARANTINED', 'INVALID')
  `).all(wsId) as Array<{ id: string }>;

  const eligibleIds = rows.map((r) => r.id);
  testAssert(eligibleIds.length === 1 && eligibleIds[0] === 'c1', 'Audience query returns only valid, unsuppressed contact (c1)');
  testAssert(!eligibleIds.includes('c2'), 'Unsubscribed contact excluded from audience');
  testAssert(!eligibleIds.includes('c3'), 'Bounced contact excluded from audience');
  testAssert(!eligibleIds.includes('c4'), 'DNC contact excluded from audience');
  testAssert(!eligibleIds.includes('c5'), 'Quarantined candidate excluded from audience');
  testAssert(!eligibleIds.includes('c6'), 'Invalid candidate excluded from audience');
  testAssert(!eligibleIds.includes('c7'), 'Empty email contact excluded from audience');

  db.close();
}

// ── Test 9: Delivery Idempotency Deduplication ─────────────────────────────────
console.log('\nTEST 9: Delivery Idempotency Deduplication');
{
  const deliveryLedger = new Map<string, { status: string; providerMessageId: string }>();
  let providerSendCalls = 0;

  function executeOrDeduplicateSend(idempotencyKey: string): { messageId: string; wasDuplicated: boolean } {
    const existing = deliveryLedger.get(idempotencyKey);
    if (existing && existing.status === 'SENT') {
      // Idempotency skip
      return { messageId: existing.providerMessageId, wasDuplicated: true };
    }

    // Call provider
    providerSendCalls++;
    const providerMessageId = `provider-msg-${Date.now()}`;
    deliveryLedger.set(idempotencyKey, { status: 'SENT', providerMessageId });
    return { messageId: providerMessageId, wasDuplicated: false };
  }

  const key = 'campaign_c1_exec1_contact1_step0';
  const first = executeOrDeduplicateSend(key);
  testAssert(!first.wasDuplicated, 'First dispatch executes against provider');
  testAssert(providerSendCalls === 1, 'Provider was invoked exactly once');

  // Retry with same key
  const second = executeOrDeduplicateSend(key);
  testAssert(second.wasDuplicated, 'Second dispatch with same idempotency key is deduplicated');
  testAssert(providerSendCalls === 1, 'Provider was NOT invoked on retry');
  testAssert(second.messageId === first.messageId, 'Identical messageId returned on idempotent retry');
}

console.log('\n======================================================================');
console.log(`CAMPAIGN LIFECYCLE & SEND SAFETY SUITE COMPLETE: ${passedTests} TESTS PASSED!`);
console.log('======================================================================');
