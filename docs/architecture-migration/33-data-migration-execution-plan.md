# LeadForge OS — Existing Data Migration Execution Plan

## 1. Executive Summary & Core Rules

This specification establishes the data reconciliation and migration procedure for transitioning existing SQLite databases (`leadforge_<workspaceId>.db`) to MongoDB.

### Absolute Principles:
1. **Separation of Concerns:** Code and architecture changes are executed in Phases 1–3 and 5–12. Data migration is a distinct operational pipeline executed in Phase 4.
2. **Preserve Legacy Identifiers:**
   ```text
   SQLite.id  ════════════════════►  MongoDB._id (Exact String Match)
   ```
   Legacy SQLite UUIDs are NEVER replaced with ObjectIds or regenerated. This preserves existing foreign key relationships (`contact.companyId`, `sequenceExecution.sequenceId`, etc.).
3. **Zero Silent Data Deletion:** Any record that cannot be automatically reconciled is quarantined in `migration_quarantine.json` for human review.
4. **Idempotent & Restartable:** The migration script can be run multiple times safely without creating duplicate documents or corrupting state.

---

## 2. Definitive Reconciliation Rules (Scenarios A – H)

```text
┌────┬────────────────────────────────────┬──────────┬────────────────────────────────────────────────────────┐
│ ID │ Scenario Condition                 │ Winner   │ Reconciliation & Preservation Behavior                 │
├────┼────────────────────────────────────┼──────────┼────────────────────────────────────────────────────────┤
│ **A**│ SQLite record exists;              │ SQLite   │ Migrated to MongoDB. Target `_id = sqlite.id`.         │
│    │ Mongo record is missing.           │          │ Inserted cleanly into MongoDB collection.              │
├────┼────────────────────────────────────┼──────────┼────────────────────────────────────────────────────────┤
│ **B**│ Mongo record exists;               │ MongoDB  │ Preserved in MongoDB. SQLite cache will rehydrate it   │
│    │ SQLite record is missing.          │          │ on next desktop startup.                               │
├────┼────────────────────────────────────┼──────────┼────────────────────────────────────────────────────────┤
│ **C**│ Both exist with SAME ID;           │ Last-    │ The record with the newer `updatedAt` timestamp wins.  │
│    │ Timestamps differ.                 │ Write    │ If SQLite has newer un-synced edits, Mongo is updated. │
├────┼────────────────────────────────────┼──────────┼────────────────────────────────────────────────────────┤
│ **D**│ Both exist with DIFFERENT IDs but  │ Merge &  │ MongoDB record preserved; SQLite record attributes     │
│    │ same unique key (e.g. same email). │ Remap    │ merged into Mongo. Foreign keys pointing to SQLite ID  │
│    │                                    │          │ are remapped to Mongo `_id`. Logged in audit.          │
├────┼────────────────────────────────────┼──────────┼────────────────────────────────────────────────────────┤
│ **E**│ SQLite record has pending sync     │ SQLite   │ Un-synced local edits take precedence. Pushed to Mongo │
│    │ (`syncStatus = 'pending'`).        │          │ and marked authoritative.                              │
├────┼────────────────────────────────────┼──────────┼────────────────────────────────────────────────────────┤
│ **F**│ Mongo record changed independently │ Newer    │ If Mongo `updatedAt > sqlite.updatedAt`, Mongo wins.   │
│    │ and SQLite is stale synced.        │ Mongo    │ Stale SQLite local row is discarded.                  │
├────┼────────────────────────────────────┼──────────┼────────────────────────────────────────────────────────┤
│ **G**│ Broken Foreign Key                 │ Partial  │ The record is migrated, but missing FK is set to null. │
│    │ (e.g. contact has invalid company) │ Quarant. │ Entry written to `migration_quarantine.json`.          │
├────┼────────────────────────────────────┼──────────┼────────────────────────────────────────────────────────┤
│ **H**│ Duplicate Logical Records          │ Canonical│ Oldest record kept as canonical; duplicates merged     │
│    │ (e.g. duplicate contact emails)    │ Dedupe   │ and logged in diagnostics.                             │
└────┴────────────────────────────────────┴──────────┴────────────────────────────────────────────────────────┘
```

---

## 3. The 9-Stage Migration Execution Lifecycle

```text
  Stage 1: Pre-Flight Safety Backup
  - Scan user data directory for all `leadforge_*.db` files.
  - Create verified snapshot: `leadforge_<ws>.db.migration-backup.bak`.
        │
        ▼
  Stage 2: Read-Only Extraction
  - Open SQLite database using read-only connection flag (`readonly: true`).
  - Extract all records across all 30 tables into structured JSON memory streams.
        │
        ▼
  Stage 3: Validation & Anomaly Detection
  - Verify schema conformance and JSON field parsability (`tags`, `notes`, `payload`).
  - Identify broken foreign keys and conflicting unique keys.
        │
        ▼
  Stage 4: Dry Run Simulation
  - Execute reconciliation logic without modifying MongoDB.
  - Output summary report: records to migrate, conflicts, quarantined items.
        │
        ▼
  Stage 5: Human Gate & Verification Check
  - Engineer inspects dry-run report. Approves execution.
        │
        ▼
  Stage 6: Target MongoDB Upsert & Transformation
  - Connect to MongoDB via Mongoose.
  - Execute batched upserts using `bulkWrite()` with exact `_id = sqlite.id`.
  - Process entities in dependency order:
    1. Workspaces -> 2. Users -> 3. Email Accounts -> 4. Templates ->
    5. Companies -> 6. Contacts -> 7. Campaigns -> 8. Sequences ->
    9. Jobs -> 10. Intelligence & Evidence -> 11. Email Deliveries.
        │
        ▼
  Stage 7: Post-Migration Integrity Verification
  - Count check: Assert `count(Mongo._id) >= count(SQLite.id)`.
  - Foreign key validation: Verify 100% of foreign keys resolve in MongoDB.
        │
        ▼
  Stage 8: Quarantine & Audit Log Emission
  - Write `migration-report-<timestamp>.json` and `migration_quarantine.json`.
        │
        ▼
  Stage 9: Cutover & Cache Schema Rebuild
  - Re-initialize SQLite file with clean `initCacheSchema()`.
  - Hydrate cache projections from MongoDB.
```

---

## 4. Migration Diagnostic Counters

The migration tooling outputs strict diagnostic metrics upon completion:

```typescript
export interface MigrationDiagnostics {
  workspaceId: string;
  startedAt: string;
  completedAt: string;
  metrics: {
    totalScanned: number;
    migrated: number;
    merged: number;
    skipped: number;
    conflictsResolved: number;
    quarantined: number;
    failed: number;
  };
  tableBreakdown: Record<string, { sqliteCount: number; mongoCount: number; status: 'OK' | 'MISMATCH' }>;
  quarantineReasons: Array<{
    table: string;
    id: string;
    reason: string;
    record: Record<string, any>;
  }>;
}
```

---

## 5. Migration CLI Tooling Specification

* **Script Path:** `scripts/migrate-sqlite-to-mongo.ts`
* **Invocation:**
  ```bash
  # Dry-run mode (safe preview)
  npx tsx scripts/migrate-sqlite-to-mongo.ts --workspace=<wsId> --dry-run

  # Full execution with automatic backup
  npx tsx scripts/migrate-sqlite-to-mongo.ts --workspace=<wsId> --execute
  ```
* **Rollback Command:**
  ```bash
  npx tsx scripts/migrate-sqlite-to-mongo.ts --workspace=<wsId> --restore-backup
  ```
