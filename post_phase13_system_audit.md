# LeadForge OS: Post-Phase 13 System-Wide Forensic Audit

## Executive Summary

This forensic audit represents an exhaustive, evidence-driven investigation of LeadForge OS following Phase 13. Every invariant, data flow, background worker, IPC channel, and state transition was evaluated directly against current source code, schemas, and live test executions.

**Authoritative Production Verdict: NOT READY**

While deterministic outreach foundations (Phase 9-13: delivery ledger, rate-limiting, sent-folder reconciliation, tracking, and metrics aggregation) have established high-integrity database models and contract tests, **severe architectural disconnects and runtime bugs exist in the production execution path**. Specifically:
1. **The Infinite Delay Stall Bug**: Any sequence step yielding a delay updates MongoDB but omits updating local SQLite cache. The scheduler only polls SQLite; therefore, multi-step campaigns stall permanently.
2. **SQLite Date Collation Failure**: ISO-8601 string formatting in SQLite comparisons prevents same-day delays from ever triggering.
3. **Template Versioning Disconnect**: The versioning API created in Phase 13 was never exposed to API routes or SDK. Automation workers still fetch mutable templates, altering emails for enrolled contacts mid-campaign.
4. **Fast Reply Race Condition**: Inbound replies arriving during message sending fail all matching criteria and drop into permanent `UNMATCHED` status with idempotency locks, causing sequences to continue emailing contacts who replied.
5. **UI Pause Bypass**: The desktop UI "Pause Campaign" button bypasses execution cancellation, leaving background workers running and dispatching emails.

---

## 1. System Architecture Audit

### Authoritative Systems vs. Projections
- **Authoritative System of Record**: MongoDB (via Fastify/Hono API and Mongoose ODM). All durable records (`campaigns`, `sequence_executions`, `email_deliveries`, `email_events`, `email_accounts`, `email_templates`, `suppressions`) reside authoritatively in MongoDB.
- **Read-Accelerating Projection**: SQLite (`better-sqlite3`, located per workspace in `apps/desktop/src/main/database/`). Designed as a disposable, high-speed read cache.
- **Renderer Cache**: React Query in Electron Renderer (`apps/desktop/src/renderer`).

### Architectural Contradictions & IPC Boundaries
- **Workers vs. Desktop Main Process**: Background workers (`apps/desktop/src/main/workers/`) run in separate processes. They communicate with the API exclusively via `@leadforge/sdk` HTTP calls. They **never** write directly to SQLite.
- **Projection Asymmetry**: The main process (`ProjectionService.ts`) is supposed to reconcile worker outcomes into SQLite upon job completion. However, in intermediate states (such as when an execution pauses or enters `WAITING`), workers update MongoDB directly via SDK, but no projection event updates SQLite. This breaks read-cache consistency for the scheduler.
- **Circular Dependencies**: `apps/desktop` contains circular imports across 8 worker plugins and `worker-host.ts`, as well as `scheduler.ts` <-> `projection-service.ts` <-> `logger.ts`.

---

## 2. Campaigns Lifecycle Audit

Lifecycle Traced: `create -> configure -> audience -> enroll -> schedule -> execute -> pause -> resume -> stop -> complete -> fail`.

- **State Transitions**:
  - Enforced in `apps/api/src/services/campaign/campaign.service.ts:54-66` via `isValidCampaignTransition()`.
  - Allowed: `DRAFT -> ACTIVE/STOPPED`, `ACTIVE -> PAUSED/STOPPED/COMPLETED`, `PAUSED -> ACTIVE/STOPPED`. `STOPPED` and `COMPLETED` are terminal.
- **Critical Contradictions Found**:
  - **Desktop UI Pause Disconnect** (`CampaignsScreen.tsx:1097`): Clicking "Pause Campaign" invokes `campaigns:update` in `apps/desktop/src/main/ipc/crm.ts:395`, passing `{ status: 'PAUSED' }`. It does **not** call `campaigns:pause` (`campaigns-ipc.ts:451`).
  - As a result, neither in-flight jobs in MongoDB nor active sequence executions in SQLite/MongoDB are paused. Workers keep executing the campaign steps.
  - **Resume IPC Missing** (`campaigns-ipc.ts`): There is no `campaigns:resume` IPC channel. Resuming from the UI updates the campaign status to `ACTIVE`, but never unpauses or reschedules paused sequence executions.
  - **Campaign Completion Trigger**: Evaluated in `ProjectionService.ts:213-225`. Checks if all executions are in `['completed', 'failed', 'replied']`. If so, marks campaign `COMPLETED`. However, if any execution is orphaned in `RUNNING` or stuck in `WAITING`, the campaign never reaches completion.

