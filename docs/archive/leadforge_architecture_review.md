# LeadForge OS Architecture Review — Generic Job Runtime & Plugin Registry

This document defines a production-ready, extensible desktop architecture for LeadForge OS. It builds upon previous reviews, incorporating a generic **Job Runtime**, a **Priority Scheduler**, a **Plugin Registry** for actions, conditions, and search providers, and a unified **Sync Queue** managed inside a multi-tenant **Workspace Runtime**.

---

## 1. Overall Verdict

### Score: 9.5/10 (Extensible, Resilient, and Desktop-First)

This evolved architecture shifts LeadForge from a feature-bound client application to a reusable, local-first execution platform. By modeling all asynchronous operations as **Jobs**, decoupling tasks via an **Event Bus**, isolating concurrency using a **Priority Scheduler**, and registering capabilities as **Plugins**, the codebase gains massive maintainability.

---

## 2. Strengths of the Evolved Architecture

- **Extensible Execution Platform**: Adding new scrapers, AI models, CRM targets, or automation actions requires no changes to the core scheduling or worker logic. You simply write and register a new plugin.
- **Responsive UI Threading**: Moving all work out of the Electron Main thread into sandboxed child processes (`child_process.fork()`) prevents UI lag.
- **Unified State Management**: Consolidating all database synchronization into a single, generic `sync_queue` simplifies offline-first support.
- **Real-time Diagnostics**: The combination of SQLite log storage, JSONL archives, and an Event Bus provides an excellent foundation for developer tools.
- **Clean Boundaries**: The React Renderer is decoupled from the network; it acts as a viewer and modifier of the local SQLite database.

---

## 3. Weaknesses of Previous Design Iterations

1. **Feature-Bound Workers**: The previous plan separated "Discovery Workers" and "Automation Workers." This leads to code duplication, separate polling loops, and redundant process orchestration.
2. **Direct Service Coupling**: Services calling other services directly (e.g., discovery calling outreach) makes it hard to add middleware, log events, or swap steps.
3. **No Centralized Scheduler**: Simple polling loops lack priority handling, execution limits, and crash recovery.
4. **Renderer-Heavy Sync Engine**: The React Renderer was managing SWR sync, which is fragile.

---

## 4. Recommended Architecture (System Blueprint)

The revised system architecture isolates concerns into clean layers, keeping the UI fast and the execution sandboxed:

```
+---------------------------------------------------------------------------------------+
|                                    ELECTRON APP                                       |
|                                                                                       |
|  +---------------------------+                 +-----------------------------------+  |
|  |     Renderer (React)      |                 |           Electron Main           |  |
|  |                           |                 |                                   |  |
|  |  [Screens / Views]        |                 |   [Workspace Runtime Manager]     |  |
|  |  [TanStack React Query]   |                 |                 │                 |  |
|  |  [Developer console UI]   |                 |                 ▼                 |  |
|  |             │             |                 |   [Workspace Runtime Instance]    |  |
|  |             ▼             |                 |   ├─ Event Bus (Local)            |  |
|  |    Local Repository       |                 |   ├─ SQLite database (WAL)        |  |
|  +-------------+-------------+                 |   ├─ Job Scheduler                |  |
|                │                               |   ├─ Plugin Registry              |  |
|         IPC (window.ipc)                       |   └─ Sync Engine                  |  |
|                │                               +-----------------+---------+-------+  |
|                ▼                                                 │         │          |
|  +---------------------------+                             Fork Process  Sync Queue   |
|  |       Preload Bridge      |                                   │         │          |
|  |                           |                                   ▼         ▼          |
|  |  - Marshals clean calls   |                         +---------+----+  +-+-------+  |
|  |  - No Hono SDK references |                         | Sandboxed    |  | Hono    |  |
|  +---------------------------+                         | Node Worker  |  | API     |  |
|                                                        |              |  +----+----+  |
|                                                        | - Headless   |       │       |
|                                                        |   Playwright |       ▼       |
|                                                        | - Scrapers   |   [ MongoDB   |
|                                                        | - Emailers   |     Atlas ]   |
|                                                        +--------------+               |
+---------------------------------------------------------------------------------------+
```

---

## 5. Worker & Job Runtime Architecture

Instead of coding feature-specific worker threads, the desktop runtime implements a generic **Worker Host** that runs pluggable jobs.

### Pluggable Job Interface

Every background execution task—regardless of whether it scrapes Google, crawls a site, dispatches SMTP emails, or queries an LLM—conforms to the `JobPlugin` interface:

