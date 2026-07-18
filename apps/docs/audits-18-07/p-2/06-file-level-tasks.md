# LeadForge OS — File-Level Tasks

> **Document Type**: Implementation Contract  
> **Source Specs**: All Phase 8 specifications + live codebase inspection  
> **Phase**: 9 — Implementation  
> **Note**: No code is generated here. File paths are links to the actual source. All changes are described, not implemented.

---

## 1. Shared Types

### [apps/desktop/src/shared/types/job.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/shared/types/job.ts)

| Field | Detail |
|---|---|
| **Current Responsibility** | Defines `JobStatus`, `JobPayload`, `JobContext`, `JobPlugin` |
| **Required Changes** | 1. Add `'starting'` to `JobStatus` union (TASK-001). 2. Add `isPaused(): boolean`, `saveCheckpoint(data: any): void`, `getCheckpoint(): any \| null`, `dbPath: string` to `JobContext` (TASK-008). 3. Add `ProgressMetadata` interface. 4. Add `SchedulerConfig` interface. |
| **Priority** | P0 |
| **Estimated Risk** | Low — type-only changes, TypeScript will flag all call sites that need updating |
| **Related Files** | `scheduler.ts`, `worker-host.ts`, all plugin files |

### [apps/desktop/src/shared/types/ipc.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/shared/types/ipc.ts) [NEW]

| Field | Detail |
|---|---|
| **Current Responsibility** | Does not exist |
| **Required Changes** | Create with `MainToWorkerMsg` union type and `WorkerToMainMsg` union type per worker_runtime_spec.md §4.2 (TASK-006). |
| **Priority** | P0 |
| **Estimated Risk** | Low — new file, no regressions |
| **Related Files** | `worker-host.ts`, `scheduler.ts` |

---

## 2. Database Layer

### [apps/desktop/src/main/database/runner.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/runner.ts)

| Field | Detail |
|---|---|
| **Current Responsibility** | Schema definition and `runMigrations()` for migrations 001–007 |
| **Required Changes** | 1. Append migration 008: recreate `jobs` table with `starting` in CHECK + new columns (TASK-001). 2. Add pre-migration backup logic before 008. 3. Append migration 009: ALTER `companies` + `contacts` for scraping columns (TASK-003). 4. Append migration 010: ALTER `sequence_executions` (TASK-004). |
| **Priority** | P0 |
| **Estimated Risk** | HIGH — migration 008 recreates the jobs table. Requires backup and careful testing. |
| **Related Files** | `connection.ts`, all repositories |

### [apps/desktop/src/main/database/connection.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/connection.ts)

| Field | Detail |
|---|---|
| **Current Responsibility** | Opens, caches, and closes workspace-scoped SQLite connections with WAL mode |
| **Required Changes** | No changes required. Existing implementation is correct per runtime_health_report.md §1. |
| **Priority** | N/A |
| **Estimated Risk** | None |
| **Related Files** | `runner.ts`, `workspace-runtime.ts` |

### [apps/desktop/src/main/database/repositories/local-crm.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/repositories/local-crm.ts)

| Field | Detail |
|---|---|
| **Current Responsibility** | CRUD, bulk save, soft/hard delete against workspace SQLite with sync_queue writes |
| **Required Changes** | 1. Add `crawlStatus`, `confidence`, `verificationStatus` fields to `syncableTables` determination logic — UNKNOWN (see database_changes.md). 2. Add `sequence_logs` to tracked tables if logs are to be synced. 3. Optimize: cache `pragma table_info()` result per table name instead of calling per `save()` invocation (runtime_health_report.md §4 bottleneck). |
| **Priority** | P2 |
| **Estimated Risk** | Low — existing logic is correct, optimization only |
| **Related Files** | All IPC handlers that call LocalCRMRepository |

---

## 3. Core Runtime

### [apps/desktop/src/main/lib/workspace-runtime.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/lib/workspace-runtime.ts)

