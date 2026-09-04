# Phase 12 — Campaign & Outreach Core Forensic Audit

## Executive Summary

This forensic audit evaluates the deterministic foundations of LeadForge OS across 15 core architectural areas:
1. Campaign State Authority
2. Canonical Outreach Eligibility
3. Bypass Audit
4. Rate Limiting & Dispatch Concurrency
5. Scheduling Semantics
6. Message & Template Integrity
7. Delivery Semantics
8. Reply Correlation & Conversation Continuity
9. Email Address & Contact Semantics
10. Suppression & Quality Integration
11. Analytics Source-of-Truth Reconciliation
12. Operations & Recovery
13. Persistence Ordering & Crash Consistency
14. Cache & Projection Consistency
15. Security Boundary Review

The objective of Phase 12 is to consolidate the deterministic outreach core so that no two components disagree about the state of the same outreach action, safety gates cannot be bypassed, and operations remain safely recoverable before introducing any AI functionality.

---

# DELIVERABLE 1 — SYSTEM STATE MAP

| Entity | Authoritative Owner | Mutable Fields | Allowed Transitions | Side Effects | Dependent Entities | Cache / Projection | Recovery Mechanism |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Campaign** | `CampaignModel` (MongoDB) via `CampaignService` | `status`, `name`, `schedule`, `settings`, `dailyLimit`, `steps`, `template` | `DRAFT -> ACTIVE, STOPPED`<br/>`ACTIVE -> PAUSED, STOPPED, COMPLETED, FAILED`<br/>`PAUSED -> ACTIVE, STOPPED, FAILED`<br/>`STOPPED, COMPLETED, FAILED` (Terminal) | On `STOPPED`: cascade cancels active jobs and sequence executions.<br/>On `PAUSED`: halts worker dispatch loops. | `SequenceExecutionModel`, `JobModel`, `EmailDeliveryModel`, `AudienceModel` | SQLite `campaigns` table via `CacheHydrator` & `LocalCRMRepository` | Idempotent status update; stale jobs cancelled by `CampaignService.stopCampaign` |
| **Sequence** | `SequenceModel` (MongoDB) via `SequenceService` | `name`, `steps`, `status`, `settings` | `DRAFT -> ACTIVE -> ARCHIVED` | Modifying active steps affects subsequent step execution for running sequences. | `CampaignModel`, `SequenceExecutionModel` | SQLite `sequences` table | Versioned step snapshot in execution context |
| **SequenceExecution** | `SequenceExecutionModel` (MongoDB) & SQLite `sequence_executions` | `status`, `currentStep`, `nextExecutionAt`, `completedAt`, `failedAt`, `logs`, `metrics`, `executionContext` | `PENDING -> RUNNING -> WAITING -> RUNNING -> COMPLETED`<br/>`* -> PAUSED -> RUNNING / WAITING`<br/>`* -> CANCELLED / FAILED` (Terminal) | On `WAITING`: sets `nextExecutionAt` for scheduler recovery.<br/>On `COMPLETED`/`CANCELLED`: releases sequence execution lock. | `ContactModel`, `CampaignModel`, `JobModel`, `EmailDeliveryModel` | SQLite `sequence_executions` table | Scheduler recovery loop recovers overdue `WAITING` executions (`nextExecutionAt <= now`) into `automation:workflow` jobs |
| **ScheduledStep** | Step definition within `SequenceExecution.executionContext` | `stepIndex`, `status`, `executedAt`, `retryCount`, `error` | `PENDING -> EXECUTING -> COMPLETED / FAILED / WAITING` | Emits `automation_event` IPC and advances execution pointer. | `SequenceExecutionModel`, `EmailDeliveryModel` | SQLite `sequence_executions.logs` | Step-level retry with exponential backoff; idempotent send slot reservation |
| **Contact** | `ContactModel` (MongoDB) via `ContactService` | `status`, `emailStatus`, `emailQuality`, `emailMeta`, `additionalEmails`, `lastContactedAt`, `notes` | `NEW -> CONTACTED -> REPLIED`<br/>`* -> BOUNCED, UNSUBSCRIBED, DO_NOT_CONTACT, ARCHIVED` (Terminal suppressions) | Transition to `BOUNCED` or `UNSUBSCRIBED` automatically adds address to `SuppressionModel` and halts running sequence executions. | `SequenceExecutionModel`, `EmailDeliveryModel`, `EmailEventModel` | SQLite `contacts` table | Monotonic state transitions enforced by `canTransitionContactStatus` |
| **EmailAddress** | `Contact.email` and `Contact.additionalEmails` | `status`, `isPrimary`, `emailQuality` | `UNVERIFIED -> VALID -> QUARANTINED / INVALID` | Address-specific verification prevents dispatching unverified/invalid addresses without corrupting the contact. | `ContactModel`, `SuppressionModel`, `EmailDeliveryModel` | SQLite `contacts` (JSON parsed) | Re-evaluation via `evaluateEmailCandidate` |
| **EmailDelivery** | `EmailDeliveryModel` (MongoDB) via `EmailDeliveryRepository` | `status`, `attempt`, `providerMessageId`, `providerThreadId`, `sentAt`, `openCount`, `clickCount`, `replyCount`, `hasReply`, `error`, `failureCode`, `leaseExpiresAt`, `nextReconciliationAt` | `QUEUED -> SENDING -> SENT` (Terminal)<br/>`SENDING -> FAILED, RETRYING, AMBIGUOUS, CANCELLED`<br/>`AMBIGUOUS -> SENT, FAILED, RETRYING`<br/>`FAILED -> SENDING, RETRYING` | On `SENT`: transitions contact to `CONTACTED`, increments daily/hourly send counters.<br/>On `AMBIGUOUS`: enters reconciliation queue without consuming quota. | `EmailAccountModel`, `ContactModel`, `CampaignModel`, `EmailEventModel` | SQLite `email_deliveries` table (hydrated on demand via IPC) | `ReconciliationService` queries Gmail sent folder to resolve `AMBIGUOUS` deliveries |
| **EmailEvent** | `EmailEventModel` (MongoDB) via `EmailEventRepository` | None (Append-only immutable event ledger) | Immutable: created upon `SENT`, `OPENED`, `CLICKED`, `REPLIED`, `BOUNCED` | Updates aggregate counters on parent `EmailDeliveryModel`. | `EmailDeliveryModel`, `CampaignModel`, `ContactModel` | Local analytics projection | Deduplication via unique `dedupeKey` index |
| **Suppression** | `SuppressionModel` (MongoDB) via `SuppressionRepository` | None (Persistent suppression record) | Active suppression (never unsuppressed without explicit administrative removal) | Blocks all outbound sends across all campaigns, sequences, and direct sends for that address. | `EmailDeliveryModel`, `ContactModel` | SQLite `suppressions` table via `DesktopSuppressionRepository` | Immediate pre-flight evaluation before send reservation |
| **Job** | `JobModel` (MongoDB) via `JobsService` & `JobScheduler` | `status`, `workerId`, `leaseExpiresAt`, `lastHeartbeatAt`, `progress`, `error`, `result` | `queued -> starting -> running -> completed`<br/>`running -> retrying, failed, cancelled, stale` | Triggers sandboxed worker process fork; heartbeats monitored every 10s. | `SequenceExecutionModel`, `CampaignModel` | In-memory `activeWorkers` map in Electron main | Lease recovery: stale leases (`leaseExpiresAt < now`) or dead heartbeats (>30s) automatically retried or failed by `JobScheduler` startup recovery |
| **Operation** | Virtual projection derived by `OperationsService` | Unified view of `JobModel` and `EmailDeliveryModel` | Dynamically calculated (`queued`, `running`, `completed`, `failed`, `retrying`, `stale`, `ambiguous`, `cancelled`) | Exposes operational health, failure classifications, and recovery actions. | `JobModel`, `EmailDeliveryModel` | Operations Center UI | Direct trigger of retry, cancel, or reconciliation actions via API endpoints |
| **Analytics Projection** | Aggregations computed by `CampaignAnalyticsService` | Cached overview, time series, step analytics, sender analytics | Real-time immutable aggregation over `EmailDeliveryModel`, `EmailEventModel`, and `SequenceExecutionModel` | Feeds campaign dashboard and reporting. | `EmailDeliveryModel`, `EmailEventModel` | In-memory query response / UI state | Recomputed directly from immutable delivery and event evidence |

