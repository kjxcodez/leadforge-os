# LeadForge OS — Data Migration Strategy

## 1. Executive Summary
This document specifies how existing data stored across local SQLite databases (`leadforge_<workspaceId>.db`) will be safely extracted, transformed, deduplicated, and imported into MongoDB collections during the migration execution phase.

---

## 2. Pre-Migration Data Audit & Vulnerabilities Identified

During forensic analysis of existing local SQLite databases, the following data conditions were detected:

1. **Un-synced Local Edits:** Records where `syncStatus = 'pending'` exist in local SQLite databases that were never successfully pushed to MongoDB.
2. **UUID vs ObjectId Mismatches:** Local entities created in SQLite use UUID strings (`crypto.randomUUID()`), while MongoDB entities created directly on the server use 24-hex `ObjectId`.
3. **Broken Foreign Keys:** Contacts referencing `companyId` values that were deleted locally.
4. **Duplicate Email / Domain Records:** Contacts sharing emails across different local workspaces.

---

## 3. Phase-by-Phase Data Migration Flow

```text
Step 1: Database Freeze & Backup
        ↓
Create full file backups of all `leadforge_*.db` SQLite files
        ↓
Step 2: SQLite Local Data Extraction Tool (`scripts/migrate-sqlite-to-mongo.ts`)
        ↓
Read un-synced SQLite records (`syncStatus = 'pending'` or missing from Mongo)
        ↓
Step 3: Identity & Foreign Key Preservation
        Set `_id = sqlite_record.id` (preserves existing UUID strings)
        Set `workspaceId = sqlite_record.workspaceId`
        ↓
Step 4: Bulk Upsert into MongoDB via API / Mongoose
        Use `bulkWrite()` with `updateOne({ _id: item.id }, { $set: item }, { upsert: true })`
        ↓
Step 5: Verification & Reconciliation
        Count Mongo documents vs SQLite source documents per workspace
        ↓
Step 6: SQLite Cache Initialization
        Wipe old SQLite files and execute `CacheHydrator` to rehydrate fresh cache
```

---

## 4. Rollback & Recovery Considerations
* **Zero Source Data Loss:** The migration script ONLY reads from SQLite. Source `.db` files are backed up to `.migration-backup.bak` before execution and remain untouched.
* **Idempotent Re-execution:** The migration script uses `upsert: true` matching on `_id`. Re-running the script safely updates records without creating duplicates.
