# LeadForge OS — Final Implementation Roadmap

## 1. Purpose & How an Engineer Uses This Blueprint

This document is the **authoritative operational blueprint** for executing the migration of LeadForge OS from Local-First SQLite + SyncEngine to MongoDB-First Architecture.

An engineer or autonomous coding agent can execute this plan **phase-by-phase**. Each phase contains:
* **Objective**
* **Exact files to touch**
* **Preconditions**
* **Step-by-step actions**
* **Verification tests required**
* **Exit criteria to advance**

---

## 2. Definitive Phase Dependency Graph

```text
  Phase 1: Canonical Identity & Shared Schemas
     │
     ▼
  Phase 2: MongoDB Model Expansion (15 New Mongoose Models + Existing Hardening)
     │
     ├─► Phase 2.5: Existing MongoDB ObjectId -> String Conversion
     │
     ▼
  Phase 3: API Persistence Boundary, Repositories & Batch Endpoints
     │
     ▼
  Phase 4: SQLite-to-MongoDB Existing Data Migration & Audit Gate
     │
     ▼
  Phase 5: Desktop UI API-First Write Path (IPC Redirection)
     │
     ▼
  Phase 6: Disposable SQLite Cache Engine (`initCacheSchema` & `CacheHydrator`)
     │
     ▼
  Phase 7: Worker Persistence Migration (Scraper, Crawler, Outreach -> SdkClient)
     │
     ▼
  Phase 8: Distributed Job Scheduler & Concurrency Locks in MongoDB
     │
     ▼
  Phase 9: Google Drive Attachment Architecture & Shared Google Auth
     │
     ▼
  Phase 10: Email Sending Safety & Delivery Ledger Integration
     │
     ▼
  ═════════════════════════════════════════════════════════════════════════════
  GATE: VERIFY 0 PENDING WRITES IN `sync_queue` ACROSS ALL RUNTIMES
  ═════════════════════════════════════════════════════════════════════════════
     │
     ▼
  Phase 11: Permanent Removal of SyncEngine & Sync Tables
     │
     ▼
  Phase 12: Permanent Removal of Legacy SQLite Migration Runner (`runner.ts`)
     │
     ▼
  Phase 13: Production Data Verification & Cutover
     │
     ▼
  Phase 14: Post-Cutover Code Cleanup & Deprecation Removal
     │
     ▼
  Phase 15: Full Regression Qualification & Release Gate Sign-Off
```

---

## 3. Detailed Phase-by-Phase Execution Guide

---

### PHASE 1: Canonical Identity & Shared Schemas
* **Objective:** Establish the string-only ID standard and universal ID generator across `packages/schema`.
* **Exact Files Touched:**
  - `packages/schema/src/common/identity.ts` (`CREATE`)
  - `packages/schema/src/fields/common.ts` (`MODIFY`)
  - `packages/schema/src/entities/*.ts` (`MODIFY`)
  - `packages/schema/src/entities/job.ts` (`CREATE`)
  - `packages/schema/src/entities/intelligence.ts` (`CREATE`)
  - `packages/schema/src/entities/delivery.ts` (`CREATE`)
  - `packages/schema/src/entities/lock.ts` (`CREATE`)
* **Preconditions:** Monorepo builds cleanly (`turbo run build`).
* **Step-by-Step Actions:**
  1. Implement `generateEntityId(): string` using native `crypto.randomUUID()` in `identity.ts`.
  2. In `fields/common.ts`, export `entityIdField = z.string().min(1).max(128)` and deprecate `objectIdField`.
  3. Update all entity schemas (`company.ts`, `contact.ts`, etc.) to enforce `id: entityIdField`.
  4. Create new Zod schemas for `Job`, `SystemLog`, `AutomationLock`, `Intelligence`, and `EmailDelivery`.
* **Verification Tests:** Unit tests in `packages/schema`: verify schemas accept UUID strings and reject non-string IDs.
* **Exit Criteria:** `pnpm --filter @leadforge/schema build` succeeds with zero TypeScript errors.

