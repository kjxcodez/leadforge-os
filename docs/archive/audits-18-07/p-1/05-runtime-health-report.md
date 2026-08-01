# LeadForge OS — Runtime Health Report

> **Document Type**: Audit Health Report  
> **Phase**: 8 — Local Worker Runtime Audit  
> **Status**: Complete  
> **Date**: July 2026

---

## Executive Verdict

The LeadForge OS local runtime is **architecturally sound and directionally correct**. The team has correctly identified the desktop-first philosophy and implemented the key scaffolding: workspace isolation, forked workers, priority scheduler, WAL-mode SQLite, event bus, structured logging, and sync engine.

However, the runtime is currently **pre-production** — it is a skeleton with simulations where real implementations must exist. Several P0 issues must be resolved before any real scraping, enrichment, or automation can execute.

**Overall Rating**: 6.5 / 10 (foundation: 9/10 — implementations: 3/10)

---

## 1. Strengths

### ✅ Correct Architectural Principles

The team has correctly established:

- `child_process.fork` for worker isolation — correct choice over worker_threads for Playwright workloads
- Per-workspace SQLite files (`leadforge_${workspaceId}.db`) — excellent isolation
- WAL + busy_timeout on all SQLite connections — correct for concurrent read/write under workers
- Priority-ordered tick dispatch — correct for mixed workload types
- LocalEventBus with scoped pub/sub — correct decoupling pattern
- Three-way logging (console, SQLite, JSONL) — production-ready
- WorkspaceRuntime lifecycle management — cleanly designed

### ✅ SQLite Schema Quality

The `jobs` table schema correctly defines all required lifecycle states including `interrupted` and `waiting`. The index `idx_jobs_scheduler` on `(workspaceId, status, priority, createdAt)` is optimal for the scheduler's primary query pattern.

The `system_logs` table with a 5000-row cap, JSONL rotation with 10-day pruning, and real-time IPC broadcast is production-grade.

### ✅ LocalCRMRepository Correctness

The repository correctly:

- Validates table names against alphanumeric pattern (SQL injection prevention)
- Uses `pragma table_info()` to resolve valid columns dynamically (prevents column mismatch errors)
- Wraps every write + sync_queue insertion in a single transaction (ACID correctness)
- Handles `_id` → `id` conversion for MongoDB compatibility
- Implements both `skipQueue` flag for pull-sync writes

### ✅ SyncEngine Correctness

The SyncEngine correctly:

- Processes sync_queue in FIFO order
- Implements LWW (Last-Write-Wins) via sequential processing
- Suspends on network errors rather than losing items
- Runs pull+push in the Main process (not renderer)
- Broadcasts `sync:completed` to all BrowserWindow instances

### ✅ WorkspaceManager Isolation

`WorkspaceManager.setActiveWorkspace()` correctly:

- Stops the previous runtime before starting the new one
- Prevents concurrent runtimes for the same workspace
- Propagates errors cleanly with `await runtime.stop()` on failure

---

## 2. Weaknesses

### ❌ W1: Worker Host Is Not a Build Target (P0)

**File**: `scheduler.ts:98` — `join(__dirname, 'worker.js')`

The worker-host script must be compiled as a separate entry point by electron-vite. Currently, no such configuration exists. At runtime, `fork()` will throw `MODULE_NOT_FOUND`.

**Impact**: Zero jobs can run. The entire worker runtime is broken in production builds.

### ❌ W2: All Job Plugins Are Simulations (P0)

All three plugins (`scrapeMaps`, `enrichWebsite`, `dispatchOutreach`) generate synthetic data with `setTimeout` delays. No Playwright, no Cheerio, no SMTP exists in the desktop app.

**Impact**: No real value is delivered to users. The product cannot be demonstrated.

### ❌ W3: Automation Executes on the API (P0 Violation)

`AutomationService.executeNextStep()` in `apps/api` runs sequence steps, sends emails, and manages WAIT timers using `process.nextTick()` recursion. This violates the core architectural principle.

**Impact**: Automations are network-dependent, cannot work offline, and run outside user control. The API is at risk of becoming an untraceable job runner.

### ❌ W4: No Heartbeat / Watchdog (P0)

