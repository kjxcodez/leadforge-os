# LeadForge OS — Database Changes

> **Document Type**: Implementation Contract  
> **Source Specs**: worker_runtime_spec.md §2.2, job_lifecycle_spec.md §1, §8, scraping_pipeline_spec.md §6  
> **Phase**: 9 — Implementation  
> **Note**: SQL statements are shown for specification only. Do NOT implement migration code from this document. Migrations are implemented in `runner.ts` as part of the appropriate build tasks.

---

## Context: Existing Migration State

Migrations 001–007 exist in `apps/desktop/src/main/database/runner.ts`. The following migrations are **new** and must be appended in strict numerical order. Running migrations out of order will corrupt the schema.

---

## Migration 008 — Job Lifecycle Hardening

**Migration Number**: 008  
**TASK Reference**: TASK-001  
**Purpose**: Add the `starting` state to the jobs CHECK constraint. Add `scheduledAt`, `checkpointData`, `checkpointAt`, `idempotencyKey`, `durationMs` columns required by job_lifecycle_spec §3, §4, §7.

**Conflict Note (C1)**: The current CHECK constraint on `jobs.status` does not include `starting`. This migration must ALTER or RECREATE the table to add it. SQLite does not support `ALTER TABLE ... MODIFY COLUMN`. The safe approach is to recreate the table with the updated CHECK constraint using a rename-and-copy pattern, or to drop and re-add the constraint if possible. SQLite CHECK constraints cannot be altered directly.

**Recommended SQL Pattern** (specification only — implement in runner.ts):

```
Step 1: Create jobs_new with updated CHECK constraint including 'starting'
Step 2: INSERT INTO jobs_new SELECT ... FROM jobs (all existing columns)
Step 3: DROP TABLE jobs
Step 4: ALTER TABLE jobs_new RENAME TO jobs
Step 5: Re-create index idx_jobs_scheduler
Step 6: Add new columns via ALTER TABLE ADD COLUMN
```

**New columns**:
```
scheduledAt    DATETIME        NULL    -- when job should next be dispatched (retries, delays)
checkpointData TEXT            NULL    -- JSON blob for pause/resume state
checkpointAt   DATETIME        NULL    -- when checkpoint was last saved
idempotencyKey TEXT            NULL    -- prevents duplicate job submission
durationMs     INTEGER         NULL    -- elapsed ms on completion (finishedAt - startedAt)
```

**Updated CHECK constraint** must include all values from `JobStatus`:
```
'pending', 'queued', 'starting', 'running', 'waiting', 'paused',
'retrying', 'completed', 'failed', 'cancelled', 'interrupted'
```

**New indexes**:
```sql
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled 
  ON jobs(workspaceId, status, scheduledAt);

CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_idempotency 
  ON jobs(workspaceId, idempotencyKey) 
  WHERE idempotencyKey IS NOT NULL;
```

**Rollback Strategy**:  
Migration 008 is NOT safely reversible due to the table recreation. If this migration causes issues, the rollback strategy is to restore the workspace database file from a backup taken at app startup before migrations run. A pre-migration backup step should be added to `runMigrations()` before migration 008 executes.

**Affected Repositories**:
- `LocalCRMRepository` — not affected (does not touch jobs table)
- `JobScheduler` — must write to new columns `scheduledAt`, `checkpointData`

**Affected Services**:
- `JobScheduler.handleJobFailure()` — must write `scheduledAt` for retries
- `JobScheduler.runJob()` — must write `status = 'starting'` on fork
- `JobScheduler.tick()` — must filter `scheduledAt <= datetime('now')` for retrying jobs
- `JobScheduler.pauseJob()` — must write `checkpointData`, `checkpointAt`

**Backward Compatibility**:  
The table recreation means existing `jobs` rows are preserved. However, any application code referencing the old CHECK constraint inline (not via prepared statements) may fail. Review all raw SQL strings in `runner.ts` that reference job status.

---

## Migration 009 — Scraping Pipeline Schema

**Migration Number**: 009  
**TASK Reference**: TASK-003  
**Purpose**: Add company-level crawl tracking and contact-level quality scoring columns. Required by scraping_pipeline_spec §6.

**New columns on `companies`**:
```
crawlStatus        TEXT    DEFAULT 'pending'
                   CHECK(crawlStatus IN ('pending','in_progress','completed','failed','skipped'))
crawledAt          DATETIME    NULL
crawlError         TEXT        NULL
contactCount       INTEGER     DEFAULT 0
score              INTEGER     NULL
scoreUpdatedAt     DATETIME    NULL
```

