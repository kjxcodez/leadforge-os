# LeadForge OS — Phase 6: Reply Ingestion, Delivery Reconciliation & Conversation Continuity Engineering Report

**Status:** IMPLEMENTED & VERIFIED  
**Version:** 1.1.1-beta.4.2  
**Scope:** Ambiguous Send Reconciliation, Gmail Inbound Reply Discovery, Hierarchical Thread & Header Correlation, Monotonic Contact `REPLIED` Transition, Active Sequence Outreach Suppression, and Multi-Tenant Isolation.

---

## 1. Current Architecture (Baseline Post-Phase 5)

Phase 5 established outbound email as a first-class, durable, and secure product object in LeadForge OS:
- Canonical outbound message representation (`htmlBody`, `textBody`, `attachments` metadata) stored directly on `EmailDeliveryModel`.
- Provider handles (`providerMessageId`, `providerThreadId`) captured upon successful dispatch.
- Opaque tracking token model for 1x1 transparent open tracking pixels and safe 302 click redirects.
- Immutable `EmailEventModel` recording time-series observations.
- Structured diagnostics categorizing failures into `RATE_LIMIT`, `AUTH`, `INVALID_RECIPIENT`, `POLICY`, `NETWORK`, and `AMBIGUOUS`.

However, the lifecycle remained open-ended in two areas:
1. When sends timed out during transmission (`AMBIGUOUS_SEND_TIMEOUT`), they were marked `AMBIGUOUS` to prevent blind resending, but the system lacked an automated reconciliation worker to discover whether Gmail actually delivered the message.
2. Inbound replies from prospects were not ingested, conversations could not transition contacts to `REPLIED`, and active sequence steps did not automatically halt when a contact replied.

Phase 6 closes this loop.

---

## 2. Delivery Reconciliation Design (Ambiguous Sends)

### The Problem
During network socket timeouts or disconnections during a Gmail API `sendMessage` call, the outcome at Google's server is uncertain. Naive systems either:
- Blindly resend (causing duplicate outreach emails to be received by prospects).
- Or mark failed and release quota (potentially double-sending when the campaign resumes).

### Collision-Safe Correlation Strategy
Naive queries like `to:recipient after:timestamp` are dangerous because they collide with earlier or concurrent messages sent to the same recipient.

LeadForge OS implements a 5-point collision-resistant correlation criteria:
1. **Targeted Gmail Query:**
   `in:sent to:${delivery.recipientEmail} from:${delivery.senderEmail} subject:"${escapedSubject}" after:${windowStart} before:${windowEnd}`
2. **Exact Header Verification:**
   Candidates returned by Gmail are retrieved individually. The worker verifies that normalized `To`, `From`, and `Subject` match the delivery record.
3. **Time Boundary:**
   The Gmail `internalDate` must fall within the transmission attempt window ($\pm 15$ minutes).
4. **Duplicate Claim Defense:**
   The candidate's `messageId` must **not** already be assigned to another `EmailDelivery` record in the database.
5. **Ambiguity Guard:**
   If multiple candidate messages match the criteria, the worker flags `reconciliationNotes = 'Ambiguous collision: multiple candidates'` and preserves `AMBIGUOUS` state without guessing.

### Reconciliation State Machine
```text
                  ┌────────────────────────┐
                  │       SENDING          │
                  └──────────┬─────────────┘
                             │ (Socket timeout)
                             ▼
                  ┌────────────────────────┐
                  │       AMBIGUOUS        │
                  └──────────┬─────────────┘
                             │
                             ▼
                  [ Reconciliation Worker ]
                             │
        ┌────────────────────┼────────────────────┐
        │ Exactly 1 Match    │ No Matches         │ Multiple Matches
        ▼                    ▼                    ▼
   ┌─────────┐      ┌──────────────────┐    ┌───────────┐
   │  SENT   │      │   Age Check      │    │ AMBIGUOUS │
   └─────────┘      └────────┬─────────┘    │ (Hold for │
        │                    │              │  review)  │
   Quota Remains    < 3 attempts / < 15m    └───────────┘
     Consumed       Keep AMBIGUOUS & Retry
                             │
                    >= 3 attempts / >= 15m
                             ▼
                        ┌──────────┐
                        │  FAILED  │
                        └──────────┘
                             │
                        Quota Slot
                         Released
```