A worker that hangs (infinite loop, blocked network, Playwright deadlock) will hold its concurrency slot indefinitely. The scheduler stops dispatching new jobs after the concurrency limit is reached.

**Impact**: One bad scrape job can freeze the entire job queue permanently until app restart.

### ❌ W5: Cancellation is SIGTERM-Only (P1)

On Windows, `worker.kill('SIGTERM')` is equivalent to `SIGKILL`. Workers get no chance to clean up open database connections, close Playwright contexts, or write final state.

**Impact**: Potential for corrupt SQLite state, leaked browser processes, and incomplete job records on Windows (the primary target platform).

### ❌ W6: No Pause / Resume (P1)

The `paused` status is defined in the schema and `JobStatus` type but has no implementation path — no IPC handler, no worker-side state, no checkpoint mechanism.

**Impact**: Users cannot pause long-running scrapes and resume them. One of the most-requested UX features in similar products.

### ❌ W7: Concurrency is Hardcoded (P1)

`maxConcurrency = 3` is a compile-time constant. There is no per-type concurrency limit. Playwright-based scrapers compete with lightweight enrichers for the same slots.

**Impact**: Incorrect resource allocation. A single concurrency limit cannot serve diverse workloads optimally.

### ❌ W8: No Progress Relay to Renderer (P1)

The scheduler publishes `job:progress` to the `LocalEventBus` but there is no bridge that forwards these events to the renderer via `win.webContents.send()`. The renderer has no real-time job monitoring.

**Impact**: The UI cannot show live progress, current step, current entity, ETA, or logs. The Jobs panel is essentially non-functional for active jobs.

### ❌ W9: Interrupted Jobs Not Auto-Recovered (P1)

When the app closes, running jobs are marked `interrupted`. On restart, `WorkspaceRuntime.start()` does not re-queue these jobs. They remain `interrupted` indefinitely.

**Impact**: Long scraping sessions are permanently lost on unexpected app close.

### ❌ W10: stdout/stderr Not Captured from Workers (P2)

`stdio: 'inherit'` in the fork call causes worker stdout/stderr to go to the parent terminal only. This means worker console.log output is not captured in `system_logs` or forwarded to the renderer.

**Impact**: Debugging worker failures in production is impossible.

---

## 3. Risks

### 🔴 R1: API Automation Migration Complexity

Migrating `AutomationService.executeNextStep()` from the API to the desktop worker is a significant undertaking. The API's `AutomationService` handles step execution for potentially thousands of active sequences. Moving this to desktop requires:

- New worker plugin (`automation:workflow`)
- New `AutomationTriggerEvaluator` in Main process
- WAIT timer persistence + resumption in scheduler
- Migration of all active executions from MongoDB to SQLite

**Risk**: Regression in existing automation functionality during migration.

### 🔴 R2: SQLite BUSY on Concurrent Workers

With `maxConcurrency = 3` and each worker opening its own SQLite connection, there is a risk of `SQLITE_BUSY` errors when all three workers write to the same workspace database simultaneously.

**Mitigation**: The WAL mode and `busy_timeout = 5000ms` significantly reduce this risk, but do not eliminate it. Recommended: serialize writes through a single connection per workspace owned by Main, with workers posting write requests via IPC.

**Risk**: Data corruption or dropped writes under high concurrency.

### 🟡 R3: Playwright Memory Leaks

Playwright browsers are expensive — each context consumes 100–300MB. Without explicit context disposal and process cleanup, a crashed worker could leave orphaned browser processes.

**Risk**: Memory exhaustion over extended scraping sessions.

### 🟡 R4: Sync Queue Overflow

If the network is unavailable for an extended period while scraping is active, the `sync_queue` table can grow unboundedly. There is currently no cap on sync_queue size.

**Risk**: SQLite file grows to gigabytes during offline operation.

### 🟡 R5: Worker Process Orphaning

If the Main process crashes abruptly (not a clean app quit), child worker processes will become orphaned Node processes. They continue consuming CPU/memory until the OS cleans them up.

**Mitigation**: Use `detached: false` (default) in `fork()` — this is already correct. Orphan risk is low but not zero.

