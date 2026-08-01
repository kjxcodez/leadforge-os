# LeadForge OS — Runtime Dependency Graph

> **Document Type**: Implementation Contract  
> **Source Specs**: worker_runtime_spec.md, job_lifecycle_spec.md, automation_engine_spec.md, runtime_health_report.md  
> **Phase**: 9 — Implementation

---

## 1. Full Dependency Graph

```
┌──────────────────────────────────────────────────────────────────────┐
│  ELECTRON MAIN PROCESS                                               │
│                                                                      │
│  [1] AppLogger ◄─────────────────────────── no deps                 │
│       │                                                              │
│  [2] getDatabase(workspaceId) ◄────────────── no deps               │
│       │                                                              │
│  [3] LocalEventBus ◄───────────────────────── no deps               │
│       │                                                              │
│  [4] SyncEngine ◄─────── [2] getDatabase                            │
│       │                   [3] LocalEventBus                          │
│       │                   SdkClient                                  │
│       │                                                              │
│  [5] JobScheduler ◄────── [2] getDatabase                           │
│       │                   [3] LocalEventBus                          │
│       │                   [1] AppLogger                              │
│       │                   worker-host.js (build artifact)            │
│       │                                                              │
│  [6] AutomationTriggerEvaluator ◄─ [2] getDatabase  [NEW]           │
│       │                              [3] LocalEventBus               │
│       │                                                              │
│  [7] WorkspaceRuntime ◄──── [2] getDatabase                         │
│       │                      [3] LocalEventBus                       │
│       │                      [4] SyncEngine                          │
│       │                      [5] JobScheduler                        │
│       │                      [6] AutomationTriggerEvaluator [NEW]    │
│       │                      runMigrations()                         │
│       │                                                              │
│  [8] WorkspaceManager ◄── [7] WorkspaceRuntime                      │
│       │                    SdkClient                                 │
│       │                                                              │
│  [9] EventBus→Renderer Bridge ◄── [3] LocalEventBus  [NEW]          │
│       │                            BrowserWindow API                 │
│                                                                      │
│  IPC Layer                                                           │
│  [10] registerSchedulerIpc ◄── [2] getDatabase                      │
│        │                        [8] WorkspaceManager                 │
│                                                                      │
│  [11] registerAutomationIpc ◄── SdkClient                           │
│        │                         [8] WorkspaceManager                │
│        │                         LocalCRMRepository                  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  FORKED WORKER PROCESS (child_process.fork)                          │
│                                                                      │
│  [W1] WorkerPluginRegistry ◄─── no deps              [NEW]          │
│        │                                                             │
│  [W2] JobContext (built per job) ◄── process.send/on [MODIFIED]     │
│        │                                                             │
│  [W3] scrapeMaps plugin ◄──── [W1] registry                         │
│        │                       [W2] ctx                              │
│        │                       better-sqlite3                        │
│        │                       playwright [NEW REAL]                 │
│        │                                                             │
│  [W4] crawlWebsite plugin ◄── [W1] registry           [NEW]         │
│        │                       [W2] ctx                              │
│        │                       better-sqlite3                        │
│        │                       cheerio [NEW]                         │
│        │                       node-fetch                            │
│        │                       robots-parser [NEW]                   │
│        │                                                             │
│  [W5] enrichWebsite plugin ◄── [W1] registry          [MODIFIED]    │
│        │                        [W2] ctx                             │
│        │                        better-sqlite3                       │
│        │                        cheerio [NEW]                        │
│        │                        email-validator [NEW]                │
│        │                                                             │
│  [W6] dispatchOutreach plugin ◄─ [W1] registry        [MODIFIED]    │
│        │                          [W2] ctx                           │
│        │                          better-sqlite3                     │
│        │                          nodemailer [NEW]                   │
│        │                                                             │
│  [W7] executeAutomationWorkflow ◄ [W1] registry        [NEW]        │
│        │                           [W2] ctx                          │
│        │                           better-sqlite3                    │
│        │                                                             │
│  [W8] worker-host.ts entrypoint ◄── [W1] registry                   │
│        │                             IPC message handler             │
│        │                             heartbeat pong                  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  API PROCESS (apps/api)                                              │
│                                                                      │
│  AutomationService ◄── MODIFIED: remove executeNextStep()            │
│                          MODIFIED: remove handleEvent()              │
│                          KEEP: CRUD only                             │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Definitions

### [1] AppLogger

| Field                | Value                                                                           |
| -------------------- | ------------------------------------------------------------------------------- |
| **File**             | `apps/desktop/src/main/lib/logger.ts`                                           |
| **Responsibilities** | Structured logging to console, SQLite `system_logs`, JSONL files, IPC broadcast |
| **Dependencies**     | `better-sqlite3` (via getDatabase), `electron.app`, `fs`, `BrowserWindow`       |
| **Dependents**       | JobScheduler, WorkspaceRuntime, SyncEngine, all IPC handlers                    |
| **Init Order**       | #1 — initialized on module import, no explicit init call required               |
| **Shutdown Order**   | Last — no explicit shutdown needed                                              |
| **Lifecycle**        | Singleton. Active for entire app lifetime. Cannot be stopped.                   |

### [2] getDatabase (Connection Pool)

| Field                | Value                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------ |
| **File**             | `apps/desktop/src/main/database/connection.ts`                                             |
| **Responsibilities** | Open and cache workspace-scoped SQLite connections (WAL mode, busy_timeout)                |
| **Dependencies**     | `better-sqlite3`, `electron.app`, `fs`                                                     |
| **Dependents**       | JobScheduler, SyncEngine, AutomationTriggerEvaluator, LocalCRMRepository, all IPC handlers |
| **Init Order**       | #2 — first call per workspaceId creates the connection                                     |
| **Shutdown Order**   | #2 from end — `closeDatabase(workspaceId)` called by WorkspaceRuntime.stop()               |
| **Lifecycle**        | Per-workspace connection cached in `workspaceDbs` Map. Closed on WorkspaceRuntime.stop().  |

### [3] LocalEventBus

| Field                | Value                                                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **File**             | `apps/desktop/src/main/lib/event-bus.ts`                                                                                         |
| **Responsibilities** | Scoped pub/sub within a single WorkspaceRuntime. Events: job:_, sync:_, crm:*, system:log                                        |
| **Dependencies**     | Node.js `EventEmitter`                                                                                                           |
| **Dependents**       | JobScheduler (publishes), SyncEngine (publishes), AutomationTriggerEvaluator (subscribes), EventBus→Renderer Bridge (subscribes) |
| **Init Order**       | #3 — instantiated inside WorkspaceRuntime constructor                                                                            |
| **Shutdown Order**   | #3 from end — `eventBus.clear()` called by WorkspaceRuntime.stop()                                                               |
| **Lifecycle**        | Per-workspace. Created with WorkspaceRuntime. Destroyed with WorkspaceRuntime.                                                   |

**Required new events** (not yet in EventType union):

- `'job:starting'` — emitted when worker is forked, before 'ready'
- `'job:paused'` — emitted on successful pause with checkpoint
- `'job:resumed'` — emitted when paused job is re-queued
- `'job:heartbeat:timeout'` — emitted when watchdog fires
- `'automation:triggered'` — emitted by AutomationTriggerEvaluator
- `'crm:created'` / `'crm:updated'` / `'crm:deleted'` — must carry `{ entityType, entityId }` payload

### [4] SyncEngine

| Field                | Value                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **File**             | `apps/desktop/src/main/services/sync-engine.ts`                                                                     |
| **Responsibilities** | Push sync_queue mutations to API (FIFO, LWW). Pull remote records to local cache.                                   |
| **Dependencies**     | getDatabase, LocalEventBus, SdkClient, LocalCRMRepository                                                           |
| **Dependents**       | WorkspaceRuntime (owns it)                                                                                          |
| **Init Order**       | #5 — started after JobScheduler in WorkspaceRuntime.start()                                                         |
| **Shutdown Order**   | #2 from end — stopped before eventBus.clear(), after scheduler.stop()                                               |
| **Lifecycle**        | Per-workspace. `setInterval` every 5000ms. Started by WorkspaceRuntime.start(). Stopped by WorkspaceRuntime.stop(). |

### [5] JobScheduler

| Field                | Value                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| **File**             | `apps/desktop/src/main/services/scheduler.ts`                                                         |
| **Responsibilities** | Fork workers, manage concurrency, dispatch jobs by priority, heartbeat, handle success/failure/cancel |
| **Dependencies**     | getDatabase, LocalEventBus, AppLogger, `child_process.fork`, worker-host.js build artifact            |
| **Dependents**       | WorkspaceRuntime (owns it), registerSchedulerIpc (calls cancelJob)                                    |
| **Init Order**       | #4 — started before SyncEngine in WorkspaceRuntime.start()                                            |
| **Shutdown Order**   | #1 — stopped first in WorkspaceRuntime.stop(), SIGTERM all active workers                             |
| **Lifecycle**        | Per-workspace. `setInterval` every 1000ms.                                                            |

**Missing implementations required**:

- Heartbeat timer per active worker
- Soft cancel via IPC message (not SIGTERM)
- `scheduledAt` check in tick (for delayed retries)
- WAIT resumption scan in tick
- Per-type concurrency maps
- Recovery scan in WorkspaceRuntime.start()
- `starting` state write on fork
- `stdio: ['ignore','pipe','pipe','ipc']` + stdout/stderr piping

### [6] AutomationTriggerEvaluator [NEW]

| Field                | Value                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **File**             | `apps/desktop/src/main/services/automation-trigger.ts` (NEW)                                                                               |
| **Responsibilities** | Subscribe to EventBus crm:* events. Find matching active sequences in SQLite. Queue automation:workflow jobs. Prevent duplicate execution. |
| **Dependencies**     | getDatabase, LocalEventBus                                                                                                                 |
| **Dependents**       | WorkspaceRuntime (owns it)                                                                                                                 |
| **Init Order**       | #6 — after JobScheduler and SyncEngine in WorkspaceRuntime.start()                                                                         |
| **Shutdown Order**   | #3 from end — unsubscribe from EventBus before clear()                                                                                     |
| **Lifecycle**        | Per-workspace. Lives inside WorkspaceRuntime. Binds on start, unbinds on stop.                                                             |

### [7] WorkspaceRuntime

| Field                | Value                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| **File**             | `apps/desktop/src/main/lib/workspace-runtime.ts`                                                |
| **Responsibilities** | Orchestrate sqliteDb, eventBus, scheduler, syncEngine, automationTrigger lifecycle              |
| **Dependencies**     | getDatabase, LocalEventBus, JobScheduler, SyncEngine, AutomationTriggerEvaluator, runMigrations |
| **Dependents**       | WorkspaceManager (owns it)                                                                      |
| **Init Order**       | Created by WorkspaceManager.setActiveWorkspace()                                                |
| **Shutdown Order**   | Destroyed by WorkspaceManager.setActiveWorkspace(null) or workspace switch                      |
| **Lifecycle**        | One active instance at a time. start() → running → stop() → destroyed.                          |

**Required additions to `start()`**:

1. Run migrations
2. Start JobScheduler
3. Start SyncEngine
4. Start AutomationTriggerEvaluator [NEW]
5. Recover interrupted jobs [NEW]
6. Resume overdue WAIT executions [NEW]

**Required additions to `stop()`**:

1. Stop JobScheduler (SIGTERM active workers, UPDATE interrupted)
2. Stop SyncEngine
3. Stop AutomationTriggerEvaluator [NEW]
4. Clear EventBus
5. Close SQLite connection

### [8] WorkspaceManager

| Field                | Value                                                                   |
| -------------------- | ----------------------------------------------------------------------- |
| **File**             | `apps/desktop/src/main/lib/workspace-manager.ts`                        |
| **Responsibilities** | Singleton supervisor. setActiveWorkspace() spin-down/spin-up lifecycle. |
| **Dependencies**     | WorkspaceRuntime, SdkClient                                             |
| **Dependents**       | All IPC handlers (via getActiveRuntime()), main/index.ts                |
| **Init Order**       | Module-level singleton. setSdk() called in registerAllIpc().            |
| **Shutdown Order**   | Not explicitly stopped — WorkspaceRuntime.stop() handles cleanup        |
| **Lifecycle**        | App-lifetime singleton.                                                 |

### [9] EventBus→Renderer Bridge [NEW]

| Field                | Value                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| **File**             | `apps/desktop/src/main/lib/event-bridge.ts` (NEW)                                                     |
| **Responsibilities** | Subscribe to LocalEventBus job:* events and forward them to all BrowserWindows via webContents.send() |
| **Dependencies**     | LocalEventBus, BrowserWindow                                                                          |
| **Dependents**       | Renderer (receives events)                                                                            |
| **Init Order**       | #7 — after WorkspaceRuntime.start() or inside it                                                      |
| **Shutdown Order**   | #4 from end — unsubscribe before eventBus.clear()                                                     |
| **Lifecycle**        | Per-workspace. Must reinitialize on workspace switch.                                                 |

**Events to bridge**:

- `job:started` → `win.webContents.send('job:started', payload)`
- `job:progress` → `win.webContents.send('job:progress', payload)`
- `job:completed` → `win.webContents.send('job:completed', payload)`
- `job:failed` → `win.webContents.send('job:failed', payload)`
- `job:cancelled` → `win.webContents.send('job:cancelled', payload)`
- `job:paused` → `win.webContents.send('job:paused', payload)`

### [W1] WorkerPluginRegistry [NEW — replaces static map]

| Field                | Value                                                                  |
| -------------------- | ---------------------------------------------------------------------- |
| **File**             | `apps/desktop/src/main/workers/plugin-registry.ts` (NEW)               |
| **Responsibilities** | Type-safe plugin registration and resolution within the worker process |
| **Dependencies**     | None                                                                   |
| **Dependents**       | worker-host.ts                                                         |
| **Init Order**       | Instantiated at top of worker-host.ts before process.on('message')     |
| **Shutdown Order**   | N/A — garbage collected on process exit                                |
| **Lifecycle**        | Per-worker-process. Lives for the lifetime of one forked worker.       |

### [W2] JobContext (enriched)

| Field                | Value                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| **File**             | `apps/desktop/src/shared/types/job.ts` (MODIFIED)                                                  |
| **Responsibilities** | Runtime context injected into plugins. Progress, logging, cancellation, pause, checkpoint, dbPath. |
| **Dependencies**     | None (interface only)                                                                              |
| **Dependents**       | All plugins                                                                                        |
| **Init Order**       | Built by worker-host.ts after receiving 'start' command                                            |
| **Shutdown Order**   | N/A                                                                                                |
| **Lifecycle**        | One instance per job execution.                                                                    |

---

## 3. Initialization Order (Full Sequence)

```
App Boot
  1. AppLogger (module init)
  2. runMigrations() on global db (main/index.ts)
  3. registerAllIpc() (main/index.ts)
     └─ WorkspaceManager.setSdk(sdk)
  4. createWindow()