---

# DELIVERABLE 2 — OUTBOUND DISPATCH MAP

Every outbound email dispatch must pass through the canonical safety gates and converge on `EmailService.send()`.

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│ DISPATCH INITIATORS                                                             │
│                                                                                 │
│ [A] Campaign Direct Batch Worker    [B] Sequence Step Executor (automation.ts) │
│     (outreach.ts)                       (handleSendEmailStep)                   │
│          │                                   │                                  │
│ [C] Operations Retry Action         [D] Manual Direct / Test Send               │
│     (operations.service.ts)             (EmailService.sendTestMessage)          │
└─────────────────────────────────────┬───────────────────────────────────────────┘
                                      │
                                      ▼
                      HTTP POST /email/send (API Gateway)
                                      │
                                      ▼
                   EmailService.send(input: SendEmailInput)
                                      │
┌─────────────────────────────────────▼───────────────────────────────────────────┐
│ CANONICAL SAFETY GATE 1: RECIPIENT VALIDATION                                   │
│  - RFC 5321 strict email syntax validation (validateEmailStrict)                │
│  - Reject malformed / syntax-invalid recipients before reserving quota/delivery │
└─────────────────────────────────────┬───────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────▼───────────────────────────────────────────┐
│ CANONICAL SAFETY GATE 2: SUPPRESSION EVALUATION                                 │
│  - Query SuppressionRepository.isSuppressed(input.to)                           │
│  - Reject immediately if suppressed (HARD_BOUNCE, UNSUBSCRIBE, MANUAL, COMPLAINT)│
└─────────────────────────────────────┬───────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────▼───────────────────────────────────────────┐
│ CANONICAL SAFETY GATE 3: CAMPAIGN AUTHORIZATION CHECK                           │
│  - If campaignId present: CampaignModel.findOne({ _id: campaignId })            │
│  - Assert campaign.status === 'ACTIVE'                                          │
│  - Reject if campaign is STOPPED, PAUSED, DRAFT, COMPLETED, or FAILED          │
└─────────────────────────────────────┬───────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────▼───────────────────────────────────────────┐
│ CANONICAL SAFETY GATE 4: CONTACT OUTREACH ELIGIBILITY (evaluateOutreachEligibility)│
│  - Resolve Contact by input.contactId OR by recipient email input.to            │
│  - Contact status: reject if UNSUBSCRIBED, BOUNCED, DO_NOT_CONTACT, ARCHIVED   │
│  - Email candidate status: reject if QUARANTINED, INVALID, or DISPOSABLE domain │
│  - Structured email quality: reject if sendable === false                       │
│  - Domain affiliation: reject if third-party or domain unmatched                │
└─────────────────────────────────────┬───────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────▼───────────────────────────────────────────┐
│ CANONICAL SAFETY GATE 5: ATOMIC MAILBOX SEND SLOT RESERVATION                   │
│  - EmailAccountRepository.reserveSendSlot(accountId, limits)                    │
│  - Single-document atomic MongoDB update ($and filter):                         │
│      * Mailbox status in ['connected', 'active']                                │
│      * sendLeaseExpiresAt <= now (enforces maxConcurrent = 1 send per mailbox)  │
│      * nextSendAt <= now (enforces inter-send interval spacing)                 │
│      * hourlySent < hourlyLimit                                                 │
│      * dailySent < dailyLimit                                                   │
│      * rateLimitedUntil <= now (provider 429 cooldown expired)                  │
│  - If rejected: throw EMAIL_RATE_LIMITED with retryAfterSec                     │
└─────────────────────────────────────┬───────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────▼───────────────────────────────────────────┐
│ CANONICAL SAFETY GATE 6: ATOMIC DELIVERY RESERVATION & IDEMPOTENCY              │
│  - Generate canonical deterministic idempotency key                             │
│  - EmailDeliveryRepository.reserveDelivery(dto)                                 │
│  - If already exists in status 'SENT' -> return cached result, release quota    │
│  - If already in active 'SENDING' with valid lease -> throw DELIVERY_ALREADY_RESERVED
│  - Atomically transition or insert record to status 'SENDING' with 5m lease    │
└─────────────────────────────────────┬───────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────▼───────────────────────────────────────────┐
│ CANONICAL SAFETY GATE 7: DRIVE ATTACHMENTS & TRACKING PERSISTENCE               │
│  - Verify Drive access and resolve binary buffers for attachments               │
│  - Inject open tracking pixel & rewrite click redirect URLs                     │
│  - Persist exact rendered HTML, text, tokens, and attachments to delivery record│
└─────────────────────────────────────┬───────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────▼───────────────────────────────────────────┐
│ PROVIDER TRANSMISSION BOUNDARY                                                  │
│  - provider.send({ from, to, subject, html, text, attachments })                │
│                                                                                 │
│    ├── SUCCESS (Provider returns messageId, threadId):                          │
│    │    ├── Finalize delivery: status = 'SENT', sentAt = now                    │
│    │    ├── Monotonic contact update: status = 'CONTACTED', lastContactedAt=now │
│    │    ├── Clear send lease on account                                         │
│    │    └── Record immutable EmailEvent (SENT)                                  │
│    │                                                                            │
│    ├── AMBIGUOUS (Network timeout / provider disconnect during send):           │
│    │    ├── Mark delivery status = 'AMBIGUOUS' with reconciliation deadline     │
│    │    ├── Clear send lease so mailbox is not locked, but DO NOT release quota │
│    │    └── ReconciliationService polls Gmail sent folder before any retry     │
│    │                                                                            │
│    └── FAILURE (Explicit 4xx/5xx rejection or hard bounce):                     │
│         ├── Release send slot quota                                             │
│         ├── Mark delivery status = 'FAILED' with structured diagnostics         │
│         ├── If provider 429: set account rateLimitedUntil cooldown              │
│         └── If permanent hard bounce: auto-suppress recipient & mark contact BOUNCED
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

