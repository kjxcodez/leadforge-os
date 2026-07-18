# LeadForge OS — Build Order

> **Document Type**: Implementation Contract  
> **Source Specs**: All Phase 8 specifications  
> **Phase**: 9 — Implementation

---

## Layer A — Foundation (No Dependencies)

---

### TASK-001
**Title**: Extend JobStatus type and SQLite CHECK constraint to include `starting`  
**Reason**: `job_lifecycle_spec.md §1.2` defines `starting` as a required state. The current SQLite CHECK constraint and TypeScript type do not include it. Conflict C1 in dependency graph.  
**Dependencies**: None  
**Complexity**: Low  
**Blocks**: TASK-002, TASK-006, TASK-015  
**Expected Files**:
- `apps/desktop/src/shared/types/job.ts` — add `'starting'` to `JobStatus` union
- `apps/desktop/src/main/database/runner.ts` — add migration 008, add `starting` to CHECK + add `scheduledAt`, `checkpointData`, `checkpointAt`, `idempotencyKey`, `durationMs` columns

**Acceptance Criteria**:
- TypeScript compiles with `starting` in `JobStatus`
- SQLite accepts `INSERT INTO jobs (..., status) VALUES (..., 'starting')`
- New columns exist on `jobs` table after migration 008 runs
- Migration is idempotent (running twice does not error)

---

### TASK-002
**Title**: Extend LocalEventBus EventType union with missing event types  
**Reason**: `runtime_dependency_graph.md §[3]` identifies missing event types required by AutomationTriggerEvaluator and EventBridge. Current union is incomplete.  
**Dependencies**: None  
**Complexity**: Low  
**Blocks**: TASK-010, TASK-011, TASK-012  
**Expected Files**:
- `apps/desktop/src/main/lib/event-bus.ts` — add `'job:starting'`, `'job:paused'`, `'job:resumed'`, `'job:heartbeat:timeout'`, `'automation:triggered'` to `EventType`

**Acceptance Criteria**:
- TypeScript compiles without casting when publishing new event types
- `eventBus.publish('job:paused', payload)` is type-safe

---

### TASK-003
**Title**: Add `crawlStatus`, `crawledAt`, `score`, `confidence`, `verificationStatus`, `sourceUrl`, `sourcePlatform`, `priority` columns to companies and contacts  
**Reason**: `scraping_pipeline_spec.md §6` defines required schema additions for crawl tracking and contact quality. None of these columns exist.  
**Dependencies**: None  
**Complexity**: Low  
**Blocks**: TASK-019, TASK-020  
**Expected Files**:
- `apps/desktop/src/main/database/runner.ts` — migration 009 with all new columns

**Acceptance Criteria**:
- All columns exist after migration runs
- `INSERT INTO companies (..., crawlStatus, score) VALUES (..., 'pending', NULL)` succeeds
- `INSERT INTO contacts (..., confidence, type, verificationStatus) VALUES (..., 'low', 'unknown', 'unverified')` succeeds
- Migration is idempotent

---

### TASK-004
**Title**: Extend sequence_executions table with `cancelledAt`, `cancelReason`, `parentJobId`  
**Reason**: `job_lifecycle_spec.md §8` defines these columns as required for sequence execution tracking.  
**Dependencies**: None  
**Complexity**: Low  
**Blocks**: TASK-022  
**Expected Files**:
- `apps/desktop/src/main/database/runner.ts` — migration 010

**Acceptance Criteria**:
- Columns exist in sequence_executions after migration
- Migration is idempotent

---

## Layer B — IPC Protocol & Build System

---

### TASK-005
**Title**: Configure electron-vite to compile worker-host as a separate CJS entrypoint  
**Reason**: `worker_runtime_spec.md §4.1` and `runtime_health_report.md §W1` identify this as P0. Without it, `fork()` throws MODULE_NOT_FOUND and zero jobs can run.  
**Dependencies**: None  
**Complexity**: Medium  
**Blocks**: TASK-006, TASK-007, ALL worker tasks  
**Expected Files**:
- `apps/desktop/electron.vite.config.js` — add worker entry point config
- Verify output path resolves to what scheduler references

**Acceptance Criteria**:
- `pnpm build` produces `dist/worker/worker-host.js` (or equivalent path)
- `node dist/worker/worker-host.js` starts without MODULE_NOT_FOUND
- Path referenced in scheduler matches compiled output path
- Dev hot-reload does not break worker path resolution

