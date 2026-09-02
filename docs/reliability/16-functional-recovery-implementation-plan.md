# 16 - Functional Recovery Implementation Plan (Phase 17 Revised)

## 1. Executive Summary

This implementation plan establishes the definitive, dependency-ordered blueprint for transitioning LeadForge from an architecturally verified codebase into a robust, reliable, production-grade application. 

Every work package adheres to strict reliability standards:
- **Investigation-First Validation**: Addresses verified root causes rather than superficial symptoms.
- **Strict Dependency Ordering**: Prerequisite database and API contracts are guaranteed before higher-level workflows.
- **Explicit Test Gates**: Every package mandates an automated reproducer test (RED → GREEN).
- **Atomic Commits**: Each commit is isolated and reviewable.
- **Deterministic Product Semantics**: Uncompromising adherence to authoritative MongoDB persistence, non-authoritative disposable SQLite caching, and truthful reporting.

---

## 2. Dependency-Ordered Architecture Sequence

```mermaid
graph TD
  WP1[WP1: Workspace DB Init & Cache Lifecycle] --> WP2[WP2: Local-First Semantic Audit]
  WP2 --> WP3[WP3: API/SDK/DTO Contracts & Phone Normalization]
  WP3 --> WP4[WP4: Workspace-Scoped Query State]
  WP4 --> WP5[WP5: Dashboard Correctness]
  WP4 --> WP6[WP6: CRM Cache Robustness]
  WP3 --> WP7[WP7: Discovery Domain Model Hierarchy]
  WP7 --> WP8[WP8: Discovery 5->1 Result Persistence Reconciliation]
  WP3 --> WP9[WP9: Crawler Persistence & Partial-Success Semantics]
  WP3 --> WP10[WP10: Intelligence Upsert & Truthful Results]
  WP4 --> WP11[WP11: Campaign/Sequence State Machine]
  WP3 --> WP12[WP12: Template Context & Missing-Company Semantics]
  WP4 --> WP13[WP13: Gmail Sender Deterministic Invalidation]
  WP3 --> WP14[WP14: Google Drive User-Owned Storage]
  WP14 --> WP15[WP15: Attachment Resolution During Delivery]
  WP13 & WP15 & WP12 --> WP16[WP16: Outbound Send State Machine Reconciliation]
  WP16 --> WP17[WP17: Delivery Ledger Consistency]
  WP16 --> WP18[WP18: Reply Ingestion & Tracking]
  WP3 --> WP19[WP19: Automation Event Payloads P1]
  WP19 --> WP20[WP20: Scheduler Adaptive Polling & Resilience]
  WP1 & WP20 --> WP21[WP21: System Engine Startup & Runtime Lifecycle]
  WP4 & WP11 & WP17 --> WP22[WP22: UI Quality & React Key Warning Cleanup]
  WP1 to WP22 --> WP23[WP23: Real Electron E2E Qualification]
  WP23 --> WP24[WP24: Final Product Reliability Gate]
```

---

## 3. Comprehensive 24-Package Work Breakdown

---

### WP1 — Workspace DB Initialization & Cache Lifecycle (P0)
- **Objective**: Guarantee that every newly opened SQLite database connection undergoes full schema inspection, table/column verification, and initialization before becoming accessible to runtime queries.
- **Detailed Lifecycle**:
  ```text
  open workspace DB (getDatabase)
  → inspect schema version (cache_metadata)
  → initialize/migrate schema (initCacheSchema)
  → verify required tables/columns exist
  → register connection in workspaceDbs Map
  → runtime / IPC queries become available
  ```
- **Affected Files**:
  - `apps/desktop/src/main/database/connection.ts`
  - `apps/desktop/src/main/database/cache-schema.ts`
  - `apps/desktop/src/main/index.ts`
- **Target Changes**:
  1. Refactor `getDatabase(workspaceId)` in `connection.ts` to be synchronous, atomic, and schema-guaranteed.
  2. Inside `getDatabase()`, before caching `new Database(dbPath)` in `workspaceDbs`, immediately execute `initCacheSchema(db)`.
  3. Validate all 18 disposable tables and indices exist.
