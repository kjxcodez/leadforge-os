# Phase 10H-R — Forensic Confirmation Report

**Date:** August 26, 2026  
**Auditor:** LeadForge OS Systems Engineering & Architecture  
**Active Baseline:** Re-verified against active source code in `apps/desktop`, `apps/api`, `packages/schema`, `packages/sdk`, SQLite migrations, and MongoDB models.

---

## 1. Executive Forensic Confirmation Summary

| Area / Item | Previous Audit Finding | Fresh Re-verification Finding | Classification | Severity |
|---|---|---|---|---|
| **10H-R1: Outreach Idempotency Race** | `UNIQUE constraint` error on `idempotencyKey` caught and ignored in `automation.ts` L1959. | Re-confirmed: Catch block only logs a warning and proceeds to call `sdk.outreach.sendEmail()`. | **VERIFIED DEFECT** | **P0** |
| **10H-R2: Canonical Status Contract** | `campaigns-ipc.ts` writes `'Active'` and `'running'`; schema & Mongo enforce `'ACTIVE'`, `'RUNNING'`. | Re-confirmed: Local SQLite writes TitleCase `'Active'` and lowercase `'running'`. Requires ad-hoc casing patches in SyncEngine. | **VERIFIED DEFECT** | **P1** |
| **10H-R3: Audience Resolver Parity** | API `AudienceService.resolveAudience()` lacks geographic & company filters supported by SQLite. | Re-confirmed: `business.ts` and `audience.service.ts` ignore `city`, `state`, `country`, `location`, `companyId`. | **VERIFIED DEFECT** | **P1** |
| **10H-R4: Contact Outreach History** | `Contact.status` is not mutated on email send (architectural separation). | Re-confirmed: `handleSendEmailStep` writes `email_deliveries` and `sequence_executions`; does not mutate `contacts.status`. | **VERIFIED INTENTIONAL BEHAVIOR** | **P2** |
| **10H-R5: Never Contacted Audience Filter** | No dynamic filter exists for "Never Contacted" contacts based on delivery ledger. | Re-confirmed: Users cannot filter for uncontacted leads without misusing `Contact.status = 'NEW'`. | **VERIFIED DESIGN GAP** | **P1** |
| **10H-R6: Location Dataset & Normalization** | 20 hardcoded countries; scraper extracts 2-letter state code while UI saves full state name. | Re-confirmed: `locations.ts` is minimal (20 countries); `scraper.ts` L486 extracts postal code `"FL"` while UI saves `"Florida"`. | **VERIFIED DESIGN GAP** | **P1** |
| **10H-R7: Sync Ownership & Stubs** | `SyncEngine` has stubbed `Promise.resolve()` for intelligence; `email_deliveries` is local-only. | Re-confirmed: `(this.sdk as any).intelligence?.save` is undefined; `email_deliveries` is local operational ledger. | **VERIFIED DESIGN GAP** | **P2** |
| **10H-R8: Electron Native Test Execution** | Host Node skips SQLite tests due to native ABI mismatch. | Re-confirmed: `run-tests.js` skips SQLite tests unless executed under Electron runtime (`ELECTRON_RUN_AS_NODE=1`). | **VERIFIED DEFECT** | **P1** |

---

## 2. Detailed Forensic Evidence & Concrete Reproduction

### Finding 1: Outbound Email Concurrent Insertion Race (10H-R1)
- **File:** `apps/desktop/src/main/workers/plugins/automation.ts` (Lines 1938–1961)
- **Code Trace:**
  ```typescript
  try {
    db.prepare(`INSERT INTO email_deliveries (...) VALUES (...)`).run(...);
  } catch (deliveryLogErr: any) {
    ctx.emitLog(`Pre-send delivery log warning: ${deliveryLogErr.message}`, 'warn');
  }
  // Execution continues directly to:
  const sendResult = await sdk.outreach.sendEmail(...);
  ```
- **Reproduction Evidence:** When two worker processes or retries race on the exact same execution step and contact, Worker B's insert fails with `SqliteError: UNIQUE constraint failed: email_deliveries.idempotencyKey`. The catch block swallows the error, and Worker B still sends the email via Gmail OAuth API.
- **Resolution:** If `INSERT` throws a unique constraint violation, re-query `email_deliveries` for the `idempotencyKey`. If status is `'SENDING'`, `'SENT'`, or `'SUPPRESSED'`, immediately abort execution and return `{ status: 'success' }`.

---

### Finding 2: Status Contract & Casing Inconsistencies (10H-R2)
- **Files:**
  - `apps/desktop/src/main/ipc/campaigns-ipc.ts` (Lines 70, 407)
  - `apps/desktop/src/main/services/sync-engine.ts` (Lines 141–152, 381–383)
  - `apps/api/src/db/models/campaign.model.ts` (Line 44)
  - `packages/schema/src/enums/index.ts` (Lines 70–84)