---

### TASK-006
**Title**: Redesign IPC protocol in worker-host.ts — full message types  
**Reason**: `worker_runtime_spec.md §4.2` specifies the complete IPC protocol. Current protocol is missing cancel, pause, resume, ping, pong, ready, checkpoint, paused, cancelled message types.  
**Dependencies**: TASK-001, TASK-005  
**Complexity**: Medium  
**Blocks**: TASK-007, TASK-008, TASK-013, TASK-014  
**Expected Files**:
- `apps/desktop/src/shared/types/ipc.ts` (NEW) — `MainToWorkerMsg` and `WorkerToMainMsg` type definitions
- `apps/desktop/src/main/workers/worker-host.ts` — update `process.on('message')` to handle all command types, send `ready` on startup, respond `pong` to `ping`

**Acceptance Criteria**:
- Worker sends `{ type: 'ready' }` immediately on startup before waiting for 'start'
- Worker responds `{ type: 'pong', timestamp }` to `{ command: 'ping' }`
- Worker handles `{ command: 'cancel' }` by setting cancel flag (not process.exit)
- Worker handles `{ command: 'pause' }` by setting pause flag
- Worker sends `{ type: 'cancelled', cleanedUp: true/false }` before exiting on cancel
- TypeScript types cover all message variants

---

### TASK-007
**Title**: Replace static JobRegistry with WorkerPluginRegistry class  
**Reason**: `worker_runtime_spec.md §4.6` specifies an extensible plugin registry class. The current static map cannot be extended at runtime and has no duplicate registration guard.  
**Dependencies**: TASK-005, TASK-006  
**Complexity**: Low  
**Blocks**: TASK-016, TASK-017, TASK-018, TASK-019, TASK-020, TASK-021, TASK-022  
**Expected Files**:
- `apps/desktop/src/main/workers/plugin-registry.ts` (NEW) — `WorkerPluginRegistry` class
- `apps/desktop/src/main/workers/worker-host.ts` — replace `JobRegistry` object with `WorkerPluginRegistry` instance

**Acceptance Criteria**:
- `registry.register('scraper:maps', fn)` works
- `registry.register('scraper:maps', fn)` a second time throws `Error: Plugin 'scraper:maps' already registered`
- `registry.resolve('unknown:type')` returns null
- `registry.listTypes()` returns array of all registered type strings

---

### TASK-008
**Title**: Enrich JobContext interface with isPaused, saveCheckpoint, getCheckpoint, dbPath  
**Reason**: `worker_runtime_spec.md §4.3` specifies the complete `JobContext` interface. The current interface is missing `isPaused()`, `saveCheckpoint()`, `getCheckpoint()`, `dbPath`.  
**Dependencies**: TASK-006  
**Complexity**: Low  
**Blocks**: TASK-016, TASK-017, TASK-018, TASK-019, TASK-020, TASK-021, TASK-022  
**Expected Files**:
- `apps/desktop/src/shared/types/job.ts` — add `isPaused()`, `saveCheckpoint(data)`, `getCheckpoint()`, `dbPath` to `JobContext`
- `apps/desktop/src/main/workers/worker-host.ts` — implement context construction with new fields, including `isPausedState` flag and checkpoint send

**Acceptance Criteria**:
- `ctx.isPaused()` returns false by default, true after pause command received
- `ctx.saveCheckpoint({ step: 3 })` causes worker to send `{ type: 'checkpoint', data: { step: 3 } }` to Main
- `ctx.getCheckpoint()` returns data from job payload `_checkpoint` field (populated by scheduler on resume)
- `ctx.dbPath` is the resolved absolute path to the workspace SQLite file

---

## Layer C — Scheduler Hardening

---

### TASK-009
**Title**: Fix process spawn options — stdio pipe, minimal env, execArgv  
**Reason**: `worker_runtime_spec.md §4.7` and `runtime_health_report.md §W10` identify `stdio: 'inherit'` and full env passthrough as security and observability defects.  
**Dependencies**: TASK-005  
**Complexity**: Low  
**Blocks**: TASK-010  
**Expected Files**:
- `apps/desktop/src/main/services/scheduler.ts` — update `fork()` options: `stdio: ['ignore','pipe','pipe','ipc']`, minimal env, `execArgv` dev condition

