# LeadForge OS — Delete / Rewrite / Keep Code Matrix

## 1. Overview
This forensic classification outlines the exact disposition of files across the monorepo during the MongoDB-first migration phase.

---

## 2. Definitive Classification Matrix

### 2.1 DELETE (Code Obsolete Under MongoDB-First Architecture)

| File / Component Path | Purpose | Why Obsolete? | Deletion Prerequisites |
| :--- | :--- | :--- | :--- |
| [`apps/desktop/src/main/services/sync-engine.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/sync-engine.ts) | Local-first sync engine polling `sync_queue` | Target architecture has no local-to-remote sync queue | API persistence boundary active |
| SQLite tables: `sync_queue`, `sync_metadata`, `sync_dead_letter` | Queue & sync metadata storage | Replaced by direct Mongo API persistence | API persistence boundary active |
| `syncStatus` column logic in `LocalCRMRepository` | Dirty-state flag (`pending` vs `synced`) | SQLite is disposable read-cache only | Cache hydrator active |
| `LocalCRMRepository.softDelete()` dirty queue logic | Enqueues DELETE into `sync_queue` | Soft delete happens directly on MongoDB via API | API DELETE endpoint active |

---

### 2.2 REWRITE (Code Whose Purpose Remains but Implementation Must Change)

| File / Component Path | Current Implementation | Target Implementation | Reason for Rewrite |
| :--- | :--- | :--- | :--- |
| [`apps/desktop/src/main/services/cache-hydrator.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/cache-hydrator.ts) | Partial hydration of 9 business tables | Comprehensive hydration of ALL business tables from Mongo API into SQLite cache | Must support 100% disposable SQLite cache rebuild |
| [`apps/desktop/src/main/ipc/crm.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/crm.ts) | Tries SDK create, falls back to staging `sync_queue` in SQLite | Direct SDK API call to Mongo; updates local SQLite cache on success | Eliminates local-first write staging |
| [`apps/desktop/src/main/workers/plugins/scraper.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/scraper.ts) | Writes crawl results directly into local SQLite database | Issues REST requests via `SdkClient` to API (`POST /companies`) | Workers must persist results in Mongo via API |
| [`apps/desktop/src/main/workers/plugins/crawler.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/crawler.ts) | Writes HTML dumps into local SQLite `page_crawls` table | Issues REST request via `SdkClient` to API (`POST /page-crawls`) | Workers must persist results in Mongo via API |
| [`apps/desktop/src/main/workers/plugins/outreach.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/outreach.ts) | Writes deliveries directly to local `email_deliveries` SQLite table | Issues REST request via `SdkClient` to API (`POST /email-deliveries`) | Ledger must be backed by MongoDB |
| [`apps/desktop/src/main/services/scheduler.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/scheduler.ts) | Queries SQLite `jobs` table directly | Queries Mongo `/jobs` endpoint via `SdkClient` | Job queue state must be backed by MongoDB |
| [`apps/desktop/src/main/database/runner.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/runner.ts) | Authoritative DB schema migration runner | Disposable SQLite cache schema initializer (`initCacheSchema()`) | Migrations are replaced by cache schema boot |

---

### 2.3 KEEP (Code Remaining Intact or Requiring Minimal Adjustment)

| File / Component Path | Purpose | Why Kept? |
| :--- | :--- | :--- |
| [`apps/api/src/routes/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/index.ts) | API route mounting | Core server architecture matches target |
| [`apps/api/src/db/models/`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/db/models) | Existing 18 Mongoose models | Core schemas already match Mongo source of truth |
| [`packages/sdk/src/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/index.ts) | `SdkClient` library | API transport client between desktop/workers & API |
| [`packages/schema/src/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/schema/src/index.ts) | Zod domain schemas | Domain validation contracts |
| [`packages/workflow-engine/src/workflow-runner.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/workflow-engine/src/workflow-runner.ts) | Workflow execution runner | Execution DAG logic remains local |