- **Reproducer & Regression Test**: `apps/desktop/src/main/services/fresh-database-all-queries.test.ts` (Opens a brand-new workspace DB on disk and immediately executes **all 15 production SQLite queries** from `14-runtime-cache-query-inventory.md` with zero schema errors).
- **Atomic Commit**: `fix(db): implement guaranteed schema verification and initialization lifecycle on database connection`

---

### WP2 — Full Local-First Dependency & Semantic Audit (P2)
- **Objective**: Conduct a repository-wide semantic scan of all local-first legacy patterns and classify/reconcile every occurrence.
- **Scan Targets**: `Local*`, `SQLite repositories`, `INSERT INTO`, `UPDATE ...`, `DELETE FROM`, `better-sqlite3`, `CacheRepository writes`, `local persistence`, `filesystem business data`, `offline queue`, `sync`, `hydrate`.
- **Classification Schema**:
  1. `Allowed Read Cache`: Fast read acceleration from hydrated tables.
  2. `Allowed Temporary State`: Transient worker progress state.
  3. `Business-State Authority Violation`: Any write or authority assumed by SQLite over MongoDB → **ELIMINATE**.
  4. `Dead/Legacy Code`: Unused mock helpers → **DELETE**.
- **Affected Files**:
  - `apps/desktop/src/main/database/repositories/*`
  - `apps/desktop/src/main/ipc/*`
  - `apps/desktop/src/main/workers/*`
- **Reproducer & Regression Test**: `apps/desktop/src/main/services/authority-boundary.test.ts` (Verifies that all entity mutations route through `SdkClient` and never directly write authoritative business records to SQLite).
- **Atomic Commit**: `refactor(core): eliminate residual local-first authority violations across repositories and ipc`

---

### WP3 — API / SDK / DTO Contract Reconciliation (P1)
- **Objective**: Align all DTO schemas, SDK client methods, and API routes with canonical domain models.
- **Target Changes**:
  1. Ensure `SdkClient` exposes full CRUD for `discoveryRuns`, `companyDiscoveryRuns`, `attachments`, `emailDeliveries`, and `googleConnections`.
  2. Update `createContactDtoSchema` to support normalized phone strings.
  3. Normalize all enum fields across API and Desktop to uppercase canonical enums (`CampaignStatus.ACTIVE`, `ContactStatus.NEW`).
- **Affected Files**:
  - `packages/schema/src/`
  - `packages/sdk/src/`
  - `apps/api/src/routes/`
- **Reproducer & Regression Test**: `packages/sdk/src/contracts.test.ts` (Validates full payload serialization and schema validation across all SDK client endpoints).
- **Atomic Commit**: `fix(sdk): reconcile sdk methods and dto schema contracts with api routes`

---

### WP4 — Workspace-Scoped Query & State Correctness (P1)
- **Objective**: Ensure every React Query key, IPC payload, and cache entry is strictly scoped by `workspaceId` and invalidated deterministically.
- **Target Changes**:
  1. Audit all frontend screens to ensure query keys strictly follow `[entity, 'list', workspaceId, ...params]`.
  2. Add `workspaceId` to `['sequence_logs', workspaceId, executionId]` in `AutomationScreen.tsx`.
  3. Ensure workspace switching unmounts and purges active query cache to prevent cross-workspace leak.
- **Affected Files**:
  - `apps/desktop/src/renderer/screens/*`
  - `apps/desktop/src/renderer/hooks/*`
- **Reproducer & Regression Test**: `apps/desktop/src/renderer/hooks/query-keys.test.ts` (Asserts all query keys contain valid workspace IDs and isolate cache entries across tenants).
- **Atomic Commit**: `fix(renderer): enforce strict workspace scoping and deterministic invalidation across react query keys`

---

### WP5 — Dashboard Correctness & Metrics Refresh (P1)
- **Objective**: Eliminate dashboard crashing on clean boot, support real-time metrics refresh, and clean up terminology.
- **Target Changes**:
  1. In `apps/desktop/src/main/ipc/dashboard.ts`, ensure all count queries execute safely over initialized cache tables.
  2. In `DashboardScreen.tsx`, rename "Sync Stats" to "Refresh Metrics".
  3. Emit and listen to `cache:hydrated` instead of `sync:completed`.