**Acceptance Criteria**:
- Worker stdout is piped to AppLogger (not parent terminal)
- Worker stderr is piped to AppLogger as error severity
- Worker env contains only: `WORKSPACES_DB_DIR`, `NODE_ENV`, and job-type-specific secrets
- Worker stdout `console.log` calls appear in `system_logs` SQLite table

---

### TASK-010
**Title**: Implement heartbeat / watchdog timer in JobScheduler.runJob()  
**Reason**: `worker_runtime_spec.md §4.5` and `runtime_health_report.md §W4` (P0). A hung worker holds a concurrency slot indefinitely, freezing the job queue.  
**Dependencies**: TASK-006, TASK-009, TASK-002  
**Complexity**: Medium  
**Blocks**: TASK-013  
**Expected Files**:
- `apps/desktop/src/main/services/scheduler.ts` — add heartbeat object per worker, `setInterval(ping, heartbeatIntervalMs)`, check elapsed vs `heartbeatTimeoutMs`, kill and fail on timeout

**Acceptance Criteria**:
- Worker receives `{ command: 'ping' }` every `heartbeatIntervalMs` ms
- If worker does not respond `{ type: 'pong' }` within `heartbeatTimeoutMs`, job is marked `failed` with error `'Heartbeat timeout'`
- Killed worker is removed from `activeWorkers`
- Heartbeat interval is cleared when worker exits (success, failure, or crash)
- EventBus event `'job:heartbeat:timeout'` is published

---

### TASK-011
**Title**: Implement soft cancel via IPC message (replace SIGTERM cancel)  
**Reason**: `worker_runtime_spec.md §3.3` and `runtime_health_report.md §W5` (P1). SIGTERM on Windows = SIGKILL. Workers cannot clean up.  
**Dependencies**: TASK-006, TASK-002  
**Complexity**: Medium  
**Blocks**: TASK-014  
**Expected Files**:
- `apps/desktop/src/main/services/scheduler.ts` — `cancelJob()`: send `{ command: 'cancel' }` first, set timeout for hard kill fallback, update status to `cancelled` on `'cancelled'` message
- `apps/desktop/src/main/ipc/scheduler.ts` — add `scheduler:jobs:pause` and `scheduler:jobs:resume` IPC handlers

**Acceptance Criteria**:
- `cancelJob(jobId)` sends `{ command: 'cancel' }` to worker via `process.send`
- Worker receives cancel command and sets `isCancelledState = true`
- Worker sends `{ type: 'cancelled', cleanedUp: true }` before exiting
- If worker does not respond within 15s, Main calls `worker.kill('SIGKILL')`
- Job status is `cancelled` in SQLite after cancellation completes
- On Windows: cancellation does not cause SQLite corruption (verified by checking DB integrity post-cancel)

---

### TASK-012
**Title**: Implement EventBus→Renderer IPC Bridge  
**Reason**: `runtime_health_report.md §7` and `worker_runtime_spec.md` (W8). The renderer has no real-time job event subscription. Jobs panel is non-functional.  
**Dependencies**: TASK-002, TASK-006  
**Complexity**: Low  
**Blocks**: None (unblocks renderer work)  
**Expected Files**:
- `apps/desktop/src/main/lib/event-bridge.ts` (NEW) — subscribe to all `job:*` events and `win.webContents.send()` them
- `apps/desktop/src/main/lib/workspace-runtime.ts` — instantiate and start EventBridge in start(), stop in stop()
- `apps/desktop/src/preload/index.ts` — expose `window.ipc.on('job:progress', ...)` etc.

**Acceptance Criteria**:
- `job:progress` EventBus event causes `win.webContents.send('job:progress', ...)` within 50ms
- `job:completed` event reaches renderer
- `job:failed` event reaches renderer with error string
- Bridge reinitializes correctly on workspace switch
- No memory leaks (listeners cleaned on workspace switch)

---

### TASK-013
**Title**: Implement configurable per-type concurrency limits in JobScheduler  
**Reason**: `worker_runtime_spec.md §4.4` and `runtime_health_report.md §W7`. Global `maxConcurrency = 3` is hardcoded and treats all job types equally.  
**Dependencies**: TASK-010  
**Complexity**: Medium  
**Blocks**: None  
**Expected Files**:
- `apps/desktop/src/main/services/scheduler.ts` — load `SchedulerConfig` from workspace settings table, add per-type active count tracking, check both global and per-type limits in tick()
- `apps/desktop/src/shared/types/job.ts` — add `SchedulerConfig` interface