```typescript
export interface JobContext {
  jobId: string;
  workspaceId: string;
  payload: any;
  updateProgress: (progress: number, metadata?: any) => void;
  emitLog: (message: string, severity?: 'info' | 'warn' | 'error', meta?: any) => void;
  isCancelled: () => boolean;
}

export interface JobPlugin {
  type: string;
  execute(context: JobContext): Promise<any>;
}
```

### SQLite `jobs` Schema

```sql
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  workspaceId TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('queued', 'running', 'waiting', 'retrying', 'paused', 'cancelled', 'completed', 'failed', 'interrupted')),
  priority INTEGER DEFAULT 1,
  payload TEXT,
  progress INTEGER DEFAULT 0,
  retryCount INTEGER DEFAULT 0,
  maxRetries INTEGER DEFAULT 3,
  workerId TEXT,
  error TEXT,
  startedAt DATETIME,
  finishedAt DATETIME,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_jobs_scheduler ON jobs(workspaceId, status, priority, createdAt);
```

### The Scheduler & Concurrency Flow

The `JobScheduler` manages dispatching tasks based on priority, resource limits, and concurrency settings:

```
                 [Scheduler Tick (Every 1s)]
                             │
                             ▼
              [Query Runnable Jobs in SQLite]
        - Filter: status IN ('queued', 'retrying')
        - Order By: priority DESC, createdAt ASC
                             │
                             ▼
             [Evaluate Concurrency Limits]
        - Active jobs < Max Concurrency (e.g. 3)
                             │
                             ▼
          [Initialize Sandboxed Process Worker]
        - Spawn Node child process (child_process.fork)
        - Update SQLite status to 'running'
        - Send payload and Job type via IPC
                             │
                             ▼
                [Execute JobPlugin.execute()]
        - Worker runs the resolved plugin
        - Pipes logs & progress back to Main
                             │
                             ▼
                   [On Process Finish]
    ┌────────────────────────┼────────────────────────┐
    ▼                        ▼                        ▼
[Success]                [Failure]               [Cancellation]
- Status: 'completed'    - Status: 'retrying'    - Status: 'cancelled'
- Finish time logged       (if retryCount < max) - Stop worker
                         - Status: 'failed'        immediately
                           (if max hit)
```

---

## 6. E2E Discovery Pipeline

Under this architecture, company discovery is a structured pipeline. Each phase of the pipeline is a distinct step, allowing the supervisor to track, checkpoint, and resume execution without starting over from scratch.

```
       [Search Query]
             │
             ▼
      +──────┴──────+
      | Discovery   |
      |   Job       | ──► Step 1: Scrape Search Engine (e.g., DuckDuckGo)
      +──────┬──────+
             │
             ▼
      +──────┴──────+
      | Deduplicator| ──► Step 2: Compare found domains against SQLite crm_records
      +──────┬──────+
             │
             ▼
      +──────┴──────+
      | Website     | ──► Step 3: Fetch website landing pages concurrently
      |   Crawler   |
      +──────┬──────+
             │
             ▼
      +──────┴──────+
      | Contact     | ──► Step 4: Extract emails, phones, and titles (Cheerio)
      |  Extractor  |
      +──────┬──────+
             │
             ▼
      +──────┴──────+
      | Confidence  | ──► Step 5: Score contact confidence & verify emails
      |   Scorer    |
      +──────┬──────+
             │
             ▼
      +──────┴──────+
      | Lead Scorer | ──► Step 6: Compute fit score against target ICP
      +──────┬──────+
             │
             ▼
      +──────┴──────+
      | SQLite Store| ──► Step 7: Save to companies/contacts. Set syncStatus = 'pending'
      +──────┬──────+
             │
             ▼
       [Emit Event]  ──► Step 8: Fire 'discovery:completed' on the Event Bus
```

- **Checkpoint Resiliency**: If the crawler crashes during step 4, the scraper results from step 1 are already saved as raw cache. The pipeline can resume from the last successful step.

---

## 7. Automation Pipeline & Extensible Steps

Automation campaigns run as structured jobs using pluggable **Actions** and **Conditions**.

### Extensible Action Plugin

Instead of writing inline condition evaluations and mutations, automation actions are registered as plugins:

```typescript
export interface ActionResult {
  success: boolean;
  error?: string;
  nextDelaySeconds?: number;
}

export interface AutomationActionPlugin {
  type: string;
  execute(contactId: string, payload: any): Promise<ActionResult>;
  rollback(contactId: string, payload: any): Promise<void>;
  validate(payload: any): boolean;
  describe(payload: any): string;
}
```

- **Rollback support** makes it easy to handle failures gracefully (e.g., removing a tag if a subsequent step fails).

### Pluggable Condition Evaluator