| Field | Detail |
|---|---|
| **Current Responsibility** | Orchestrates sqliteDb, eventBus, scheduler, syncEngine lifecycle for one workspace |
| **Required Changes** | 1. Instantiate `AutomationTriggerEvaluator` in constructor (TASK-021). 2. Instantiate `EventBusBridge` in constructor (TASK-012). 3. Call `automationTrigger.start()` in `start()` (TASK-021). 4. Call `eventBridge.start()` in `start()` (TASK-012). 5. Call `recoverInterruptedJobs()` in `start()` after scheduler starts (TASK-016). 6. Call `resumeOverdueWaitJobs()` in `start()` after scheduler starts (TASK-015). 7. Call `automationTrigger.stop()` in `stop()` (TASK-021). 8. Call `eventBridge.stop()` in `stop()` (TASK-012). 9. Fix comment numbering (currently two `// 3.` comments in stop()). |
| **Priority** | P0 |
| **Estimated Risk** | Medium — changes to startup sequence must be ordered correctly to avoid timing issues |
| **Related Files** | `automation-trigger.ts` (NEW), `event-bridge.ts` (NEW), `scheduler.ts`, `sync-engine.ts` |

### [apps/desktop/src/main/lib/event-bus.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/lib/event-bus.ts)

| Field | Detail |
|---|---|
| **Current Responsibility** | Scoped EventEmitter wrapper with typed EventType union |
| **Required Changes** | Add `'job:starting'`, `'job:paused'`, `'job:resumed'`, `'job:heartbeat:timeout'`, `'automation:triggered'` to `EventType` union (TASK-002). `AppEvent` type requires no changes. |
| **Priority** | P0 |
| **Estimated Risk** | Low — additive type change |
| **Related Files** | `scheduler.ts`, `automation-trigger.ts`, `event-bridge.ts` |

### [apps/desktop/src/main/lib/event-bridge.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/lib/event-bridge.ts) [NEW]

| Field | Detail |
|---|---|
| **Current Responsibility** | Does not exist |
| **Required Changes** | Create class `EventBusBridge` that subscribes to `LocalEventBus` `job:*` events and forwards them via `BrowserWindow.getAllWindows()[n].webContents.send(...)`. Must be cleanly stoppable (unsubscribe all). Must handle `BrowserWindow` not yet existing gracefully. |
| **Priority** | P1 |
| **Estimated Risk** | Low — new file, no regressions |
| **Related Files** | `workspace-runtime.ts`, `event-bus.ts` |

### [apps/desktop/src/main/lib/workspace-manager.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/lib/workspace-manager.ts)

| Field | Detail |
|---|---|
| **Current Responsibility** | Singleton supervisor for WorkspaceRuntime lifecycle switching |
| **Required Changes** | No behavioral changes required. Verify `getActiveRuntime()` is used (not bypassed) in all IPC handlers. |
| **Priority** | N/A |
| **Estimated Risk** | None |
| **Related Files** | `workspace-runtime.ts` |

---

## 4. Scheduler

### [apps/desktop/src/main/services/scheduler.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/scheduler.ts)