**Acceptance Criteria**:
- `scraper:maps` concurrency never exceeds configured limit (default: 1)
- `crawler:website` concurrency never exceeds configured limit (default: 2)
- Global concurrency never exceeds `maxConcurrency`
- Limits are read from SQLite settings table, fallback to defaults if missing
- Changing settings mid-run takes effect on next tick

---

### TASK-014
**Title**: Implement pause / resume with checkpoint persistence in JobScheduler  
**Reason**: `worker_runtime_spec.md §4.3` and `job_lifecycle_spec.md §4`. `paused` status is defined but has no implementation path.  
**Dependencies**: TASK-008, TASK-011  
**Complexity**: High  
**Blocks**: None  
**Expected Files**:
- `apps/desktop/src/main/services/scheduler.ts` — add `pauseJob(jobId)`, handle `{ type: 'paused', checkpoint }` message, store checkpoint in `checkpointData`
- `apps/desktop/src/main/services/scheduler.ts` — update `runJob()` to pass `_checkpoint` from `checkpointData` in job payload when resuming
- `apps/desktop/src/main/ipc/scheduler.ts` — add `scheduler:jobs:pause`, `scheduler:jobs:resume` IPC handlers

**Acceptance Criteria**:
- `scheduler:jobs:pause` IPC handler sends `{ command: 'pause' }` to active worker
- Worker sets `isPausedState = true`, calls `ctx.saveCheckpoint()`, sends `{ type: 'paused', checkpoint }`
- Main stores checkpoint in `jobs.checkpointData` column
- Job status transitions to `paused` in SQLite
- `scheduler:jobs:resume` updates job to `queued`
- On next dispatch, scheduler passes `_checkpoint` in start payload
- Plugin reads `ctx.getCheckpoint()` and resumes from saved step

---

### TASK-015
**Title**: Implement WAIT-timer resumption scan in JobScheduler.tick()  
**Reason**: `job_lifecycle_spec.md §2` and `automation_engine_spec.md §4.2`. Waiting sequence executions must be re-queued when their timer fires.  
**Dependencies**: TASK-001  
**Complexity**: Medium  
**Blocks**: TASK-022  
**Expected Files**:
- `apps/desktop/src/main/services/scheduler.ts` — add second query block in tick(): `SELECT from sequence_executions WHERE status='waiting' AND nextExecutionAt <= datetime('now')`; for each result, check if resume job already queued, if not insert new `automation:workflow` job

**Acceptance Criteria**:
- A sequence_execution in `waiting` status with `nextExecutionAt` in the past is re-queued within 1 scheduler tick (≤ 2s)
- No duplicate resume jobs are created if one is already queued/running
- Resumed execution `currentStep` is correct (not reset to 0)

---

### TASK-016
**Title**: Implement interrupted-job recovery in WorkspaceRuntime.start()  
**Reason**: `job_lifecycle_spec.md §6` and `runtime_health_report.md §W9`. Interrupted jobs are never re-queued after app restart.  
**Dependencies**: TASK-001  
**Complexity**: Low  
**Blocks**: None  
**Expected Files**:
- `apps/desktop/src/main/lib/workspace-runtime.ts` — add `recoverInterruptedJobs()` call in start(), implement the method: UPDATE `interrupted` → `queued` for auto-recoverable types

**Acceptance Criteria**:
- After app restart, `interrupted` jobs of type `scraper:maps`, `crawler:website`, `enrich:website`, `automation:workflow` are re-queued
- `outreach:campaign` jobs are NOT auto-recovered (requires explicit user action — safety)
- Recovery runs before scheduler.start() or immediately after

---

## Layer D — New Worker Plugins (Real Implementations)

---

### TASK-017
**Title**: Implement real Google Maps scraper plugin (Playwright)  
**Reason**: `scraping_pipeline_spec.md §3`, `runtime_health_report.md §W2` (P0). Current `scrapeMaps()` is a simulation.  
**Dependencies**: TASK-007, TASK-008, TASK-005, new-packages Playwright  
**Complexity**: Very High  
**Blocks**: TASK-018, TASK-019 (pipeline depends on real company data)  
**Expected Files**:
- `apps/desktop/src/main/workers/plugins/scraper.ts` — rewrite with real Playwright implementation
- Checkpoint: save `{ collectedCount, lastScrollPosition }`
- Duplicate check before insert
- Extract: name, website, phone, address, rating

