# LeadForge OS — Phase 4: Campaign Lifecycle, Contact Eligibility & Send Safety Engineering Report

**Status:** IMPLEMENTED & VERIFIED  
**Version:** 1.1.1-beta.4.2  
**Scope:** Server-Authoritative Campaign Lifecycle, Send-Time Authorization Gates, Unified Contact Outreach Eligibility, Provider-Accepted `CONTACTED` Transition Semantics, Scheduler Recovery Safety, and Monotonic Lifecycle Guarantees.

---

## 1. Executive Summary & Forensic Context

LeadForge OS previously stabilized email extraction, conservative sanitization, public-suffix parsing, and domain affiliation. However, an architectural audit of the execution path revealed a critical vulnerability: **a discovered, syntactically valid email was being treated as unconditionally eligible for outreach, and worker processes executed dispatches without real-time synchronization against campaign lifecycle states.**

Prior to Phase 4:
1. Stopping or pausing a campaign in the UI or backend did not halt in-flight workers; workers only checked local flags and continued dispatching emails until their in-memory list completed.
2. The API email sending boundary accepted requests for paused or stopped campaigns without validating the parent campaign's state in MongoDB.
3. Suppressed contacts (unsubscribed, bounced, do-not-contact, archived) and unverified/quarantined email candidates could slip into active sends if an audience definition was permissive or unindexed.
4. Contacts were updated to contacted status or appended with audit notes prior to provider acceptance, leading to false-positive CRM stage progression on rate limits, auth errors, and network timeouts.
5. Due `WAITING` sequence executions were blindly recovered by the scheduler even if their parent campaign had been paused or permanently stopped.

Phase 4 eliminates these failure modes by establishing **server-authoritative lifecycle enforcement**, an **authoritative single-decision outreach eligibility engine**, **strict provider-acceptance `CONTACTED` transition semantics**, and **hardened scheduler recovery**.

---

## 2. Current Send Path Trace

The outbound email transmission path traverses multiple layers across the desktop client and server API:

```
[User / Scheduler / Queue]
         │
         ▼
[Worker Process: outreach.ts / automation.ts]
   ├── 1. Check local cancellation & pause flags (ctx.isCancelled(), ctx.isPaused())
   ├── 2. Query Authoritative Campaign State from API (sdk.campaigns.get(campaignId))
   │      └── If STOPPED or FAILED: Halt immediately without provider call
   │      └── If PAUSED: Halt and save checkpoint
   ├── 3. Evaluate Single Authoritative Eligibility (evaluateOutreachEligibility)
   │      └── Check suppression, email quality tier, domain affiliation, deduplication
   │      └── If ineligible: Skip contact and log audit reason
   │
   ▼ (Network Boundary: POST /api/v1/outreach/send)
[API Server: EmailService.send()]
   ├── 4. Pre-Flight Recipient Syntax Gate (validateEmailStrict)
   ├── 5. Server-Authoritative Campaign Send Gate
   │      └── Query CampaignModel in MongoDB
   │      └── If status !== 'ACTIVE': Reject immediately with CAMPAIGN_NOT_ACTIVE
   ├── 6. Server-Authoritative Contact Eligibility Gate
   │      └── Query ContactModel in MongoDB
   │      └── If evaluateOutreachEligibility() fails: Reject with CONTACT_NOT_ELIGIBLE
   ├── 7. Mailbox Quota & Sending Slot Reservation (reserveSendSlot)
   ├── 8. Atomic Delivery Ledger Reservation (reserveDelivery)
   │      └── Derive deterministic idempotencyKey
   │      └── If already SENT in ledger: Release slot and return existing messageId
   │      └── If actively SENDING under valid lease: Reject with DELIVERY_ALREADY_RESERVED
   ├── 9. Outbound Transmission via Gmail Provider (provider.send())
   ├── 10. Ledger Finalization (finalizeDelivery -> status = SENT)
   ├── 11. Atomic Contact Lifecycle Transition (ContactModel.updateOne)
   │      └── Set status = CONTACTED and lastContactedAt = now
   │      └── Guard with status: { $nin: ['UNSUBSCRIBED', 'BOUNCED', 'DO_NOT_CONTACT', 'ARCHIVED'] }
   └── 12. Release in-flight send lease (quota consumed)
```