| Field | Detail |
|---|---|
| **Current Responsibility** | Tick-based job dispatcher, fork management, IPC message handling, success/failure/cancel |
| **Required Changes** | 1. Fix worker host path to reference compiled output from electron-vite (TASK-004, TASK-005). 2. Update `fork()` options: `stdio`, minimal env, `execArgv` (TASK-009). 3. Pipe `worker.stdout/stderr` to `AppLogger` (TASK-009). 4. Write `status = 'starting'` on fork before worker is ready (TASK-006). 5. Handle `{ type: 'ready' }` message — transition from `starting` to `running` (TASK-006). 6. Add heartbeat: `setInterval(ping, heartbeatIntervalMs)`, watchdog check (TASK-010). 7. Handle `{ type: 'pong' }` message (TASK-010). 8. Handle `{ type: 'checkpoint' }` — write `checkpointData`, `checkpointAt` to SQLite (TASK-014). 9. Handle `{ type: 'paused' }` — write checkpoint, update status to `paused` (TASK-014). 10. Handle `{ type: 'cancelled' }` — update status to `cancelled` (TASK-011). 11. Add `pauseJob(jobId)` method: send `{ command: 'pause' }` (TASK-014). 12. Replace `cancelJob()` SIGTERM with soft cancel IPC + 15s hard-kill fallback (TASK-011). 13. Clear heartbeat interval on all worker exit paths. 14. Remove `worker.kill('SIGTERM')` from `handleJobSuccess()` (BC-011). 15. Add second tick query block for WAIT resumption (TASK-015). 16. Update tick retry filter: add `scheduledAt <= datetime('now')` condition (BC-006). 17. Write `scheduledAt` in `handleJobFailure()` for retry backoff (TASK-001). 18. Pass `_checkpoint` from `checkpointData` in job payload when re-dispatching paused/interrupted jobs. 19. Add per-type concurrency tracking and limits (TASK-013). |
| **Priority** | P0 |
| **Estimated Risk** | HIGH — this is the most change-dense file. All changes are interdependent. Must be implemented and tested atomically. |
| **Related Files** | `worker-host.ts`, `job.ts`, `event-bus.ts`, `logger.ts` |

---

## 5. Worker Host

### [apps/desktop/src/main/workers/worker-host.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/worker-host.ts)

| Field | Detail |
|---|---|
| **Current Responsibility** | Entrypoint for forked worker process. Static `JobRegistry` map. `process.on('message')` dispatch. |
| **Required Changes** | 1. Replace static `JobRegistry` with `WorkerPluginRegistry` instance (TASK-007). 2. Send `{ type: 'ready' }` immediately on startup (TASK-006). 3. Handle `{ command: 'cancel' }` — set `isCancelledState = true` in context (TASK-006). 4. Handle `{ command: 'pause' }` — set `isPausedState = true` in context (TASK-006). 5. Handle `{ command: 'resume' }` — clear `isPausedState` (TASK-006). 6. Handle `{ command: 'ping' }` — send `{ type: 'pong', timestamp }` (TASK-006, TASK-010). 7. Implement `ctx.saveCheckpoint()` as `process.send({ type: 'checkpoint', data })` (TASK-008). 8. Implement `ctx.getCheckpoint()` from `payload._checkpoint` (TASK-008). 9. Add `ctx.dbPath` — resolve workspace DB path from env `WORKSPACES_DB_DIR` (TASK-008). 10. On cancel complete: send `{ type: 'cancelled', cleanedUp: true }`, then `process.exit(0)`. 11. On pause complete: send `{ type: 'paused', checkpoint }`, then `process.exit(0)`. 12. Do NOT call `process.exit()` directly in plugins — plugins return result to host. |
| **Priority** | P0 |
| **Estimated Risk** | Medium — new message types must be added carefully alongside existing ones |
| **Related Files** | `plugin-registry.ts` (NEW), `job.ts`, `ipc.ts` (NEW), all plugin files |

### [apps/desktop/src/main/workers/plugin-registry.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugin-registry.ts) [NEW]

| Field | Detail |
|---|---|
| **Current Responsibility** | Does not exist |
| **Required Changes** | Create `WorkerPluginRegistry` class per worker_runtime_spec.md §4.6 (TASK-007). |
| **Priority** | P0 |
| **Estimated Risk** | Low — new file |
| **Related Files** | `worker-host.ts` |

### [apps/desktop/src/main/workers/plugins/scraper.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/scraper.ts)

| Field | Detail |
|---|---|
| **Current Responsibility** | `scrapeMaps()` simulation using setTimeout and fake data |
| **Required Changes** | Full rewrite with real Playwright implementation per scraping_pipeline_spec.md §3. Add duplicate check before company insert. Use `ctx.saveCheckpoint()` every 10 companies. Check `ctx.isCancelled()` and `ctx.isPaused()` after each company. Close Playwright context on exit. |
| **Priority** | P0 |
| **Estimated Risk** | Very High — new external dependency (Playwright), real network I/O, complex automation |
| **Related Files** | `worker-host.ts`, `job.ts`, `database/connection.ts` |