---

### PHASE 2: MongoDB Model Expansion & Hardening
* **Objective:** Create the 15 missing operational Mongoose models in `apps/api` and harden all existing 18 models to enforce string-only `_id`.
* **Exact Files Touched:**
  - `apps/api/src/db/models/job.model.ts` through `email-delivery.model.ts` (15 files, `CREATE`)
  - `apps/api/src/db/models/company.model.ts`, `contact.model.ts`, etc. (`MODIFY`)
  - `apps/api/src/repositories/base/base.repository.ts` (`MODIFY`)
* **Preconditions:** Phase 1 complete.
* **Step-by-Step Actions:**
  1. Implement 15 new Mongoose models matching `26-mongodb-schema-implementation-plan.md`.
  2. Enforce `_id: { type: String, required: true }` and `{ _id: false }` across all 33 schemas.
  3. In `base.repository.ts`, enforce `payload._id = payload.id` on creation; throw if ID missing.
  4. Configure TTL index on `systemlogs` (14 days) and `automationlocks` (0s lease expiry).
* **Verification Tests:** Run Mongoose schema validation tests; assert zero models generate default ObjectId.
* **Exit Criteria:** All 33 models successfully register with Mongoose.

---

### PHASE 2.5: Existing MongoDB ObjectId -> String Conversion
* **Objective:** Convert any legacy documents in existing MongoDB collections that hold BSON `ObjectId` into canonical BSON `String`.
* **Exact Files Touched:**
  - `scripts/migrate-mongo-objectids-to-strings.ts` (`CREATE`)
* **Preconditions:** Phase 2 complete.
* **Step-by-Step Actions:**
  1. Run audit query: `db.collection.countDocuments({ _id: { $type: "objectId" } })`.
  2. For matching documents, execute clone-and-swap recreating documents with `_id = oid.toString()`.
  3. Update child foreign keys referencing the old ObjectId to reference the string.
  4. Delete original documents holding ObjectId.
* **Verification Tests:** Run automated assertion: `countDocuments({ _id: { $type: "objectId" } }) === 0` across all collections.
* **Exit Criteria:** 0 ObjectId documents remain anywhere in MongoDB.

---

### PHASE 3: API Repositories, Services & Batch Endpoints
* **Objective:** Establish the API persistence boundary for all 33 entities and introduce high-throughput batch APIs.
* **Exact Files Touched:**
  - `apps/api/src/routes/jobs.ts`, `intelligence.ts`, `locks.ts`, `deliveries.ts` (`CREATE`)
  - `apps/api/src/routes/batch.ts` (`CREATE` — implements `POST /bulk` endpoints)
  - `apps/api/src/routes/index.ts` (`MODIFY` — mount new route groups)
  - `packages/sdk/src/modules/jobs.ts`, `locks.ts`, `intelligence.ts`, `deliveries.ts` (`CREATE`)
  - `packages/sdk/src/modules/companies.ts`, `contacts.ts` (`MODIFY` — add `createBulk`)
  - `packages/sdk/src/client/index.ts` (`MODIFY` — register new modules)
* **Preconditions:** Phase 2 & 2.5 complete.
* **Step-by-Step Actions:**
  1. Implement REST routes with Hono OpenAPI & Zod validation.
  2. Implement Batch API endpoints using `bulkWrite()` with `{ ordered: false }`.
  3. Implement `LockService` using atomic `findOneAndUpdate` with lease expiration.
  4. Implement new modules in `packages/sdk` and expose on `SdkClient`.
* **Verification Tests:** Suite T3 (API Durability) and Suite T6 (Batch Throughput).
* **Exit Criteria:** All endpoints return 200/201 and persist string `_id` documents in MongoDB.

---

### PHASE 4: SQLite-to-MongoDB Existing Data Migration
* **Objective:** Safely extract and reconcile legacy records from existing `.db` files into MongoDB with zero data loss.
* **Exact Files Touched:**
  - `scripts/migrate-sqlite-to-mongo.ts` (`CREATE`)