### Atomic Lease Locking
To ensure at most one worker processes an ambiguous delivery at a time:
- The worker uses an atomic query with `$and` wrapping lease expiry and retry backoff:
  ```typescript
  {
    _id: deliveryId,
    workspaceId: this.workspaceId,
    status: 'AMBIGUOUS',
    $and: [
      { $or: [{ reconciliationLeaseExpiresAt: null }, { reconciliationLeaseExpiresAt: { $lt: now } }] },
      { $or: [{ nextReconciliationAt: null }, { nextReconciliationAt: { $lte: now } }] }
    ]
  }
  ```
- Claims the record with a 60-second lease (`reconciliationLeaseExpiresAt = now + 60000`) and increments `reconciliationAttempts`.
- Expired leases self-heal automatically if a worker crashes.

---

## 3. Inbound Reply Architecture

Inbound reply ingestion operates as a targeted, incremental discovery engine:
1. **Incremental Polling:**
   Connected mailboxes track `lastInboundPollAt`. Each poll queries Gmail only for messages received since the last checkpoint:
   `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=to:${account.email}+after:${timestamp}&maxResults=25`
2. **Self-Message Filtering:**
   Messages sent by the mailbox itself (`From === account.email`) are immediately skipped.
3. **Idempotent Ingestion:**
   Before processing MIME payloads, the message ID is evaluated against `EmailDeliveryModel.findOne({ idempotencyKey: 'inbound_' + accountId + '_' + msg.id })`. If already ingested, it is skipped with zero overhead.
4. **MIME Body Extraction:**
   Extracts `text/plain`, `text/html`, attachment metadata (`hasAttachments`, `attachmentCount`), and standard headers (`From`, `To`, `Subject`, `Message-ID`, `In-Reply-To`, `References`, `Date`).

---

## 4. Hierarchical Correlation Strategy

Inbound replies are correlated to outbound messages and contacts through a deterministic 3-tier hierarchy:

```text
                           Incoming Message
                                  │
                                  ▼
           [ Tier 1: Gmail Conversation Thread Matching ]
             providerThreadId == EmailDelivery.providerThreadId?
                                  │
                     ┌────────────┴────────────┐
                    YES                        NO
                     │                         │
                     ▼                         ▼
             MATCHED (Thread)    [ Tier 2: Email Header Matching ]
                                   In-Reply-To / References == providerMessageId?
                                               │
                                  ┌────────────┴────────────┐
                                 YES                        NO
                                  │                         │
                                  ▼                         ▼
                          MATCHED (Header)   [ Tier 3: Contact Email Fallback ]
                                               From == Contact.email in Workspace?
                                                            │
                                               ┌────────────┴────────────┐
                                              YES                        NO
                                               │                         │
                                               ▼                         ▼
                                       MATCHED (Contact)            UNMATCHED
```

### 1. Tier 1: Thread ID Matching (Strongest)
Gmail assigns a common `threadId` to all messages in an email conversation. If `incoming.threadId` matches an outbound `EmailDelivery` record in the workspace, we have deterministic conversation continuity.

### 2. Tier 2: Standard Message Headers (`In-Reply-To` / `References`)
When mail clients (Outlook, Apple Mail, Thunderbird) reply across provider boundaries, they preserve RFC 5322 headers:
- `In-Reply-To`: Contains the `Message-ID` of the immediate parent email.
- `References`: Contains the historical chain of `Message-ID`s.
If any referenced ID matches an outbound delivery's `providerMessageId`, the reply is matched with high confidence.

### 3. Tier 3: Contact Email Fallback
If thread and header references were stripped by a security gateway, the sender address is normalized (`normalizeEmail(fromAddress)`) and matched against active contacts in the workspace. If found, the reply attaches to the contact's most recent outbound delivery (`status: 'SENT'`).

---

## 5. Matching Confidence & Unmatched Handling

