# LeadForge OS — Sync Engine Forensic Audit

## 1. Executive Summary & Core Code References
The local-first synchronization subsystem consists of four primary modules:
* [`apps/desktop/src/main/services/sync-engine.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/sync-engine.ts): Background sync worker polling `sync_queue` every 5 seconds.
* [`apps/desktop/src/main/services/cache-hydrator.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/cache-hydrator.ts): Hydrates local SQLite from MongoDB API.
* [`apps/desktop/src/main/database/repositories/local-crm.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/repositories/local-crm.ts): Enqueues local mutations into `sync_queue` table during write operations.
* [`apps/desktop/src/main/lib/workspace-runtime.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/lib/workspace-runtime.ts): Boots and shuts down `SyncEngine` per active workspace.

---

## 2. Comprehensive Outbound Sync Lifecycle

```text
User UI Action / IPC Call
          ↓
LocalCRMRepository.save() / softDelete()
          ↓
Write to SQLite table (syncStatus = 'pending')
          ↓
Insert row into SQLite `sync_queue` table
          ↓
SyncEngine.tick() (Polls every 5s)
          ↓
Fetch items with retryCount < 5 ORDER BY createdAt ASC
          ↓
Resolve SdkClient module (sdk.companies, sdk.contacts, etc.)
          ↓
Execute REST call (CREATE / UPDATE / DELETE) to apps/api
          ├── SUCCESS ──> Delete row from `sync_queue` & update syncStatus = 'synced'
          └── FAILURE ──> Increment retryCount & log lastError
                                ↓
                        If retryCount >= 5: Move to `sync_dead_letter` table
```

---

## 3. Detailed Call Graph & Trigger Conditions

### 3.1 What Invokes Outbound Sync?
* Periodic `setInterval` timer ([`sync-engine.ts:69`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/sync-engine.ts#L69)) firing every **5000ms**.
* Direct IPC handlers in `crm.ts` attempt SDK calls directly, but fall back to staging in `sync_queue` when network issues occur ([`crm.ts:93`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/crm.ts#L93)).

### 3.2 Participating Entities
`sync_queue` handles mutations across 10 syncable tables ([`sync-engine.ts:13-29`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/sync-engine.ts#L13-L29)):
1. `companies`
2. `contacts`
3. `campaigns`
4. `sequences`
5. `sequence_executions`
6. `email_accounts`
7. `templates`
8. `discovery_runs`
9. `company_discovery_runs`
10. `audiences`

### 3.3 Dead-Letter & Poisoned Message Handling
* Max retries = **5** (`MAX_SYNC_RETRIES = 5`).
* Poisoned queue items are automatically moved in a transaction from `sync_queue` to `sync_dead_letter` ([`sync-engine.ts:154-179`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/sync-engine.ts#L154-L179)).

---

## 4. Inbound Remote Pull & Hydration (`CacheHydrator`)

* On `WorkspaceRuntime` boot, `CacheHydrator.hydrateWorkspaceCache()` is called ([`workspace-runtime.ts:138`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/lib/workspace-runtime.ts#L138)).
* `CacheHydrator` fetches remote lists via `sdk.<entity>.list()` and calls `LocalCRMRepository.saveMany(table, records, true)`.
* **Conflict Guard:** `LocalCRMRepository.saveMany` contains logic to prevent remote sync from overwriting local changes that are still pending sync ([`local-crm.ts:273-275`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/repositories/local-crm.ts#L273-L275)):
```typescript
if (existing.syncStatus === 'pending') {
  continue; // Skip overwrite from remote if local edits are queued
}
```

---

## 5. Components Obsolete Under MongoDB-First Architecture

In the target MongoDB-first architecture:
1. `SyncEngine` ([`sync-engine.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/sync-engine.ts)) becomes **completely obsolete**.
2. SQLite `sync_queue`, `sync_metadata`, and `sync_dead_letter` tables become **obsolete**.
3. `syncStatus` (`pending` / `synced`) column flags across all SQLite tables become **obsolete**.
4. Conflict resolution (LWW) and local mutation queues are **deleted**.
