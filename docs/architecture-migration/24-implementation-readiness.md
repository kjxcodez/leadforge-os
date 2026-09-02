# LeadForge OS — Implementation Readiness Assessment (MongoDB-First)

## 1. Executive Summary & Audit Baseline

Following the exhaustive forensic audit of the LeadForge OS monorepo (documented in `01-repository-inventory.md` through `23-master-migration-plan.md`), this document certifies the repository's readiness for migration from the legacy **Local-First (SQLite + SyncEngine)** architecture to the **MongoDB-First Architecture**.

### Purpose of this Phase
> [!IMPORTANT]
> **THIS PHASE IS STRICTLY ARCHITECTURAL PLANNING & SPECIFICATION.**
> Zero production application source files, API routes, database schemas, or worker runtimes are modified during this phase. All specifications herein are frozen contracts intended for phase-by-phase execution by engineering agents.

---

## 2. Locked Architectural Decisions

The following foundational decisions have been evaluated, forensic-tested, and permanently locked:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LOCKED ARCHITECTURAL INVARIANTS                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. MongoDB is the Sole Authoritative Datastore                              │
│    - SQLite is strictly a disposable, materialized read-cache for UI speed.  │
│    - No business mutations or execution states originate authoritatively in │
│      SQLite.                                                                │
│                                                                             │
│ 2. MongoDB `_id` Must Be String Only                                        │
│    - Every LeadForge MongoDB document uses `_id: string`.                   │
│    - BSON `ObjectId` is strictly prohibited for domain models.              │
│    - Mongoose schemas must explicitly define `_id: { type: String }`.       │
│                                                                             │
│ 3. Client-Side ID Generation Prior to Write                                 │
│    - IDs are generated via `crypto.randomUUID()` before HTTP transmission.  │
│    - Invariant: MongoDB `_id` === API `id` === SQLite cache `id`.           │
│    - Zero ID translation layers or surrogate key mapping.                   │
│                                                                             │
│ 4. API is the Canonical Persistence Boundary                                │
│    - Desktop Main and Local Workers persist strictly via SdkClient -> API.  │
│    - Direct `better-sqlite3` writes from workers for business state are     │
│      eliminated.                                                            │
│                                                                             │
│ 5. Serverless & Free-Tier Economic Operation                                │
│    - API is hosted on Vercel (Hono); MongoDB is free-tier Atlas.            │
│    - High-throughput operations use Batch APIs (`POST /bulk`).              │
│    - Distributed automation locks use MongoDB atomic operations (No Redis). │
│                                                                             │
│ 6. Google Drive Attachment Storage & Gmail Separation                       │
│    - Binary files live permanently in Google Drive.                         │
│    - MongoDB stores attachment metadata (`fileId`, `driveUrl`, `size`).     │
│    - Send-time MIME assembly downloads binary streams via Google Drive API. │
│                                                                             │
│ 7. Total Sync Subsystem Elimination                                         │
│    - `SyncEngine`, `sync_queue`, `sync_metadata`, `sync_dead_letter`, and    │
│      `syncStatus` dirty flags are completely deleted in dependency order.   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Architecture Transition Topology

### 3.1 Current Legacy Architecture (Local-First Split Authority)
```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                             CURRENT RUNTIME TOPOLOGY                        │
└─────────────────────────────────────────────────────────────────────────────┘
  Desktop React UI                       Local Workers (Scraper/Crawler/Enricher)
        │                                                  │
        ▼ (IPC)                                            ▼ (Direct SQLite write)
  Electron Main Process ──────────────────────────► SQLite Database
        │                                           (leadforge_<workspaceId>.db)
        ▼ (Write local first)                       - 30 Tables
  SQLite Database                                   - jobs, system_logs, intelligence
  (syncStatus = 'pending')                          - sync_queue, sync_dead_letter
        │
        ▼ (Every 5 seconds)
  SyncEngine Background Polling
        │
        ▼ (HTTP REST)
  apps/api (Hono)
        │
        ▼ (Mongoose ObjectId)
  MongoDB Server (18 Models Only — 15 SQLite Tables Missing!)
```

### 3.2 Target MongoDB-First Architecture
```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TARGET RUNTIME TOPOLOGY                        │
└─────────────────────────────────────────────────────────────────────────────┘
                               ┌─────────────────────────┐
                               │     MongoDB Server      │
                               │ SINGLE SOURCE OF TRUTH  │
                               │  (33 Mongoose Models)   │
                               │    (_id: String ONLY)   │
                               └────────────▲────────────┘
                                            │ Mongoose
                               ┌────────────┴────────────┐
                               │   apps/api (Hono/Vercel)│
                               │  Persistence Boundary   │
                               │  (Batch & Atomic Ops)   │
                               └────────────▲────────────┘
                                            │ HTTP (SdkClient)
                   ┌────────────────────────┴────────────────────────┐
                   │                                                 │
      ┌────────────┴────────────┐                       ┌────────────┴────────────┐
      │  Electron Main Process  │                       │  Local Worker Threads   │
      │   (Desktop UI / IPC)    │                       │  (Playwright / Scraper) │
      └────────────┬────────────┘                       └────────────┬────────────┘
                   │                                                 │
        Update Cache (Authoritative doc)                  Update Cache (Optional)
                   │                                                 │
                   └────────────────────────┬────────────────────────┘
                                            │
                               ┌────────────▼────────────┐
                               │    SQLite Read-Cache    │
                               │    (Disposable ONLY)    │
                               │  (leadforge_<ws>.db)    │
                               └─────────────────────────┘
```

---

## 4. Scope Boundaries & Change Manifest Summary

| Area | Current Count | Target Count | Net Change | Architectural Responsibility |
| :--- | :--- | :--- | :--- | :--- |
| **MongoDB Models** | 18 | 33 | +15 Models | Full durable coverage for all operational & intelligence data. |
| **API Endpoints** | ~25 | 48 (incl. 7 Batch APIs)| +23 Endpoints | Canonical persistence gatekeeper. |
| **Worker Plugins** | 8 | 8 (Refactored) | 0 (Rewritten) | Persistent writes rerouted from SQLite to SdkClient. |
| **SQLite Tables** | 30 | 12 (Cache only) | -18 Tables | Demoted to disposable UI read projection. |
| **Sync Components**| 4 modules | 0 | -4 Modules | Completely eliminated (SyncEngine, queues, dirty flags). |
| **Migration System**| 33 migrations | 1 Init Schema | Retired | Clean `initCacheSchema` replaces historical migrations. |

---

## 5. Pre-Implementation Verification Checklist

Before executing Phase 1, the following operational requirements must be satisfied:
- [x] Complete forensic inventory of all SQLite schemas and migrations (Completed in `04-sqlite-forensic-audit.md`).
- [x] Complete forensic inventory of all Mongoose models and plugins (Completed in `05-mongodb-forensic-audit.md`).
- [x] Identification of all 15 SQLite-only tables requiring MongoDB schemas (Completed in `03-persistence-inventory.md`).
- [x] Mapping of all worker persistence touchpoints (Completed in `08-workers-runtime-audit.md`).
- [x] Verification of Node.js `>=18` runtime supporting native `crypto.randomUUID()` across main and worker runtimes.
- [x] Verification of Hono + Mongoose compatibility on Vercel serverless deployment.
- [x] Definition of zero-data-loss SQLite-to-MongoDB reconciliation strategy.

---

## 6. Implementation Readiness Sign-Off

The forensic audit and architectural blueprints establish that the migration path is sound, well-bounded, and does not require speculative abstractions. The detailed implementation blueprints (`25` through `40`) provide exact specifications for every affected component.