* **Preconditions:** Phase 3 complete; verified backup taken (`.migration-backup.bak`).
* **Step-by-Step Actions:**
  1. Execute dry run: `npx tsx scripts/migrate-sqlite-to-mongo.ts --dry-run`.
  2. Review dry-run report for conflicts or unparseable rows.
  3. Execute migration: upsert SQLite records into MongoDB preserving `_id = sqlite.id`.
  4. Write `migration-diagnostics.json` and `migration_quarantine.json`.
* **Verification Tests:** Suite T10: Count verification `count(Mongo._id) >= count(SQLite.id)`.
* **Exit Criteria:** All migratable SQLite rows safely reside in MongoDB.

---

### PHASE 5: Desktop UI API-First Write Path (IPC Redirection)
* **Objective:** Redirect desktop IPC handlers to write to the API via `SdkClient`, updating SQLite cache on success.
* **Exact Files Touched:**
  - `apps/desktop/src/main/ipc/crm.ts` (`REWRITE`)
  - `apps/desktop/src/main/ipc/campaigns-ipc.ts` (`REWRITE`)
  - `apps/desktop/src/main/ipc/audiences-ipc.ts` (`REWRITE`)
  - `apps/desktop/src/main/ipc/automation.ts` (`REWRITE`)
* **Preconditions:** Phase 4 complete.
* **Step-by-Step Actions:**
  1. Replace `LocalCRMRepository.save()` in IPC handlers with `await sdk.<entity>.create()`.
  2. On API success, call `LocalCRMRepository.saveCache(table, res.data)`.
  3. If API call fails or device is offline, reject IPC call with clear error message; do NOT write to local SQLite.
* **Verification Tests:** Suite T6 (Offline Write Protection).
* **Exit Criteria:** UI mutations persist directly to MongoDB via API; zero items added to `sync_queue`.

---

### PHASE 6: Disposable SQLite Cache Architecture
* **Objective:** Demote SQLite to disposable materialized read-cache and implement `initCacheSchema`.
* **Exact Files Touched:**
  - `apps/desktop/src/main/database/initCacheSchema.ts` (`CREATE`)
  - `apps/desktop/src/main/services/cache-hydrator.ts` (`REWRITE`)
  - `apps/desktop/src/main/database/repositories/local-crm.ts` (`REWRITE`)
  - `apps/desktop/src/main/lib/workspace-runtime.ts` (`MODIFY`)
* **Preconditions:** Phase 5 complete.
* **Step-by-Step Actions:**
  1. Implement `initCacheSchema(db)` creating clean empty tables for the 12 cached entities.
  2. Rewrite `CacheHydrator` to stream records from API into SQLite using `INSERT OR REPLACE`.
  3. Remove dirty sync tracking and conflict resolution in `LocalCRMRepository`.
* **Verification Tests:** Suite T2 (Disposable Cache Destruction): Delete `.db` file, reboot app, assert 100% data restored.
* **Exit Criteria:** Deleting `.db` file causes zero data loss.

---

### PHASE 7: Worker Persistence Migration
* **Objective:** Remove `better-sqlite3` from all worker plugins; persist results via `SdkClient`.
* **Exact Files Touched:**
  - `apps/desktop/src/main/workers/plugins/scraper.ts` (`REWRITE`)
  - `apps/desktop/src/main/workers/plugins/crawler.ts` (`REWRITE`)
  - `apps/desktop/src/main/workers/plugins/enricher.ts` (`REWRITE`)
  - `apps/desktop/src/main/workers/plugins/outreach.ts` (`REWRITE`)
  - `apps/desktop/src/main/workers/plugins/linkedin.ts` (`REWRITE`)
  - `apps/desktop/src/main/workers/plugins/intelligence-worker.ts` (`REWRITE`)
* **Preconditions:** Phase 3 and Phase 6 complete.
* **Step-by-Step Actions:**
  1. Remove `import Database from 'better-sqlite3'` across all worker plugins.
  2. Implement in-memory buffering (e.g. 50 items) and flush via `sdk.<entity>.createBulk()`.
  3. Pre-generate entity UUIDs locally so child foreign keys resolve before transmission.