- **Affected Files**:
  - `apps/desktop/src/main/ipc/dashboard.ts`
  - `apps/desktop/src/renderer/screens/DashboardScreen.tsx`
- **Reproducer & Regression Test**: `apps/desktop/src/main/ipc/dashboard.test.ts` (Executes `dashboard:stats` and `dashboard:chart-data` against clean and populated cache DBs).
- **Atomic Commit**: `fix(dashboard): stabilize metrics queries and modernize refresh telemetry`

---

### WP6 — CRM Correctness & Cache Query Robustness (P1)
- **Objective**: Stabilize company and contact CRM table queries, facet filters, and search indexing.
- **Target Changes**:
  1. Fix `companies:distinct-values` and `contacts:distinct-values` to handle clean tables gracefully.
  2. Ensure CRM filters support multi-field search and tag queries without crashing on null values.
- **Affected Files**:
  - `apps/desktop/src/main/ipc/crm.ts`
  - `apps/desktop/src/renderer/screens/CompaniesScreen.tsx`
  - `apps/desktop/src/renderer/screens/ContactsScreen.tsx`
- **Reproducer & Regression Test**: `apps/desktop/src/main/ipc/crm-queries.test.ts` (Tests multi-column distinct queries and facet generation on empty and populated CRM datasets).
- **Atomic Commit**: `fix(crm): harden company and contact facet queries and search indexing`

---

### WP7 — Discovery Domain Model & Run/Job Hierarchy (P1)
- **Objective**: Establish the canonical domain hierarchy: `DiscoveryRun` (top-level) → `DiscoveryJob` (`scraper:maps`) → `Child Jobs` (`crawler:website[]`, `enrich:intelligence[]`).
- **Target Changes**:
  1. In `DiscoveryScreen.tsx`, eliminate ad-hoc string filtering on `allJobs`.
  2. Fetch top-level discovery runs authoritatively via `discovery:run:list`.
  3. Render child crawler and enrichment jobs in a dedicated "Run Execution Details" sub-panel rather than cluttering the Discovery Runs table.
- **Affected Files**:
  - `apps/desktop/src/renderer/screens/DiscoveryScreen.tsx`
  - `apps/desktop/src/main/ipc/discovery-ipc.ts`
  - `apps/api/src/routes/business.ts`
- **Reproducer & Regression Test**: `apps/desktop/src/renderer/screens/discovery-hierarchy.test.ts` (Asserts Discovery Runs list displays only Maps parent runs, with child jobs nested in run details).
- **Atomic Commit**: `refactor(discovery): establish canonical discovery run and child job execution hierarchy`

---

### WP8 — Discovery Result Persistence & Count Reconciliation (5 -> 1 Fix) (P0)
- **Objective**: Eliminate the discrepancy where 5 companies were scraped into MongoDB but only 1 appeared in the UI.
- **Target Changes**:
  1. Trace and fix the data pipeline: `scraper.ts` creates companies → creates `company_discovery_runs` linking documents → writes to MongoDB.
  2. In `discovery-ipc.ts:discovery:run:companies`, fetch directly from `sdk.companyDiscoveryRuns.list({ discoveryRunId })` and join company records from MongoDB/cache if local SQLite cache is not yet hydrated.
  3. In `DiscoveryScreen.tsx`, **delete the client-side fuzzy substring fallback** that filtered out scraped companies that did not literally match the query string.
- **Affected Files**:
  - `apps/desktop/src/main/workers/plugins/scraper.ts`
  - `apps/desktop/src/main/ipc/discovery-ipc.ts`
  - `apps/desktop/src/renderer/screens/DiscoveryScreen.tsx`
- **Reproducer & Regression Test**: `apps/desktop/src/main/workers/discovery-persistence-reconciliation.test.ts` (Simulates 5-company Maps scrape, verifies all 5 company records and linking rows are returned by `discovery:run:companies` without fuzzy filter dropping).
- **Atomic Commit**: `fix(discovery): reconcile discovery run membership linking and eliminate lossy fuzzy filtering`

---