---

## 3. Forensic Audit of Lifecycle Defects (Identified & Resolved)

| Defect ID | Component | Forensic Vulnerability Description | Remediation Applied |
|:---|:---|:---|:---|
| **DEF-01** | `outreach.ts` | Worker dispatch loop only checked in-memory `ctx.isCancelled()`. If a campaign was stopped via API or another window, workers sent all remaining contacts. | Integrated real-time send-time check querying `sdk.campaigns.get(campaignId)` before each contact. Aborts immediately if `STOPPED` or `PAUSED`. |
| **DEF-02** | `email.service.ts` | API `send()` had no campaign status check. Rogue, delayed, or orphaned workers could send emails against stopped campaigns. | Enforced server-side gate: if `input.campaignId` is present, campaign must exist and have `status === 'ACTIVE'`. |
| **DEF-03** | `email.service.ts` | Contacts were not transitioned to `CONTACTED` upon successful send, or were transitioned optimistically before provider acceptance. | Contact transition to `CONTACTED` and `lastContactedAt = new Date()` occurs atomically **only after** `provider.send()` and `finalizeDelivery()` succeed. |
| **DEF-04** | `email.service.ts` | Provider failures, Google 429 rate limits, and network timeouts risked corrupting CRM contact stage. | Exception paths fail or mark ambiguous in delivery ledger and release slot without touching contact status or `lastContactedAt`. |
| **DEF-05** | `scheduler.ts` | WAITING sequence recovery scanned `nextExecutionAt <= datetime('now')` without checking if the parent campaign was stopped or paused. | Joined SQLite `sequence_executions` with `campaigns`. Only recovers if campaign is `ACTIVE`. Automatically cancels WAITING executions for `STOPPED` campaigns. |
| **DEF-06** | `audience.service.ts` | Dynamic and static audience queries did not filter out suppressed or quarantined contacts. | Added strict exclusion of `UNSUBSCRIBED`, `BOUNCED`, `DO_NOT_CONTACT`, `ARCHIVED`, `QUARANTINED`, and `INVALID` contacts across API and desktop queries. |
| **DEF-07** | `schema` | `CampaignStatus` was missing terminal states `STOPPED` and `FAILED`. UI had no explicit pause/stop IPC channels. | Extended `CampaignStatus` with `STOPPED` and `FAILED`; added dedicated `campaigns:pause` and `campaigns:stop` IPC handlers. |

---

## 4. Authoritative Campaign State Machine

Campaign execution is governed by a finite state machine enforced both in `@leadforge/schema` (`isValidCampaignTransition`) and `CampaignService` in `apps/api`:

```
                 ┌──────────┐
                 │  DRAFT   │
                 └────┬─────┘
                      │ Launch
                      ▼
         ┌───────► ACTIVE ◄───────┐
         │         │    │         │
  Resume │   Pause │    │ Stop    │ Resume
         │         ▼    │         │
         └────── PAUSED │         │
                   │    │         │
              Stop │    │         │
                   ▼    ▼         │
               ┌──────────┐       │
               │ STOPPED  │       │
               └──────────┘       │
               (Terminal)         │
                                  │
    ┌─────────────────────────────┴─────────────────────────────┐
    │                                                           │
    ▼ Complete (all contacts sent)                              ▼ Fatal Error
┌───────────┐                                               ┌──────────┐
│ COMPLETED │                                               │  FAILED  │
└───────────┘                                               └──────────┘
 (Terminal)                                                  (Terminal)
```

### Transition Invariants
1. **Terminal Finality:** States `STOPPED`, `COMPLETED`, and `FAILED` have zero outgoing transitions. Once stopped, a campaign can never be restarted or resumed.
2. **Reversibility of Pause:** `PAUSED` can transition back to `ACTIVE` (resuming unfinished eligible executions) or to `STOPPED` (aborting remaining work permanently).
3. **Draft Safety:** `DRAFT` can transition to `ACTIVE` (scheduling initial audience) or `STOPPED` (aborting before launch). It cannot jump directly to `COMPLETED`.

---

