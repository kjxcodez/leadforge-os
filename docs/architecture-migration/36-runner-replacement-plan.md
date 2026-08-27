# LeadForge OS — Migration Runner (`runner.ts`) Replacement Plan

## 1. Executive Summary & Problem Analysis

In the legacy architecture, [`apps/desktop/src/main/database/runner.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/runner.ts) executed a sequential 33-step migration pipeline (`001_initial_schema` through `033_contact_last_contacted_at`).
This runner:
1. Re-played 33 historical incremental DDL steps on every fresh desktop installation.
2. Created tables and columns that were subsequently dropped or altered (e.g. `discovery_jobs`, `discovery_results`, multiple revisions of `jobs` and `sync_queue`).
3. Retained obsolete sync engine infrastructure (`sync_queue`, `sync_dead_letter`).

### Target Architecture Decision:
> **The 33-step migration runner is permanently retired.**
> Fresh desktop installations require only a clean, instantaneous SQLite cache schema initializer (`initCacheSchema`), while MongoDB manages its own indexes and document lifecycles via Mongoose.

---

## 2. Target Schema Initializer Architecture

```text
                                OLD RUNNER ARCHITECTURE
  runner.ts ──► Loops 33 SQL migrations ──► Alters tables 5x ──► Heavy Startup Lag

                               TARGET RUNNER ARCHITECTURE
  initCacheSchema.ts ──► Single clean DDL execution (< 10ms) ──► Instant Cache Boot
```

### 2.1 The New SQLite Cache Initializer (`initCacheSchema.ts`)
* **File:** `apps/desktop/src/main/database/initCacheSchema.ts`
* **Purpose:** Runs when a new workspace `.db` is initialized. Creates clean cache tables in a single atomic transaction.
* **Complete DDL Definition:**
  ```sql
  -- Fast pragmas for cache performance
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;

  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    ownerId TEXT,
    settingsTimezone TEXT DEFAULT 'UTC',
    createdAt DATETIME,
    updatedAt DATETIME
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    name TEXT,
    role TEXT,
    activeWorkspaceId TEXT,
    createdAt DATETIME,
    updatedAt DATETIME
  );

  CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL,
    name TEXT NOT NULL,
    domain TEXT,
    website TEXT,
    industry TEXT,
    size TEXT,
    employeeCount INTEGER,
    revenue TEXT,
    location TEXT,
    city TEXT,
    state TEXT,
    country TEXT,
    phone TEXT,
    rating REAL,
    status TEXT DEFAULT 'LEAD',
    tags TEXT DEFAULT '[]',
    notes TEXT,
    opportunityScore REAL,
    createdAt DATETIME,
    updatedAt DATETIME,
    deletedAt DATETIME DEFAULT NULL
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL,
    companyId TEXT,
    firstName TEXT,
    lastName TEXT,
    email TEXT,
    phone TEXT,
    title TEXT,
    linkedinUrl TEXT,
    headline TEXT,
    profilePictureUrl TEXT,
    type TEXT,
    status TEXT DEFAULT 'NEW',
    tags TEXT DEFAULT '[]',
    notes TEXT,
    lastContactedAt DATETIME DEFAULT NULL,
    createdAt DATETIME,
    updatedAt DATETIME,
    deletedAt DATETIME DEFAULT NULL
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    sequenceId TEXT,
    sendingAccountId TEXT,
    status TEXT DEFAULT 'DRAFT',
    schedule TEXT,
    timezone TEXT DEFAULT 'UTC',
    dailyLimit INTEGER DEFAULT 0,
    createdAt DATETIME,
    updatedAt DATETIME,
    deletedAt DATETIME DEFAULT NULL
  );

  CREATE TABLE IF NOT EXISTS email_accounts (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    provider TEXT NOT NULL,
    status TEXT NOT NULL,
    dailyLimit INTEGER DEFAULT 200,
    hourlyLimit INTEGER DEFAULT 50,
    dailySent INTEGER DEFAULT 0,
    hourlySent INTEGER DEFAULT 0,
    signature TEXT,
    googleAccountId TEXT,
    lastVerifiedAt DATETIME,
    createdAt DATETIME,
    updatedAt DATETIME
  );

  CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    variables TEXT DEFAULT '[]',
    attachments TEXT DEFAULT '[]',
    createdAt DATETIME,
    updatedAt DATETIME,
    deletedAt DATETIME DEFAULT NULL
  );

  CREATE TABLE IF NOT EXISTS sequences (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL,
    trigger TEXT NOT NULL,
    steps TEXT NOT NULL,
    createdAt DATETIME,
    updatedAt DATETIME,
    deletedAt DATETIME DEFAULT NULL
  );

  CREATE TABLE IF NOT EXISTS sequence_executions (
    id TEXT PRIMARY KEY,
    sequenceId TEXT NOT NULL,
    workspaceId TEXT NOT NULL,
    campaignId TEXT,
    contactId TEXT,
    companyId TEXT,
    currentStep INTEGER DEFAULT 0,
    currentStepName TEXT,
    status TEXT NOT NULL,
    emailsSent INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    failures INTEGER DEFAULT 0,
    startedAt DATETIME,
    completedAt DATETIME,
    nextExecutionAt DATETIME,
    createdAt DATETIME,
    updatedAt DATETIME
  );

  CREATE TABLE IF NOT EXISTS discovery_runs (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL,
    name TEXT NOT NULL,
    query TEXT NOT NULL,
    country TEXT,
    state TEXT,
    city TEXT,
    provider TEXT NOT NULL,
    status TEXT NOT NULL,
    resultCount INTEGER DEFAULT 0,
    startedAt DATETIME,
    finishedAt DATETIME,
    createdAt DATETIME,
    updatedAt DATETIME
  );

  CREATE TABLE IF NOT EXISTS company_discovery_runs (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL,
    companyId TEXT NOT NULL,
    discoveryRunId TEXT NOT NULL,
    requiresReview INTEGER DEFAULT 0,
    createdAt DATETIME,
    updatedAt DATETIME
  );

  CREATE TABLE IF NOT EXISTS audiences (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL,
    name TEXT NOT NULL,
    mode TEXT DEFAULT 'DYNAMIC',
    staticMemberIds TEXT DEFAULT '[]',
    filterDefinition TEXT DEFAULT '{}',
    createdAt DATETIME,
    updatedAt DATETIME
  );

  -- Strategic UI Query Indexes
  CREATE INDEX IF NOT EXISTS idx_companies_ws_domain ON companies(workspaceId, domain);
  CREATE INDEX IF NOT EXISTS idx_companies_ws_status ON companies(workspaceId, status);
  CREATE INDEX IF NOT EXISTS idx_contacts_ws_comp ON contacts(workspaceId, companyId);
  CREATE INDEX IF NOT EXISTS idx_contacts_ws_email ON contacts(workspaceId, email);
  CREATE INDEX IF NOT EXISTS idx_campaigns_ws ON campaigns(workspaceId);
  CREATE INDEX IF NOT EXISTS idx_seq_exec_ws_status ON sequence_executions(workspaceId, status);
  ```

---

## 3. MongoDB Bootstrap & Index Manager (`initMongoDatabase.ts`)

In place of raw SQL migrations, MongoDB index management and collection bootstrap are handled server-side during API boot:

* **File:** `apps/api/src/db/init/initMongoDatabase.ts`
* **Execution:** Runs once on API startup or CI migration gate.
* **Responsibilities:**
  1. Compiles all 33 Mongoose schemas.
  2. Ensures all compound and unique indexes are created using `Model.syncIndexes()`.
  3. Verifies TTL index registrations on `systemlogs` and `automationlocks`.

---

## 4. Cutover Procedure from `runner.ts` to `initCacheSchema.ts` (Phase 12)

1. Ensure Phase 4 (SQLite Data Migration to Mongo) is 100% verified.
2. In `apps/desktop/src/main/database/connection.ts`:
   - Replace `import { runMigrations } from './runner'` with `import { initCacheSchema } from './initCacheSchema'`.
   - On database connection open, invoke `initCacheSchema(db)`.
3. In `apps/desktop/src/main/database/`:
   - Deprecate and delete `runner.ts`.
