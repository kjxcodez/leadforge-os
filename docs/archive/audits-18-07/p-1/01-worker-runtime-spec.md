# LeadForge OS — Worker Runtime Architecture Specification

> **Document Type**: Architecture Specification  
> **Phase**: 8 — Local Worker Runtime Audit  
> **Status**: Pre-Implementation Blueprint  
> **Scope**: Desktop (Electron Main process + forked Node workers)

---

## 1. Executive Summary

The current worker runtime in LeadForge OS is a **partially-implemented skeleton** that correctly establishes the foundational architectural pattern — `child_process.fork` + IPC messaging — but has critical gaps in several areas:

- The worker host (`worker-host.ts`) is **not registered as a build target** and cannot currently be resolved at runtime (`join(__dirname, 'worker.js')` does not point to a compiled artifact).
- All three job plugins (`scraper.ts`, `enricher.ts`, `outreach.ts`) are **simulations**, not real implementations.
- There is **no pause/resume capability**, no **heartbeat monitoring**, no **workspace isolation at the fork level**, and no **cancellation signal propagation** beyond SIGTERM polling.
- The `JobScheduler` is **architecturally sound** as a tick-based priority queue dispatcher but is missing several production-critical features.

The architecture **can evolve** into the full execution engine described in the product vision without a fundamental redesign. The foundations are correct. The gaps are implementation gaps, not design gaps.

---

## 2. Current Architecture Inventory

### 2.1 Component Map

```
Electron Main Process
│
├── WorkspaceManager           [SINGLETON]
│     └── setActiveWorkspace() → spins WorkspaceRuntime up/down
│
├── WorkspaceRuntime           [PER-WORKSPACE]
│     ├── sqliteDb             (better-sqlite3, WAL mode)
│     ├── eventBus             (LocalEventBus, scoped EventEmitter)
│     ├── scheduler            (JobScheduler, tick-based)
│     └── syncEngine           (SyncEngine, 5s poll)
│
├── JobScheduler               [SERVICES/SCHEDULER.TS]
│     ├── tick() every 1s      SELECT queued/retrying jobs
│     ├── runJob()             fork('worker.js'), send IPC 'start'
│     ├── activeWorkers        Map<jobId, ChildProcess>
│     ├── maxConcurrency = 3   HARDCODED
│     ├── handleJobSuccess()   UPDATE jobs SET status='completed'
│     ├── handleJobFailure()   retry logic, UPDATE status='retrying'
│     └── cancelJob()          SIGTERM + UPDATE status='cancelled'
│
├── Worker Host                [WORKERS/WORKER-HOST.TS]
│     ├── JobRegistry          Map<type, pluginFn>
│     │     ├── 'scraper:maps'      → scrapeMaps()
│     │     ├── 'enrich:website'   → enrichWebsite()
│     │     ├── 'outreach:campaign'→ dispatchOutreach()
│     │     └── 'mock:test'        → inline mock
│     └── process.on('message')   → resolve plugin, execute, send result
│
└── LocalEventBus              [LIB/EVENT-BUS.TS]
      ├── publish(type, payload)
      ├── subscribe(type, listener)
      └── events: job:*, sync:*, crm:*, system:log
```

### 2.2 SQLite Schema (Jobs)

```sql
CREATE TABLE jobs (
  id           TEXT PRIMARY KEY,
  workspaceId  TEXT NOT NULL,
  type         TEXT NOT NULL,
  status       TEXT CHECK(status IN ('queued','running','waiting','retrying','paused','cancelled','completed','failed','interrupted')),
  priority     INTEGER DEFAULT 1,
  payload      TEXT,       -- JSON
  progress     INTEGER DEFAULT 0,
  retryCount   INTEGER DEFAULT 0,
  maxRetries   INTEGER DEFAULT 3,
  workerId     TEXT,
  error        TEXT,
  startedAt    DATETIME,
  finishedAt   DATETIME,
  createdAt    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_jobs_scheduler ON jobs(workspaceId, status, priority, createdAt);
```

The schema correctly supports all required lifecycle states. The index is optimized for the scheduler's primary query pattern.

---

## 3. Audit Findings

### 3.1 Worker Host

| Concern                    | Finding                                                                        | Severity     |
| -------------------------- | ------------------------------------------------------------------------------ | ------------ |
| Build target resolution    | `join(__dirname, 'worker.js')` assumes compiled output — no build step defined | **CRITICAL** |
| Process isolation          | Plugins open their own SQLite connections independently — correct isolation    | OK           |
| Plugin registry            | Static flat map, cannot be extended at runtime                                 | MEDIUM       |
| IPC protocol               | Single `message` event with `{type, ...}` — works but brittle as features grow | MEDIUM       |
| Error propagation          | Catches errors and sends `{type:'error'}` — correct                            | OK           |
| Resource cleanup           | `db.close()` at end of each plugin — correct                                   | OK           |
| Multiple types per process | Only one job type per forked process — correct, by design                      | OK           |
| stdin/stdout               | `stdio: 'inherit'` — logs go to parent terminal, not captured                  | LOW          |

