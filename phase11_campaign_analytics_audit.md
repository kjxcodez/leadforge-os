# LeadForge OS — Phase 11: Campaign Analytics, Performance Intelligence & Attribution Audit

**Author**: Antigravity AI  
**Date**: September 4, 2026  
**Status**: Authoritative Forensic Audit  
**Target Milestone**: Phase 11 Campaign Performance Intelligence Layer  

---

## 1. Executive Summary & Audit Purpose

Before implementing the Campaign Analytics and Performance Intelligence Layer, this forensic audit examines the entire campaign outreach lifecycle across `@leadforge/schema`, `apps/api` (MongoDB models, services, repositories), and `apps/desktop` (Electron SQLite tables, IPC channels, worker plugins).

The goal of this audit is to:
1. Map all operational state transitions from audience enrollment to terminal delivery or reply.
2. Verify the integrity prerequisites established in Phase 10.
3. Establish the authoritative source of truth for every campaign performance metric.
4. Uncover and document denominator ambiguities, event duplication risks, retry inflation risks, open/click limitations, and attribution constraints.
5. Provide a rigorous foundation for the Phase 11 Metric Dictionary and Analytics Engine.

---

## 2. End-to-End Campaign Outreach State Machine

The LeadForge OS campaign outreach pipeline spans the following deterministic states:

```text
[Audience Resolution]
       │ (Phase 10 filter: excludes suppressed, quarantined, invalid)
       ▼
[Campaign Enrollment]
       │ Creates SequenceExecution record in sequence_executions
       ▼
[Sequence Step Scheduled]
       │ Delay days / scheduling window calculated
       ▼
[Job Queue Dispatch]
       │ Worker picks up automation:workflow job
       ▼
[Send-Time Pre-Flight Gating]
       │ Re-checks suppression, invalid address, campaign active status, daily limits
       ├── (Suppressed / Invalid) ────────► [Execution Cancelled / Contact Suppressed]
       ▼
[Lease Reservation]
       │ Creates EmailDelivery record with status='SENDING', leaseExpiresAt
       ▼
[Provider Dispatch (Gmail API / SMTP)]
       ├── (Network timeout / ambiguous) ──► [status='AMBIGUOUS', reconciliation scheduled]
       ├── (Provider permanent reject) ───► [status='FAILED', auto-suppress on hard bounce]
       ▼
[Provider Accepted]
       │ status='SENT', sentAt=Date.now(), providerMessageId & threadId captured
       │ Contact transitions to status='CONTACTED'
       ├── (Inbound DSN / Bounce) ────────► [EmailEvent 'BOUNCED', Contact 'BOUNCED', auto-suppress]
       ├── (Open Tracking Pixel Request) ──► [EmailEvent 'OPENED', delivery.openCount++]
       ├── (Click Tracking Redirect) ──────► [EmailEvent 'CLICKED', delivery.clickCount++]
       ▼
[Inbound Reply Received]
       │ Inbound delivery recorded, EmailEvent 'REPLIED' emitted
       │ Parent delivery.hasReply=true, replyCount++
       │ Contact transitions to status='REPLIED'
       ▼
[Sequence Stopped by Reply]
       │ SequenceExecution marked status='completed' / 'replied'
       │ Subsequent scheduled steps cancelled
```

---

## 3. Phase 10 Integrity Verification (Prerequisites Check)

Prior to designing analytics, we verified the Phase 10 guarantees across the codebase:

| Prerequisite | Expected Behavior | Audit Verification Result | Location in Codebase |
|---|---|---|---|
| **Email Quality Invariant** | DNS/MX checks must never claim mailbox verification | **PASS**: `DnsEmailVerificationProvider.mailboxVerified` is strictly `null`. `evaluateEmailQuality` yields `MX_VALID` (score $\le 0.85$), reserving `VERIFIED` strictly for explicit mailbox proof. | `packages/core/src/email/verification-provider.ts`, `packages/schema/src/utils/email-quality-engine.ts` |
| **Send Eligibility Invariant** | Suppressed and invalid addresses excluded from audience and dispatch | **PASS**: `audiences-ipc.ts` filters out `suppressions` table entries and `emailStatus IN ('QUARANTINED', 'INVALID')`. `email.service.ts` and `outreach.ts` perform pre-flight suppression checks. | `apps/desktop/src/main/ipc/audiences-ipc.ts`, `apps/api/src/services/email/email.service.ts` |
| **Ambiguous Send Safety** | Ambiguous deliveries must never be blindly retried | **PASS**: Ambiguous sends are quarantined until reconciliation or human intervention confirms receipt. `canRetryDelivery()` blocks retry on `AMBIGUOUS`. | `apps/api/src/services/operations/operations.service.ts` |
| **Historical Data Immutability** | Legacy deliveries must not be rewritten into false claims | **PASS**: Deliveries in `EmailDeliveryModel` have permanent retention (no TTL). Email quality cache expiration does not mutate historical delivery records. | `apps/api/src/db/models/email-delivery.model.ts` |
| **Bounce Identity Isolation** | Bounces must tie to recipient email, not entire contact | **PASS**: `parseDsnReport()` extracts recipient email; `suppressions` table is keyed on `(workspaceId, email)`. Multi-email contacts retain valid alternative addresses. | `packages/schema/src/utils/bounce-classifier.ts`, `apps/desktop/src/main/database/suppression-repository.ts` |

---

## 4. Metric Source of Truth & Field Analysis

| Metric Category | Metric Name | Authoritative Source | Source Field / Filter | Notes & Potential Risks |
|---|---|---|---|---|
| **Audience & Enrollment** | Contacts Enrolled | `SequenceExecutionModel` / `sequence_executions` | `COUNT(DISTINCT contactId)` where `campaignId = :id` and `deletedAt IS NULL` | Deduplicated by contact. Do not count raw execution records if a contact was re-enrolled. |
| | Contacts Eligible | `ContactModel` & `SuppressionModel` | Contacts enrolled minus those with `status IN ('UNSUBSCRIBED', 'BOUNCED', 'DO_NOT_CONTACT')` or email in `suppressions` | Dynamic based on evaluation window vs historical eligibility. Must document whether eligibility is evaluated at enrollment or send time. |
| | Contacts Suppressed | `SuppressionModel` / `suppressions` | `COUNT(DISTINCT email)` matching enrolled contacts in `suppressions` | Must distinguish between contacts suppressed *prior* to send vs suppressed *as a result* of send (bounces/unsubscribes). |
| **Outreach Volume** | Emails Scheduled | `sequence_executions` | Steps remaining to be executed for enrolled contacts | Computed from sequence definition steps minus executed steps. |
| | Emails Queued | `EmailDeliveryModel` / `email_deliveries` | `status = 'QUEUED'` with `campaignId = :id` | Ephemeral transient state. |
| | Emails Attempted | `EmailDeliveryModel` / `email_deliveries` | `status != 'QUEUED'` (includes `SENDING`, `SENT`, `FAILED`, `AMBIGUOUS`, `SUPPRESSED`) | Reflects every attempt dispatched to the provider. |
| | Provider Accepted | `EmailDeliveryModel` / `email_deliveries` | `status = 'SENT'` and `sentAt IS NOT NULL` | Means mail provider accepted message; does NOT guarantee inbox placement. |
| | Emails Failed | `EmailDeliveryModel` / `email_deliveries` | `status = 'FAILED'` | Permanent dispatch rejections. |
| | Emails Ambiguous | `EmailDeliveryModel` / `email_deliveries` | `status = 'AMBIGUOUS'` or `ambiguous = 1` | Timeout during dispatch. Kept isolated until reconciled. |
| **Observed Engagement** | Observed Opens | `EmailEventModel` / `EmailDeliveryModel` | `SUM(openCount)` or `COUNT(events)` with `type = 'OPENED'` | Subject to mail client prefetch/caching. Labeled as *Observed Opens*. |
| | Unique Open Deliveries | `EmailDeliveryModel` | `COUNT(id)` where `openCount > 0` | Unique at delivery level (one email message opened). |
| | Unique Open Contacts | `EmailDeliveryModel` | `COUNT(DISTINCT contactId)` where `openCount > 0` | Unique at prospect contact level. |
| | Observed Clicks | `EmailEventModel` / `EmailDeliveryModel` | `SUM(clickCount)` or `COUNT(events)` with `type = 'CLICKED'` | May include security scanner automated clicks. |
| | Unique Click Deliveries| `EmailDeliveryModel` | `COUNT(id)` where `clickCount > 0` | Unique link click per message. |
| | Unique Click Contacts | `EmailDeliveryModel` | `COUNT(DISTINCT contactId)` where `clickCount > 0` | Unique prospect contact who clicked. |
| **Response & Feedback**| Replies Received | `EmailDeliveryModel` (direction=INBOUND) & `EmailEventModel` | `COUNT(id)` where `direction = 'INBOUND'` and `campaignId = :id` | Raw count of incoming messages. |
| | Replying Contacts | `EmailDeliveryModel` | `COUNT(DISTINCT contactId)` where `hasReply = true` | True prospect response count. |
| | Hard Bounces | `EmailDeliveryModel` / `EmailEventModel` | `status = 'FAILED'` and `failureCategory IN ('INVALID_RECIPIENT', 'MAILBOX_UNAVAILABLE', 'DOMAIN_NOT_FOUND')` | Definitive recipient failure. |
| | Soft / Transient Bounces | `EmailDeliveryModel` | `status = 'FAILED'` and `failureCategory IN ('RATE_LIMIT', 'NETWORK', 'PROVIDER')` | Temporary server issues or rate limits. |
| **Sequence Outcomes** | Stopped by Reply | `SequenceExecutionModel` / `sequence_executions` | `status IN ('replied', 'completed')` with log indicating stop on reply | Measures sequence effectiveness in terminating redundant follow-ups. |
| | Sequences Completed | `SequenceExecutionModel` | `status = 'completed'` without reply stop | Contact ran through all sequence steps without replying. |
| | Sequences Cancelled | `SequenceExecutionModel` | `status IN ('cancelled', 'stopped')` | Manually aborted or campaign stopped. |

