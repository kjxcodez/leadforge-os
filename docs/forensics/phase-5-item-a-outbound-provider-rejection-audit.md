# LeadForge OS — Phase 5 Forensic Audit Report
## Item A: Forensic Audit of Blocked and Provider-Rejected Outbound Emails

- **Issue Reference**: [#24](https://github.com/kjxcodez/leadforge-os/issues/24)
- **Investigation Date**: 2026-09-09
- **Classification**: Forensic Engineering Audit (Phase 5 — Item A)
- **Severity**: **CRITICAL (P0)** — Sender Reputation Destruction & Broken Error Governance
- **Audit Branch**: `audit/outbound-provider-rejections`

---

## 1. Executive Summary

During cold email outreach in LeadForge OS, operators experience outbound emails being blocked or rejected by receiving mail servers, anti-spam gateways (e.g., Proofpoint, Mimecast, Microsoft Defender), and Google Workspace / Gmail API infrastructure.

This audit conducted a deep forensic investigation of the complete outbound delivery path, runtime error handling, bounce classification, retry mechanics, and campaign lifecycle governance across the codebase.

### Key Audit Findings:
1. **Misclassification of Permanent Spam/Policy Blocks as Transient Network Errors**:
   When receiving mail servers reject an outbound email with `SMTP 554 5.7.1` (Spamhaus blocklist, content filter, anti-spam policy block), LeadForge's `classifyEmailFailure()` in `apps/api/src/services/email/email.service.ts` fails to match any specific branch and defaults to `EmailFailureCategory.PROVIDER`. `EmailService.send()` then casts this directly to `failureCat = 'NETWORK'`. Consequently, critical reputation blocks are recorded against sender mailbox health as transient network glitches rather than fatal reputation blocks.
2. **False-Positive Hard Bounce Suppression on Google API HTTP 400**:
   In `apps/api/src/services/google/gmail.provider.ts`, any HTTP 400 Bad Request (such as a malformed MIME body, invalid header, or character set violation) is hardcoded as `INVALID_RECIPIENT`. When propagated to `EmailService.send()`, LeadForge permanently suppresses the recipient address (`SuppressionReason.HARD_BOUNCE`) and permanently corrupts the contact record to `status: BOUNCED, emailStatus: INVALID`, even though the recipient email address itself is completely valid.
3. **Misdiagnosis of Google API HTTP 403 as Token Revocation**:
   In `gmail.provider.ts`, all HTTP 401 and 403 status codes are hardcoded to `MAILBOX_REAUTH_REQUIRED`. When Google throttles a mailbox due to daily sending quota exhaustion (500/day for standard Gmail, 2,000/day for Workspace) or suspends sending due to bulk sender abuse guidelines, LeadForge misdiagnoses the issue as an expired OAuth token, flags the mailbox as `reauth_required`, and repeatedly schedules 5-minute retry loops.
4. **Silent Failure of Rate Limit Cooldown**:
   When Google returns HTTP 429 or `RESOURCE_EXHAUSTED`, `GmailProvider` throws `new EmailDomainError('SENDER_RATE_LIMITED', ..., 'rate_limit')`. However, `EmailService.send()` checks `if (err.code === 'PROVIDER_RATE_LIMITED' || err.classification === 'provider_rate_limited')`. Because the string tokens do not match, `setProviderCooldown()` is never called, and the mailbox is never placed into cooldown.
5. **Reconciliation DSN Overwrite**:
   When Google delivers an asynchronous Delivery Status Notification (DSN) from `mailer-daemon@googlemail.com` for a spam block (`554 5.7.1`) or SPF/DKIM policy rejection (`550 5.7.26`), `parseDsnReport()` correctly categorizes it as `SPAM_REJECTION` or `POLICY_REJECTION`. However, `ReconciliationService.pollInbound()` in `apps/api/src/services/email/reconciliation.service.ts` line 707 explicitly overwrites `failureCategory` with `EmailFailureCategory.INVALID_RECIPIENT`, corrupting delivery analytics.
6. **Zero Campaign-Level Circuit Breakers**:
   Neither the automation workflow worker (`automation.ts`) nor the outreach batch worker (`outreach.ts`) possesses a campaign-level circuit breaker. If a mailbox is blocked or recipient mail servers reject sends, the worker simply fails individual executions and continues firing hundreds of subsequent messages to other contacts from the same compromised mailbox.
7. **Zero Domain-Level Throttling / Company Cardinality**:
   When an audience contains dozens of contacts at the same company (e.g., 64 contacts at `@targetcompany.com`), LeadForge dispatches them in rapid succession without domain-level pacing or cardinality limits, triggering recipient-side spam burst heuristics (`554 5.7.1`).
8. **Violation of Ambiguous Send Invariant**:
   `VALID_DELIVERY_TRANSITIONS` in `apps/api/src/repositories/email-delivery/email-delivery.repository.ts` allows transitions from `AMBIGUOUS -> SENDING` and `FAILED -> SENDING`. This permits `reserveDelivery()` to reclaim an ambiguous delivery and re-dispatch an outbound message without verifying provider-side acceptance, violating the project invariant: *"Never blindly resend when provider acceptance is uncertain."*

---

## 2. Outbound Delivery Trace

The outbound email pipeline flows through the following layers:

```text
Campaign (`CampaignModel` / UI)
  ↓
Sequence Execution (`SequenceExecutionModel` in SQLite / MongoDB)
  ↓
Automation Plugin Worker (`apps/desktop/src/main/workers/plugins/automation.ts`)
  ↓ [handleSendEmailStep()]
SdkClient (`sdk.outreach.sendEmail`)
  ↓ [POST /email/send]
API Router (`apps/api/src/routes/email/index.ts`)
  ↓
EmailService (`apps/api/src/services/email/email.service.ts`)
  ↓ [Eligibility check, suppression check, reservation lease]
EmailDeliveryRepository.reserveDelivery (`apps/api/src/repositories/email-delivery/email-delivery.repository.ts`)
  ↓ [Atomically transitions delivery record to SENDING]
EmailAccountService.buildProvider (`apps/api/src/services/email/email-account.service.ts`)
  ↓ [Zero Outbound SMTP Invariant: direct SMTP is disabled; returns GmailProvider]
GmailProvider.sendMessage (`apps/api/src/services/google/gmail.provider.ts`)
  ↓ [MimeBuilder.buildRaw() -> RFC 2822 base64url payload]
Google Gmail REST API (`POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send`)
  ↓
  ├── Path A: Synchronous API Error (HTTP 400, 401, 403, 429, 500)
  │     ↓
  │   Caught in EmailService.send() -> classifyEmailFailure() -> failDelivery()
  │
  └── Path B: Synchronous Provider Acceptance (HTTP 200 { id, threadId })
        ↓
      Delivery record finalized to status: 'SENT'
        ↓
      Google Outbound MTA (SMTP transmission across Internet)
        ↓
      Recipient MX / Gateway (Proofpoint, Microsoft 365, Mimecast, Google MX)
        ↓
        ├── Path B1: Recipient Accepts -> Delivered to recipient inbox
        │
        └── Path B2: Recipient Rejects (SMTP 550 User Unknown / 554 Spam Block / 5.7.1)
              ↓
            Recipient sends SMTP 5xx to Google MTA
              ↓
            Google MTA synthesizes asynchronous DSN from mailer-daemon@googlemail.com
              ↓
            DSN lands in sender Gmail inbox
              ↓
            ReconciliationService.pollInbound() discovers DSN
              ↓
            parseDsnReport() extracts bounce details
              ↓
            Delivery record updated to status: 'FAILED' (line 707)
```

---

## 3. Failure Classification

The following table summarizes all observed outbound failure modes, their architectural owner, classification, retryability, and how LeadForge currently handles them:

| Failure Mode | Raw Evidence / Error Code | Failure Owner | Canonical Classification | Retryable? | Current LeadForge State | LeadForge Defect / Anomaly |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Recipient Unknown** | SMTP `550 5.1.1 User unknown` / `Address not found` | RECIPIENT MX | `INVALID_RECIPIENT` (Hard Bounce) | No | `status: FAILED`, `failureCategory: INVALID_RECIPIENT` | Correctly identified; suppresses contact address. |
| **Recipient Domain Non-Existent** | SMTP `550 5.1.2 Host or domain name not found` | RECIPIENT DNS / MX | `DOMAIN_UNAVAILABLE` (Hard Bounce) | No | `status: FAILED`, `failureCategory: PROVIDER` | Misclassified as `PROVIDER` and `NETWORK` transient error; contact not suppressed. |
| **Recipient Spam / Gateway Block** | SMTP `554 5.7.1 Client host blocked using Spamhaus` | RECIPIENT SECURITY GATEWAY | `POLICY` / `SPAM_REJECTION` | No | `status: FAILED`, `failureCategory: PROVIDER` (mapped to `NETWORK`) | **Severe**: Misclassified as transient network failure; mailbox treated as healthy; campaign continues sending. |
| **Recipient Authentication Block** | SMTP `550 5.7.26 Message rejected due to SPF/DKIM/DMARC` | RECIPIENT MX / SECURITY GATEWAY | `POLICY` (Authentication Policy) | No | `status: FAILED`, `failureCategory: INVALID_RECIPIENT` | Misclassified as invalid recipient address due to `550` substring match; falsely suppresses valid recipient! |
| **Recipient Mailbox Full** | SMTP `452 4.2.2 Mailbox full / over quota` | RECIPIENT MX | `SOFT_BOUNCE` (Storage Exceeded) | Yes | `status: FAILED`, `failureCategory: PROVIDER` (mapped to `NETWORK`) | Unclassified; recorded as generic provider error. |
| **Google Daily Quota Exceeded** | HTTP `403` `Daily sending quota exceeded` | GOOGLE / SENDER PROVIDER | `RATE_LIMIT` / `QUOTA_EXHAUSTED` | Yes (after reset) | `status: FAILED`, `failureCategory: AUTH` | **Severe**: Misdiagnosed as expired OAuth token (`MAILBOX_REAUTH_REQUIRED`); forces unnecessary re-auth loop. |
| **Google Bulk Sender Block** | HTTP `403` `Bulk sender guidelines violation / suspicious activity` | GOOGLE / SENDER PROVIDER | `POLICY` / `SENDER_ABUSE_BLOCK` | No | `status: FAILED`, `failureCategory: AUTH` | Misdiagnosed as OAuth token expiry; mailbox status set to `reauth_required`. |
| **Google Rate Limit / Quota** | HTTP `429` / `RESOURCE_EXHAUSTED` | GOOGLE / SENDER PROVIDER | `RATE_LIMIT` | Yes | `status: RETRYING`, `failureCategory: RATE_LIMIT` | **Defect**: `err.code` (`SENDER_RATE_LIMITED`) does not match expected `PROVIDER_RATE_LIMITED`; `setProviderCooldown()` skipped! |
| **Google Malformed Payload** | HTTP `400` `Invalid argument / RFC 2822 violation` | LEADFORGE-SIDE FAILURE | `INTERNAL` / `MALFORMED_PAYLOAD` | No | `status: FAILED`, `failureCategory: INVALID_RECIPIENT` | **Severe Data Corruption**: HTTP 400 is mapped to `INVALID_RECIPIENT`, permanently suppressing valid leads as HARD_BOUNCE. |
| **Network Timeout During Send** | Socket `ETIMEDOUT` / network disconnect on `messages.send` | LEADFORGE / NETWORK | `AMBIGUOUS` | No (requires reconciliation) | `status: AMBIGUOUS` | Delivery marked AMBIGUOUS, but `VALID_DELIVERY_TRANSITIONS` allows immediate resend. |
| **Asynchronous DSN Bounce** | Inbound email from `mailer-daemon@googlemail.com` | RECIPIENT MX via GOOGLE DSN | Depends on DSN body (e.g. `554` spam vs `550` user) | Depends on DSN code | `status: FAILED`, `failureCategory: INVALID_RECIPIENT` | **Defect**: Line 707 in `reconciliation.service.ts` hardcodes `INVALID_RECIPIENT`, ignoring `parseDsnReport()` result. |

---

## 4. Google vs Recipient vs LeadForge

When operators report that outbound emails are "blocked", who is actually blocking them?

### Architectural Proof & Breakdown:

1. **Google REST API Acceptance vs Rejection**:
   - **Google does NOT perform synchronous recipient verification at API submit time**: The Gmail REST API (`users.me.messages.send`) accepts messages asynchronously with HTTP 200 `{ id, threadId }` as long as the sending mailbox is authorized, within sending quotas, and the MIME formatting is valid.
   - **When Google rejects immediately (HTTP 4xx)**:
     - If Google returns **HTTP 403**, the failure owner is **GOOGLE / SENDER PROVIDER** (exceeded daily sending limit of 500/2,000, or triggered Google's automated bulk sender heuristics).
     - If Google returns **HTTP 429**, the failure owner is **GOOGLE / SENDER PROVIDER** (API requests/sec quota).
     - If Google returns **HTTP 400**, the failure owner is **LEADFORGE-SIDE FAILURE** (bad MIME encoding, header syntax, or oversized payload).
2. **Recipient Mail Server / Gateway Rejection (Post-Acceptance)**:
   - When Google returns HTTP 200, Google has *accepted* the message for outbound transport. Google's MTA then connects via SMTP to the recipient's MX host.
   - If the recipient server rejects the email (e.g. `550 5.1.1` User Unknown or `554 5.7.1` Spamhaus Blocklist), the rejection owner is **RECIPIENT MAIL SERVER** or **RECIPIENT SECURITY GATEWAY**.
   - Google's MTA receives this SMTP rejection and generates a DSN email from `mailer-daemon@googlemail.com` back to the sender's mailbox.
   - **Critical Distinction**: The presence of a Gmail-generated DSN in the sender's mailbox does **NOT** mean Google blocked the message. It proves that Google accepted the message and the recipient's mail infrastructure rejected it later.
3. **The Multi-Contact Cascade**:
   - When a campaign sends to 64 contacts at the same company, the recipient gateway detects the burst and issues an SMTP `554 5.7.1` spam block.
   - Because LeadForge fails to pause the campaign, it continues sending the remaining 50+ messages to that company.
   - All 50+ messages bounce back to Google.
   - Google's outbound anti-abuse systems observe the massive bounce rate on the sender account and subsequently issue a **Google HTTP 403 quota/abuse block** on the sender's mailbox!

---

## 5. Error Handling

### 5.1 The `classifyEmailFailure()` Engine
**File:** [apps/api/src/services/email/email.service.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/services/email/email.service.ts#L37-L147)

```typescript
export function classifyEmailFailure(err: any): {
  code: string;
  category: EmailFailureCategory;
  safeHumanMessage: string;
  technicalMessage: string;
  retryable: boolean;
  ambiguous: boolean;
}
```

Inspection reveals the following structural defects:
- **Missing `classifyBounce` Integration**: The schema package provides a mature, RFC-compliant parser in `packages/schema/src/utils/bounce-classifier.ts`. However, `classifyEmailFailure()` was written as an ad-hoc regex/string match and does not use `classifyBounce()`.
- **Fallthrough to Generic PROVIDER**: Any error containing `554`, `spam`, `blocklist`, `reputation`, or `relay denied` falls through to line 48:
  ```typescript
  let category = EmailFailureCategory.PROVIDER;
  ```
- **Fallback to NETWORK in `EmailService.send()`**:
  Lines 726–730:
  ```typescript
  let failureCat: 'AUTH' | 'RATE_LIMIT' | 'NETWORK' | 'INVALID_RECIPIENT' | 'AMBIGUOUS' = 'NETWORK';
  if (failure.category === EmailFailureCategory.AUTH) failureCat = 'AUTH';
  else if (failure.category === EmailFailureCategory.RATE_LIMIT) failureCat = 'RATE_LIMIT';
  else if (failure.category === EmailFailureCategory.AMBIGUOUS) failureCat = 'AMBIGUOUS';
  ```
  `EmailFailureCategory.PROVIDER` is mapped to `'NETWORK'`, which treats hard spam and gateway rejections as transient connection errors.

### 5.2 Dangerous Error Behaviors Identified:
1. **Permanent spam block treated as temporary network error**: Mailbox health allows up to 5 consecutive network errors before degrading, allowing repeated toxic sends.
2. **Malformed request treated as hard bounce**: Valid contacts are permanently suppressed due to MIME formatting errors.
3. **Daily quota block treated as revoked OAuth token**: Users are told their Google account disconnected when they simply hit their sending limit.

---

## 6. Retry Safety

### 6.1 Ownership of Retry Decisions
Retry logic is split between three distinct layers with no unified coordinator:
1. **`EmailDeliveryRepository.failDelivery()`**: Calculates `isRetryable = options.retryable && retryCount < 3`. If true, sets `status = 'RETRYING'` and `nextRetryAt`. However, **no background processor in the API polls or retries these deliveries**.
2. **`automation.ts` (Sequence Execution Worker)**:
   - For rate limits: Sleeps inline up to 5 seconds and retries once. If that fails, yields `{ status: 'wait', delaySeconds: 15, retrySameStep: true }`.
   - For auth errors: Yields `{ status: 'wait', delaySeconds: 300, retrySameStep: true }`.
   - For all other errors (including provider policy blocks): Throws an unhandled exception, setting execution status to `FAILED`.
3. **`outreach.ts` (Bulk Campaign Worker)**:
   - For rate limits: Sleeps inline `retryAfterSec` and retries once.
   - For other errors: Increments `failureCount++` and **immediately proceeds to the next contact in the loop**.

### 6.2 Invariant Violation: Ambiguous Send Re-dispatch
The established project safety invariant states:
> *Never blindly resend when provider acceptance is uncertain.*

**File:** [apps/api/src/repositories/email-delivery/email-delivery.repository.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/repositories/email-delivery/email-delivery.repository.ts#L7-L17)

```typescript
export const VALID_DELIVERY_TRANSITIONS: Record<EmailDeliveryStatus, EmailDeliveryStatus[]> = {
  ...
  AMBIGUOUS: ['SENT', 'FAILED', 'RETRYING', 'CANCELLED', 'SENDING'],
  FAILED: ['SENDING', 'RETRYING'],
  ...
};
```

In `reserveDelivery()` (lines 54–85):
If a previous attempt ended in `AMBIGUOUS` (e.g. network timeout while calling Google API), `reserveDelivery()` allows the transition `AMBIGUOUS -> SENDING`. If the worker retries, `EmailService.send()` calls `provider.send()` again with a new payload, causing **duplicate outbound emails** if Google had actually accepted the first request.

---

## 7. Campaign Impact

### Trace: Email Failure -> Campaign Health
We traced the impact of repeated delivery failures up the operational hierarchy:

```text
Email Failure (e.g. 554 Spam Block)
  ↓
Delivery Record (status: 'FAILED', failureCat: 'NETWORK')
  ↓
EmailAccountModel (health.consecutiveFailures increments)
  ↓
Execution State (execution.status = 'FAILED')
  ↓
Campaign State (campaign.status = 'ACTIVE' [UNTOUCHED])
  ↓
Future Sends (Worker continues dispatching to remaining contacts!)
```

### Observed Vulnerabilities:
1. **No Campaign Pause Circuit Breaker**: Neither single failures nor repeated systemic failures cause a campaign to pause. If an entire domain or mailbox is blocked, `outreach.ts` continues running through all contacts in the campaign audience.
2. **Absence of Domain-Level Health State**: If 5 consecutive contacts at `@targetcorp.com` bounce or are blocked, LeadForge has no mechanism to pause outreach to `@targetcorp.com`. It will attempt to send to all remaining contacts at that company.
3. **Mailbox Degradation Isolation**: Even if `EmailAccountRepository` eventually marks a mailbox as `BLOCKED` after 5 consecutive failures, campaigns referencing that mailbox do not transition to `PAUSED`. Instead, sequence executions fail or enter 300-second wait loops, filling logs with error spam.

---

## 8. Production Evidence

### Real Evidence from Repository and Test Suites:
1. **Confirmed Code Artifacts**:
   - `apps/api/src/services/email/email.service.ts` line 726 defaults `failureCat = 'NETWORK'`.
   - `apps/api/src/services/google/gmail.provider.ts` lines 139–157 maps HTTP 403 to `MAILBOX_REAUTH_REQUIRED`.
   - `apps/api/src/services/google/gmail.provider.ts` line 169 maps HTTP 400 to `INVALID_RECIPIENT`.
   - `apps/api/src/services/google/gmail.provider.ts` line 161 throws `SENDER_RATE_LIMITED`, which fails to match `PROVIDER_RATE_LIMITED` in `email.service.ts` line 751.
   - `apps/api/src/services/email/reconciliation.service.ts` line 707 hardcodes `failureCategory: EmailFailureCategory.INVALID_RECIPIENT`.
   - `apps/api/src/repositories/email-delivery/email-delivery.repository.ts` lines 11–12 permits `AMBIGUOUS -> SENDING` and `FAILED -> SENDING`.
2. **Zero Outbound SMTP Paths**:
   Verification scripts (`scripts/verify-phase9.ts`, `verify-phase14.ts`, `verify-architecture-invariants.ts`) enforce `INV-3: Zero Outbound SMTP & Nodemailer Dependency Removal`. This proves all outbound traffic is routed exclusively through Google Gmail REST API.
3. **Reproduction Test Suite**:
   Executed `apps/api/src/services/email/outbound-provider-rejection-audit.test.ts` (8 passing tests), confirming all 4 major defect categories in runtime isolation.

---

## 9. Test Coverage Gaps

Why did existing test suites fail to catch these defects?

1. **Zero Unit Tests for `classifyEmailFailure()`**: Prior to this audit, `classifyEmailFailure()` had zero unit tests verifying its error classification logic.
2. **Mocking Around Error Paths in `GmailProvider`**: Existing tests for `GmailProvider` focused solely on inbound message listing (`inbound-relevance.test.ts`), mocking the happy path and never exercising HTTP 400, 403, 429, or 500 error responses from the Google API.
3. **Disconnect Between Schema and API**: `packages/schema/src/utils/bounce-classifier.test.ts` comprehensively tests `classifyBounce()`, but `apps/api` never utilized that utility for outbound error classification.
4. **DSN Tests Limited to 5.1.1 Hard Bounces**: Existing reconciliation tests only validated standard user-unknown bounces (`5.1.1`), completely omitting spam blocks (`554 5.7.1`), policy blocks (`550 5.7.26`), and soft bounces (`452`).
5. **No End-to-End Campaign Circuit Breaker Tests**: No test in the repository existed to verify whether a campaign pauses when consecutive provider or recipient rejections occur.

---

## 10. Root Causes

### Confirmed Root Causes:
1. **CONFIRMED**: `classifyEmailFailure()` in `email.service.ts` lacks branches for SMTP 554, spam filters, reputation blocks, and policy rejections, causing them to fall through to `EmailFailureCategory.PROVIDER` and be recorded as `NETWORK` errors.
2. **CONFIRMED**: `GmailProvider.sendMessage()` in `gmail.provider.ts` lacks nuanced error parsing:
   - HTTP 400 is falsely mapped to `INVALID_RECIPIENT`, triggering false-positive recipient suppression.
   - HTTP 403 is falsely mapped to `MAILBOX_REAUTH_REQUIRED`, misdiagnosing quota and spam blocks as credential revocation.
3. **CONFIRMED**: Token naming divergence between `SENDER_RATE_LIMITED` (thrown by `GmailProvider`) and `PROVIDER_RATE_LIMITED` (expected by `EmailService`), disabling automated provider cooldown on HTTP 429.
4. **CONFIRMED**: Line 707 in `reconciliation.service.ts` hardcodes `failureCategory: EmailFailureCategory.INVALID_RECIPIENT` on DSN ingestion, discarding the parsed DSN classification.
5. **CONFIRMED**: Neither `automation.ts` nor `outreach.ts` contains a campaign-level circuit breaker or pause trigger on consecutive provider or domain rejections.
6. **CONFIRMED**: Zero domain-level rate limiting or cardinality controls exist in the send pipeline, allowing rapid multi-contact bursts to single corporate domains.

### Hypotheses:
1. **HYPOTHESIS**: Operators reporting "Google blocked our emails" were encountering Google's automated daily sending quota (500/day) or anti-abuse throttling after rapid bursts triggered high bounce rates, which LeadForge surfaced as a "Re-authentication required" prompt.

---

## 11. Severity Assessment

- **Highest Severity**: **CRITICAL (P0)**
- **Rationale**:
  - **Reputation Damage**: Blasting emails after recipient spam blocks destroys sender domain reputation and IP deliverability.
  - **False-Positive Lead Suppression**: Valid leads are permanently suppressed and marked `BOUNCED` when Google returns HTTP 400.
  - **Broken Operator Experience**: Quota limits are reported as broken OAuth credentials.
  - **Duplicate Send Risk**: Ambiguous send records can be reclaimed and resent without provider verification.

---

## 12. Recommended Remediation Boundary (Phase 6)

The following changes are recommended for implementation in **Phase 6** (do NOT implement now):

1. **Unified Error Classification**:
   - Refactor `classifyEmailFailure()` to delegate to the canonical `classifyBounce()` in `@leadforge/schema`.
   - Add explicit categories: `BounceCategory.SPAM_REJECTION`, `BounceCategory.POLICY_REJECTION`, `BounceCategory.RATE_LIMIT`, `BounceCategory.DOMAIN_UNAVAILABLE`.
2. **Google REST API Error Normalization**:
   - In `gmail.provider.ts`, parse the Google API error `message` and `status`:
     - Distinguish between true auth revocation (`UNAUTHENTICATED`, `invalid_grant`) and quota/rate blocks (`RESOURCE_EXHAUSTED`, `Daily sending quota exceeded`).
     - Map HTTP 400 to a non-suppressing internal error (e.g. `INVALID_PAYLOAD`).
   - Align rate limit error tokens (`PROVIDER_RATE_LIMITED`).
3. **Reconciliation DSN Preservation**:
   - In `reconciliation.service.ts`, preserve `dsnReport.classification.category` instead of hardcoding `INVALID_RECIPIENT`.
4. **Campaign & Mailbox Circuit Breakers**:
   - Implement an automated campaign pause circuit breaker: if a campaign encounters $N$ consecutive provider rejections (e.g. 3 spam blocks or quota limits), automatically transition the campaign to `PAUSED` and notify the operator.
5. **Domain Pacing & Company Cardinality**:
   - Implement domain-level rate limiting (e.g. maximum 1 email per domain every 60 seconds) to prevent triggering corporate anti-spam gateway burst heuristics.
6. **Ambiguous Delivery Invariant Enforcement**:
   - Remove `AMBIGUOUS -> SENDING` from `VALID_DELIVERY_TRANSITIONS` or require an explicit reconciliation check before re-dispatch.