Workspace Activation (user logs in or switches workspace)
  5. WorkspaceManager.setActiveWorkspace(workspaceId)
     5a. Stop previous WorkspaceRuntime (if any)
     5b. new WorkspaceRuntime(workspaceId, sdk)
         5b-i.  getDatabase(workspaceId)     → open WAL connection
         5b-ii. runMigrations(db)            → apply pending migrations
         5b-iii.new LocalEventBus(workspaceId)
         5b-iv. new JobScheduler(...)
         5b-v.  new SyncEngine(...)
         5b-vi. new AutomationTriggerEvaluator(...) [NEW]
     5c. WorkspaceRuntime.start()
         5c-i.  scheduler.start()            → setInterval 1000ms
         5c-ii. syncEngine.start()           → setInterval 5000ms + initial pull
         5c-iii.automationTrigger.start()    → subscribe to EventBus [NEW]
         5c-iv. new EventBusBridge(...)      → subscribe, bind BrowserWindow [NEW]
         5c-v.  recoverInterruptedJobs()     → re-queue interrupted jobs [NEW]
         5c-vi. resumeOverdueWaitJobs()      → queue waiting executions past timer [NEW]
```

---

## 4. Shutdown Order (Full Sequence)

```
App Quit (app.on('will-quit') or 'window-all-closed')
  1. scheduler.stop()
     ├─ clearInterval(intervalId)
     ├─ for each activeWorker: worker.kill('SIGTERM')
     └─ UPDATE jobs SET status='interrupted' WHERE status='running'
  2. syncEngine.stop()
     └─ clearInterval(intervalId)
  3. automationTrigger.stop()        [NEW]
     └─ unsubscribe from EventBus
  4. eventBusBridge.stop()           [NEW]
     └─ unsubscribe from EventBus
  5. eventBus.clear()
  6. closeDatabase(workspaceId)