**Critical Gap**: The `worker-host.ts` must be compiled separately as a standalone Node entrypoint and explicitly bundled by electron-vite as an external worker chunk. Without this, `fork()` will throw `MODULE_NOT_FOUND`.

### 3.2 IPC Protocol

The current IPC message protocol is:

```
Main → Worker:  { command: 'start', jobId, workspaceId, type, payload }
Worker → Main:  { type: 'progress', progress, metadata }
               { type: 'log', severity, message, meta }
               { type: 'success', result }
               { type: 'error', error }
```

**What's Missing**:

- `{ type: 'cancel' }` — Main should be able to send a soft cancellation signal to the child without SIGTERM, allowing cleanup before exit
- `{ type: 'pause' }` / `{ type: 'resume' }` — not implemented
- `{ type: 'heartbeat' }` — no periodic liveness ping from worker to Main
- `{ type: 'checkpoint', data }` — no progress checkpointing for resumable jobs

### 3.3 Cancellation

Current cancellation mechanism:

1. `cancelJob(jobId)` calls `worker.kill('SIGTERM')`
2. Worker listens for `SIGTERM` and sets `isCancelledState = true`
3. Plugin loops check `ctx.isCancelled()` on each iteration

**Problems**:

- `SIGTERM` on Windows is not reliably honored by Node child processes — `kill('SIGTERM')` on Windows actually sends SIGKILL
- The cancel check only fires at iteration boundaries — a slow single operation (e.g., a single Playwright page load) will not respond to cancellation mid-operation
- No cleanup hooks — DB connections in the worker may not close if SIGTERM kills mid-transaction

**Recommended Pattern**:

```
Main → Worker: { command: 'cancel' }  (via process.send)
Worker: sets isCancelledState = true, does NOT kill immediately
Worker: at next checkpoint, performs cleanup, sends { type: 'cancelled' }
Worker: exits 0
```

### 3.4 Process Spawning

```typescript
// CURRENT (scheduler.ts:98)
const workerHostPath = join(__dirname, 'worker.js');
const worker = fork(workerHostPath, [], {
  env: { ...process.env, WORKSPACES_DB_DIR: ... },
  stdio: 'inherit',
});
```

**Problems**:

- Path assumes CJS compiled output — must align with electron-vite build configuration
- `stdio: 'inherit'` prevents capturing worker stdout/stderr in the Main process log sink
- `env: { ...process.env }` passes all parent environment variables to the child — security risk; should pass only required variables
- No `execArgv` — cannot attach Node inspector for worker debugging
- No resource limits — a runaway Playwright scraper could consume all RAM

### 3.5 Lifecycle State Machine

Current implemented states:

- `queued` → `running` → `completed`
- `queued` → `running` → `retrying` → `running` → `failed`
- `running` → `cancelled` (via cancelJob)
- `running` → `interrupted` (via scheduler.stop on app close)

Missing states per spec:

- `paused` — no implementation
- `resumed` — no implementation
- `waiting` — defined in schema/types but no scheduler path for it (needed for sequence steps)
- `pending` — not defined (pre-queued state)

### 3.6 Concurrency

- `maxConcurrency = 3` is hardcoded — must be configurable per workspace
- Concurrency is checked globally, not per job type — a scraper and enricher will compete for the same slot
- No per-job-type concurrency limits — e.g., Playwright jobs should have a separate limit from lightweight enrichment jobs
- No resource-aware throttling — CPU/memory usage not monitored

### 3.7 Memory and Resource Cleanup

When a job completes:

1. `handleJobSuccess()` calls `worker.kill('SIGTERM')` after success message — this is **incorrect**: the worker already called `process.exit(0)` on success, so killing it again is a no-op but could cause spurious errors if the process hasn't exited yet.
2. `this.activeWorkers.delete(jobId)` — correct
3. No worker memory monitoring

When the scheduler stops:

- `worker.kill('SIGTERM')` + UPDATE status='interrupted' — correct pattern
- `this.activeWorkers.clear()` — correct

**Gap**: If the process exits abnormally (unhandled exception before sending `error` message), the `exit` handler correctly catches it. But if the job writes partial data to SQLite before crashing, there is no rollback mechanism — data integrity depends on whether the plugin used transactions (all three current plugins do use transactions, so this is OK for now).