### WP9 — Crawler Persistence + Partial-Success Semantics (P1)
- **Objective**: Normalize phone numbers to E.164, ensure contacts pass API validation, and report truthful crawl outcomes.
- **Target Changes**:
  1. Implement `normalizePhone(rawPhone)` in `crawler.ts` to convert `(555) 123-4567` → `+15551234567` before calling `sdk.contacts.create()`.
  2. Implement granular outcome metrics: `pagesVisited`, `contactsExtracted`, `contactsPersisted`, `contactsRejected`.
  3. Set outcome status truthfully: `SUCCESS` (100% persisted), `PARTIAL_SUCCESS` (>0 persisted, >0 rejected), `FAILED` (0 persisted).
- **Affected Files**:
  - `apps/desktop/src/main/workers/plugins/crawler.ts`
  - `packages/schema/src/fields/common.ts`
- **Reproducer & Regression Test**: `apps/desktop/src/main/workers/crawler-persistence-semantics.test.ts` (Crawls test page with mixed phone formats, asserts E.164 normalization and `PARTIAL_SUCCESS` status on invalid contact data).
- **Atomic Commit**: `fix(crawler): normalize phone numbers to e164 and implement truthful partial-success outcome reporting`

---

### WP10 — Intelligence Persistence + Truthful Result Semantics (P1)
- **Objective**: Fix duplicate key `409 CONFLICT` errors on contact intelligence re-enrichment and report accurate enrichment metrics.
- **Target Changes**:
  1. In `apps/api/src/repositories/intelligence/contact-intelligence.repository.ts`, implement `upsertByContactId(workspaceId, contactId, data)` using `findOneAndUpdate({ workspaceId, contactId }, update, { upsert: true, returnDocument: 'after' })`.
  2. In `apps/api/src/routes/intelligence.ts`, update `POST /contact` to call `upsertByContactId`.
  3. In `intelligence-worker.ts`, track `contactsAttempted`, `contactsUpdated`, `contactsCreated`, `contactsFailed` and report outcome truthfully.
- **Affected Files**:
  - `apps/api/src/repositories/intelligence/contact-intelligence.repository.ts`
  - `apps/api/src/routes/intelligence.ts`
  - `apps/desktop/src/main/workers/plugins/intelligence-worker.ts`
- **Reproducer & Regression Test**: `apps/api/src/services/intelligence-upsert.test.ts` (Enriches the same contact multiple times; asserts 200/201 response, zero 409 CONFLICT errors, and updated scores).
- **Atomic Commit**: `fix(intelligence): implement upsert semantics for contact intelligence and accurate outcome telemetry`

---

### WP11 — Campaign & Sequence State Machine (P1)
- **Objective**: Normalize campaign execution states and status transitions across API, workers, and UI.
- **Target Changes**:
  1. Enforce strict uppercase canonical status strings (`ACTIVE`, `PAUSED`, `COMPLETED`, `DRAFT`) across `automation.ts`, `CampaignsScreen.tsx`, and `crm.ts`.
  2. Ensure sequence execution progress updates update MongoDB `SequenceExecutionModel` atomically and trigger UI query invalidation.
- **Affected Files**:
  - `apps/desktop/src/main/workers/plugins/automation.ts`
  - `apps/desktop/src/renderer/screens/CampaignsScreen.tsx`
  - `apps/desktop/src/main/ipc/crm.ts`
- **Reproducer & Regression Test**: `apps/desktop/src/main/workers/campaign-state-machine.test.ts` (Tests full status lifecycle transitions: DRAFT → ACTIVE → PAUSED → ACTIVE → COMPLETED).
- **Atomic Commit**: `fix(campaigns): normalize campaign status enums and sequence execution state transitions`

---

### WP12 — Template Rendering Context & Missing-Company Semantics (P0)
- **Objective**: Define explicit, robust context resolution semantics for contact and company template variables.
- **Target Semantics**:
  ```text
  Template Variable Resolution Contract:
  ├── Contact Fields: {{contact.firstName}}, {{contact.lastName}}, {{contact.email}}, {{contact.title}}
  │   └── If field missing → resolves to empty string "" (or contact-level fallback).
  └── Company Fields: {{company.name}}, {{company.domain}}, {{company.industry}}, {{company.location}}
      ├── If contact.companyId exists → load company and interpolate values.
      └── If contact.companyId is null / missing:
          ├── Template contains {{company.*}} tokens → UI warning displayed on campaign enrollment.
          └── At send time → {{company.*}} tokens resolve cleanly to "" without throwing fatal error.
  ```