---

## 3. Sequences / Workflow Engine Audit

### Package vs. Worker Reality
- The monorepo defines a published package `@leadforge/workflow-engine` (`packages/workflow-engine/`).
- **Audit Reality**: `@leadforge/workflow-engine` is **completely unused** by outreach campaigns. It is only imported by the AI prototype `@leadforge/agent-runtime`.
- Outreach campaigns are executed entirely by an ad-hoc 2,627-line monolithic runner in `apps/desktop/src/main/workers/plugins/automation.ts`.

### Step Types Audited
1. **`SEND_EMAIL`**: Handled in `automation.ts:1467-1650`. Checks campaign status, evaluates contact eligibility, renders variables, calls `sdk.outreach.sendEmail`.
2. **`DELAY` / `WAIT`**: Handled in `automation.ts:1229-1296`. Computes `nextExecutionAt = now + delaySeconds`. Sets MongoDB status `WAITING`.
   - **Critical Bug**: Omits writing to SQLite `sequence_executions`. Emits `automation:waiting` via `event-bridge.ts`, which only broadcasts to renderer UI. Scheduler never sees it.
3. **`CONDITION` / `IF_ELSE`**: Evaluates field conditions (e.g. `contact.status === 'opened'`). Sets target step index.
4. **`GOTO` / `LABEL`**: Jumps to label. Guarded by `runtime.jumpCount <= 50` to prevent infinite loops.
5. **`SET_VARIABLE`**: Writes key-value pair to `execCtx.variables`.
6. **`UPDATE_CONTACT`**: Calls `sdk.contacts.update` to mutate contact fields.

---

## 4. Audience & Contact Selection Audit

- **Enrollment Flow**: Handled in `apps/desktop/src/main/ipc/campaigns-ipc.ts:40-110`.
- **Snapshotting vs Dynamic**: Enrollment creates a concrete `sequence_executions` record for each selected contact. It is **snapshotted** at enrollment time; changes to audience filters afterwards do not alter enrolled executions.
- **Deduplication Gap**:
  - `campaigns-ipc.ts:67-74` checks `WHERE campaignId = ? AND contactId = ?`.
  - It prevents enrolling the same contact twice in the *same* campaign, but has **no cross-campaign enrollment check**.
  - A contact can be simultaneously enrolled in Campaign A and Campaign B, causing concurrent outreach.
- **Multi-Email Contacts**:
  - `ContactModel` supports `email` (primary) and `additionalEmails: [{ email, type, isVerified }]`.
  - However, `automation.ts:1509` exclusively reads `contact.email`. Secondary emails are never targeted for outreach by the automation worker.

---

## 5. Email Quality & Verification Audit

- **Distinction of States**: The system strictly separates validation stages:
  1. `syntax-valid`: `zod` regex validation in schemas.
  2. `MX-valid` / `disposable`: Evaluated in `EmailQualityModel` and `EmailVerificationRepository`.
  3. `mailbox-verified`: Provider SMTP handshake check.
  4. `provider-accepted`: Gmail API returned `200` with `messageId`.
  5. `delivered`: Provider acceptance + absence of bounce DSN.
- **Send-Time Safety Gate**:
  - Enforced in `apps/api/src/services/email/email.service.ts:240-254`.
  - Gate 1: Mailbox status `connected`.
  - Gate 2: Provider cooldown active check.
  - Gate 3: Campaign terminal status check (`STOPPED`/`FAILED`).
  - Gate 4: Suppression lookup (`suppressionRepo.findSuppressed(to, workspaceId)`).
  - Gate 5: Contact outreach eligibility check (`evaluateOutreachEligibility`).

---

## 6. Email Templates Audit

- **Phase 13 Claims vs Actual Implementation**:
  - Phase 13 claimed versioned template pinning across the execution lifecycle.
  - `EmailTemplateRepository.findVersion(templateId, version)` exists in `apps/api/src/repositories/email-template/email-template.repository.ts:62-102` and passed contract tests.
  - **The Disconnect**: `findVersion` is **never exposed in any API route** (`apps/api/src/routes/business.ts` or `email/index.ts`), never added to `OutreachService`, and never exposed in `packages/sdk/src/modules/outreach.ts`.
  - In `apps/desktop/src/main/workers/plugins/automation.ts:1484`:
    ```ts
    const templates = await sdk.outreach.listTemplates();
    const tpl = templates.find((t: any) => t.id === templateId);
    ```
    The worker fetches all templates and grabs whatever mutable template currently exists!
  - If a user edits a template while contacts are enrolled, running contacts immediately receive the edited template. Pinned versioning is completely bypassed.

