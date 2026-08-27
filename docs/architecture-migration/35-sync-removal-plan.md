# LeadForge OS — Sync Engine Deprecation & Removal Plan

## 1. Executive Summary & Subsystem Inventory

Under the MongoDB-First architecture, the entire local-first asynchronous synchronization subsystem becomes completely obsolete.

### Components Marked for Permanent Elimination:
1. [`apps/desktop/src/main/services/sync-engine.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/sync-engine.ts): Background sync engine polling `sync_queue` every 5000ms.
2. SQLite Tables: `sync_queue`, `sync_metadata`, `sync_dead_letter`.
3. Column Flags: `syncStatus` (`'pending'` / `'synced'`) and `version` columns across all SQLite tables.
4. Dirty Tracking Logic: `LocalCRMRepository.save()` and `softDelete()` enqueueing logic.
5. Conflict Resolution: Last-Write-Wins (LWW) resolution and conflict suppression guards.

---

## 2. Ordered Deletion Dependency Graph

> [!CAUTION]
> Deleting `SyncEngine` before all write consumers (UI, IPC, Workers) have migrated to direct API persistence would cause silent data loss for any local write that still attempts to enqueue to `sync_queue`.

The phased deprecation must follow strict dependency prerequisites:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SYNC ENGINE RETIREMENT TIMELINE                       │
└─────────────────────────────────────────────────────────────────────────────┘

  Phase 4: Migrate Existing SQLite Data to MongoDB
  (Ensures all historical un-synced items are safely persisted in MongoDB)
        │
        ▼
  Phase 5: Desktop API-First Write Path Active
  (All IPC mutation handlers write to SdkClient -> API directly)
        │
        ▼
  Phase 7: Worker Persistence Active
  (Scraper, Crawler, Outreach write to SdkClient -> API directly)
        │
        ▼
  Phase 8: Job Scheduler & Locks Active
  (Scheduler and Locks write to MongoDB via API directly)
        │
        ▼
  ═══════════════════════════════════════════════════════════════════════════
  GATE: VERIFY ZERO WRITES TO `sync_queue` (Audit counter: count === 0)
  ═══════════════════════════════════════════════════════════════════════════
        │
        ▼
  Phase 11: Execute Sync Subsystem Deletion (Step-by-Step Below)
```

---

## 3. Step-by-Step Deletion Protocol (Phase 11)

### Step 11.1: Unbind `SyncEngine` from `WorkspaceRuntime`
* **File:** `apps/desktop/src/main/lib/workspace-runtime.ts`
* **Action:**
  - Remove `private syncEngine: SyncEngine | null = null;`.
  - Remove `this.syncEngine.start()` and `this.syncEngine.stop()`.
  - Delete import `import { SyncEngine } from '../services/sync-engine';`.

### Step 11.2: Remove Enqueue Logic in `LocalCRMRepository`
* **File:** `apps/desktop/src/main/database/repositories/local-crm.ts`
* **Action:**
  - Remove methods `enqueueSync()`, `markSynced()`, `getPendingSyncCount()`.
  - In `save()`, remove `INSERT INTO sync_queue ...`.
  - In `softDelete()`, remove sync queue staging.
  - Simplify `save()` to purely execute `INSERT OR REPLACE` into the local SQLite cache table.

### Step 11.3: Delete `sync-engine.ts` Source File
* **File:** `apps/desktop/src/main/services/sync-engine.ts`
* **Action:** Delete file permanently from the repository.

### Step 11.4: Purge Sync Tables from SQLite Cache Initializer
* **File:** `apps/desktop/src/main/database/initCacheSchema.ts` (successor to `runner.ts`)
* **Action:**
  - Omit creation of `sync_queue`, `sync_metadata`, and `sync_dead_letter`.
  - Omit `syncStatus` and `version` columns from cached business tables (`companies`, `contacts`, `campaigns`, etc.).

### Step 11.5: Remove Preload & IPC Sync Channels
* **Files:** `apps/desktop/src/main/ipc/crm.ts`, `apps/desktop/src/preload/index.ts`
* **Action:** Remove obsolete channels `sync:status`, `sync:trigger`, `sync:dead-letter:list`.

---

## 4. Verification Check for Safe Sync Removal

Before committing Phase 11, the automated test `scripts/verify-sync-removal.ts` runs against the codebase:
1. **Grep Assertion:** Asserts zero references to `sync_queue`, `sync_dead_letter`, or `SyncEngine` in `apps/desktop/src/`.
2. **Schema Assertion:** Verifies that freshly created SQLite cache files contain no sync tables.
3. **Runtime Assertion:** Dispatches 50 UI mutations and asserts that no timer polls or sync threads are spawned.