- **Target Changes**:
  1. In `apps/desktop/src/main/workers/plugins/automation.ts:loadEntityData`, fetch `company = await sdk.companies.get(contact.companyId)` whenever `contact.companyId` is present.
  2. In `packages/sdk/src/utils/variable-resolver.ts`, ensure safe fallback for null company context.
  3. In `CampaignsScreen.tsx`, add an enrollment validation warning if a template references `{{company.*}}` but selected contacts have `companyId === null`.
- **Reproducer & Regression Test**: `packages/sdk/src/utils/template-context-semantics.test.ts` (Tests all 5 combinations: contact only, contact+company, missing company, missing company field, missing contact field).
- **Atomic Commit**: `fix(automation): establish explicit contact and company template resolution contracts`

---

### WP13 — Gmail Sender Lifecycle & Deterministic Invalidation (P1)
- **Objective**: Ensure newly connected Gmail accounts immediately appear in the campaign sender dropdown without polling delays or full app restarts.
- **Target Changes**:
  1. In `WorkspaceSettingsScreen.tsx:pollTransaction`, upon `res.status === 'completed'`, immediately execute `queryClient.invalidateQueries({ queryKey: ['email_accounts', workspaceId] })`.
  2. In `CampaignsScreen.tsx`, ensure `accountsQuery` consumes the shared query cache deterministically.
  3. Remove any unnecessary permanent polling intervals.
- **Affected Files**:
  - `apps/desktop/src/renderer/screens/WorkspaceSettingsScreen.tsx`
  - `apps/desktop/src/renderer/screens/CampaignsScreen.tsx`
- **Reproducer & Regression Test**: `apps/desktop/src/renderer/screens/sender-dropdown-invalidation.test.ts` (Simulates Google OAuth completion and asserts immediate React Query cache refresh and sender dropdown population).
- **Atomic Commit**: `fix(outreach): trigger deterministic react query invalidation upon gmail oauth completion`

---

### WP14 — Google Drive User-Owned Attachment Storage (P0)
- **Objective**: Implement durable, user-owned Google Drive attachment storage via backend `GoogleDriveProvider`.
- **Detailed Lifecycle**:
  ```text
  User selects file in Desktop UI
  → Electron reads buffer (validated <= 25 MB)
  → Desktop invokes sdk.attachments.upload(buffer, filename, mimeType, googleConnectionId)
  → API invokes GoogleDriveProvider.uploadFile() targeting user's Google Drive
  → Drive creates "LeadForge Attachments" folder if missing & uploads binary
  → Drive returns durable fileId & webViewLink
  → API creates MongoDB AttachmentModel record with (fileId, googleConnectionId, size, mimeType, contentHash)
  → Desktop associates durable attachmentId with Template / Campaign
  ```
- **Affected Files**:
  - `apps/desktop/src/main/ipc/outreach.ts`
  - `apps/desktop/src/renderer/screens/CampaignsScreen.tsx`
  - `apps/desktop/src/renderer/components/crm/ProgressiveSequenceEditor.tsx`
  - `packages/sdk/src/modules/attachments.ts`
- **Reproducer & Regression Test**: `apps/api/src/services/google-drive-attachment-lifecycle.test.ts` (Simulates file upload, verifies Google Drive binary upload, durable `fileId` persistence in MongoDB, and metadata retrieval).
- **Atomic Commit**: `feat(drive): implement user-owned google drive binary attachment storage and persistence`

---

### WP15 — Attachment Resolution During Delivery (P0)
- **Objective**: Ensure attachments are dynamically resolved and downloaded from Google Drive at email send time.
- **Target Changes**:
  1. In `apps/api/src/services/email/email.service.ts:send`, read attachment IDs from template/send payload.
  2. Lookup `AttachmentModel` by ID in MongoDB to retrieve `googleConnectionId` and `fileId`.
  3. Download binary buffer via `driveProvider.downloadFile(googleConnectionId, fileId)`.
  4. Construct MIME attachment parts with correct `filename`, `contentType`, and `data`.