---

## 7. Message Composition Audit

- **Canonical Fingerprint Discrepancy**:
  - In `packages/sdk/src/utils/variable-resolver.ts:572`: `composeOutboundMessage()` computes `messageFingerprint` over `workspaceId, senderEmail, recipientEmail, subject, textBody, htmlBody` (after tracking injection), `attachmentChecksums`, `templateId`, `templateVersion`.
  - In `apps/api/src/services/email/email.service.ts:289-298`:
    ```ts
    const messageFingerprint = computeMessageFingerprint({
      workspaceId: this.workspaceId,
      senderEmail: account.email,
      recipientEmail: input.to,
      subject: input.subject,
      htmlBody: input.html || null,
      textBody: input.text || null,
      templateId: input.templateId || null,
      templateVersion: input.templateVersion || null
    });
    ```
  - API ledger hashes raw HTML (before tracking rewrite) and **completely omits `attachmentChecksums`**!
  - Result: SDK preview fingerprints and API delivery ledger fingerprints never match.
- **Lineage Erasure on Throttle Retry**:
  - In `apps/desktop/src/main/workers/plugins/automation.ts:1630-1644`: In the in-process retry path after a 5-second rate limit pause, `templateId`, `templateVersion`, and `variablesSnapshot` are omitted from the retry payload. The retried delivery is persisted with null lineage.

---

## 8. Provider Integration Audit (Gmail)

- **Provider Abstraction**: Implemented in `apps/api/src/services/email/providers/gmail-provider.ts` implementing `EmailProvider` interface.
- **Token Refresh**: Token refresh is transparently managed in `GoogleAuthService.getValidAccessToken(connectionId)`. Refreshes expired access tokens using the stored refresh token.
- **Error Mapping**: Provider maps Google API errors cleanly:
  - 401/403: `AUTH_REVOKED` / `reauth_required`.
  - 429 / 403 `userRateLimitExceeded`: `PROVIDER_RATE_LIMITED`.
  - 5xx / Network socket hangup: `AMBIGUOUS_SEND_TIMEOUT`.

---

## 9. Rate Limiting Audit

- **Enforcement Layer**: Implemented atomically in MongoDB via `EmailAccountRepository.reserveSendSlot` (`apps/api/src/repositories/email-account/email-account.repository.ts:67-150`).
- **Mechanics**:
  - Concurrency lease: `sendLeaseExpiresAt` enforces `maxConcurrent = 1`.
  - Minimum spacing: `minSendIntervalMs` sets `nextSendAt = now + interval`.
  - Hourly / Daily limits: Windows tracked via `hourlySent` and `dailySent` with rolling window resets.
  - Cooldown: `rateLimitedUntil` prevents reservation during provider backoff.
- **Finding**: While API reservation is atomic and correct, the worker's handling of rejections (`status: 'wait'`) triggers the SQLite infinite stall bug (`THROTTLE-04`).

---

## 10. Scheduling Audit

- **Clock Source**: System UTC clock (`new Date()`, `datetime('now')` in SQLite).
- **Critical Collation Bug** (`scheduler.ts:388`):
  - Scheduler query: `WHERE se.nextExecutionAt <= datetime('now')`.
  - In SQLite, string comparison is performed character by character.
  - `se.nextExecutionAt` is stored as an ISO 8601 string: `'2026-09-05T17:00:00.000Z'`.
  - `datetime('now')` produces: `'2026-09-05 17:00:00'`.
  - Because character `'T'` (ASCII 84) > `' '` (ASCII 32), `'2026-09-05T...' <= '2026-09-05 ...'` evaluates to **FALSE** for any time on the same date! Delays scheduled for today are invisible until the next UTC day.

---

## 11. Delivery / Dispatch Audit & Crash Windows

- **Persistence Ordering**:
  1. `accountRepo.reserveSendSlot`: Atomic reservation in MongoDB.
  2. `deliveryRepo.reserveDelivery`: Delivery inserted with `status = 'SENDING'`, lease 300s.
  3. `provider.send`: Network transmission to Google API.
  4. `deliveryRepo.finalizeDelivery`: Status updated to `SENT`, `providerMessageId` set.
  5. `ContactModel.updateOne`: Transition to `CONTACTED`.
  6. `accountRepo.clearSendLease`: Release concurrency lease.