---

## 4. Bottlenecks

| Bottleneck                          | Location              | Impact                                        | Mitigation                       |
| ----------------------------------- | --------------------- | --------------------------------------------- | -------------------------------- |
| Playwright startup time             | `scraper:maps` plugin | 1–3s per job (cold browser)                   | Browser pool in worker           |
| Single-threaded SQLite writes       | All plugins           | Write contention at 3 concurrent workers      | WAL mode (already applied)       |
| Scheduler tick every 1s             | `scheduler.ts:30`     | Polling overhead; 1s dispatch latency         | Acceptable for current scale     |
| Sequential sync_queue processing    | `sync-engine.ts:199`  | Large queues delay syncing                    | Batch API calls (future)         |
| No rate limiting in crawlers        | `enricher.ts`         | Potential IP bans from target sites           | Add `requestDelayMs` per domain  |
| `setInterval` polling in SyncEngine | `sync-engine.ts:42`   | Wakes every 5s even when idle                 | EventBus-driven trigger (future) |
| `saveMany()` column derivation      | `local-crm.ts:127`    | `pragma table_info` called on every bulk save | Cache column sets per table      |

---

## 5. Missing Components

| Component                                      | Priority | Blocks                    |
| ---------------------------------------------- | -------- | ------------------------- |
| Worker host build target (electron-vite entry) | P0       | Everything                |
| Real Playwright Google Maps scraper            | P0       | Discovery feature         |
| Real Cheerio website crawler                   | P0       | Contact discovery feature |
| Real SMTP email dispatcher                     | P0       | Outreach feature          |
| Soft cancel IPC protocol                       | P0       | Cancellation on Windows   |
| Heartbeat / watchdog timer                     | P0       | Queue stability           |
| Progress → renderer IPC bridge                 | P1       | Jobs UI                   |
| Pause / Resume with checkpoint                 | P1       | UX feature                |
| Interrupted job recovery on startup            | P1       | Data integrity            |
| Per-type concurrency limits                    | P1       | Resource management       |
| AutomationTriggerEvaluator                     | P1       | Local automations         |
| AutomationWorkflowPlugin                       | P1       | Local automations         |
| WAIT timer resumption in scheduler             | P1       | Sequence engine           |
| `scheduledAt` column for delayed jobs          | P1       | Retry backoff, scheduling |
| `checkpointData` column for pause              | P1       | Pause/resume              |
| AI enrichment plugin                           | P2       | AI features               |
| Company scoring plugin                         | P2       | Lead scoring              |
| Browser context pool                           | P2       | Performance               |
| Sync queue size cap                            | P2       | Storage safety            |
| `idempotencyKey` for job deduplication         | P2       | Correctness               |
| Worker CPU/memory monitoring                   | P3       | Observability             |

---

## 6. Scalability Assessment

### Current Tested Ceiling

- **Workers**: 3 concurrent (hardcoded)
- **Jobs**: Unlimited queue depth (SQLite)
- **Companies**: Tested with ~10 (simulated)
- **Contacts**: Tested with ~10 per company (simulated)
- **Workspaces**: 1 active at a time

### Projected Architecture Ceilings (No Redesign Required)

| Dimension                   | Ceiling                    | Notes                                                                   |
| --------------------------- | -------------------------- | ----------------------------------------------------------------------- |
| Concurrent workers          | ~10–15                     | Beyond this, CPU/RAM becomes the limiting factor on typical hardware    |
| Running jobs simultaneously | 500+                       | SQLite queue is unbounded; scheduler handles any queue depth            |
| Companies per workspace     | 100,000+                   | SQLite with proper indexes handles millions of rows; no redesign needed |
| Contacts per workspace      | 1,000,000+                 | SQLite row limit is effectively unbounded                               |
| Sequences in flight         | ~50 concurrent WAIT states | Scheduler tick handles any count                                        |
| Workspaces per app instance | 1 active (current)         | Multi-workspace concurrent support is a future phase                    |
| Campaigns                   | Unlimited                  | SMTP is rate-limited by email provider, not by this architecture        |

### What Requires Redesign at Scale

