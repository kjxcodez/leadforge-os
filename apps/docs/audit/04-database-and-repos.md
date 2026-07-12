# LeadForge OS Forensic Architecture Audit — Part 4: Database, Repositories, & Sync Engine

This document details the MongoDB Atlas and local SQLite database layers, Mongoose and better-sqlite3 repositories, the background synchronization engine, and TanStack query designs.

---

## 1. Database Documentation

LeadForge OS employs a hybrid database strategy:
- **MongoDB Atlas** serves as the master global datastore containing authorized GTM workspaces, team configurations, and permanent CRM records.
- **SQLite** serves as a transient read-through cache and write-behind task queue running locally inside the user's desktop application directory (`userData` path).

### 1.1 MongoDB Atlas Structure (Mongoose)

#### 1.1.1 Main Data Models & Mongoose Schemas

##### 1. User (`user.model.ts`)
- **Fields**: `email` (unique), `name`, `password` (hashed via bcrypt), `role` (enum: `"owner" | "admin" | "user"`, defaults to `"user"`), `activeWorkspaceId`, `createdAt`, `updatedAt`.
- **Tenant Scope**: User membership references workspace IDs via custom memberships in the Workspace model.
- **Indexes**: Unique index on `email`.

##### 2. Workspace (`workspace.model.ts`)
- **Fields**: `name`, `slug` (unique), `ownerId` (references User), `members` (array of: `{ userId, role: "owner" | "admin" | "member", joinedAt }`), `settings` ({ `defaultTimezone` }), `createdAt`, `updatedAt`.
- **Validation**: Enforces unique workspaces slugs.

##### 3. Company (`company.model.ts`)
- **Fields**: `workspaceId` (enforces tenant boundaries), `name`, `domain`, `industry`, `status` (enum: `"lead" | "contacted" | "nurturing" | "qualified" | "unqualified"`), `tags` (array of strings), `notes` (array of: `{ content, authorId, createdAt }`), `deletedAt` (nullable date), `createdAt`, `updatedAt`.
- **Soft Deletes**: Employs soft-delete plugin adding `deletedAt` checks on standard finds.
- **Indexes**: Compound index on `{ workspaceId: 1, deletedAt: 1 }` and `{ workspaceId: 1, domain: 1 }` for domain-level deduplication.

##### 4. Contact (`contact.model.ts`)
- **Fields**: `workspaceId`, `companyId` (references Company), `firstName`, `lastName`, `email`, `phone`, `status` (enum: `"active" | "bounced" | "opted_out"`), `deletedAt`, `createdAt`, `updatedAt`.
- **Indexes**: Compound index on `{ workspaceId: 1, email: 1 }`.

##### 5. Campaign (`campaign.model.ts`)
- **Fields**: `workspaceId`, `name`, `status` (enum: `"draft" | "active" | "paused" | "completed"`), `steps` (array of sequence steps), `deletedAt`, `createdAt`, `updatedAt`.

##### 6. Discovery Job & Discovery Result (`discovery-job.model.ts` / `discovery-result.model.ts`)
- **DiscoveryJob**: `workspaceId`, `name`, `provider`, `status` (enum: `"pending" | "running" | "completed" | "failed"`), `progress` (0-100), `query`, `error`, `statistics` ({ `totalFound`, `duplicatesSkipped` }), `startedAt`, `finishedAt`.
- **DiscoveryResult**: `workspaceId`, `jobId`, `companyName`, `website`, `email`, `phone`, `linkedinUrl`, `status` (enum: `"pending" | "imported" | "skipped"`), `contactsJson` (serialized lead employees metadata).

##### 7. Automation, Email Accounts & Templates
- **Sequence**: `workspaceId`, `name`, `status`, `trigger`, `steps` (serialized logic steps).
- **SequenceExecution**: `workspaceId`, `sequenceId`, `companyId`, `contactId`, `currentStep`, `status` (enum: `"running" | "paused" | "completed" | "failed" | "stopped"`), `nextExecutionAt`.
- **SequenceLog**: `workspaceId`, `executionId`, `timestamp`, `step`, `action`, `status`, `message`.
- **EmailAccount**: `workspaceId`, `name`, `email`, `provider` (SMTP/IMAP), `status`, `limits` (daily/hourly volumes), `signature`.
- **EmailTemplate**: `workspaceId`, `name`, `subject`, `body`, `variables` (placeholder tokens).

---

### 1.2 SQLite Cache Structure (better-sqlite3)

SQLite operates as a single file cache `leadforge.db` inside the desktop app's `app.getPath('userData')` folder.

#### 1.2.1 SQLite Schema & Migrations (`runner.ts`)
SQLite migrations are run sequentially on startup inside a transaction.
- **`001_initial_schema`**:
  - Creates tables `users`, `workspaces`, `companies`, `contacts`, `campaigns`, `activities`, `outreach`, `settings`, `sync_queue`, `sync_metadata`.
  - Column `syncStatus` (enum: `'synced' | 'pending'`) tracks if local writes have been pushed to Atlas.
  - Column `deletedAt` maps soft-deleted records.
- **`002_discovery_schema`**:
  - Adds `discovery_jobs` and `discovery_results`.