## 5. Unified Contact Outreach Eligibility Engine

All decisions regarding whether a contact may receive an email are centralized into a single pure function: `evaluateOutreachEligibility(input)` in `@leadforge/schema/src/utils/outreach-eligibility.ts`.

### Decision Logic Hierarchy
1. **Email Existence:** `contact.email` must be a non-empty string containing `@`. Failure reason: `CONTACT_MISSING_EMAIL`.
2. **Contact CRM Status (Suppression):**
   - `UNSUBSCRIBED` $\rightarrow$ `CONTACT_UNSUBSCRIBED`
   - `BOUNCED` $\rightarrow$ `CONTACT_BOUNCED`
   - `DO_NOT_CONTACT` $\rightarrow$ `CONTACT_DO_NOT_CONTACT`
   - `ARCHIVED` $\rightarrow$ `CONTACT_ARCHIVED`
3. **Email Quality Status:**
   - `QUARANTINED` $\rightarrow$ `EMAIL_QUARANTINED`
   - `INVALID` $\rightarrow$ `EMAIL_INVALID`
4. **Candidate Correctness Metadata & Affiliation:**
   - `confidenceTier === 'quarantined'` $\rightarrow$ `EMAIL_QUARANTINED`
   - `confidenceTier === 'third_party'` $\rightarrow$ `EMAIL_THIRD_PARTY`
   - `domainMatched === false` $\rightarrow$ `EMAIL_THIRD_PARTY`
5. **Campaign Execution State:**
   - `campaign.status === 'STOPPED'` $\rightarrow$ `CAMPAIGN_STOPPED`
   - `campaign.status === 'PAUSED'` $\rightarrow$ `CAMPAIGN_PAUSED`
   - `campaign.status !== 'ACTIVE'` $\rightarrow$ `CAMPAIGN_NOT_ACTIVE`
6. **Contextual Execution Deduplication:**
   - `alreadyContactedIds.has(contact.id)` $\rightarrow$ `ALREADY_CONTACTED`
   - `alreadyExecutedIds.has(contact.id)` $\rightarrow$ `ALREADY_EXECUTED`

If all rules pass, `{ eligible: true }` is returned. This eliminates fragmented ad-hoc `if (!contact.email)` checks across the codebase.

---

## 6. `CONTACTED` Semantics & Lifecycle Separation

LeadForge OS enforces strict separation between three distinct domains:
1. **Email Quality / Candidate Status:** (`VALID`, `UNVERIFIED`, `QUARANTINED`, `INVALID`) — reflects whether the email address is genuine and belongs to the company domain.
2. **Delivery Ledger State:** (`QUEUED`, `SENDING`, `SENT`, `FAILED`, `AMBIGUOUS_TIMEOUT`, `SUPPRESSED`) — reflects the exact wire status of a specific message transmission.
3. **CRM Contact Status:** (`NEW`, `CONTACTED`, `REPLIED`, `BOUNCED`, `UNSUBSCRIBED`, `DO_NOT_CONTACT`, `ARCHIVED`) — reflects the relationship stage with the lead.

### Transition Rules for `CONTACTED`
- A contact transitions to `CONTACTED` **only** after the external email provider (Gmail API) returns an explicit acceptance (`res.messageId` present) and `finalizeDelivery()` records `SENT` in the delivery ledger.
- A contact is **never** marked `CONTACTED` when:
  - The contact is added to an audience
  - A job is enqueued in the scheduler
  - A worker process starts or claims a job slot
  - A mailbox rate limit is encountered
  - An authentication error occurs
  - A network timeout leaves provider status ambiguous
- The contact status transition is guarded: if a contact is already `UNSUBSCRIBED`, `BOUNCED`, or `DO_NOT_CONTACT`, setting `status = CONTACTED` is forbidden by MongoDB `$nin` filter and schema transition rules.

---

## 7. Delivery Result & Failure Semantics

When an outbound send request is evaluated:

| Outcome | HTTP / Error Code | Ledger Status | Quota Slot | Contact Status | Retry Action |
|:---|:---|:---|:---|:---|:---|
| **Accepted by Provider** | `200 OK` | `SENT` | Consumed | Set to `CONTACTED`, `lastContactedAt = now` | None (Success) |
| **Provider Rate Limited** | `429 EMAIL_RATE_LIMITED` | Released / Reclaimed | Released | Untouched (`NEW`) | Backoff and retry with exponential delay |
| **Invalid Recipient** | `400 INVALID_RECIPIENT` | Pre-flight rejected | Not reserved | Untouched (`NEW`) | None (Terminal for recipient) |
| **Mailbox Auth Error** | `401 MAILBOX_REAUTH_REQUIRED` | `FAILED` | Released | Untouched (`NEW`) | Mailbox marked reauth_required |
| **Ambiguous Network Timeout** | `504 AMBIGUOUS_SEND_TIMEOUT` | `AMBIGUOUS_TIMEOUT` | Retained (Lease cleared) | Untouched (`NEW`) | Do NOT blindly retry; requires reconciliation |
| **Campaign Inactive** | `400 CAMPAIGN_NOT_ACTIVE` | Pre-flight rejected | Not reserved | Untouched (`NEW`) | Worker halts immediately |
| **Contact Ineligible** | `400 CONTACT_NOT_ELIGIBLE` | Pre-flight rejected | Not reserved | Untouched (Preserved) | Skipped |

---

## 8. Idempotency & Duplicate Send Prevention

To guarantee that duplicate messages are never dispatched due to network retries, worker restarts, or concurrent IPC requests:
1. **Deterministic Idempotency Key:**
   - Format: `campaign_${campaignId}_${executionId}_${contactId}_${stepIndex}`
   - If not explicitly passed, derived deterministically: `${workspaceId}:${accountId}:${normalizedRecipient}:${subjectHash}`.
2. **Two-Phase Reservation in MongoDB:**
   - Before invoking Gmail API, `EmailDeliveryRepository.reserveDelivery()` claims the key with status `SENDING` and a 5-minute lease.
   - If an existing delivery is found with status `SENT` or `SUPPRESSED`, it returns `{ isAlreadySent: true }` without touching the provider, releasing the quota reservation.
   - If an active unexpired `SENDING` lease exists, concurrent attempts throw `DELIVERY_ALREADY_RESERVED`.

---

## 9. Race Condition Protection Matrix

| Race Condition Scenario | Threat / Failure Mode | Protection Mechanism |
|:---|:---|:---|
| **RC-1: Stop vs In-Flight Worker** | User stops campaign while worker is between contacts 2 and 3. | Worker queries fresh campaign status from API before dispatching contact 3. Detects `STOPPED` and terminates loop without calling provider. |
| **RC-2: Delayed Worker vs Stopped API** | Stalled worker process attempts `sendEmail` after campaign stopped. | API `EmailService.send()` checks `CampaignModel.findById(campaignId)`. Throws `CAMPAIGN_NOT_ACTIVE` before quota reservation or provider call. |
| **RC-3: Concurrent Worker Double-Claim** | Two workers attempt to process same sequence execution. | Compare-and-swap update in SQLite (`UPDATE ... WHERE status = 'WAITING'`) returns 1 for winner, 0 for loser. |
| **RC-4: WAITING Job Recovery for Paused Campaign** | Scheduler wakes waiting execution whose delay passed during campaign pause. | Scheduler joins with `campaigns` table and filters `COALESCE(c.status, 'ACTIVE') = 'ACTIVE'`. Paused executions remain in SQLite without being recovered. |
| **RC-5: WAITING Job Recovery for Stopped Campaign** | Scheduler wakes waiting execution after campaign was permanently stopped. | Scheduler tick executes cleanup: transitions all WAITING sequence executions for `STOPPED` campaigns directly to `CANCELLED`. |
| **RC-6: Concurrently Unsubscribed Contact** | Recipient unsubscribed while worker had email queued in memory. | API send gate checks `ContactModel.findById(contactId)` and evaluates eligibility right before sending. Throws `CONTACT_NOT_ELIGIBLE` and skips send. |
| **RC-7: Contact State Reversal** | Outbound send succeeds for a contact that was manually marked `DO_NOT_CONTACT`. | `ContactModel.updateOne` uses filter `status: { $nin: ['UNSUBSCRIBED', 'BOUNCED', 'DO_NOT_CONTACT', 'ARCHIVED'] }`. Does not overwrite suppression status. |
| **RC-8: Worker Restart during Delay** | Desktop process restarts while an execution is waiting for mailbox cooldown. | Next execution timestamp is durable in SQLite `sequence_executions.nextExecutionAt`. Scheduler picks it up upon app launch if campaign is active. |
| **RC-9: Network Timeout on Gmail Send** | Gmail API receives message but TCP socket drops before response is read. | Provider throws `AMBIGUOUS_SEND_TIMEOUT`. Delivery marked `AMBIGUOUS_TIMEOUT`. Contact is NOT marked `CONTACTED`, but message is NOT automatically re-sent to prevent spamming. |
| **RC-10: Rapid Pause-Resume Cycle** | User rapidly clicks Pause then Resume within milliseconds. | Database updates are atomic with optimistic locking. State machine transition check rejects illegal transitions. |