* **Verification Tests:** Suite T4 (Worker Persistence): Run scraper, assert records commit in MongoDB without opening SQLite.
* **Exit Criteria:** Zero SQLite connections opened by background worker threads.

---

### PHASE 8: Distributed Job Scheduler & Concurrency Locks in MongoDB
* **Objective:** Move scheduler state and automation locks from SQLite to MongoDB.
* **Exact Files Touched:**
  - `apps/desktop/src/main/services/scheduler.ts` (`REWRITE`)
  - `apps/desktop/src/main/workers/plugins/automation.ts` (`REWRITE`)
* **Preconditions:** Phase 7 complete.
* **Step-by-Step Actions:**
  1. Refactor `JobScheduler` to poll `sdk.jobs.list({ status: 'queued' })` instead of SQLite `jobs`.
  2. Replace local `automation_locks` queries with `sdk.locks.acquire()` and `sdk.locks.release()`.
  3. Implement worker progress checkpointing via `sdk.jobs.saveCheckpoint()`.
* **Verification Tests:** Suite T5 (Worker Crash & Resume): Kill worker process mid-execution; assert state survives in MongoDB.
* **Exit Criteria:** Scheduler and locks operate 100% via MongoDB.

---

### PHASE 9: Google Drive Attachment Architecture & Shared Auth
* **Objective:** Establish Google Drive as permanent binary store and decouple Google authentication.
* **Exact Files Touched:**
  - `apps/api/src/services/google/auth.service.ts` (`CREATE`)
  - `apps/api/src/services/google/drive.provider.ts` (`CREATE`)
  - `apps/api/src/routes/templates.ts` (`MODIFY` — add attachment upload endpoint)
* **Preconditions:** Phase 2 complete.
* **Step-by-Step Actions:**
  1. Implement `GoogleAuthService` handling OAuth token refresh for Gmail and Drive.
  2. Implement `GoogleDriveProvider` handling multipart uploads and stream downloads by `fileId`.
  3. Add `POST /templates/attachments` endpoint uploading binary to Drive and returning metadata.
* **Verification Tests:** Suite T7: Upload file, assert binary stored in Drive and metadata in MongoDB.
* **Exit Criteria:** Binary attachments independent of local desktop disk.

---

### PHASE 10: Email Sending Safety & Delivery Ledger Integration
* **Objective:** Wire Google Drive download and MIME composition into email dispatch with strict idempotency.
* **Exact Files Touched:**
  - `apps/api/src/services/email/providers/gmail-provider.ts` (`MODIFY`)
  - `apps/api/src/services/email/send.service.ts` (`MODIFY`)
  - `apps/desktop/src/main/workers/plugins/outreach.ts` (`MODIFY`)
* **Preconditions:** Phase 9 complete.
* **Step-by-Step Actions:**
  1. In `send.service.ts`, record delivery attempt in `emaildeliveries` with `status: 'SENDING'`.
  2. Download attachments from Google Drive via `GoogleDriveProvider`.
  3. Construct RFC 2822 MIME message and transmit via Gmail API or SMTP.
  4. Update delivery status to `'SENT'` with `providerMessageId`.
* **Verification Tests:** Suite T7: Full send with attachment; verify ledger in MongoDB and duplicate rejection.
* **Exit Criteria:** Outbound emails deliver attachments safely with complete audit ledger.

---

### PHASE 11: Permanent Removal of SyncEngine & Sync Tables
* **Objective:** Purge all legacy local-first sync infrastructure from the desktop codebase.
* **Exact Files Touched:**
  - `apps/desktop/src/main/services/sync-engine.ts` (`DELETE`)
  - `apps/desktop/src/main/lib/workspace-runtime.ts` (`MODIFY`)
  - `apps/desktop/src/main/database/repositories/local-crm.ts` (`MODIFY`)