# DELIVERABLE 3 — REMEDIATION MATRIX

| ID | Severity | Area | Finding | Risk | Canonical Intended Behavior | Recommended Remediation | Tests Required |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REM-01** | **CRITICAL** | Area 8: Reply Correlation | `imap-poller.ts` lines 136-143 correlates ANY inbound email with In-Reply-To/References to `activeExecutions[0]` | Corrupts CRM contact state and prematurely terminates unrelated campaign executions for random contacts | Inbound reply matching must strictly match provider threadId, In-Reply-To / References Message-ID, or sender email address belonging to that specific execution | Remove `activeExecutions[0]` fallback; require strict header/thread/sender correlation matching | Unit test verifying unmatched inboxes do not corrupt activeExecutions[0]; correlation test |
| **REM-02** | **CRITICAL** | Area 5: Scheduler Semantics | `scheduler.ts` WAITING sequence recovery passes `contactId` instead of `entityId` and `entityType` | Every recovered WAITING execution crashes with unhandled exception `missing required payload field: entityId` | Scheduler WAITING recovery must supply canonical payload fields: `{ executionId, sequenceId, entityId, entityType: 'contact', campaignId }` | Align job creation payload in `scheduler.ts` with `AutomationWorkflowPayload` schema | Recovery test verifying WAITING execution resumes successfully without error |
| **REM-03** | **CRITICAL** | Area 1 & 12: Campaign Authority | `campaigns-ipc.ts` enqueues jobs without `campaignId` in payload | Campaign pause and stop operations fail to cancel running jobs (`j.payload.campaignId` is undefined); workers continue sending outreach | Job payload must always contain `campaignId` when created from campaign enrollment or schedule | Add `campaignId` to job creation payloads in `campaigns-ipc.ts` | Test campaign pause/stop cancels in-flight and queued workflow jobs |
| **REM-04** | **CRITICAL** | Area 6: Idempotency & Message Integrity | `outreach.ts` includes volatile `ctx.jobId` in idempotency key (`campaign_${campaignId}_${runIdentifier}_${contact.id}_step0`) | Retrying a failed/interrupted campaign job generates a new idempotency key, allowing duplicate sends to the same recipient | Campaign outreach idempotency keys must be deterministic: `campaign_${campaignId}_${contactId}_step${stepIndex}` | Standardize campaign batch idempotency key format to exclude volatile `jobId` | Idempotency test verifying identical key generated on job retry prevents duplicate send |
| **REM-05** | **HIGH** | Area 1: Campaign Authority | `updateCampaign(id, { status: 'STOPPED' })` in `campaign.service.ts` does not cascade-cancel jobs and executions | Bypassing `stopCampaign` endpoint by updating campaign status directly leaves active jobs and executions running | All paths transitioning campaign to `STOPPED` must trigger cascade cancellation of jobs and executions | Move cascade cancellation into `updateCampaign` when target status is `STOPPED` | Test `updateCampaign` with status `STOPPED` cancels associated jobs and executions |
| **REM-06** | **HIGH** | Area 2: Outreach Eligibility | `EmailService.send()` skips contact eligibility check if `contactId` is `'direct-contact'` or missing | Direct sends to contacts marked `UNSUBSCRIBED` or `DO_NOT_CONTACT` in CRM bypass eligibility checks if not yet in Suppression table | If `contactId` is omitted or `'direct-contact'`, lookup Contact by `input.to` email and evaluate eligibility | Resolve contact document by email if `contactId` is not provided in `EmailService.send()` | Direct send test asserting contact in CRM with `UNSUBSCRIBED` status is blocked |
| **REM-07** | **HIGH** | Area 8: Reply Correlation | Inbound reply matching fallback in `reconciliation.service.ts` matches latest sent delivery regardless of sending mailbox account | Inbound reply to Mailbox B can attach to a delivery sent from Mailbox A in an unrelated campaign | Contact fallback matching must verify that `matchedDelivery.accountId === account._id` OR `matchedDelivery.senderEmail === account.email` | Add accountId / senderEmail filter to contact-level fallback query in `reconciliation.service.ts` | Multi-account reply test verifying reply only matches delivery from the same account |
| **REM-08** | **HIGH** | Area 8: Reply Correlation | `reconciliation.service.ts` cancels ALL sequence executions for a contact across all campaigns upon reply | Replying to Campaign A prematurely terminates sequence in Campaign B | Reply should cancel the sequence execution matching the replied campaign/delivery | Scope sequence execution cancellation to `campaignId: matchedDelivery.campaignId` | Test multi-campaign contact reply only halts the matched campaign's execution |
| **REM-09** | **HIGH** | Area 9: Contact & Email Semantics | `reconciliation.service.ts` only searches primary `email: normalizedFrom`; ignores `additionalEmails` | Inbound replies and bounces from secondary contact emails are marked unmatched | Contact lookup should query `$or: [{ email: normalizedFrom }, { 'additionalEmails.email': normalizedFrom }]` | Update contact lookup queries in `reconciliation.service.ts` to inspect `additionalEmails` | Test bounce and reply correlation for secondary email addresses |
| **REM-10** | **HIGH** | Area 13: Crash Consistency | `reconcileStaleDeliveries` in `email-delivery.repository.ts` directly marks stale `SENDING` deliveries as `FAILED` | If worker crashed after Gmail accepted send, delivery is falsely marked `FAILED`, allowing duplicate resend | Stale deliveries must be marked `AMBIGUOUS` so `ReconciliationService` verifies Gmail sent folder | Update `reconcileStaleDeliveries` to transition stale deliveries to `AMBIGUOUS` | Crash test verifying stale delivery is reconciled via Gmail search before failure |
| **REM-11** | **HIGH** | Area 11: Analytics Source-of-Truth | Direct worker (`outreach.ts`) passes synthetic IDs `sequenceId: 'campaign-' + campaignId`, `executionId: 'exec-' + campaignId` | Distorts execution counts in analytics; multiple contacts share identical executionId | Campaign batch sends should create or resolve genuine `SequenceExecution` or use contact-specific execution ID | Use deterministic per-contact execution ID `exec_${campaignId}_${contact.id}` | Test analytics aggregation correctly reports distinct executions |
| **REM-12** | **MEDIUM** | Area 7: Delivery Semantics | `reconciliation.service.ts` resolves absent delivery to `FAILED` without recording `FAILED` EmailEvent | Event ledger missing corresponding event for audit trail | Record immutable `FAILED` event in `EmailEventModel` when reconciliation determines send failed | Add `eventRepo.recordEvent({ type: EmailEventType.FAILED })` on absent resolution | Verify FAILED event recorded during reconciliation |
| **REM-13** | **MEDIUM** | Area 4: Concurrency & Rate Limits | No recipient-level in-flight reservation cooldown | Simultaneous campaigns could send duplicate emails to the same recipient concurrently | Enforce recipient in-flight check: reject if another delivery to same recipient is currently in `SENDING` state | Check active `SENDING` deliveries for recipient email before reservation | Test concurrent workers targeting same recipient are serialized or rejected |
| **REM-14** | **MEDIUM** | Area 14: Cache Consistency | SQLite `sequence_executions` not refreshed when MongoDB execution is updated via API reply poller | Desktop UI displays outdated execution status until manual page reload | Broadcast IPC event or trigger selective cache invalidation on reply/bounce ingestion | Emit sync notification when executions are modified by server reconciliation | Test execution status updates reflected in local cache |