- **Crash Window Classifications**:
  - *Crash between (2) and (3)*: **Safe**. Message was not sent. Lease expires in 5 minutes; marked `AMBIGUOUS`, sent-folder reconciliation verifies absence, recovers to `FAILED`.
  - *Crash between (3) and (4)*: **Recoverable (Delayed)**. Message was sent by provider, but local status remains `SENDING`. After 5 minutes, lease expires; marked `AMBIGUOUS`. SentFolderReconciliation finds matching message in Gmail sent folder and reconciles to `SENT`.
  - *Crash during (4)*: **Recoverable**.

---

## 12. Reply, Bounce & Inbound Reconciliation Audit

- **Inbound Polling**: Managed by `ReconciliationService.reconcileInboundReplies()` scanning Gmail history and message lists.
- **Correlation Chain**:
  1. `providerThreadId`: Matches outbound delivery with same Gmail thread ID.
  2. Header references (`In-Reply-To`, `References`): Matches `providerMessageId`.
  3. Sender email fallback: Looks up contact, matches latest outbound delivery with `status = 'SENT'`.
- **Critical Race Window (`INBOUND-03`)**:
  - If a reply arrives before `finalizeDelivery` completes (while status is still `SENDING`), thread ID and message ID are null in the delivery record, and status is not `SENT`.
  - All 3 correlation checks fail.
  - The reply is marked `processingStatus = 'UNMATCHED'` and recorded with `idempotencyKey = inbound_${accountId}_${item.id}`.
  - Reconciliation skips it forever. The contact is never marked `REPLIED`, and future campaign steps continue sending follow-ups!

---

## 13. Suppression Audit

- **Scoping**: Address-level, domain-level, workspace-scoped, and system-global.
- **Enforcement**: Send-time safety gate in `EmailService.send()` checks suppression collection before provider dispatch.
- **Administrative Recovery Inconsistency (`UNSUPPRESS-13`)**:
  - `SuppressionRepository.unsuppress()` deletes the record from MongoDB `suppressions`.
  - It does **not** delete the record from SQLite `suppressions` table.
  - It does **not** restore `ContactModel.status` (leaves it `BOUNCED` or `UNSUBSCRIBED`).
  - Send-time checks continue to reject sends to the unsuppressed contact.

---

## 14. Analytics Audit

- **Authoritative Aggregations**: `CampaignAnalyticsService` in `apps/api/src/services/analytics/campaign-analytics.service.ts` calculates metrics directly from immutable `email_deliveries` and `email_events` with explicit denominators.
- **Desktop SQLite Fallback Gap (`ANALYTICS-FALLBACK-20`)**:
  - When the desktop app is offline or SDK fails, `analytics:campaign:overview` IPC queries SQLite `email_deliveries`.
  - However, SQLite `email_deliveries` is **only populated when a user visits the Delivery Logs screen** (`outreach.ts:356`). In all other situations, SQLite delivery table is empty, and offline analytics returns all zeros.

---

## 15. Operations & Observability Audit

- **Operations Center**: Implemented in `apps/api/src/services/operations/operations.service.ts` and `apps/desktop/src/renderer/screens/OperationsCenterScreen.tsx`.
- **Capabilities**:
  - Surfaces active workers, queue throughput, and mailbox health.
  - Detects ambiguous deliveries stuck in `SENDING` (>5 min) and triggers reconciliation.
- **Observability Blindspots**:
  - No visibility into executions orphaned in SQLite `RUNNING` status from crashes.
  - Unmatched inbound replies have no dedicated inspection or manual linking UI.

---

## 16. Desktop / API Consistency Audit

| Product Action | Desktop Path | API Path | Divergence / Risk |
| :--- | :--- | :--- | :--- |
| **Pause Campaign** | `CampaignsScreen.tsx` $\rightarrow$ `crm.ts:campaigns:update` | `CampaignService.pauseCampaign` | Desktop UI does NOT pause workers or jobs; API pause does. |
| **Resume Campaign** | `CampaignsScreen.tsx` $\rightarrow$ `crm.ts:campaigns:update` | `CampaignService.resumeCampaign` | Desktop UI does NOT unpause executions; resume IPC missing. |
| **Stop Campaign** | `campaigns:stop` (IPC) | `CampaignService.stopCampaign` | API stop cascades in MongoDB, but does not notify SQLite cache. |
| **Send Email** | `automation.ts` $\rightarrow$ `sdk.outreach.sendEmail` | `EmailService.send` | Discrepant fingerprints; lineage erased on retry. |