### 3.8 Multiple Concurrent Workers

The `activeWorkers` map correctly tracks all running processes by `jobId`. The tick-based approach correctly prevents spawning new workers when at capacity. However:

- There is no **per-workspace** concurrency cap — if multiple workspaces are ever active simultaneously (future), they share no concurrency context
- There is no **worker warm pool** — every job spawns a cold Node process (~300–500ms startup overhead for Playwright)
- No deduplication — if the same `type+payload` is queued twice, both will run

### 3.9 Stalled Worker Detection

There is **no heartbeat or timeout mechanism**. If a worker enters an infinite loop or blocks indefinitely on a network operation, it will hold its concurrency slot forever. The scheduler tick will never dispatch new jobs beyond the limit.

**Required**: A watchdog timer in `runJob()` that kills the worker after a configurable `maxDurationMs` and marks the job as `failed`.

---

## 4. Target Architecture Specification

### 4.1 Worker Host Build Target

The worker host must be compiled as a standalone CommonJS file separate from the main Electron bundle:

```js
// electron.vite.config.js — add worker entry
export default {
  main: {
    entry: 'src/main/index.ts'
    // ... existing config
  },
  worker: {
    entry: 'src/main/workers/worker-host.ts',
    output: { format: 'cjs', dir: 'dist/worker' }
  }
};
```

The scheduler must reference the correct compiled path:

```typescript
const workerHostPath = join(__dirname, '../worker/worker-host.js');
// Adjust relative to main bundle output dir
```

### 4.2 Full IPC Protocol Specification

```typescript
// Main → Worker messages
type MainToWorkerMsg =
  | { command: 'start'; jobId: string; workspaceId: string; type: string; payload: any }
  | { command: 'cancel' } // soft cancel request
  | { command: 'pause' } // soft pause request
  | { command: 'resume' } // resume after pause
  | { command: 'ping' }; // heartbeat check

// Worker → Main messages
type WorkerToMainMsg =
  | { type: 'ready' } // worker initialized
  | { type: 'progress'; progress: number; metadata?: any; checkpoint?: any }
  | { type: 'log'; severity: 'info' | 'warn' | 'error'; message: string; meta?: any }
  | { type: 'checkpoint'; data: any } // resumable state snapshot
  | { type: 'pong'; timestamp: string } // heartbeat response
  | { type: 'paused'; checkpoint: any } // paused and saved state
  | { type: 'cancelled'; cleanedUp: boolean } // graceful cancel complete
  | { type: 'success'; result: any }
  | { type: 'error'; error: string; recoverable: boolean };
```

### 4.3 Enriched JobContext

```typescript
export interface JobContext {
  jobId: string;
  workspaceId: string;
  payload: any;

  // Progress & logging
  updateProgress(progress: number, metadata?: ProgressMetadata): void;
  emitLog(message: string, severity?: 'info' | 'warn' | 'error', meta?: any): void;

  // Control signals
  isCancelled(): boolean;
  isPaused(): boolean;

  // Checkpointing (resumable jobs)
  saveCheckpoint(data: any): void;
  getCheckpoint(): any | null;

  // Resource helpers
  dbPath: string; // resolved SQLite path — worker opens its own connection
}

export interface ProgressMetadata {
  step?: number;
  total?: number;
  current?: number;
  description?: string;
  eta?: number; // estimated seconds remaining
  entity?: string; // current entity being processed (e.g., company name)
}
```

### 4.4 Concurrency Configuration

Concurrency settings must be stored in the workspace `settings` SQLite table and loaded at runtime:

```typescript
interface SchedulerConfig {
  maxConcurrency: number; // global max workers (default: 3)
  concurrencyByType: {
    'scraper:maps': number; // default: 1 (browser-heavy)
    'crawler:website': number; // default: 2
    'enrich:website': number; // default: 3
    'outreach:campaign': number; // default: 1
    'automation:workflow': number; // default: 5
  };
  workerTimeoutMs: number; // default: 900000 (15 min)
  heartbeatIntervalMs: number; // default: 10000 (10s)
  heartbeatTimeoutMs: number; // default: 30000 (30s — 3 missed beats)
}
```

### 4.5 Watchdog / Heartbeat Mechanism