| Scenario                                       | Redesign Needed                                                         |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| 50 concurrent active workspaces                | WorkspaceManager must support concurrent runtimes (not just one active) |
| Real-time collaborative editing across devices | WebSocket/SSE push from API (current polling is inadequate)             |
| AI enrichment at >100 companies/hour           | GPU-accelerated local LLM or API batching required                      |
| Sync queue > 100k items                        | Batched API sync (currently sequential per item)                        |
| Cross-workspace campaign analytics             | Aggregation layer beyond per-workspace SQLite                           |

### Verdict on 50 Workers / 500 Jobs

The current architecture **can support this scale** with the following additions:

1. Configurable `maxConcurrency` per workspace (not hardcoded to 3)
2. Per-type concurrency limits
3. `scheduledAt` + delayed dispatch for backoff
4. Heartbeat to prevent slot starvation
5. WAL mode already applied — no SQLite concurrency redesign needed

The **fundamental architecture does not need to be replaced**. The scheduler, IPC protocol, plugin registry, and SQLite persistence model can all scale to the required dimensions.

---

## 7. Progress Reporting Architecture (Target)

```
Worker process
  process.send({ type: 'progress', progress: 45, metadata: {
    step: 5, total: 10, current: 5, entity: 'Apex Boston Dentists',
    description: 'Crawling contact page', eta: 120
  }})
       │
       ▼
JobScheduler (Main process)
  worker.on('message') →
    db.prepare('UPDATE jobs SET progress=?, updatedAt=? WHERE id=?').run(45, now, jobId)
    eventBus.publish('job:progress', { jobId, progress: 45, metadata })
       │
       ▼
EventBus IPC Bridge (NEW — required)
  eventBus.subscribe('job:progress', (event) => {
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('job:progress', event.payload);
    });
  });
       │
       ▼
Renderer (React)
  useEffect(() => {
    window.ipc.on('job:progress', (payload) => {
      queryClient.setQueryData(['jobs', payload.jobId], (old) => ({
        ...old, progress: payload.progress, metadata: payload.metadata
      }));
    });
  }, []);
       │
       ▼
UI Components
  <JobProgressBar percent={job.progress} />
  <JobCurrentStep step={job.metadata?.description} />
  <JobCurrentEntity entity={job.metadata?.entity} />
  <JobETA seconds={job.metadata?.eta} />
  <JobLogs jobId={job.id} />
```

**Required Fields in UI for each active job**:

- Status badge (Queued / Running / Waiting / Paused / Retrying / Completed / Failed / Cancelled)
- Progress percentage
- Current step description
- Current entity name
- ETA (estimated seconds remaining)
- Duration (elapsed time since startedAt)
- Log stream (real-time via IPC subscription)
- Retry count / maxRetries
- Error message (if failed)
- Cancel / Pause / Resume buttons

---

## 8. Prioritized Remediation Plan

### Phase A — Make Workers Actually Work (P0, ~2–3 days)

1. Configure `worker-host.ts` as electron-vite external entry
2. Implement soft cancel via IPC (replace SIGTERM on Windows)
3. Implement heartbeat + watchdog (30s timeout)
4. Fix `stdio: 'pipe'` and route to AppLogger
5. Fix `handleJobSuccess` double-kill

### Phase B — Real Implementations (P0, ~2–3 weeks)

6. Implement real Playwright Google Maps scraper
7. Implement real Cheerio website crawler
8. Implement real SMTP email dispatcher (Nodemailer)

### Phase C — UX & Control (P1, ~1 week)

9. Add progress → renderer IPC bridge
10. Implement pause / resume with checkpoint
11. Implement interrupted job recovery on startup
12. Add per-type concurrency limits

### Phase D — Automation Migration (P1, ~1–2 weeks)

13. Implement AutomationTriggerEvaluator
14. Implement AutomationWorkflowPlugin
15. Implement WAIT timer resumption in scheduler tick
16. Remove automation execution from API

### Phase E — Polish (P2, ~3–5 days)

17. Add `scheduledAt`, `checkpointData`, `idempotencyKey` to jobs schema
18. Add sync queue size cap
19. Add browser context pooling
20. Add AI enrichment plugin (stub → real)