```

---

## 5. Conflict Register

| Conflict ID | Description                                                                                                                                                                                                                                                                                  | Specs Involved                                                 | Resolution Needed                                                                                                                                                                                   |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1          | `job_lifecycle_spec.md` defines `starting` as a state but the scheduler schema CHECK constraint in `runner.ts` does not include it                                                                                                                                                           | job_lifecycle_spec.md §1.2, worker_runtime_spec.md §2.2        | Migration 008 must add `starting` to the CHECK constraint                                                                                                                                           |
| C2          | `scraping_pipeline_spec.md` §2.1 shows `crawler:website` and `enrich:website` as separate sequential jobs, but `worker_runtime_spec.md` §4.6 lists them both in the registry without clarifying whether crawl+enrich is one plugin or two                                                    | scraping_pipeline_spec.md §2.1, worker_runtime_spec.md §4.6    | **Required Investigation**: Determine if `crawler:website` and `enrich:website` are separate job types or merged. Current spec shows them separately — recommend keeping separate for resumability. |
| C3          | `automation_engine_spec.md` §2.2 shows `AutomationTriggerEvaluator` queuing a job with `automation:workflow` type, but `scraping_pipeline_spec.md` §7.2 shows pipeline chaining handled directly in `handleJobSuccess()` inside the scheduler — these are two different chaining mechanisms  | automation_engine_spec.md §2.2, scraping_pipeline_spec.md §7.2 | Both mechanisms are valid for different purposes (automation triggers vs pipeline chaining). Must not be merged.                                                                                    |
| C4          | `job_lifecycle_spec.md` §3.3 defines `retrying` as a status in the state machine where the job stays `retrying` until `scheduledAt` passes. However `scheduler.ts` tick query selects `status IN ('queued', 'retrying')` meaning `retrying` jobs are immediately re-dispatched without delay | job_lifecycle_spec.md §3.3, worker_runtime_spec.md §3.5        | The tick must be updated to check `scheduledAt <= NOW` for retrying jobs                                                                                                                            |