```typescript
// In runJob(), after fork:
const heartbeat = {
  lastSeen: Date.now(),
  intervalId: setInterval(() => {
    worker.send({ command: 'ping' });

    const elapsed = Date.now() - heartbeat.lastSeen;
    if (elapsed > config.heartbeatTimeoutMs) {
      AppLogger.error('JobScheduler', `Heartbeat timeout for job ${job.id}`);
      worker.kill('SIGKILL');
      handleJobFailure(job.id, job.retryCount, job.maxRetries, 'Heartbeat timeout');
    }
  }, config.heartbeatIntervalMs)
};

// On 'pong' message:
heartbeat.lastSeen = Date.now();

// On worker exit: clearInterval(heartbeat.intervalId)
```

### 4.6 Plugin Registry Design (Extensible)

Replace the static `JobRegistry` map with a plugin registry pattern:

```typescript
class WorkerPluginRegistry {
  private plugins = new Map<string, (ctx: JobContext) => Promise<any>>();

  register(type: string, fn: (ctx: JobContext) => Promise<any>): void {
    if (this.plugins.has(type)) throw new Error(`Plugin '${type}' already registered`);
    this.plugins.set(type, fn);
  }

  resolve(type: string): ((ctx: JobContext) => Promise<any>) | null {
    return this.plugins.get(type) ?? null;
  }

  listTypes(): string[] {
    return [...this.plugins.keys()];
  }
}

// worker-host.ts entrypoint
const registry = new WorkerPluginRegistry();
registry.register('scraper:maps', scrapeMaps);
registry.register('crawler:website', crawlWebsite); // NEW
registry.register('enrich:website', enrichWebsite);
registry.register('enrich:ai', aiEnrich); // FUTURE
registry.register('outreach:campaign', dispatchOutreach);
registry.register('automation:workflow', executeWorkflow); // FUTURE
registry.register('sequence:step', executeSequenceStep); // FUTURE
registry.register('mock:test', mockTest);
```

### 4.7 Process Spawn Hardening

```typescript
const worker = fork(workerHostPath, [], {
  env: {
    // Minimal environment — never pass full process.env
    WORKSPACES_DB_DIR: join(app.getPath('userData'), 'workspaces'),
    NODE_ENV: process.env.NODE_ENV,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY // only if needed by plugin
  },
  stdio: ['ignore', 'pipe', 'pipe', 'ipc'], // capture stdout/stderr
  execArgv: is.dev ? ['--inspect=0'] : [] // debuggable in dev
});

// Pipe worker stdout/stderr to AppLogger
worker.stdout?.on('data', (data) => {
  AppLogger.info('WorkerHost', data.toString().trim(), job.workspaceId);
});
worker.stderr?.on('data', (data) => {
  AppLogger.error('WorkerHost', data.toString().trim(), job.workspaceId);
});
```

---

## 5. Component Responsibilities (Definitive)

| Component          | Owns                                                       | Does NOT Own             |
| ------------------ | ---------------------------------------------------------- | ------------------------ |
| `WorkspaceRuntime` | Lifecycle of scheduler, syncEngine, eventBus per workspace | Executing jobs           |
| `JobScheduler`     | Fork management, priority dispatch, concurrency, heartbeat | Job business logic       |
| `WorkerHost`       | Plugin resolution, context building, IPC bridge            | SQLite schema, sync      |
| `JobPlugin` (each) | Single job type execution against SQLite                   | IPC protocol, scheduling |
| `LocalEventBus`    | Pub/sub within Main process                                | Cross-process events     |
| `SyncEngine`       | Push mutations to API, pull remote data                    | Job execution            |
| `AppLogger`        | Structured log aggregation (console, SQLite, JSONL, IPC)   | Business logic           |

---

## 6. Missing Components Checklist

| Component                                 | Status       | Priority |
| ----------------------------------------- | ------------ | -------- |
| Worker host build target in electron-vite | ❌ Missing   | P0       |
| Soft cancel via IPC (not SIGTERM)         | ❌ Missing   | P0       |
| Heartbeat / watchdog timer                | ❌ Missing   | P0       |
| Pause / Resume state machine              | ❌ Missing   | P1       |
| Resumable checkpoint persistence          | ❌ Missing   | P1       |
| Per-type concurrency limits               | ❌ Missing   | P1       |
| Worker warm pool                          | ❌ Missing   | P2       |
| Job deduplication before queueing         | ❌ Missing   | P1       |
| Worker memory/CPU usage reporting         | ❌ Missing   | P2       |
| Configurable worker timeout               | ❌ Missing   | P1       |
| stdio capture from workers                | ❌ Missing   | P1       |
| Real Playwright scraper plugin            | ❌ Simulated | P0       |
| Real Cheerio crawler plugin               | ❌ Simulated | P0       |
| Real SMTP outreach plugin                 | ❌ Simulated | P0       |
| Automation worker plugin                  | ❌ Missing   | P1       |
| Sequence step worker plugin               | ❌ Missing   | P1       |