---

## 17. MongoDB / SQLite Consistency Audit

- **Authority Model**: MongoDB is authoritative; SQLite is a read projection.
- **Stale Projection Risk**:
  - When mutations occur outside desktop IPC (e.g. background API workers or external API calls), SQLite is not notified until the user triggers a sync or pagination read.
  - If a campaign is stopped via API, SQLite continues to show `ACTIVE` until manually refreshed.

---

## 18. IPC & Electron Security Audit

- **Preload Isolation**: Context isolation is enabled. Renderer accesses IPC only via strictly typed `window.ipc.invoke` wrappers in `preload/index.ts`.
- **Input Validation**: All main process IPC handlers use `safeRegister` (`apps/desktop/src/main/ipc/helper.ts`) with try/catch wrapping.
- **Shell / URL Opening**: Shell execution is restricted; URL opening is sanitized.
- **Secret Exposure**: OAuth refresh tokens and API secrets are stored in MongoDB and decrypted in API services; secrets are not passed into renderer window state.

---

## 19. Multi-Tenancy Audit

- **Scoping Invariant**: Every MongoDB collection (`contacts`, `companies`, `campaigns`, `sequence_executions`, `email_deliveries`, `email_events`, `suppressions`, `email_accounts`) includes `workspaceId: { type: String, required: true, index: true }`.
- **Query Scoping**: Audited across all repository classes in `apps/api/src/repositories/`. All queries enforce `this.workspaceId`.
- **Result**: Multi-tenancy isolation is strictly preserved. Zero cross-workspace data bleed verified.

---

## 20. Data Lifecycle & Cascade Deletions Audit

- **Campaign Deletion**:
  - `CampaignService.delete` soft-deletes the campaign (`deletedAt = new Date()`).
  - Cancels associated jobs in MongoDB.
  - Does **not** cascade-delete delivery ledger history (`email_deliveries` and `email_events` remain intact for audit compliance).
- **Template Deletion Bug (`TPL-DELETE-15`)**:
  - Deleting an email template does not check for active sequence executions referencing it. Subsequent steps referencing the deleted template fail immediately.

---

## 21. User-Facing Product Completeness Audit

- **Workflow Gaps Identified**:
  - No business hours schedule constraints for campaign sending.
  - No manual reply reconciliation interface for unmatched replies.
  - No contact un-enrollment flow from active campaigns.
  - No multi-mailbox send rotation.

---

## 22. Testing System Audit

- **Baseline Test Results**:
  - Unit / Component tests: 41 test files passed (323 tests passed).
  - Contract test suite: 6 test files passed (38 tests passed).
  - SQLite integration tests: 9 test files passed (all passed).
  - Typecheck: 12 packages passed (`FULL TURBO`).
- **False Confidence Points**:
  - Contract test `composition-contracts.test.ts:104` proves `EmailTemplateRepository.findVersion` works, but fails to test whether any API route or worker actually calls it.
  - SQLite integration tests mock time and ISO strings, missing the real-world ASCII collation mismatch with `datetime('now')`.

---

## 23. Codebase Health Audit

- **ESLint**: 31 errors and 65 warnings in `apps/marketing` (failing `pnpm doctor`).
- **Prettier**: 49 unformatted files (failing `pnpm doctor`).
- **Architecture**: Circular dependencies detected in desktop plugins.
- **Engine Duplication**: Monorepo maintains `@leadforge/workflow-engine` while using an ad-hoc runner in `apps/desktop/src/main/workers/plugins/automation.ts`.

---

## 24. Documentation / Implementation Drift Audit

- **Phase 13 Walkthrough vs Reality**:
  - Documentation claimed template versioning was fully wired to outbound sending. Reality: Versioning repository method was never exposed to API or SDK.
  - Documentation claimed canonical message fingerprinting was unified. Reality: SDK and API compute completely different hashes.

---

## 25. Product Roadmap Gap Analysis

See detailed breakdown in `post_phase13_product_gap_analysis.md`.

---

# Cross-System Adversarial Scenarios