* **Preconditions:** Phases 5, 7, and 8 complete; audit verifies 0 writes to `sync_queue`.
* **Step-by-Step Actions:**
  1. Unbind `SyncEngine` from `WorkspaceRuntime`.
  2. Delete `sync-engine.ts`.
  3. Remove all sync queue statements from `LocalCRMRepository`.
* **Verification Tests:** Suite T8: Codebase grep confirms zero occurrences of `sync_queue` or `SyncEngine`.
* **Exit Criteria:** SyncEngine completely eradicated.

---

### PHASE 12: Permanent Removal of Legacy SQLite Migration Runner
* **Objective:** Retire `runner.ts` and switch connection boot to `initCacheSchema`.
* **Exact Files Touched:**
  - `apps/desktop/src/main/database/runner.ts` (`DELETE`)
  - `apps/desktop/src/main/database/connection.ts` (`MODIFY`)
* **Preconditions:** Phase 6 and Phase 11 complete.
* **Step-by-Step Actions:**
  1. In `connection.ts`, replace `runMigrations` with `initCacheSchema`.
  2. Delete `runner.ts`.
* **Verification Tests:** Start desktop with fresh workspace ID; assert database initializes in < 10ms.
* **Exit Criteria:** Clean single-step cache bootstrap active.

---

### PHASE 13: Production Data Verification & Cutover
* **Objective:** Execute production cutover per `38-cutover-and-rollback-plan.md`.
* **Preconditions:** All automated tests T1–T11 pass 100%.
* **Actions:** Run cutover script, verify MongoDB counts, deploy Vercel API and desktop release build.
* **Exit Criteria:** Production deployment active on MongoDB-First architecture.

---

### PHASE 14: Post-Cutover Cleanup & Deprecation Removal
* **Objective:** Remove temporary migration flags, deprecated helper functions, and diagnostic logs.
* **Exit Criteria:** Repository is clean and streamlined.

---

### PHASE 15: Full Regression Qualification & Release Gate Sign-Off
* **Objective:** Comprehensive end-to-end regression qualification across all business workflows.
* **Exit Criteria:** Final Release Gate passed with zero known regressions.

---

## 4. Key Questions Answered for the Implementing Engineer

```text
┌───────────────────────────────────────────────────┬────────────────────────────────────────────────────────────┐
│ Engineering Question                              │ Authoritative Answer                                       │
├───────────────────────────────────────────────────┼────────────────────────────────────────────────────────────┤
│ **What do I implement first?**                    │ Phase 1: `generateEntityId()` in `packages/schema`.        │
├───────────────────────────────────────────────────┼────────────────────────────────────────────────────────────┤
│ **What exact files do I touch?**                  │ Consult `39-file-change-manifest.md` for exact paths.      │
├───────────────────────────────────────────────────┼────────────────────────────────────────────────────────────┤
│ **When do we migrate existing data?**             │ Phase 4 (after API models exist, before UI switches writes)│
├───────────────────────────────────────────────────┼────────────────────────────────────────────────────────────┤
│ **When do we switch app to Mongo authority?**     │ Phase 5 (Desktop UI IPC handlers redirect to SdkClient).   │
├───────────────────────────────────────────────────┼────────────────────────────────────────────────────────────┤
│ **When do workers stop using SQLite?**            │ Phase 7 (Worker plugins refactored to SdkClient batch).    │
├───────────────────────────────────────────────────┼────────────────────────────────────────────────────────────┤
│ **When do we remove SyncEngine?**                 │ Phase 11 (after all UI, workers, and scheduler migrate).   │
├───────────────────────────────────────────────────┼────────────────────────────────────────────────────────────┤
│ **When do we replace runner.ts?**                 │ Phase 12 (switched to `initCacheSchema(db)`).              │
├───────────────────────────────────────────────────┼────────────────────────────────────────────────────────────┤
│ **How do we verify zero data loss?**              │ Suite T10 count check + Suite T2 cache destruction test.   │
└───────────────────────────────────────────────────┴────────────────────────────────────────────────────────────┘
```