---

# DELIVERABLE 4 — CANONICAL OUTREACH INVARIANTS

The deterministic outreach core of LeadForge OS is governed by the following twenty canonical invariants:

* **I-001 No outbound message can bypass canonical eligibility.**
  Every outbound send path—campaign batch, sequence step, manual send, retry, or test send—must converge on `EmailService.send()` and pass RFC 5321 syntax validation, suppression lookup, campaign authorization, and contact eligibility.

* **I-002 A currently suppressed email address cannot be dispatched.**
  If an address exists in `SuppressionModel` (for reasons including `HARD_BOUNCE`, `UNSUBSCRIBE`, `MANUAL`, or `COMPLAINT`), provider dispatch is unconditionally blocked at the server boundary.

* **I-003 A reply-suppressed execution cannot produce another message.**
  Once a contact replies to outreach within a sequence or campaign, that sequence execution is immediately transitioned to `COMPLETED` and subsequent outreach steps are permanently cancelled.

* **I-004 Provider acceptance is immutable historical evidence.**
  Once an email is accepted by the provider (e.g. Gmail API returns `messageId` and `threadId`), the delivery record status `SENT` and timestamp `sentAt` are permanently immutable. Terminal delivery status `SENT` has zero outgoing state transitions.

* **I-005 Historical delivery records cannot be rewritten to change what was sent.**
  Rendered HTML, rendered text, attachments, tracking tokens, and header metadata persisted at reservation time cannot be mutated by retries, template updates, or contact edits.