---

## 5. Critical Vulnerabilities & Analytical Gotchas Identified

### A. Denominator Ambiguity (The "Silent Inflation" Problem)
A pervasive defect in cold outreach tooling is reporting vanity percentages without disclosing denominators.
- **Flawed Example**: Reporting "Reply Rate = 15%" by calculating `replies / sent emails` when a 4-step sequence sent 400 emails to 100 contacts and received 15 replies.
  - In reality, $15 / 100 = 15\%$ contact reply rate, but $15 / 400 = 3.75\%$ message reply rate!
- **Mandatory Phase 11 Rule**:
  Every rate must explicitly declare and display its numerator, denominator, and formula:
  - **Contact Reply Rate**: $\frac{\text{Replying Contacts}}{\text{Eligible Contacts Enrolled}}$
  - **Message Reply Rate**: $\frac{\text{Replies Received}}{\text{Provider Accepted Emails}}$
  - **Unique Open Rate**: $\frac{\text{Unique Opened Deliveries}}{\text{Provider Accepted Emails}}$
  - **Unique Click-Through Rate (CTR)**: $\frac{\text{Unique Clicked Deliveries}}{\text{Provider Accepted Emails}}$
  - **Click-to-Open Rate (CTOR)**: $\frac{\text{Unique Clicked Deliveries}}{\text{Unique Opened Deliveries}}$
  - **Hard Bounce Rate**: $\frac{\text{Hard Bounces}}{\text{Emails Attempted}}$

### B. Retry Inflation Risk
- In `EmailDeliveryModel`, retries update `attempt` and `retryCount` in-place using the unique `idempotencyKey`.
- If an analytics query counts raw rows grouping by status without respecting `direction = 'OUTBOUND'` and `idempotencyKey`, retried or ambiguous deliveries could be double-counted.
- **Audit Verification**: Queries must aggregate on distinct delivery IDs and treat `attempt` as metadata rather than creating phantom volume.

### C. Provider Acceptance vs True Delivery (The "Sent" Fallacy)
- When Gmail API returns HTTP 200, it confirms Google accepted the message for delivery. It does NOT confirm that the recipient's mail server accepted it or that it avoided the spam folder.
- **UI Language Invariant**: The UI must display `Provider Accepted` or `Dispatched`, NEVER "Delivered to Recipient". Delivery is an inference supported only by subsequent opens, clicks, replies, or the absence of a DSN bounce within 48 hours.

