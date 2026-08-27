# LeadForge OS — Master Architecture Migration Plan (MongoDB-First)

## A. Executive Summary

LeadForge OS is undergoing an architectural migration from a **Local-First (SQLite → Sync Engine → MongoDB)** architecture to a **MongoDB-First Architecture**.

### Key Decisions:
1. **MongoDB** is the single, authoritative source of truth for ALL business, operational, execution, and intelligence data.
2. **`apps/api`** is the canonical persistence boundary. Application UI and workers interact with MongoDB strictly via the API (`SdkClient`).
3. **SQLite** is demoted to a 100% disposable materialized read-cache for desktop UI performance. Wiping SQLite results in ZERO data loss.
4. **Identity Standard:** Absolute identity invariant (`MongoDB _id === API Entity ID === SQLite Cache ID`). Zero ID translation layer.

---

## B. Current Architecture

```text
CURRENT: Local-First Architecture

Desktop Application UI
        ↓
SQLite Database (Primary Authority for Writes)
        ↓
Sync Queue (`sync_queue` table)
        ↓
Sync Engine (`sync_engine.ts` background polling loop)
        ↓
SdkClient (HTTP REST calls)
        ↓
API Server (`apps/api`)
        ↓
MongoDB Instance
```

### Forensic Audit Findings:
* 30 active SQLite tables exist in desktop runtime.
* 18 Mongoose models exist in API server.
* **15 SQLite tables** (Jobs, System Logs, Intelligence Engine, Evidence, Email Deliveries, Audit Logs, Memory, Page Crawls) exist EXCLUSIVELY in SQLite with NO Mongo models in API server!
* Desktop UI and Workers write directly to local SQLite files (`leadforge_<workspaceId>.db`).

---

## C. Target Architecture

```text
TARGET: MongoDB-First Architecture

                    ┌──────────────────────────────────┐
                    │          MongoDB Server          │
                    │ SINGLE AUTHORITATIVE SOURCE OF   │
                    │              TRUTH               │
                    └────────────────┬─────────────────┘
                                     │
                                 Mongoose
                                     │
                    ┌────────────────┴─────────────────┐
                    │         Hono API Server          │
                    │ (Canonical Persistence Boundary) │
                    └────────────────┬─────────────────┘
                                     │
                             HTTP (SdkClient)
                                     │
              ┌──────────────────────┴──────────────────────┐
              │                                             │
   Electron Main Process                           Local Worker Threads
    (Desktop UI / IPC)                            (Playwright/Outreach)
              │                                             │
      Update Local Cache                            Update Local Cache
              │                                             │
              └──────────────────────┬──────────────────────┘
                                     │
                        ┌────────────▼────────────┐
                        │    SQLite Read-Cache    │
                        │    (Disposable Only)    │
                        └─────────────────────────┘
```

---

## D. Persistence Ownership

All 33 business and operational entities are owned authoritatively by MongoDB:

* **Core Entities:** Workspaces, Users, Companies, Contacts, Campaigns, Outreach Events, Email Accounts, Templates, Sequences, Executions, Logs, Discovery Runs, Audiences.
* **New Mongo Collections (Migrated from SQLite):** Jobs (`jobs`), System Logs (`systemlogs`), Company Intelligence (`companyintelligences`), Website Intelligence (`websiteintelligences`), Contact Intelligence (`contactintelligences`), Opportunity Scores (`opportunityscores`), Audit Logs (`auditlogs`), Workspace Memory (`workspacememories`), Page Crawls (`pagecrawls`), Intelligence Sources (`intelligencesources`), Intelligence Evidence (`intelligenceevidences`), Intelligence Claims (`intelligenceclaims`), Intelligence Inferences (`intelligenceinferences`), Email Deliveries (`emaildeliveries`), Automation Locks (`automationlocks`).

---

## E. Identity Strategy

* **Rule:** `MongoDB _id === API Entity ID === SQLite Cache ID`.
* No UUID-to-ObjectId translation layer.
* When Mongo documents are created, Mongo assigns `_id`. API returns `_id` to clients. Clients save `_id` as `id` in SQLite cache.
* Pre-existing SQLite UUID strings migrated to MongoDB are preserved as `_id` to prevent foreign key breakage.

---

## F. Cache Strategy

* SQLite database file (`leadforge_<workspaceId>.db`) contains ONLY disposable read-cache projections.
* `initCacheSchema(db)` initializes cache tables at application startup.
* `CacheHydrator.hydrateWorkspaceCache(workspaceId, sdk)` populates local SQLite cache asynchronously on startup or on-demand.
* Wiping or deleting SQLite cache rebuilds complete local state from MongoDB in under 2 seconds.