### Scenario 1: User edits a template while 1,000 contacts are already enrolled
- **Expected Behavior**: Enrolled contacts maintain their pinned template version or frozen snapshot.
- **Actual Behavior**: `automation.ts:1484` calls `sdk.outreach.listTemplates()` without specifying a version. `matchedTemplate = tpl` retrieves the latest mutable template! All remaining contacts receive the newly edited template.
- **Severity**: HIGH.
- **Root Cause**: `findVersion` was never exposed in API route or SDK; worker takes mutable current template.
- **Recommended Phase**: Phase 15.

### Scenario 2: Campaign is paused while a worker is inside provider dispatch
- **Expected Behavior**: In-flight provider send completes safely; subsequent steps halt cleanly.
- **Actual Behavior**: Provider dispatch finishes; `finalizeDelivery` records `SENT`. Next step checks `campaignDoc.status === 'PAUSED'` (`automation.ts:1545`) and yields `{ status: 'wait', delaySeconds: 60 }`. Because of the SQLite delay bug, that wait stalls permanently. If paused from Desktop UI, UI called `campaigns:update` (`crm.ts:395`) which did not cancel jobs or pause sequence executions, leaving workers to continue running next contacts.
- **Severity**: HIGH.
- **Root Cause**: Asymmetric pause handling between UI (`crm.ts:395`) vs `campaigns-ipc.ts:451`, plus the SQLite wait delay bug.
- **Recommended Phase**: Phase 14 & Phase 16.

### Scenario 3: Campaign is stopped while several workers are running
- **Expected Behavior**: Workers immediately abort; queued jobs transition to `cancelled`.
- **Actual Behavior**: If stopped via API, MongoDB jobs and executions cancel properly. In-flight workers abort before send. However, SQLite `sequence_executions` and `campaigns` table are not updated immediately until desktop rehydrates.
- **Severity**: MEDIUM.
- **Root Cause**: SQLite cache projection lag when mutations happen via API.
- **Recommended Phase**: Phase 16.

### Scenario 4: Gmail returns 429 while three campaigns share one mailbox
- **Expected Behavior**: Mailbox enters backoff cooldown; campaigns queue cleanly, then resume after cooldown expires.
- **Actual Behavior**: `setProviderCooldown(accountId, cooldownSec)` sets `rateLimitedUntil` in MongoDB. All three campaigns receive `429` / `EMAIL_RATE_LIMITED` from `reserveSendSlot`. `automation.ts:1618` sees `retryAfterSec > 5` and yields `{ status: 'wait', delaySeconds, retrySameStep: true }`. Because `automation:waiting` never reaches SQLite `sequence_executions`, and scheduler only queries SQLite, **all three campaigns stall permanently and never resume!**
- **Severity**: CRITICAL.
- **Root Cause**: Rate limiting cooldown yielding `status: 'wait'` intersecting with SQLite wait stall bug.
- **Recommended Phase**: Phase 14.

### Scenario 5: Process crashes immediately after provider acceptance
- **Expected Behavior**: System detects crash, reconciles sent message from Gmail sent folder, and recovers execution without duplicate sends.
- **Actual Behavior**: `provider.send` succeeded, but `finalizeDelivery` did not run. `EmailDeliveryModel` remains `status: 'SENDING'` with null `providerMessageId`. When lease expires (5m), `reconcileStaleSending` marks it `AMBIGUOUS`. Background `SentFolderReconciliation` scans Gmail sent folder and recovers it to `SENT`. Handled safely by delivery ledger architecture.
- **Severity**: MEDIUM (Safe recovery, but contact transition is delayed 5-15 mins).
- **Root Cause**: Inherent network two-phase commit boundary.
- **Recommended Phase**: Phase 14.

### Scenario 6: Process crashes during scheduler recovery
- **Expected Behavior**: Scheduler recovery transitions are atomic across SQLite and MongoDB job creation.
- **Actual Behavior**: `scheduler.ts:404` runs atomic CAS in SQLite (`WAITING -> RUNNING`), then calls `sdk.jobs.create`. If the crash happens between SQLite update and `jobs.create`, SQLite marks execution `RUNNING`, but no job exists in MongoDB. On next startup, query filters `WHERE UPPER(se.status) = 'WAITING'`, so the orphaned execution is ignored forever.
- **Severity**: HIGH.
- **Root Cause**: Multi-system state transition without two-phase commit or crash recovery scan for orphaned `RUNNING` executions.
- **Recommended Phase**: Phase 14.