* **I-006 A retry cannot create duplicate provider dispatch for the same logical attempt.**
  Deterministic idempotency keys derived from `(workspaceId, campaignId, contactId, stepIndex)` ensure that retries of the same logical action encounter the existing delivery record and return cached provider evidence without calling the provider again.

* **I-007 Ambiguous provider outcomes cannot be treated as confirmed failures.**
  A network timeout, socket hangup, or process crash during provider dispatch transitions the delivery to `AMBIGUOUS`. The system must never convert an ambiguous outcome into a failure or permission to resend without verifying absence in the provider sent folder.

* **I-008 DNS/MX evidence cannot be represented as mailbox existence proof.**
  DNS record presence and MX host resolution represent domain-level routability only and must never be recorded or displayed as mailbox existence or verification proof.

* **I-009 Bounce evidence is address-scoped unless an explicit product rule says otherwise.**
  A hard bounce received for an email address invalidates and suppresses that specific email address. If a contact possesses multiple email addresses, valid alternate addresses remain usable unless the contact has no valid addresses remaining.

* **I-010 Campaign STOPPED state prevents new dispatch.**
  When a campaign transitions to `STOPPED`, all associated pending jobs and sequence executions are cancelled immediately. Workers check campaign state at the send boundary and abort dispatch if the campaign is stopped.