### [apps/desktop/src/main/workers/plugins/crawler.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/crawler.ts) [NEW]

| Field | Detail |
|---|---|
| **Current Responsibility** | Does not exist (job type `crawler:website` is unregistered) |
| **Required Changes** | Create `crawlWebsite(ctx: JobContext)` plugin per scraping_pipeline_spec.md §4. BFS with p-limit, robots.txt check, email regex extraction, contact classification, confidence scoring, Cheerio-first with Playwright fallback (fallback is FUTURE). |
| **Priority** | P0 |
| **Estimated Risk** | Very High — new file, complex scraping logic, external network I/O |
| **Related Files** | `worker-host.ts`, `job.ts`, migration 009 columns |

### [apps/desktop/src/main/workers/plugins/enricher.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/enricher.ts)

| Field | Detail |
|---|---|
| **Current Responsibility** | `enrichWebsite()` simulation with fake contact data |
| **Required Changes** | Full rewrite: use `ctx.dbPath` to open SQLite, load contacts from crawled data, run email validation, set `confidence`, `type`, `verificationStatus` per scraping_pipeline_spec.md §4.5. |
| **Priority** | P0 |
| **Estimated Risk** | High — rewrite, must not corrupt existing contacts |
| **Related Files** | `crawler.ts`, migration 009 columns |

### [apps/desktop/src/main/workers/plugins/outreach.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/outreach.ts)

| Field | Detail |
|---|---|
| **Current Responsibility** | `dispatchOutreach()` simulation with setTimeout |
| **Required Changes** | Full rewrite: read SMTP credentials from `email_accounts` SQLite table, construct Nodemailer transport, send real emails per contact, log to `sequence_logs`, respect `dailyLimit`/`hourlyLimit`. |
| **Priority** | P0 |
| **Estimated Risk** | High — real SMTP, credential handling, rate limiting |
| **Related Files** | `job.ts`, `sequence_logs` table |

### [apps/desktop/src/main/workers/plugins/automation.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/automation.ts) [NEW]

| Field | Detail |
|---|---|
| **Current Responsibility** | Does not exist |
| **Required Changes** | Create `executeAutomationWorkflow(ctx: JobContext)` per automation_engine_spec.md §2.3. Handle all step types. WAIT step writes `nextExecutionAt` and exits. CONDITION evaluates against SQLite. All steps write to `sequence_logs`. |
| **Priority** | P1 |
| **Estimated Risk** | Very High — complex business logic, many step types, state machine |
| **Related Files** | `automation-trigger.ts` (NEW), migration 010 columns, `sequences` table |

---

## 6. New Services

### [apps/desktop/src/main/services/automation-trigger.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/automation-trigger.ts) [NEW]

| Field | Detail |
|---|---|
| **Current Responsibility** | Does not exist |
| **Required Changes** | Create `AutomationTriggerEvaluator` class per automation_engine_spec.md §2.2. Subscribe to `crm:created`, `crm:updated` on `LocalEventBus`. Query `sequences` WHERE `status='active'` AND trigger matches. Deduplicate. Queue `automation:workflow` jobs. |
| **Priority** | P1 |
| **Estimated Risk** | Medium — new file, well-specified |
| **Related Files** | `event-bus.ts`, `workspace-runtime.ts`, `scheduler.ts` |

---

## 7. IPC Handlers

### [apps/desktop/src/main/ipc/scheduler.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/scheduler.ts)

| Field | Detail |
|---|---|
| **Current Responsibility** | `scheduler:jobs:submit`, `scheduler:jobs:list`, `scheduler:jobs:cancel` |
| **Required Changes** | 1. Add `scheduler:jobs:pause` handler — calls `activeRuntime.scheduler.pauseJob(jobId)` (TASK-024). 2. Add `scheduler:jobs:resume` handler — updates job to `queued` (TASK-024). 3. Add `idempotencyKey` check in submit handler (TASK-025). 4. Add `scheduledAt` parameter support in submit handler. 5. Update `scheduler:jobs:cancel` to await async `cancelJob()` (BC-005). |
| **Priority** | P1 |
| **Estimated Risk** | Low — additive changes to existing file |
| **Related Files** | `scheduler.ts` (service), `workspace-manager.ts` |