- **`003_outreach_schema`**:
  - Adds `email_accounts` and `templates`.
- **`004_automation_schema`**:
  - Adds `sequences`, `sequence_executions`, and `sequence_logs`.

#### 1.2.2 Indices for Fast CRM Rendering
SQLite cache relies on:
- `idx_companies_workspaceId` ON `companies(workspaceId)`
- `idx_contacts_workspaceId` ON `contacts(workspaceId)`
- `idx_campaigns_workspaceId` ON `campaigns(workspaceId)`
- `idx_sync_queue_workspaceId` ON `sync_queue(workspaceId)`
- `idx_discovery_jobs_workspaceId` ON `discovery_jobs(workspaceId)`

---

## 2. Repository Layer

LeadForge OS decouples data querying via a strict repository design pattern.

### 2.1 Mongoose Base Repository (`apps/api/src/repositories/base/base.repository.ts`)
The `BaseRepository` encapsulates MongoDB CRUD. It enforces workspace-scoping boundaries:
- **`applyScope(filter)`**: Automatically appends `workspaceId` to all search predicates if workspace context is active.
- **Error Mapping (`handleError`)**: Maps database errors to standard HTTP response errors:
  - `ValidationError` -> HTTP 400 Bad Request
  - `ConflictError` (11000 duplicate keys) -> HTTP 409 Conflict
  - `NotFoundError` (Mongoose CastError or empty find) -> HTTP 404 Not Found
- **Soft Deletes**: In `delete()`, checks if the document schema supports a custom `.softDelete()` hook, executing it to write a date timestamp instead of executing a destructive `deleteOne()`.

### 2.2 Local SQLite Repositories (`apps/desktop/src/main/database/repositories/`)
- **`LocalCRMRepository`**:
  - Generates parameterized dynamic SQL queries (e.g. `SELECT * FROM companies WHERE workspaceId = ?`).
  - Implements transactional bulk saving (`saveMany`) to handle massive CRM imports without clogging I/O thread.
  - Checks table names against a regex allowlist `/^[a-zA-Z0-9_]+$/` to secure queries against SQL injections.
- **`LocalQueueRepository`**:
  - Operates as a SQLite FIFO task coordinator queue.
  - Exposes `push()`, `pop()`, `updateProgress()`, and `remove()`.
- **`LocalWorkspaceRepository`**:
  - Caches workspaces list locally to render workspace selector dropdowns instantly on startup.

---

## 3. Sync Engine Architecture

LeadForge OS implements a **Stale-While-Revalidate (SWR)** caching sync engine.

```
Read Request (e.g. Find Companies)
      │
      ├───► 1. Query local SQLite Cache instantly → Return cached list to UI (0ms delay)
      │
      └───► 2. Check network status (navigator.onLine)
                  │
                  ├───► If Online: Fetch fresh list from API Server (MongoDB Atlas)
                  │         │
                  │         ▼
                  │     Over-write SQLite cache with fresh records
                  │         │
                  │         ▼
                  │     Invalidate React Query keys → Silent UI refresh
                  │
                  └───► If Offline: Silent pass, UI remains on cached records
```

### 3.1 Write-Behind Queueing
For writes (Creates, Updates, Deletions):
1. **Local Write**: The mutation is written immediately to local SQLite (WAL mode).
2. **Online Check**:
   - If online: SDK attempts to POST/PATCH to API. If successful, writes are stored in SQLite as `syncStatus = 'synced'`.
   - If offline (or if API request crashes): The operation is saved to the SQLite `sync_queue` table with the operation details (`CREATE`, `UPDATE`, or `DELETE`), the workspace ID, the payload JSON, and is set as `syncStatus = 'pending'` locally.
3. **Queue Processing**:
   - The `SyncWorker` triggers every 60 seconds (or immediately when the window triggers an `online` event listener).
   - It fires `QueueProcessor.processQueue(workspaceId)`.
   - `processQueue` pops tasks in order, parses payloads, forwards requests to remote repositories (`RemoteCompanyRepository`, etc.) over IPC, saves the final resolved values back to SQLite, and pops the task off the queue.
   - If a request fails repeatedly, the processor increments the `retryCount` (max 5) and registers the error message, warning the GTM user on the health dashboard.

---

## 4. TanStack Query Architecture

The desktop renderer initializes a global `QueryClient` inside `AppProviders.tsx`.

### 4.1 Query Keys scoping
To prevent cross-workspace data bleed, all query keys are structured:
- `['companies', workspaceId, filters]`
- `['contacts', workspaceId, filters]`
- `['campaigns', workspaceId, filters]`
- `['discovery-jobs', workspaceId]`
- `['sequences', workspaceId]`

### 4.2 Invalidation & Optimistic UI Updates
1. **Invalidation**: When a sync loop completes successfully or a mutation succeeds, the renderer runs:
   ```typescript
   queryClient.invalidateQueries({ queryKey: ['companies', workspaceId] });
   ```
2. **Optimistic Updates**: For custom mutations (like adding note or tagging companies), the mutation hook saves the optimistic record straight to the React query cache before starting the actual IPC channel invoke. This provides sub-millisecond feedback to GTM prospectors.