- **Affected Files**:
  - `apps/api/src/services/email/email.service.ts`
  - `apps/api/src/services/google/drive.provider.ts`
- **Reproducer & Regression Test**: `apps/api/src/services/email-drive-attachment-delivery.test.ts` (Executes email dispatch with Drive attachment, asserts MIME body contains valid base64 payload matching original file buffer).
- **Atomic Commit**: `fix(outreach): resolve and construct google drive mime attachments during email dispatch`

---

### WP16 — End-to-End Outbound Send State Machine Reconciliation (P0)
- **Objective**: Reconcile the complete send state machine across Gmail, delivery ledger, sequence executions, campaign metrics, and UI.
- **Detailed State Transitions**:
  ```text
  1. Send Reservation: Check quota & reserve slot in EmailDeliveryModel (QUEUED)
  2. Context & Assets: Resolve template variables & download Drive attachments
  3. Provider Dispatch: Send MIME message via Gmail API (SENDING)
  4. Provider Finalization:
     ├── Success: Receive Gmail messageId → finalize EmailDelivery (SENT)
     └── Error:
         ├── Deterministic Failure (4xx/5xx): finalize EmailDelivery (FAILED)
         └── Ambiguous/Timeout: mark EmailDelivery (AMBIGUOUS) with NO blind resend
  5. State Propagation:
     ├── Update SequenceExecution step log & currentStep
     ├── Update Contact status (CONTACTED)
     ├── Update Campaign live stats
     └── Invalidate UI queries (email_deliveries, campaign_enrollments, campaigns)
  ```
- **Affected Files**:
  - `apps/api/src/services/email/email.service.ts`
  - `apps/desktop/src/main/workers/plugins/outreach.ts`
  - `apps/desktop/src/main/workers/plugins/automation.ts`
- **Reproducer & Regression Test**: `apps/desktop/src/main/workers/outbound-send-state-machine.test.ts` (Executes full outbound send and asserts synchronized state transitions across Gmail response, delivery record, execution step, and campaign counters).
- **Atomic Commit**: `fix(outreach): reconcile outbound send state machine across gmail, delivery ledger, execution and ui`

---

### WP17 — Delivery Ledger Consistency & Live Audit (P0)
- **Objective**: Connect the Desktop Delivery Ledger UI directly to the authoritative MongoDB `EmailDeliveryModel`.
- **Target Changes**:
  1. Replace local SQLite query in `apps/desktop/src/main/ipc/outreach.ts:email-deliveries:list` with `sdk.emailDeliveries.list({ workspaceId, campaignId, status, page, limit })`.
  2. Ensure delivery ledger displays real-time status (`SENT`, `FAILED`, `AMBIGUOUS`), Gmail `messageId`, recipient email, and timestamps.
- **Affected Files**:
  - `apps/desktop/src/main/ipc/outreach.ts`
  - `apps/desktop/src/renderer/screens/CampaignsScreen.tsx`
  - `packages/sdk/src/modules/email-deliveries.ts`
- **Reproducer & Regression Test**: `apps/desktop/src/main/ipc/delivery-ledger-authoritative.test.ts` (Sends test email via API, invokes `email-deliveries:list` IPC, asserts delivery record is immediately returned with status `SENT`).
- **Atomic Commit**: `fix(outreach): connect delivery ledger directly to authoritative mongodb api store`

---

### WP18 — Reply Ingestion & Tracking Reconciliation (P2)
- **Objective**: Ensure incoming Gmail replies update contact status to `REPLIED` and trigger sequence stop conditions.
- **Target Changes**:
  1. In `apps/desktop/src/main/workers/plugins/automation.ts`, ensure sequence execution loop checks contact status and halts when `status === 'REPLIED'`.
  2. Verify IMAP/Gmail reply polling worker updates MongoDB `ContactModel` and emits `crm:updated` event.
- **Affected Files**:
  - `apps/desktop/src/main/workers/plugins/automation.ts`
  - `apps/api/src/services/outreach/reply-tracker.service.ts`
- **Reproducer & Regression Test**: `apps/desktop/src/main/workers/reply-stop-condition.test.ts` (Sets contact status to `REPLIED` during active sequence; asserts sequence execution halts immediately with `status_replied`).
- **Atomic Commit**: `fix(automation): enforce sequence stop condition upon reply ingestion`