```typescript
export interface ConditionContext {
  workspaceId: string;
  contactId: string;
  sqliteDb: any;
}

export interface ConditionPlugin {
  type: string;
  evaluate(context: ConditionContext, criteria: any): Promise<boolean>;
}
```

This makes it clean to register condition checks:

- `HasReply`: Evaluates if outreach logs show a reply.
- `HasTag`: Checks if a contact has a specific tag.
- `LeadScore`: Evaluates if the lead score is above a threshold.
- `TimeElapsed`: Evaluates if enough time has passed.

---

## 8. First-Class Event Bus

The local `EventBus` decouples services completely. Components publish events, and any number of listeners react without coupling the publisher to the subscriber.

```
                  [Event Publisher]
             (e.g., Discovery Job finish)
                          │
                          ▼
                  [Local Event Bus]
                          │
    ┌─────────────────────┼─────────────────────┐
    ▼                     ▼                     ▼
[Automation]         [Analytics]           [System Notifications]
- Trigger sequence   - Rebuild metrics     - Show desktop toast
  step evaluation      aggregations        - Log active dashboard trace
    │                     │                     │
    ▼                     ▼                     ▼
[Sync Queue]         [Sync Queue]          [SQLite Log]
- Append update      - Append update       - Write audit log entry
```

### Decoupled Sequence Example

1. **Scraper** saves results $\rightarrow$ publishes `discovery:import:completed`.
2. **Automation Engine** subscribes to `discovery:import:completed` $\rightarrow$ evaluates trigger rules $\rightarrow$ queues sequence jobs.
3. **Analytics Engine** subscribes to `discovery:import:completed` $\rightarrow$ updates metrics in SQLite.
4. **Developer Tools UI** listens to all events $\rightarrow$ displays them in the live event logger.

---

## 9. Structured Runtime Logging (Three Outputs)

Logs should be written to three distinct destinations to support both offline user queries and developer debugging:

```
                            [Log Message Generated]
                                       │
                                       ▼
                              [Local Event Bus]
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
  [SQLite Database]          [Rotating Log Files]             [IPC Event Stream]
  - Table: `system_logs`     - Path: `userData/logs/*.jsonl`  - Target: Renderer
  - Purpose: Local UI query  - Purpose: Crash diagnostics     - Purpose: Real-time
  - Keep: Last 5,000 logs    - Keep: 10 days of files           Developer Console
```

### Log JSON Record Format

```json
{
  "timestamp": "2026-07-13T22:20:05.102Z",
  "workerId": "worker-fork-4122",
  "workspaceId": "ws_estimating_01",
  "severity": "warn",
  "task": "smtp-dispatch",
  "message": "SMTP connection timeout on port 465, retrying via port 587...",
  "durationMs": 4000,
  "metadata": {
    "accountId": "acc_gmail_982",
    "targetEmail": "estimator@acme.com",
    "attempt": 2
  }
}
```

---

## 10. Developer Tools UI Blueprint

Since this is a desktop application, a built-in Developer Panel is invaluable. The panel UI is divided into six tabs:

```
+---------------------------------------------------------------------------------------+
| DEVELOPER CONSOLE                                                           [X] Close |
+---------------------------------------------------------------------------------------+
| [Jobs] | [Sync Queue] | [Event Stream] | [Database] | [IPC Monitor] | [Logs Console]  |
+---------------------------------------------------------------------------------------+
| ACTIVE JOBS                                                            Limit: [ 10 ]  |
| ID      TYPE         PRIORITY  STATUS     PROGRESS  DURATION   ERROR                  |
| ------------------------------------------------------------------------------------- |
| j_0192  discovery    High      running    [40%]     12.1s      -                      |
| j_0191  outreach     Medium    waiting    [100%]    0.4s       -                      |
| j_0182  enrichment   Low       failed     [20%]     4.2s       "Rate limit hit"       |
|                                                                                       |
| Actions: [ Pause Scheduler ]  [ Force Resume Waiting ]  [ Clear Completed Jobs ]     |
+---------------------------------------------------------------------------------------+
| LIVE EVENT LOGS (Filter: * )                                                          |
| 22:20:05.102Z  [Event]  outreach:email:sent   -> { msgId: "msg_92a", to: "acme.com" } |
| 22:20:06.140Z  [Sync]   sync:queue:processed  -> { entity: "contacts", op: "UPDATE" } |
| 22:20:08.502Z  [Worker] job:progress          -> { jobId: "j_0192", progress: 40 }    |
+---------------------------------------------------------------------------------------+
```

### Developer Console Features

- **Jobs Inspector**: View, pause, pause execution, or cancel active running tasks.
- **Sync Queue Monitor**: Check the queue length, view payloads, and trigger syncs manually.
- **Event Stream Logger**: A real-time stream of all events passing through the local Event Bus.
- **SQLite Inspector**: Run read-only SQL queries directly against the local `leadforge.db` from the UI.

---

## 11. Unified Sync Queue

Rather than maintaining separate queues for each entity type, LeadForge OS uses a single, generic `sync_queue` table:

```sql
CREATE TABLE sync_queue (
  id TEXT PRIMARY KEY,
  workspaceId TEXT NOT NULL,
  entityType TEXT NOT NULL,      -- 'companies', 'contacts', 'campaigns', 'jobs', 'sequence_logs'
  entityId TEXT NOT NULL,
  operation TEXT NOT NULL,       -- 'CREATE', 'UPDATE', 'DELETE'
  payload TEXT NOT NULL,         -- JSON string of changes
  version INTEGER NOT NULL,      -- LWW version mapping
  retryCount INTEGER DEFAULT 0,
  lastError TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_sync_queue_priority ON sync_queue(workspaceId, createdAt);
```

### Sync Engine Rules

1. **No Bypassing**: All database modifications write to SQLite first and insert a record into `sync_queue`. The local repository never makes direct Hono API network calls.
2. **Main Engine Processing**: The `SyncEngine` in Electron Main polls `sync_queue`. If online, it streams payloads to Hono in order, resolving conflicts using the `version` column.

---

## 12. Workspace Runtime Isolation

To support switching between multiple active workspaces, Electron Main manages isolated **Workspace Runtimes**:

```typescript
class WorkspaceRuntime {
  public readonly workspaceId: string;
  public readonly sqliteDb: any;
  public readonly eventBus: LocalEventBus;
  public readonly scheduler: JobScheduler;
  public readonly syncEngine: SyncEngine;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
    this.sqliteDb = this.initializeDatabase();
    this.eventBus = new LocalEventBus();
    this.scheduler = new JobScheduler(this);
    this.syncEngine = new SyncEngine(this);
  }

  public async start() {
    await this.syncEngine.start();
    await this.scheduler.start();
  }

  public async stop() {
    await this.scheduler.stop();
    await this.syncEngine.stop();
    this.sqliteDb.close();
  }
}
```

- **Dynamic Workspace Swapping**: When the user switches workspaces, the application spins down the previous workspace runtime and initializes the new one, keeping execution state cleanly isolated.

---

## 13. Technical Risks & Mitigations

- **SQLite Database Lock Concurrency**: Running multiple child workers that write to the SQLite database concurrently can cause `SQLITE_BUSY` errors.
  - _Mitigation_: Enable WAL (Write-Ahead Logging) mode, set a busy timeout of 5000ms, and route all worker writes through IPC back to a single SQLite connection thread in Electron Main.
- **Worker Process Crashes**: Headless browser automation (Playwright) can crash due to memory leaks or OS environment issues.
  - _Mitigation_: The supervisor monitors child process exit codes. If a worker exits with a non-zero code, the job is marked `interrupted`, the browser is cleaned up, and the job is scheduled for a retry.
- **Event Loop Latency**: Parsing large JSON Payloads or handling too many IPC messages in Electron Main can cause lag.
  - _Mitigation_: Offload parsing to child processes. The main process should only handle structured messages and store raw payloads.

---

## 14. Step-by-Step Migration Plan

```
[Phase 1: Database & IPC Cleanout]
 ├── Create unified 'jobs', 'sync_queue', and 'system_logs' tables in SQLite.
 ├── Move database write calls in Electron Main to insert to 'sync_queue' on mutations.
 └── Expose clean 'db:find' and 'db:save' IPC channels, removing Hono dependencies from the Renderer.

[Phase 2: Generic Job Scheduler & Host]
 ├── Implement the Node child process worker file.
 ├── Create the JobScheduler in Electron Main.
 └── Port Google Maps scraping and website crawling into JobPlugins.

[Phase 3: Event Bus & Decoupling]
 ├── Setup the Local Event Bus.
 ├── Route job progress, logging, and completion to the Event Bus.
 └── Wire the Automation trigger evaluations to run on 'discovery:import:completed'.

[Phase 4: Dev Tools & Diagnostics]
 ├── Add Developer Panel UI tabs to the React Renderer.
 └── Wire the UI to read logs, jobs, and events from the Event Bus over IPC.
```

---

## 15. Final Recommendation

If building LeadForge OS today, we should implement a **Generic Job Runtime** using isolated **Workspace Runtimes**.

By keeping the React Renderer focused on UI, moving sync logic to Electron Main, routing all heavy tasks through child workers, and using a plugin registry for custom search providers, conditions, and actions, LeadForge transitions into a scalable, local-first platform.