When an incoming email cannot be linked to an outbound delivery or contact:
- **LeadForge Rule 1: Never Guess.** The system never attaches an ambiguous reply to an arbitrary contact or campaign.
- **Unmatched Persistence:** The email is safely ingested into `EmailDeliveryModel` with:
  - `direction: 'INBOUND'`
  - `processingStatus: 'UNMATCHED'`
  - `matchConfidence: 'none'`
  - `matchedDeliveryId: null`
  - `contactId: 'unmatched-contact'`
- **Zero Side Effects:** Unmatched messages do **not** mutate any contact CRM status, do not cancel campaigns, and do not trigger false notifications.

---

## 6. Contact Lifecycle & Monotonic `REPLIED` Transition

When an inbound reply is successfully matched to a contact:
1. **Monotonic Status Progression:**
   The contact is transitioned to `ContactStatus.REPLIED`.
   - `NEW` $\rightarrow$ `REPLIED` (Permitted)
   - `CONTACTED` $\rightarrow$ `REPLIED` (Standard progression)
   - `REPLIED` $\rightarrow$ `REPLIED` (Idempotent no-op)
2. **Terminal Suppression Invariant:**
   Contacts with the following suppression states are **strictly protected** and will **never** be overwritten by `REPLIED`:
   - `UNSUBSCRIBED`
   - `BOUNCED`
   - `DO_NOT_CONTACT`
   - `ARCHIVED`
   *(If an unsubscribed contact replies to say "remove me", their CRM suppression state remains `UNSUBSCRIBED`)*.
3. **Timestamp Tracking:**
   `contact.lastRepliedAt` is set to the exact message `internalDate`.

---

## 7. Campaign & Sequence Interaction: Automated Outreach Suppression

A critical rule in cold outreach is: **Once a prospect replies, all further automated sequence follow-ups must immediately stop.**

Phase 6 implements this at two layers:
1. **CRM Outreach Eligibility Layer (`evaluateOutreachEligibility`):**
   Added `CONTACT_REPLIED` check. If `contact.status === 'REPLIED'`, `evaluateOutreachEligibility` returns `{ eligible: false, reason: 'CONTACT_REPLIED' }`. Campaign dispatchers (`outreach.ts`) skip the contact automatically.
2. **Active Sequence Execution Cancellation:**
   When a reply is matched, the worker atomically updates all active or waiting executions for that contact:
   ```typescript
   await SequenceExecutionModel.updateMany(
     {
       workspaceId: this.workspaceId,
       contactId: contactDoc._id.toString(),
       status: { $in: ['active', 'running', 'waiting', 'pending', 'WAITING', 'ACTIVE', 'RUNNING', 'PENDING'] }
     },
     {
       $set: {
         status: 'completed',
         completedAt: new Date(),
         nextExecutionAt: null
       },
       $inc: { replies: 1 },
       $push: {
         logs: {
           timestamp: new Date(),
           level: 'info',
           message: 'Sequence execution halted: contact replied to email outreach.',
           step: matchedDelivery.stepIndex
         }
       }
     }
   );
   ```

---

## 8. Immutable Reply Event Stream

Every matched reply emits an immutable `EmailEventType.REPLIED` event into `EmailEventModel`:
```typescript
{
  deliveryId: matchedDelivery._id.toString(),
  contactId: contactDoc._id.toString(),
  campaignId: matchedDelivery.campaignId || null,
  type: EmailEventType.REPLIED,
  occurredAt: incomingDate,
  metadata: {
    providerMessageId: item.id,
    providerThreadId: item.threadId,
    from: normalizedFrom,
    subject: detail.headers.subject,
    matchConfidence: 'thread' | 'header' | 'contact'
  },
  dedupeKey: `reply_${workspaceId}_${incomingMessageId}`
}
```

---

## 9. Idempotency Invariants

Across network retries, crash loops, and overlapping polling cycles:
1. **Inbound Delivery Record:**
   Guaranteed unique by compound index on `{ workspaceId: 1, idempotencyKey: 1 }` where `idempotencyKey = 'inbound_' + accountId + '_' + messageId`.