---

### WP19 — Automation Event Semantics & Payload Metadata (P1)
- **Objective**: Include rich job metadata in scheduler completion events so automation triggers evaluate with valid entity IDs and job types.
- **Target Changes**:
  1. In `apps/desktop/src/main/services/scheduler.ts:499`, update event emission:
     ```typescript
     this.eventBus.publish('job:completed', {
       jobId,
       jobType: job.type,
       entityId: job.payload?.entityId || job.payload?.companyId || job.payload?.contactId || '',
       entityType: job.payload?.entityType || (job.payload?.companyId ? 'company' : job.payload?.contactId ? 'contact' : ''),
       result
     });
     ```
  2. In `apps/desktop/src/main/services/automation-trigger.ts`, evaluate triggers using valid `jobType` and `entityId`.
- **Affected Files**:
  - `apps/desktop/src/main/services/scheduler.ts`
  - `apps/desktop/src/main/services/automation-trigger.ts`
- **Reproducer & Regression Test**: `apps/desktop/src/main/services/automation-event-payload.test.ts` (Completes a Maps scraper job in scheduler; asserts `AutomationTriggerEvaluator` receives `DISCOVERY_FINISHED` with the actual `entityId` and executes matching automation sequence).
- **Atomic Commit**: `fix(automation): include rich job metadata in completion events for accurate trigger evaluation`

---

### WP20 — Scheduler Adaptive Polling & Concurrent Worker Resilience (P2)
- **Objective**: Implement adaptive polling to eliminate idle network overhead while maintaining sub-50ms job startup latency and multi-worker crash resilience.
- **Target Architecture**:
  - **Correctness Mechanism**: MongoDB atomic claim (`findOneAndUpdate` with worker lease).
  - **Fast-Path Optimization**: Immediate local tick trigger (`scheduler.triggerTick()`) upon job enqueue.
  - **Adaptive Safety Net**: Poll every 10s when idle, accelerating to 2s when workers are active.
  - **Crash Resilience**: Per-job heartbeat watchdog (10s ping, 30s timeout) and startup lease recovery.
- **Affected Files**:
  - `apps/desktop/src/main/services/scheduler.ts`
  - `apps/desktop/src/main/ipc/scheduler.ts`
- **Reproducer & Regression Test**: `apps/desktop/src/main/services/scheduler-adaptive-resilience.test.ts` (Tests idle backoff, immediate tick dispatch on job enqueue, worker crash recovery, and multi-client lease safety).
- **Atomic Commit**: `fix(scheduler): implement adaptive polling and resilient worker concurrency control`

---

### WP21 — System Engine Startup & Runtime Lifecycle (P1)
- **Objective**: Ensure the `WorkspaceRuntime` ("System Engine") starts automatically upon clean boot and synchronizes its state with the `InfraStatusPanel` UI.
- **Target Changes**:
  1. In `apps/desktop/src/main/index.ts` and `WorkspaceManager`, ensure `setActiveWorkspace(workspaceId)` starts the `WorkspaceRuntime` automatically on cold launch.
  2. In `InfraStatusPanel.tsx`, reflect live subsystem states (`Scheduler`, `CacheHydrator`, `AutomationEvaluator`, `WorkerPool`).
  3. Ensure "Start Engine" / "Stop Engine" cleanly starts and stops background subsystems.
- **Affected Files**:
  - `apps/desktop/src/main/services/workspace-runtime.ts`
  - `apps/desktop/src/main/services/workspace-manager.ts`
  - `apps/desktop/src/renderer/components/dashboard/InfraStatusPanel.tsx`
- **Reproducer & Regression Test**: `apps/desktop/src/main/services/system-engine-lifecycle.test.ts` (Verifies automatic engine startup on cold boot, clean shutdown on stop, and accurate telemetry reporting).
- **Atomic Commit**: `fix(runtime): guarantee automatic system engine startup and synchronize telemetry controls`

---

### WP22 — UI Quality, React Key Warnings & Error States Cleanup (P2)
- **Objective**: Eliminate React console runtime warnings (`Each child in a list should have a unique key`) and harden loading, empty, and error states.
- **Target Changes**:
  1. Audit and assign stable, unique key props across Discovery results table, Campaigns enrollment table, Activity Feed, and Settings accounts list.
  2. Implement consistent error boundary fallbacks and empty state banners across all screens.
