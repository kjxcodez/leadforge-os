# LeadForge OS — Target Cache Architecture

## 1. Executive Summary & Rules
SQLite in LeadForge OS is strictly a **disposable materialized projection / performance cache**.

### Fundamental Cache Invariants
1. Deleting the local `.db` file MUST NOT result in any data loss.
2. The SQLite database schema is initialized directly at application boot from a clean cache specification.
3. No synchronization queues (`sync_queue`), conflict resolution engines, or tombstone records exist inside SQLite.

---

## 2. Target Cache Lifecycle & Boot Flow

```text
Electron Desktop Application Boot
               ↓
Initialize SQLite File Connection (`leadforge_<workspaceId>.db`)
               ↓
Execute `initCacheSchema(db)` (Creates cache tables & indexes if missing)
               ↓
Construct SdkClient & connect to API
               ↓
Execute `CacheHydrator.hydrateWorkspaceCache(workspaceId, sdk)`
               ↓
Fetch canonical records from MongoDB via API
               ↓
Bulk insert records into local SQLite cache tables
               ↓
Application ready for synchronous UI queries
```

---

## 3. Cache Eviction, Invalidation & Rebuild Strategies

### 3.1 On-Demand Rebuild
If a user triggers "Reset Local Cache" or if the SQLite file is corrupted:
1. SQLite connection is closed and the `.db` file is deleted from disk.
2. A new empty `.db` file is opened.
3. `initCacheSchema(db)` creates clean cache tables.
4. `CacheHydrator.hydrateWorkspaceCache()` re-populates all tables from MongoDB in under 2 seconds.

### 3.2 Selective Table Invalidation
When specific entities are updated (e.g. `contacts:update` or `campaigns:create`):
* The API response returns the updated document.
* `LocalCRMRepository.save(table, record, true)` replaces the specific row in SQLite.
* No full cache refresh is required for single-row mutations.