**Acceptance Criteria**:
- Running `scraper:maps` with query `"dentists boston"` produces ≥ 1 real company record in SQLite
- Duplicate domains are skipped (not re-inserted)
- Progress updates fire after each company stored
- Cancel command stops scraping within 1 page load cycle
- Browser context is closed on plugin exit (no orphaned Chromium processes)
- Job completes with `status = 'completed'` in SQLite

---

### TASK-018
**Title**: Implement real website crawler plugin (Cheerio + fetch)  
**Reason**: `scraping_pipeline_spec.md §4`, `runtime_health_report.md §W2` (P0). Job type `crawler:website` does not exist.  
**Dependencies**: TASK-007, TASK-008, TASK-005, new-packages Cheerio, robots-parser  
**Complexity**: Very High  
**Blocks**: TASK-019  
**Expected Files**:
- `apps/desktop/src/main/workers/plugins/crawler.ts` (NEW) — `crawlWebsite(ctx: JobContext)` implementation
- Priority URL ordering, BFS with p-limit concurrency, robots.txt check, email regex extraction, contact classification, confidence scoring

**Acceptance Criteria**:
- Given a real company website, produces ≥ 1 contact record in SQLite
- Respects `robots.txt` — disallowed paths are skipped
- Respects `maxDepth` and `maxPages` limits
- Does not insert duplicate emails
- Marks company `crawlStatus = 'completed'` or `'failed'` on exit
- Checkpoint saves visited URL set for resume capability

---

### TASK-019
**Title**: Rewrite enrichWebsite plugin (Cheerio — real extraction from crawled data)  
**Reason**: `runtime_health_report.md §W2` (P0). Current `enrichWebsite` generates synthetic data.  
**Dependencies**: TASK-007, TASK-008, TASK-003  
**Complexity**: High  
**Blocks**: None  
**Expected Files**:
- `apps/desktop/src/main/workers/plugins/enricher.ts` — rewrite with real Cheerio extraction, email validation, confidence scoring, type classification

**Acceptance Criteria**:
- Enriched contacts have real email addresses (not `firstname.lastname@domain.com` templates)
- `confidence` field is set (`high`, `medium`, `low`)
- `type` field is set (`human`, `department`, `unknown`)
- `verificationStatus` is set to `unverified`
- Invalid email formats are rejected before insert

---

### TASK-020
**Title**: Rewrite dispatchOutreach plugin (Nodemailer — real SMTP)  
**Reason**: `runtime_health_report.md §W2` (P0). Current outreach plugin simulates SMTP with `setTimeout`.  
**Dependencies**: TASK-007, TASK-008, new-packages Nodemailer  
**Complexity**: High  
**Blocks**: None  
**Expected Files**:
- `apps/desktop/src/main/workers/plugins/outreach.ts` — rewrite with real Nodemailer SMTP transport
- Read SMTP credentials from `email_accounts` SQLite table
- Per-contact email send with template variable substitution
- Log success/failure per contact in `sequence_logs`

**Acceptance Criteria**:
- Given valid SMTP credentials in `email_accounts`, sends real email to test address
- Failed sends (invalid domain, SMTP error) are logged as `failed` in `sequence_logs`
- Cancelled mid-send does not leave partial send logs
- Daily/hourly limits from `email_accounts.dailyLimit` / `hourlyLimit` are respected

---

## Layer E — Automation Engine

---

### TASK-021
**Title**: Implement AutomationTriggerEvaluator  
**Reason**: `automation_engine_spec.md §2.2`. Local automation triggers do not exist. Currently automations run on the API.  
**Dependencies**: TASK-002, TASK-001  
**Complexity**: High  
**Blocks**: TASK-022, TASK-023  
**Expected Files**:
- `apps/desktop/src/main/services/automation-trigger.ts` (NEW) — `AutomationTriggerEvaluator` class
- `apps/desktop/src/main/lib/workspace-runtime.ts` — instantiate and wire AutomationTriggerEvaluator in start()/stop()