### D. Automated Bot / Security Scanner Distortions
- Apple Mail Privacy Protection (MPP), Google Image Proxy, and anti-spam link scanners (Proofpoint, Mimecast, Barracuda) trigger tracking pixels and link redirects automatically within seconds of delivery.
- `TrackingService` in `apps/api` already captures `metadata.isPrefetch`.
- **Audit Requirement**: The analytics engine must label open metrics as `Observed Opens`. Furthermore, if `isPrefetch = true`, the event must be segregated so operators can view both raw observed opens and scanner-filtered opens.

### E. Multi-Touch and Attribution Ambiguity
- When a prospect receives:
  - Day 1: Campaign A, Step 1
  - Day 3: Campaign B, Step 1
  - Day 5: Campaign A, Step 2
  - Day 6: Prospect replies with "Interested, let's talk"
- If the email client preserved thread headers (`In-Reply-To` / `References`), `ReconciliationService` correlates directly to Campaign A, Step 2 (Direct Attribution, confidence = `'thread'`).
- If headers were stripped and correlation fell back to contact email matching (`matchConfidence = 'contact'`), attributing the reply solely to Campaign B or Campaign A is an inference.
- **Audit Requirement**: The analytics API must return the attribution confidence level (`thread`, `header`, `contact`) so the UI does not misrepresent circumstantial matches as ironclad sequence attribution.

### F. Timezone Discrepancies in Time-Series Aggregations
- MongoDB stores all dates as UTC. SQLite stores UTC ISO strings.
- If a daily send/reply chart uses UTC day boundaries (`$dateToString: { format: "%Y-%m-%d", date: "$sentAt" }`), a message sent at 8:00 PM EST (01:00 UTC next day) will appear on tomorrow's bar!
- **Audit Requirement**: Every timeline aggregation endpoint must accept a `timezone` query parameter (e.g. `America/New_York`, `Asia/Kolkata`, or campaign-configured timezone) and pass it to MongoDB's `$dateToString: { timezone: ... }` / SQLite offset modifiers.

### G. Soft-Deleted / Archived Campaigns & Contacts
- When a campaign or contact is deleted or archived, `deletedAt` is populated.
- Historical deliveries and events in `EmailDeliveryModel` and `EmailEventModel` remain permanent.
- **Audit Requirement**: Campaign performance metrics must query deliveries by `campaignId` regardless of whether the contact record was subsequently updated or archived. The delivery ledger is immutable historical evidence.

---

## 6. Architecture & Deliverable Map for Phase 11

Based on this audit, Phase 11 will deliver:
1. **Canonical Analytics Schema & Metric Dictionary** (`@leadforge/schema`):
   - Zod schemas for campaign overview, funnel, sequence steps, time series, mailbox performance, quality distribution, and comparisons.
2. **Authoritative Analytics Service & MongoDB Aggregations** (`apps/api`):
   - High-performance, indexed aggregation pipelines computing metrics on-the-fly without stale denormalized columns.
   - REST endpoints under `/api/v1/analytics/campaigns/...`.
3. **SDK Module** (`@leadforge/sdk`):
   - Type-safe client methods under `sdk.analytics.campaigns`.
4. **Desktop SQLite Aggregation & IPC Bridge** (`apps/desktop`):
   - Local analytical queries for offline cache support and real-time desktop UI responsiveness.
5. **Campaign Performance Intelligence UI** (`CampaignsScreen.tsx`):
   - Interactive Funnel with drop-off diagnostics.
   - Sequence Step Conversion Table.
   - Timezone-aware Time-Series Charts (Recharts).
   - Mailbox Health & Sender Comparison.
   - Explainability tooltips exposing formulas and denominators.
   - Controlled CSV / JSON Export.
6. **Adversarial Integrity Test Suite**:
   - Tests validating zero retry inflation, duplicate event deduplication, multiple-reply contact collapsing, and timezone bucket accuracy.

---

## 7. Audit Sign-Off

The data layer is verified, all Phase 10 invariants are intact, and the metric sources of truth are established. Proceeding to create the implementation plan.