- **Code Trace:**
  - `campaigns-ipc.ts`: `UPDATE campaigns SET status = 'Active'` (TitleCase).
  - `campaigns-ipc.ts`: `UPDATE sequence_executions SET status = 'running'` (lowercase).
  - `campaign.model.ts`: `enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED']` (uppercase).
  - `sync-engine.ts`: Ad-hoc casing patches `payload.status = payload.status.toUpperCase()`.
- **Reproduction Evidence:** Direct mutations or unpatched sync payloads fail Mongoose enum validation on API.
- **Resolution:** Standardize on canonical uppercase status enums across IPC, SQLite queries, and Sync payloads.

---

### Finding 3: SQLite vs API Audience Filter Parity (10H-R3)
- **Files:**
  - `apps/desktop/src/main/ipc/audiences-ipc.ts` (Lines 76–89)
  - `apps/api/src/services/audience/audience.service.ts` (Lines 62–90)
- **Code Trace:**
  - `audiences-ipc.ts` supports `city`, `state`, `country`, `location`, `search`, `status`, `industry`, `discoveryRunId`. (Missing `companyId`).
  - `audience.service.ts` ONLY supports `search`, `status`, `industry`, `discoveryRunId`. It drops `city`, `state`, `country`, `location`, and `companyId`.
- **Reproduction Evidence:** A dynamic audience created with location filter "Miami, Florida" resolves matching leads in desktop SQLite, but returns empty or unconstrained results when resolved via the backend API.
- **Resolution:** Update `AudienceService.resolveAudience()` in `apps/api` to implement identical filtering logic for `city`, `state`, `country`, `location`, `companyId`, and `contactedStatus`.

---

### Finding 4: Contact Outreach State & History Semantics (10H-R4 & 10H-R5)
- **Files:**
  - `apps/desktop/src/main/workers/plugins/automation.ts` (Lines 1900–2048)
  - `apps/desktop/src/main/database/runner.ts` (Lines 30–50)
- **Code Trace:** `handleSendEmailStep` does not mutate `Contact.status`. `Contact.status` is only set to `REPLIED` by `imap-poller.ts` or via explicit `MOVE_PIPELINE_STAGE` steps.
- **Verdict:** This separation is **VERIFIED INTENTIONAL BEHAVIOR**. Overwriting `Contact.status = 'CONTACTED'` on every email corrupts CRM lifecycle stages.
- **Design Gap:** `contacts` lacks a `lastContactedAt` timestamp, and dynamic audiences lack a `contactedStatus: 'all' | 'never' | 'contacted'` filter rule.
- **Resolution:**
  1. Add Migration 033: `ALTER TABLE contacts ADD COLUMN lastContactedAt DATETIME DEFAULT NULL`.
  2. Update `contacts.lastContactedAt = CURRENT_TIMESTAMP` upon successful `status = 'SENT'`.
  3. Implement `contactedStatus` filter in `audiences-ipc.ts`, `audience.service.ts`, and `CreateAudienceModal.tsx`.

---

### Finding 5: Location Normalization & Dataset Completeness (10H-R6)
- **Files:**
  - `apps/desktop/src/renderer/lib/locations.ts`
  - `apps/desktop/src/main/workers/plugins/scraper.ts` (Lines 474–497)
  - `apps/desktop/src/renderer/screens/DiscoveryScreen.tsx`
- **Code Trace:**
  - UI inputs store full state name (`"Florida"`).
  - Playwright scraper parses 2-letter state postal code (`"FL"`).
  - CRM filters query `SELECT DISTINCT state FROM companies`, resulting in split entries (`"Florida"` and `"FL"`).
- **Resolution:**
  1. Expand local standard ISO-3166-1 country dataset and ISO-3166-2 subdivisions.
  2. In `scraper.ts`, normalize state postal codes to canonical state names (e.g. `"FL"` -> `"Florida"`).
  3. Add a SQLite migration/backfill to normalize existing state codes.

---

### Finding 6: Sync Ownership & Stubs (10H-R7)
- **Files:**
  - `apps/desktop/src/main/services/sync-engine.ts` (Lines 483–496)
  - `packages/sdk/src/client/index.ts`
- **Code Trace:** `(this.sdk as any).intelligence?.save` is undefined. `email_deliveries` is not in `sync_queue`.
- **Verdict:**
  - `email_deliveries`: **LOCAL SOURCE OF TRUTH / LOCAL OPERATIONAL LEDGER**.
  - Intelligence Trust Records: **INTENTIONALLY LOCAL**.
- **Resolution:** Remove misleading no-op calls in `SyncEngine` for intelligence entities and explicitly document their local-only architecture.