### [apps/desktop/src/main/ipc/automation.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/automation.ts)

| Field | Detail |
|---|---|
| **Current Responsibility** | Sequence CRUD via SDK, execution start/stop via SDK `sdk.executions.start()` |
| **Required Changes** | 1. `sequence:start` handler — currently calls `sdk.executions.start()` which triggers API-side execution. Must change to: create a local `automation:workflow` job in SQLite instead of calling SDK. 2. `execution:logs` — currently reads from remote only. Must fall back to `sequence_logs` SQLite table when offline. 3. `execution:list` — verify sync_queue correctly propagates local executions to MongoDB. |
| **Priority** | P1 |
| **Estimated Risk** | Medium — behavioral change in `sequence:start` is a breaking change for the renderer |
| **Related Files** | `automation.service.ts` (API), `local-crm.ts`, `automation-trigger.ts` |

---

## 8. Build Configuration

### [apps/desktop/electron.vite.config.js](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/electron.vite.config.js) (or `.ts`)

| Field | Detail |
|---|---|
| **Current Responsibility** | Configures Vite build for main, preload, and renderer |
| **Required Changes** | Add separate worker entrypoint that compiles `worker-host.ts` as CJS to a dedicated output directory (TASK-005). Output path must match the path reference in `scheduler.ts`. |
| **Priority** | P0 |
| **Estimated Risk** | Medium — build system changes can break development hot-reload |
| **Related Files** | `scheduler.ts` (path reference) |

---

## 9. API Files

### [apps/api/src/services/automation/automation.service.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/services/automation/automation.service.ts)

| Field | Detail |
|---|---|
| **Current Responsibility** | Full automation orchestration: trigger evaluation, step execution, email sending, WAIT timer, `process.nextTick()` recursion |
| **Required Changes** | 1. Delete `executeNextStep()` method (TASK-023, BC-001). 2. Delete `handleEvent()` method (TASK-023, BC-001). 3. Trim `startExecution()` to create PENDING record only — remove call to `executeNextStep()` (TASK-023). 4. `stopExecution()` — keep, update status to CANCELLED only. |
| **Priority** | P1 — cannot be done until TASK-022 is complete |
| **Estimated Risk** | HIGH — removes currently-running production functionality. Must be deployed after desktop replacement is confirmed working. |
| **Related Files** | `outreach.service.ts`, `sequence-execution.model.ts`, automation routes |

---

## 10. Renderer Files

### [apps/desktop/src/preload/index.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/preload/index.ts)

| Field | Detail |
|---|---|
| **Current Responsibility** | Exposes IPC channels to renderer via contextBridge |
| **Required Changes** | Expose `window.ipc.on('job:progress', ...)`, `window.ipc.on('job:completed', ...)`, `window.ipc.on('job:failed', ...)`, `window.ipc.on('job:paused', ...)`, `window.ipc.on('job:cancelled', ...)` for real-time event subscription. |
| **Priority** | P1 |
| **Estimated Risk** | Low — additive |
| **Related Files** | `event-bridge.ts` (NEW), renderer job components |

### Renderer job status badge / display components

| Field | Detail |
|---|---|
| **Current Responsibility** | Renders job status as static text or polling-derived state |
| **Required Changes** | Handle new `'starting'` status value (show spinner, same as `'running'`). Subscribe to `window.ipc.on('job:progress', ...)` for live progress bars. Subscribe to `window.ipc.on('job:completed/failed', ...)` to update job list without polling. |
| **Priority** | P1 |
| **Estimated Risk** | Low |
| **Related Files** | `preload/index.ts`, `event-bridge.ts` |
| **UNKNOWN** | The specific renderer component files for job display are not identified in this audit. **Required Investigation**: Locate all renderer components that render job status, progress, or job lists. |