---

## G. Worker Strategy

* Workers remain local for browser automation, scraping, Playwright execution, and CPU-heavy analysis.
* Workers **MUST NOT** write directly to SQLite.
* Workers construct API DTOs and call `SdkClient` endpoints directly to persist job progress, crawl results, intelligence scores, and email deliveries into MongoDB.

---

## H. Sync Removal Strategy

The following legacy local-first sync components will be deleted:
1. `apps/desktop/src/main/services/sync-engine.ts`
2. SQLite tables: `sync_queue`, `sync_metadata`, `sync_dead_letter`.
3. `syncStatus` (`pending` / `synced`) column flags.
4. Dirty-state tracking and local-to-remote conflict resolution (LWW) mechanisms.

---

## I. Dependency-Ordered Migration Phases

```text
Phase 0: Forensic Audit & Discovery (COMPLETED - AUDIT ONLY)
Phase 1: Mongo Schema Expansion (Create 15 missing Mongoose models in API)
Phase 2: API Endpoint Expansion (Add REST endpoints for jobs, intelligence, worker logs, deliveries)
Phase 3: ID Strategy Standardisation (Enforce Mongo `_id` flow in BaseRepository & SdkClient)
Phase 4: SQLite Data Extraction & Migration to Mongo (`migrate-sqlite-to-mongo.ts`)
Phase 5: Worker Persistence Migration (Refactor worker plugins to use `SdkClient` -> API)
Phase 6: Disposable SQLite Cache Architecture (`initCacheSchema` & expanded `CacheHydrator`)
Phase 7: Synchronization Engine Removal (Delete `sync-engine.ts` and sync tables)
Phase 8: Attachments & Google Drive Integration (Drive binary upload + Mongo metadata + MIME)
Phase 9: End-to-End Verification & Release Qualification
```

---

## J. Data Migration

* Pre-migration script `scripts/migrate-sqlite-to-mongo.ts` scans all local `.db` files.
* Reads un-synced and local-only records (`jobs`, `intelligence`, `deliveries`, `audit_logs`).
* Upserts records into MongoDB matching `_id = sqlite_record.id`.
* Verifies document counts between SQLite source and MongoDB target.

---

## K. API Migration

* API endpoints created for `/jobs`, `/company-intelligence`, `/website-intelligence`, `/contact-intelligence`, `/opportunity-scores`, `/audit-logs`, `/workspace-memory`, `/page-crawls`, `/email-deliveries`, `/system-logs`.
* Middleware updated to scope all new endpoints by `workspaceId`.

---

## L. Worker Migration

* `scraper.ts`, `crawler.ts`, `enricher.ts`, `outreach.ts`, `intelligence-worker.ts`, and `automation.ts` refactored to issue `SdkClient` REST calls to API.
* Direct `better-sqlite3` queries inside worker plugins removed.

---

## M. Attachment Migration

* Template attachments stored as Google Drive files (`fileId`).
* MongoDB `EmailTemplate` stores metadata (`fileId`, `filename`, `mimeType`, `size`).
* At send time, API downloads binary stream from Google Drive, constructs MIME, and transmits via Gmail API or SMTP.

---

## N. Testing Plan

* Automated test suite `scripts/test-mongodb-migration.ts`:
  1. Identity invariant assertion (`_id === id`).
  2. SQLite cache deletion and rebuild test.
  3. API persistence durability test.
  4. Worker crash and resume recovery test.
  5. Attachment Google Drive send test.

---

## O. Rollback / Failure Strategy

* SQLite databases backed up to `.migration-backup.bak` before Phase 4.
* If Phase 4 fails, restore `.migration-backup.bak` files and abort migration without modifying MongoDB.

---

## P. Cleanup

* Post-migration cleanup removes legacy migration runner `runner.ts` (replaced by `initCacheSchema`), legacy sync tables, and `sync-engine.ts`.

---

## Q. Risk Summary

* **R-01 (Un-synced Local Edits):** Mitigated by Phase 4 data extraction script.
* **R-02 (ID Translation Break):** Mitigated by strict identity invariant enforcement (`_id === id`).
* **R-03 (Worker SQLite Coupling):** Mitigated by Phase 5 `SdkClient` refactoring.

---

## R. Unknowns Log

* **Google Drive Scope:** Centralized Service Account vs User OAuth (marked `UNKNOWN` - requires confirmation).
* **Offline UI Write Policy:** Product policy on offline write blocking (marked `UNKNOWN` - requires confirmation).