2. **Reply Event:**
   Guaranteed unique by compound index on `{ workspaceId: 1, dedupeKey: 1 }` where `dedupeKey = 'reply_' + workspaceId + '_' + messageId`.
3. **Delivery Aggregation:**
   Parent delivery `hasReply` and `lastRepliedAt` updates are idempotent.
4. **Result:** Repeated polling of the same mailbox produces exactly 1 message record, 1 reply event, and 1 contact transition.

---

## 10. Scheduling & Execution Strategy

- **Reconciliation Worker:** Runs every 60 seconds. Claims batches of up to 10 `AMBIGUOUS` records using atomic leasing.
- **Inbound Reply Poller:** Runs every 120 seconds. Iterates connected mailboxes (`status: 'connected'`).
- **Persistence:** All state resides in MongoDB and SQLite. No local memory arrays, `setTimeout`s, or ephemeral process state.

---

## 11. Gmail API Quota Safety

The Gmail API enforces a rate limit of 250 quota units per user per second and 1,000,000 units per day.
- `messages.list`: 5 units
- `messages.get`: 5 units
- Batch size is capped at 25 messages per mailbox per cycle.
- Polling uses `after:${lastInboundPollAt}` timestamp boundaries, returning zero messages on idle mailboxes (cost: 5 units per poll).
- Under 10 connected mailboxes polling every 2 minutes:
  $\approx 10 \times 30 \times 5 = 1,500$ units/hour $\ll 1,000,000$ daily quota.

---

## 12. Security & HTML Preview Protection

1. **Inbound Content Untrusted:** Inbound email bodies are treated as untrusted user input.
2. **Preview Sanitization (`sanitizeHtmlForPreview`):**
   - `<script>`, `<iframe>`, `<object>`, and `<embed>` tags are completely stripped.
   - Inline event handlers (`onload`, `onerror`, `onclick`) are removed.
   - `javascript:` URIs are neutralized.
3. **Token & Credential Safety:** No OAuth tokens, client secrets, or refresh tokens are exposed in API payloads, database message logs, or error messages.

---

## 13. Automated Test Verification Matrix

A dedicated automated test suite (`email-reply-reconciliation.test.ts`) was authored and executed, verifying all 12 key lifecycle invariants:

```
======================================================================
RUNNING EMAIL REPLY INGESTION & DELIVERY RECONCILIATION TEST SUITE
======================================================================

TEST 1: Ambiguous Send Reconciliation State Machine
  [PASS] Ambiguous delivery promoted to SENT when verified in Gmail
  [PASS] Provider message ID populated from Gmail
  [PASS] Provider thread ID populated from Gmail
  [PASS] Quota remains consumed when send is verified
  [PASS] Recent missing send remains AMBIGUOUS for retry
  [PASS] nextReconciliationAt scheduled
  [PASS] Attempt counter incremented
  [PASS] Missing send transitioned to FAILED after bounded attempts
  [PASS] Failure classification set
  [PASS] Quota slot released upon confirmed absence

TEST 2: Collision-Safe Reconciliation Criteria
  [PASS] Exact match accepted
  [PASS] Different recipient rejected
  [PASS] Different sender rejected
  [PASS] Different subject rejected

TEST 3: Thread-Based Inbound Reply Correlation
  [PASS] Reply correlated to correct outbound delivery via thread
  [PASS] Reply correlated to correct contact ID
  [PASS] Confidence level recorded as thread

TEST 4: Header-Based Reply Correlation
  [PASS] Correlated via In-Reply-To header
  [PASS] Correlated via References header
  [PASS] Unknown header returns null (no false match)

TEST 5: Monotonic Contact Status Transitions
  [PASS] CONTACTED -> REPLIED is permitted
  [PASS] NEW -> REPLIED is permitted
  [PASS] REPLIED -> REPLIED is idempotent
  [PASS] UNSUBSCRIBED -> REPLIED is FORBIDDEN
  [PASS] BOUNCED -> REPLIED is FORBIDDEN
  [PASS] DO_NOT_CONTACT -> REPLIED is FORBIDDEN
  [PASS] ARCHIVED -> REPLIED is FORBIDDEN

TEST 6: Sequence Outreach Suppression on Reply
  [PASS] Replied contact is deemed INELIGIBLE for outreach
  [PASS] Ineligibility reason is CONTACT_REPLIED
  [PASS] Execution for replied contact completed immediately
  [PASS] Replies counter incremented
  [PASS] Unrelated contact execution remained unaffected

TEST 7: Inbound Polling Idempotency
  [PASS] First poll records REPLIED event
  [PASS] Duplicate poll cycle safely rejected by idempotency constraint
  [PASS] Exactly 1 event preserved in database

TEST 8: Inbound HTML Preview Sanitization
  [PASS] Scripts stripped from inbound reply
  [PASS] Iframes stripped from inbound reply
  [PASS] Inline event handlers removed
  [PASS] javascript: URI neutralized
  [PASS] Legitimate reply text preserved
  [PASS] Safe image preserved

TEST 9: Multi-Tenant Workspace Data Isolation
  [PASS] Workspace Alpha matches only its own delivery
  [PASS] Workspace Alpha cannot cross into Workspace Beta

======================================================================
REPLY INGESTION & RECONCILIATION SUITE COMPLETE: 43 TESTS PASSED!
======================================================================
```