- **Affected Files**:
  - `apps/desktop/src/renderer/screens/*`
  - `apps/desktop/src/renderer/components/*`
- **Reproducer & Regression Test**: `apps/desktop/src/renderer/components/ui-quality.test.tsx` (Renders all core screens with empty, loading, and populated data; asserts zero React key warnings).
- **Atomic Commit**: `fix(ui): eliminate react key warnings and harden screen loading and error states`

---

### WP23 — Real Electron E2E Qualification & Lifecycle Testing (P0)
- **Objective**: Execute end-to-end integration tests simulating real user workflows in a clean Electron runtime environment.
- **Test Matrix**:
  1. Clean AppData cold boot → Zero SQLite errors.
  2. Discovery run creation → Maps scraping → 5 companies created.
  3. Discovery UI reconciliation → All 5 companies displayed in UI.
  4. Auto-chained crawler → Phone normalization to E.164 → Contacts saved with `PARTIAL_SUCCESS`/`SUCCESS`.
  5. Intelligence enrichment → Upsert without 409 CONFLICT.
  6. Gmail OAuth connect → Immediate sender dropdown appearance.
  7. Google Drive attachment upload → Durable `fileId` persistence.
  8. Campaign send → Template variable resolution (`{{contact.firstName}}` + `{{company.name}}`) + Drive attachment delivery → Gmail dispatch.
  9. Delivery ledger verification → Immediate appearance with status `SENT`.
- **Reproducer & Regression Test**: `apps/desktop/src/main/services/e2e-recovery-qualification.test.ts`.
- **Atomic Commit**: `test(e2e): implement comprehensive end-to-end functional qualification suite`

---

### WP24 — Final Product Reliability Gate & Zero-Regression Certification (P0)
- **Objective**: Final release verification gate ensuring zero remaining local-first authority violations, zero schema errors, 100% build cleanliness, and green test suite.
- **Execution**: Run full test suite, bundle verification, and generate final Phase 17 verification report.
- **Atomic Commit**: `chore(release): certify functional recovery and product reliability for phase 17`

---

## 4. Adjusted Severity Matrix

| Severity Level | Scope & Definition | Work Packages Included |
|---|---|---|
| **P0 (Critical Runtime Blockers)** | Failures that crash clean installs, lose outbound delivery data, corrupt attachments, or fail variable interpolation. | **WP1** (DB Init), **WP8** (Discovery 5→1 Fix), **WP12** (Template Context), **WP14** (Drive Storage), **WP15** (Drive Delivery), **WP16** (Send State Machine), **WP17** (Delivery Ledger), **WP23** (E2E Qualification), **WP24** (Final Gate) |
| **P1 (Core Functional Integrity)** | Failures that misrepresent domain hierarchies, reject valid data, trigger false conflict errors, or stall workflows. | **WP3** (Contracts), **WP4** (Workspace State), **WP5** (Dashboard), **WP6** (CRM), **WP7** (Discovery Model), **WP9** (Crawler Persistence), **WP10** (Intel Upsert), **WP11** (Campaign States), **WP13** (Sender Invalidation), **WP19** (Automation Payloads), **WP21** (System Engine Lifecycle) |
| **P2 (Orchestration & Hygiene)** | Optimizations, resilience guards, legacy audit, and UI warning cleanup. | **WP2** (Local-First Audit), **WP18** (Reply Ingestion), **WP20** (Adaptive Polling), **WP22** (React Warnings) |
| **P3 (Cosmetic & Polish)** | UI terminology alignment and label consistency. | Terminology polish within WP5/WP22 |

---

## 5. Verification Protocol & Execution Rules

1. **Test-Driven First**: For each work package, write the reproducer test first, verify failure (RED), apply the minimal corrective implementation, and verify pass (GREEN).
2. **Authoritative State Preservation**: SQLite must NEVER be made authoritative for business state or delivery ledgers. MongoDB is the single source of truth.
3. **No Production Code Changes Until Plan Approval**: Full adherence to the approved 24 work packages.