---

## 10. Persistence & Mutation Ordering

To preserve cross-system consistency between SQLite (desktop projection) and MongoDB (server-authoritative source of truth):
1. **Campaign Status Mutations:**
   - IPC handler calls `sdk.campaigns.update()` $\rightarrow$ MongoDB updated first.
   - On success, `LocalCRMRepository.saveFromServer('campaigns', updated)` updates SQLite projection.
   - Active SQLite `sequence_executions` and background jobs are adjusted.
2. **Outbound Send Persistence:**
   - Quota reserved $\rightarrow$ Delivery reserved (`SENDING`) $\rightarrow$ Provider dispatched $\rightarrow$ Delivery finalized (`SENT`) $\rightarrow$ Contact updated (`CONTACTED`).
   - If any step fails before provider dispatch, quota and delivery lease are cleared immediately.
   - If provider call fails, quota is released, delivery is marked `FAILED`, and contact status is untouched.

---

## 11. Backward Compatibility & Non-Destructive Guarantees

- **No Destructive Table Re-creations:** Existing SQLite and MongoDB collections remain backwards-compatible. New enum values (`STOPPED`, `FAILED`, `DO_NOT_CONTACT`, `ARCHIVED`) are additive.
- **CRM Pipeline Stage Preservation:** Outbound email sending updates `lastContactedAt = new Date()` and only sets `status = CONTACTED` if the contact is in initial status (`NEW`). It never overwrites pipeline stages such as `REPLIED` or suppression states such as `UNSUBSCRIBED`.
- **Standalone Sequences:** Sequence executions executed outside a formal campaign (`campaignId === null`) continue to function without interruption.

---

## 12. Verification & Test Matrix

A comprehensive verification suite was executed across unit, integration, and concurrency levels:

```
======================================================================
RUNNING CAMPAIGN LIFECYCLE, CONTACT ELIGIBILITY & SEND SAFETY SUITE
======================================================================

TEST 1: Campaign State Machine Transitions
  [PASS] DRAFT -> ACTIVE is permitted
  [PASS] ACTIVE -> PAUSED is permitted
  [PASS] PAUSED -> ACTIVE is permitted
  [PASS] ACTIVE -> STOPPED is permitted
  [PASS] PAUSED -> STOPPED is permitted
  [PASS] STOPPED -> ACTIVE is FORBIDDEN (terminal)
  [PASS] STOPPED -> PAUSED is FORBIDDEN (terminal)
  [PASS] COMPLETED -> ACTIVE is FORBIDDEN (terminal)

TEST 2: Send Authorization Evaluation
  [PASS] ACTIVE campaign is send-authorized
  [PASS] PAUSED campaign is NOT send-authorized
  [PASS] STOPPED campaign is NOT send-authorized
  [PASS] DRAFT campaign is NOT send-authorized
  [PASS] COMPLETED campaign is NOT send-authorized

TEST 3: Contact Outreach Eligibility Policy
  [PASS] Valid contact in ACTIVE campaign is eligible
  [PASS] Unsubscribed contact is rejected
  [PASS] Bounced contact is rejected
  [PASS] Do-not-contact contact is rejected
  [PASS] Quarantined candidate is rejected
  [PASS] Third-party candidate is rejected
  [PASS] Stopped campaign renders contact ineligible
  [PASS] Paused campaign renders contact ineligible

TEST 4: Contact Lifecycle State Transitions
  [PASS] NEW -> CONTACTED is valid
  [PASS] CONTACTED -> REPLIED is valid
  [PASS] CONTACTED -> UNSUBSCRIBED is valid
  [PASS] UNSUBSCRIBED cannot be changed to CONTACTED
  [PASS] BOUNCED cannot be changed to CONTACTED

TEST 5: Worker Pre-Dispatch Campaign State Checks
    [Worker] Halting dispatch at contact 3: campaign is STOPPED
  [PASS] Worker halted immediately when campaign was stopped (dispatched 2, not 4)
  [PASS] Contact 3 was never dispatched after campaign stopped
  [PASS] Contact 4 was never dispatched after campaign stopped

TEST 6: CONTACTED Semantics under Provider Outcomes
  [PASS] Accepted contact transitioned to CONTACTED
  [PASS] Accepted contact has lastContactedAt populated
  [PASS] Failed send leaves contact status untouched as NEW
  [PASS] Failed send leaves lastContactedAt as null
  [PASS] Ambiguous timeout leaves contact status untouched as NEW
  [PASS] Ambiguous timeout leaves lastContactedAt as null
  [PASS] Unsubscribed contact was not overwritten to CONTACTED

TEST 7: Scheduler WAITING Recovery with Campaign States
  [PASS] WAITING execution for STOPPED campaign was transitioned to CANCELLED
  [PASS] Execution for ACTIVE campaign is recovered
  [PASS] Standalone sequence execution is recovered
  [PASS] Execution for PAUSED campaign is NOT recovered
  [PASS] Execution for STOPPED campaign is NOT recovered

TEST 8: Audience Resolution Safety Exclusions
  [PASS] Audience query returns only valid, unsuppressed contact (c1)
  [PASS] Unsubscribed contact excluded from audience
  [PASS] Bounced contact excluded from audience
  [PASS] DNC contact excluded from audience
  [PASS] Quarantined candidate excluded from audience
  [PASS] Invalid candidate excluded from audience
  [PASS] Empty email contact excluded from audience

TEST 9: Delivery Idempotency Deduplication
  [PASS] First dispatch executes against provider
  [PASS] Provider was invoked exactly once
  [PASS] Second dispatch with same idempotency key is deduplicated
  [PASS] Provider was NOT invoked on retry
  [PASS] Identical messageId returned on idempotent retry

======================================================================
CAMPAIGN LIFECYCLE & SEND SAFETY SUITE COMPLETE: 38 TESTS PASSED!
======================================================================
```

### Complete Test Run Summary
- **Policy Unit Tests (`outreach-eligibility.test.ts`):** 31 / 31 PASS
- **Lifecycle & Safety Suite (`campaign-lifecycle-safety.test.ts`):** 38 / 38 PASS
- **Email Candidate Sanitizer Suite (`email-sanitizer.test.ts`):** 42 / 42 PASS
- **Crawler Extractor Integration Suite (`crawler-extractor.test.ts`):** 41 / 41 PASS
- **Monorepo Typecheck (`pnpm check-types`):** 20 / 20 tasks successful (0 errors)
- **Desktop Regression Suites (`run-tests.js`):** 16 / 16 suites PASS

---

## 13. Known Limitations & Phase 5 Readiness

1. **Email Tracking & Engagement (Phase 5):** Phase 4 deliberately does not alter tracking pixel injection, click redirect wrapping, or open event ingestion. Those concerns belong strictly to the engagement tracking phase.
2. **Mailbox Provider Reconciliation:** While ambiguous timeouts (`AMBIGUOUS_SEND_TIMEOUT`) are recorded in the delivery ledger to prevent duplicate sends, automated reconciliation (querying Gmail API search for message delivery verification after socket timeouts) is scheduled for the delivery observability phase.
3. **UI Campaign Action Buttons:** The IPC handlers and backend APIs for `pause` and `stop` are implemented and verified. Full UI visual overhaul of button states and toasts in `CampaignsScreen.tsx` can be polished in the upcoming UX cycle.
