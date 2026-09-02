# LeadForge OS — Runtime Architecture Audit

## 1. Executive Summary
LeadForge OS operates across two primary process boundaries:
1. **The Server Process (`apps/api`)**: A Hono REST application running on Node.js connected to MongoDB.
2. **The Desktop Process (`apps/desktop`)**: An Electron application containing a Node.js Main Process, a Chromium Renderer Process, and child worker threads.

---

## 2. Process & Thread Topology

### 2.1 API Server Runtime (`apps/api`)
* **Host Runtime:** Node.js standalone process.
* **Http Layer:** Hono mounted via `@hono/node-server` on port 3000 (or `PORT` env var).
* **Database Driver:** Mongoose / MongoDB Native Driver ([`apps/api/src/db/connection/mongoose.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/db/connection/mongoose.ts#L1-L35)).
* **Concurrency:** Single Node event loop handling async HTTP requests and Mongo queries.
* **Statelessness:** Partially stateless. State is delegated to MongoDB, but OAuth transactions and session tokens use MongoDB collections (`OAuthTransactionModel`, `UserModel`).

---

### 2.2 Desktop Runtime (`apps/desktop`)

#### A. Main Process Supervisor
* **Entrypoint:** [`apps/desktop/src/main/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/index.ts#L1-L120)
* **Key Components:**
  * **`WorkspaceManager`** ([`workspace-manager.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/lib/workspace-manager.ts#L9-L105)): Manages active workspace runtime lifecycle.
  * **`WorkspaceRuntime`** ([`workspace-runtime.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/lib/workspace-runtime.ts#L23-L198)): Isolated workspace container containing `better-sqlite3` DB connection, `JobScheduler`, `SyncEngine`, `EventBridge`, and `AutomationTriggerEvaluator`.
  * **`LocalCRMRepository`** ([`local-crm.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/repositories/local-crm.ts#L46-L418)): Performs synchronous SQLite read/write queries.
  * **`SyncEngine`** ([`sync-engine.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/sync-engine.ts#L47-L363)): Background loop polling `sync_queue` table every 5 seconds and pushing mutations to API via `SdkClient`.
  * **`CacheHydrator`** ([`cache-hydrator.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/cache-hydrator.ts#L10-L142)): Pulls canonical Mongo records from API into SQLite.

#### B. Renderer Process (UI)
* **Runtime:** Chromium browser context.
* **IPC Integration:** Communicates with Main process via `window.electron.ipcRenderer` ([`apps/desktop/src/preload/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/preload/index.ts#L1-L80)).
* **Persistence:** Does NOT access SQLite or Mongo directly. Reads and writes strictly through IPC invocation calls to Main process.

#### C. Background Worker Threads / Subprocesses
* **Host Manager:** `WorkerHost` ([`apps/desktop/src/main/workers/worker-host.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/worker-host.ts#L1-L200)).
* **Plugin Modules:** Scraper, Crawler, Enricher, Outreach, LinkedIn, Intelligence Worker, IMAP Poller ([`apps/desktop/src/main/workers/plugins/`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins)).
* **Persistence Access:** Workers currently instantiate `better-sqlite3` directly and execute queries on local SQLite databases!

---

## 3. Workspace Lifecycle Analysis

When a user selects or switches a workspace:
1. `WorkspaceManager.setActiveWorkspace(workspaceId)` is invoked ([`workspace-manager.ts:30-81`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/lib/workspace-manager.ts#L30-L81)).
2. The active `WorkspaceRuntime` is cleanly stopped (stopping `JobScheduler`, `SyncEngine`, `EventBridge`, `AutomationTriggerEvaluator`, and closing SQLite file handle).
3. A new `WorkspaceRuntime` instance is constructed for the target `workspaceId`.
4. `runMigrations(sqliteDb)` executes synchronously to ensure schema migration state ([`runner.ts:1060-1188`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/runner.ts#L1060-L1188)).
5. Interrupted jobs are recovered (`recoverInterruptedJobs()`).
6. `JobScheduler` and `SyncEngine` start background polling loops.
7. `CacheHydrator.hydrateWorkspaceCache()` asynchronously pulls Mongo records to populate SQLite.

---

## 4. Current Architectural Flaws Identified

> [!WARNING]
> 1. **Worker Direct SQLite Coupling:** Workers instantiate `better-sqlite3` directly to write crawl/scrape results, bypassing the API.
> 2. **Local Dual-Write Contention:** UI operations write local SQLite first, then enqueue `sync_queue` items, leading to potential offline out-of-sync states and duplicate entity creation.
> 3. **Sync Engine Complexity:** `SyncEngine` must continuously manage conflict resolution (LWW), dead-letter queues, and dirty state flags across 10 syncable tables.