### Scenario 7: Contact replies from a secondary email address
- **Expected Behavior**: Inbound reply matches contact by secondary email, links to campaign, updates contact to `REPLIED`, stops sequence.
- **Actual Behavior**: `reconciliation.service.ts:657` checks `$or: [{ email: normalizedFrom }, { 'additionalEmails.email': normalizedFrom }]`. If secondary email is in `additionalEmails`, it finds contact and links to latest delivery. BUT if secondary email is NOT in `additionalEmails`, correlation fails completely; reply is marked `UNMATCHED`, sequence continues, and contact receives follow-ups.
- **Severity**: MEDIUM.
- **Root Cause**: Inability to correlate secondary email without pre-registered `additionalEmails` or matching headers.
- **Recommended Phase**: Phase 17.

### Scenario 8: Same contact is enrolled in two campaigns
- **Expected Behavior**: Cross-campaign outreach deduplication or warning; prevention of simultaneous outreach.
- **Actual Behavior**: Enrollment deduplication only checks `WHERE campaignId = ? AND contactId = ?`. Cross-campaign check does not exist. Sequence locks are keyed `(sequenceId, contactId)` so both execute concurrently. Both campaigns dispatch emails to the contact in parallel.
- **Severity**: HIGH.
- **Root Cause**: Lack of workspace-level contact enrollment exclusivity and global contact send lock.
- **Recommended Phase**: Phase 16.

### Scenario 9: Same mailbox sends to same recipient from two workers
- **Expected Behavior**: Strict serialization; no concurrent sends to same recipient.
- **Actual Behavior**: `EmailAccountRepository.reserveSendSlot` enforces `maxConcurrent = 1` per mailbox. `EmailService` lines 256-265 enforces `activeSendingToRecipient`. Worker 2 fails with `CONCURRENT_RECIPIENT_SEND_IN_FLIGHT` and backs off safely.
- **Severity**: LOW / VERIFIED SAFE.
- **Root Cause**: N/A (Protected by database invariants).
- **Recommended Phase**: N/A.

### Scenario 10: Contact is suppressed immediately after message scheduling
- **Expected Behavior**: Send-time suppression check blocks provider transmission.
- **Actual Behavior**: `EmailService.send` executes Safety Gate 4 (`suppressionRepo.findSuppressed`) immediately after account slot reservation (lines 240-254). The message is aborted and marked `status: 'SUPPRESSED'`.
- **Severity**: LOW / VERIFIED SAFE.
- **Root Cause**: N/A (Protected by send-time safety gate).
- **Recommended Phase**: N/A.

### Scenario 11: Template is deleted while an execution is waiting
- **Expected Behavior**: Execution uses pinned archived template version or halts with recoverable warning.
- **Actual Behavior**: Worker (`automation.ts:1484`) tries `listTemplates()`. Template is missing. `rawSubject` / `rawBody` are undefined. Step throws error; execution fails permanently.
- **Severity**: HIGH.
- **Root Cause**: Template versioning archive is bypassed; no immutable snapshot used by automation worker.
- **Recommended Phase**: Phase 15.

### Scenario 12: Gmail account is disconnected while jobs are queued
- **Expected Behavior**: Queued jobs pause or fail gracefully with clear operator notice (`reauth_required`).
- **Actual Behavior**: Worker attempts `reserveSendSlot`; repository rejects with `MAILBOX_NOT_ACTIVE`. Worker throws error, execution marks `FAILED`, and job retry counter increments until terminal `failed`. No auto-pause of campaign.
- **Severity**: MEDIUM.
- **Root Cause**: No campaign-level pause when primary sending account loses connection.
- **Recommended Phase**: Phase 16.

### Scenario 13: SQLite contains stale campaign state while MongoDB has STOPPED
- **Expected Behavior**: SQLite acts strictly as read projection; authoritative mutations in MongoDB dictate execution safety.
- **Actual Behavior**: Worker check in `automation.ts:1537` queries `sdk.campaigns.get(campaignId)` (authoritative MongoDB) before every email send. If MongoDB has `STOPPED`, worker detects it and aborts send! However, desktop UI shows stale `ACTIVE` until manual refresh.
- **Severity**: LOW/MEDIUM (Data integrity is preserved, but UI is misleading).
- **Root Cause**: Lack of reactive projection push from API to desktop cache.
- **Recommended Phase**: Phase 16.