### Complete Test Results Across Monorepo
- **Email Reply & Reconciliation Suite (`email-reply-reconciliation.test.ts`):** 43 / 43 PASS
- **Email Delivery & Engagement Suite (`email-delivery-engagement.test.ts`):** 38 / 38 PASS
- **Email Tracking Utilities Suite (`tracking.test.ts`):** 26 / 26 PASS
- **Campaign Lifecycle & Send Safety Suite (`campaign-lifecycle-safety.test.ts`):** 38 / 38 PASS
- **Outreach Eligibility Policy Suite (`outreach-eligibility.test.ts`):** 31 / 31 PASS
- **Email Candidate Sanitizer Suite (`email-sanitizer.test.ts`):** 42 / 42 PASS
- **Desktop Regression Test Runner (`run-tests.js`):** 18 / 18 suites PASS
- **Monorepo Typecheck (`pnpm check-types`):** 20 / 20 tasks successful (0 errors)

---

## 14. Handling Specific Concurrency Races (Phase 6AC)

- **Race 1: Send reconciles to SENT after reply is discovered:**
  The reply correlation finds the delivery by `providerThreadId` regardless of whether wire status is `SENT` or `AMBIGUOUS`. When reconciliation runs, it confirms the send in Gmail, updating status to `SENT`.
- **Race 2: Reply arrives before reconciliation completes:**
  The reply updates the contact to `REPLIED` and parent delivery to `hasReply: true`. The contact's `REPLIED` state is protected and cannot be downgraded back to `CONTACTED`.
- **Race 3: Repeated polling:**
  Enforced by unique MongoDB index on `idempotencyKey` and `dedupeKey`. Duplicate records are rejected with zero side-effects.
- **Race 4: Campaign stopped after reply:**
  Outreach is already suppressed because the contact is `REPLIED` and the sequence execution is marked `completed`. Stopping the campaign is an idempotent operation.
- **Race 5: Contact unsubscribes after replying:**
  The transition `REPLIED` $\rightarrow$ `UNSUBSCRIBED` is permitted. Outreach remains suppressed.
- **Race 6: Worker restart mid-poll:**
  `lastInboundPollAt` is updated only upon successful completion of the mailbox poll, ensuring missed messages are retrieved on the next cycle.

---

## 15. Known Limitations & Next Phase Readiness

1. **AI Reply Classification & Sentiment:** Phase 6 captures, correlates, and stores raw reply content and updates contact state to `REPLIED`. Categorizing replies into positive/negative sentiment or automatic lead scoring is scheduled for the AI intelligence cycle.
2. **Automated Reply Drafting:** Generating AI draft responses is intentionally excluded from this phase.
3. **Email Logs UI:** The backend data model, reconciliation workers, reply streams, and query endpoints are now fully stable and verified, unlocking the Email Logs UI overhaul.