**Acceptance Criteria**:
- When `crm:created` event fires with `entityType: 'company'`, evaluator queries sequences with trigger type `COMPANY_CREATED`
- Matching active sequences each get an `automation:workflow` job queued
- Duplicate check prevents two executions for same sequence+entity pair when one is already running/waiting
- Evaluator binds on start(), unbinds on stop()

---

### TASK-022
**Title**: Implement AutomationWorkflowPlugin (`automation:workflow`)  
**Reason**: `automation_engine_spec.md §2.3`. Sequence execution does not exist on the desktop.  
**Dependencies**: TASK-007, TASK-008, TASK-015, TASK-004, TASK-021  
**Complexity**: Very High  
**Blocks**: TASK-023  
**Expected Files**:
- `apps/desktop/src/main/workers/plugins/automation.ts` (NEW) — `executeAutomationWorkflow(ctx)`
- Handles all step types: WAIT, SEND_EMAIL, ASSIGN_TAG, REMOVE_TAG, CREATE_NOTE, MOVE_PIPELINE_STAGE, START_CAMPAIGN, STOP_CAMPAIGN, ASSIGN_OWNER, CREATE_ACTIVITY, FINISH_SEQUENCE, CONDITION
- WAIT: writes `nextExecutionAt`, exits with `{ status: 'waiting' }`
- CONDITION: `evaluateCondition()` against SQLite
- Writes `sequence_executions` and `sequence_logs`

**Acceptance Criteria**:
- A sequence with steps [WAIT 60s, SEND_EMAIL, FINISH] creates a `waiting` execution, resumes after 60s, sends email, marks completed
- CONDITION step halts execution if condition fails
- All step types produce correct `sequence_logs` entries
- Cancel command stops execution at next step boundary
- Checkpoint saves `{ currentStep, executionId }` for pause/resume

---

### TASK-023
**Title**: Remove executeNextStep / handleEvent from API AutomationService  
**Reason**: `automation_engine_spec.md §1.1`. P0 architectural violation — API executes sequence steps.  
**Dependencies**: TASK-022 must be complete and tested first  
**Complexity**: Medium  
**Blocks**: Nothing (cleanup)  
**Expected Files**:
- `apps/api/src/services/automation/automation.service.ts` — delete `executeNextStep()`, delete `handleEvent()`, trim `startExecution()` to create-only
- `apps/api/src/routes/` — verify no route calls removed methods

**Acceptance Criteria**:
- `AutomationService` has no `executeNextStep` method
- `AutomationService` has no `handleEvent` method
- `startExecution()` creates execution record with status `PENDING` and returns without running any step
- All API automation tests pass with new CRUD-only contract
- No compile errors

---

## Layer F — IPC & Renderer Integration

---

### TASK-024
**Title**: Add `scheduler:jobs:pause` and `scheduler:jobs:resume` IPC handlers  
**Reason**: `job_lifecycle_spec.md §4` specifies pause/resume as user-initiated via IPC. No handlers exist.  
**Dependencies**: TASK-014  
**Complexity**: Low  
**Blocks**: None  
**Expected Files**:
- `apps/desktop/src/main/ipc/scheduler.ts` — add two new `safeRegister` calls

**Acceptance Criteria**:
- `window.ipc.invoke('scheduler:jobs:pause', { workspaceId, jobId })` pauses a running job
- `window.ipc.invoke('scheduler:jobs:resume', { workspaceId, jobId })` resumes a paused job
- Both handlers return error if job is not in correct state

---

### TASK-025
**Title**: Add deduplication / idempotencyKey check to scheduler:jobs:submit  
**Reason**: `worker_runtime_spec.md §3.8` and `job_lifecycle_spec.md §7`. Same job can be submitted twice without deduplication.  
**Dependencies**: TASK-001  
**Complexity**: Low  
**Blocks**: None  
**Expected Files**:
- `apps/desktop/src/main/ipc/scheduler.ts` — add idempotency key check before INSERT

**Acceptance Criteria**:
- Submitting two jobs with same `idempotencyKey` returns the existing job ID (not a new one)
- Jobs without `idempotencyKey` are always inserted (no dedup)
- Idempotency only applies when previous job is not in `failed`, `cancelled`, or `completed` state

---

> **Note**: Tasks are ordered strictly by dependency. No task in Layer D begins before Layers A–C are complete. No task in Layer E begins before Layer D plugins exist.