* **I-011 Campaign PAUSED state prevents new dispatch.**
  When a campaign is in `PAUSED` status, workers halt dispatch loops, save checkpoints, and yield execution slots. `EmailService.send()` rejects outbound sends associated with a paused campaign.

* **I-012 Provider/account rate limits cannot be bypassed through worker concurrency.**
  Mailbox sending limits, concurrency limits (`maxConcurrent = 1`), and inter-send intervals are enforced by single-document atomic operations on `EmailAccountModel` at the final dispatch boundary. Concurrent workers competing for the same mailbox are serialized.

* **I-013 Analytics cannot inflate results through retries or duplicate events.**
  Metrics are derived from immutable delivery records and deduplicated event logs. Retrying a failed attempt updates the existing attempt counter rather than creating duplicate accepted delivery records.

* **I-014 Historical analytics must not depend on mutable current contact state.**
  Campaign performance metrics (attempted, accepted, opened, clicked, replied, bounced) are derived solely from immutable delivery and event ledgers and remain constant regardless of subsequent contact edits, archiving, or deletions.

* **I-015 Every provider dispatch must be attributable to a campaign, sequence, or manual action.**
  Every outbound delivery record must durably record its origin: `campaignId`, `sequenceId`, `executionId`, `stepIndex`, and `contactId`. Synthetic or orphan sends without provenance are prohibited.

* **I-016 Every outbound message must have an auditable delivery record.**
  No provider dispatch may occur without an atomically reserved delivery record in `EmailDeliveryModel`. If the provider call fails, the delivery record captures structured failure diagnostics and error codes.

* **I-017 A worker crash must not silently create permission to resend.**
  Stale `SENDING` deliveries whose leases expire without provider finalization are transitioned to `AMBIGUOUS` for sent-folder verification. Missing local state is never interpreted as authorization to dispatch again.

* **I-018 Recovery must be idempotent.**
  Scheduler crash recovery, stale lease reconciliation, and WAITING timer evaluations can execute repeatedly without spawning duplicate jobs or sending duplicate messages.

* **I-019 Cross-tenant data cannot participate in another tenant's campaign or analytics.**
  All queries, mutations, reservations, and event records enforce strict workspace boundary filtering (`workspaceId: this.workspaceId`). Cross-tenant access is structurally blocked.

* **I-020 Cache state must never override authoritative business state.**
  MongoDB is the sole authoritative source of truth for business state. SQLite is a disposable read projection. In any conflict, MongoDB state unconditionally supersedes local cache state.