**New columns on `contacts`**:
```
confidence         TEXT    DEFAULT 'low'
                   CHECK(confidence IN ('high','medium','low'))
type               TEXT    DEFAULT 'unknown'
                   CHECK(type IN ('human','department','unknown'))
verificationStatus TEXT    DEFAULT 'unverified'
                   CHECK(verificationStatus IN ('unverified','valid','invalid','catch_all'))
sourceUrl          TEXT    NULL
sourcePlatform     TEXT    NULL
priority           INTEGER DEFAULT 1
```

**SQL approach**: `ALTER TABLE companies ADD COLUMN ...` × 6, `ALTER TABLE contacts ADD COLUMN ...` × 6. SQLite supports adding columns via ALTER TABLE ADD COLUMN without table recreation as long as new columns have defaults or are nullable.

**New indexes**:
```sql
CREATE INDEX IF NOT EXISTS idx_companies_crawl_status 
  ON companies(workspaceId, crawlStatus);

CREATE INDEX IF NOT EXISTS idx_contacts_confidence 
  ON contacts(workspaceId, confidence, priority);
```

**Rollback Strategy**:  
SQLite does not support `ALTER TABLE DROP COLUMN` in versions prior to 3.35. If rollback is needed, a table-rename approach must be used. Recommended: run a pre-migration integrity check and backup before applying.

**Affected Repositories**:
- `LocalCRMRepository` — `findMany()` and `save()` automatically adapt via `pragma table_info()` — no changes needed
- New `CrawlerPlugin` and `EnricherPlugin` will write to these columns directly

**Affected Services**:
- `SyncEngine` — `crawlStatus`, `confidence`, `verificationStatus` columns are not in `syncableTables` currently. Must verify whether these should sync or remain local-only.

**UNKNOWN**: Should `crawlStatus`, `score`, `confidence`, `verificationStatus` sync to MongoDB? The specs do not explicitly address this.  
**Required Investigation**: Define which new columns are sync-eligible before implementing SyncEngine handling.

**Backward Compatibility**:  
All new columns have defaults. Existing company and contact rows will read as `crawlStatus = 'pending'` and `confidence = 'low'`. No data loss.

---

## Migration 010 — Sequence Execution Tracking

**Migration Number**: 010  
**TASK Reference**: TASK-004  
**Purpose**: Add cancellation tracking and parent job linkage to `sequence_executions`. Required by job_lifecycle_spec §8.

**New columns on `sequence_executions`**:
```
cancelledAt     DATETIME    NULL
cancelReason    TEXT        NULL
parentJobId     TEXT        NULL    -- FK reference to jobs.id
```

**SQL approach**: `ALTER TABLE sequence_executions ADD COLUMN ...` × 3. All nullable, no defaults required.

**New indexes**:
```sql
CREATE INDEX IF NOT EXISTS idx_seq_exec_parent_job 
  ON sequence_executions(parentJobId) 
  WHERE parentJobId IS NOT NULL;
```

**Rollback Strategy**: Same as Migration 009. Pre-migration backup recommended.

**Affected Repositories**:
- `LocalCRMRepository` — adapts automatically via `pragma table_info()`

**Affected Services**:
- `AutomationWorkflowPlugin` — must write `parentJobId = ctx.jobId` on execution creation
- `JobScheduler.cancelJob()` — if cancelling an `automation:workflow` job, must also set `cancelledAt` and `cancelReason` on associated sequence_execution

**Backward Compatibility**:  
All columns nullable. No data loss. Existing execution rows will have NULL values for new columns.

---

## Migration Sequencing Summary

| Migration | Number | Depends On | Tables Affected | Risk |
|---|---|---|---|---|
| Job Lifecycle Hardening | 008 | 001-007 | `jobs` (recreate) | HIGH — table recreation |
| Scraping Pipeline Schema | 009 | 008 | `companies`, `contacts` (alter) | LOW — add columns only |
| Sequence Execution Tracking | 010 | 008 | `sequence_executions` (alter) | LOW — add columns only |

---

## Pre-Migration Backup Requirement

Before migration 008 runs (table recreation), `runMigrations()` must:
1. Detect that migration 008 has not been applied
2. Copy the workspace database file to `leadforge_${workspaceId}.db.pre008.bak`
3. Proceed with migration
4. If migration fails, log the backup path for manual recovery

This requirement is **not currently implemented** and must be added to `runner.ts` as part of TASK-001.