### Scenario 14: A provider response is delayed beyond the delivery lease
- **Expected Behavior**: Timeout handled cleanly; lease expiration does not allow duplicate dispatch.
- **Actual Behavior**: Gmail provider timeout is 30s (`MAX_STEP_DURATION_MS = 60s`). If send times out at network level, `EmailService` catches `AMBIGUOUS_SEND_TIMEOUT`, clears lease, and marks delivery `AMBIGUOUS`. Sent-folder reconciliation later checks if it arrived.
- **Severity**: LOW / VERIFIED SAFE.
- **Root Cause**: N/A (Handled well by Phase 11/12 delivery ledger architecture).
- **Recommended Phase**: N/A.

### Scenario 15: A reply arrives before delivery finalization
- **Expected Behavior**: Inbound reply waits or retries correlation once outbound delivery is finalized.
- **Actual Behavior**: `reconciliation.service.ts:616-670` checks `providerThreadId`, headers, and fallback `status: 'SENT'`. Because the outbound delivery is still in `status: 'SENDING'`, all 3 checks fail. The reply is ingested as `processingStatus: 'UNMATCHED'` with permanent `idempotencyKey`. It is never re-processed. Contact is not marked `REPLIED`, sequence continues follow-ups.
- **Severity**: CRITICAL.
- **Root Cause**: Inbound reconciliation does not defer or retry unmatched replies for recently active accounts.
- **Recommended Phase**: Phase 17.

### Scenario 16: A bounce arrives after a subsequent alternate-email enrollment
- **Expected Behavior**: Bounce is attributed to the specific email address and delivery that bounced.
- **Actual Behavior**: DSN bounce parser extracts the exact recipient address from DSN headers. It suppresses the specific bounced email in `suppressions`. However, `ContactModel.status` is set to `BOUNCED`, which halts outreach for the contact across all emails.
- **Severity**: MEDIUM.
- **Root Cause**: Contact-level `status: 'BOUNCED'` vs address-level suppression mismatch.
- **Recommended Phase**: Phase 17.

### Scenario 17: A retry occurs while reconciliation is running
- **Expected Behavior**: Reconciliation locks delivery or delivery lease prevents concurrent retry.
- **Actual Behavior**: `EmailDeliveryModel.reconciliationLeaseExpiresAt` locks the delivery record during reconciliation. Retry path checks `reserveDelivery` which checks `sendLeaseExpiresAt`. Safe concurrency lock exists.
- **Severity**: LOW / VERIFIED SAFE.
- **Root Cause**: N/A (Protected by lease mechanism).
- **Recommended Phase**: N/A.

### Scenario 18: Workspace A and Workspace B contain the same recipient email
- **Expected Behavior**: Strict isolation; actions in Workspace A do not affect Workspace B.
- **Actual Behavior**: Deliveries, suppressions, campaigns, and events are strictly partitioned by `workspaceId`. No cross-tenant bleed.
- **Severity**: INFORMATIONAL / VERIFIED SAFE.
- **Root Cause**: N/A (Rigorous workspace scoping in repositories).
- **Recommended Phase**: N/A.

### Scenario 19: Multiple scheduler ticks see the same due execution
- **Expected Behavior**: Only one scheduler tick processes the due execution.
- **Actual Behavior**: `scheduler.ts:404` uses atomic compare-and-swap:
  `UPDATE sequence_executions SET status = 'RUNNING' WHERE id = ? AND UPPER(status) = 'WAITING'`.
  Only the tick with `changes === 1` enqueues the job.
  HOWEVER: The query `se.nextExecutionAt <= datetime('now')` compares ISO-8601 string (`'2026-09-05T...'`) with SQLite datetime string (`'2026-09-05 ...'`). In ASCII string comparison, `'T'` > `' '`, so due executions scheduled for today are NOT seen until the next day!
- **Severity**: CRITICAL.
- **Root Cause**: ISO string vs SQLite `datetime('now')` string collation format mismatch.
- **Recommended Phase**: Phase 14.

### Scenario 20: Application restarts with mixed stale/running jobs
- **Expected Behavior**: Startup recovery sweeps stale/running jobs, resets uncompleted executions, resumes waiting schedules.
- **Actual Behavior**: `scheduler.ts` sweeps MongoDB `jobs` collection, moving stale `running` jobs to `retrying` or `failed`. However, SQLite `sequence_executions` in `RUNNING` status from a previous process crash are NOT scanned during startup recovery! They remain `RUNNING` in SQLite forever.
- **Severity**: HIGH.
- **Root Cause**: Startup recovery scans MongoDB `jobs`, but does not reset orphaned SQLite `sequence_executions`.
- **Recommended Phase**: Phase 14.
