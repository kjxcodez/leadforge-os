# LeadForge OS — Test Plan

> **Document Type**: Implementation Contract  
> **Source Specs**: All Phase 8 specifications  
> **Phase**: 9 — Implementation

---

## Testing Infrastructure Requirements

Before any tests can run, the following must be confirmed:

- A test framework is configured (`vitest` or `jest`) for the desktop package
- SQLite in-memory databases are usable in test contexts (`better-sqlite3` supports `:memory:`)
- IPC handlers can be tested without launching a real BrowserWindow (use Electron's `ipcMain`/`ipcRenderer` mock or test the handler functions directly)
- Worker process tests use `child_process.fork` in test with the compiled worker bundle

**UNKNOWN**: What test framework is currently configured for `apps/desktop`?  
**Required Investigation**: Check `apps/desktop/package.json` for `"test"` script, presence of `vitest.config.ts` or `jest.config.js`.

---

## Group 1 — SQLite Schema Tests (TASK-001, TASK-003, TASK-004)

### T-001-1 Migration 008 — jobs table recreation

- Insert a job with `status = 'starting'` → succeeds
- Insert a job with `status = 'invalid_status'` → throws CHECK constraint violation
- All original 7 migration steps still apply after 008 runs
- New columns (`scheduledAt`, `checkpointData`, `checkpointAt`, `idempotencyKey`, `durationMs`) exist in schema
- Running `runMigrations()` twice on same database does not error (idempotent)
- Jobs inserted before migration 008 have `NULL` values for new columns (not missing)

### T-001-2 Migration 009 — companies/contacts columns

- `companies` table has `crawlStatus` with DEFAULT 'pending'
- `companies.crawlStatus` CHECK only allows `('pending','in_progress','completed','failed','skipped')`
- `contacts` table has `confidence`, `type`, `verificationStatus`
- Inserting an invalid `confidence` value → CHECK constraint violation
- Existing company rows have `crawlStatus = 'pending'` after migration

### T-001-3 Migration 010 — sequence_executions columns

- `sequence_executions` has `cancelledAt`, `cancelReason`, `parentJobId`
- All three columns are nullable
- Existing rows have NULL values for new columns

### T-001-4 Pre-migration backup

- When migration 008 has not been applied, a `.pre008.bak` file is created before migration
- If migration 008 fails, the backup file exists for recovery

### T-001-5 Index verification

- `idx_jobs_scheduled` index exists after migration 008
- `idx_jobs_idempotency` partial index exists and is UNIQUE
- `idx_companies_crawl_status` exists after migration 009

---

## Group 2 — EventBus Tests (TASK-002)

### T-002-1 New event types compile

- Publishing `'job:starting'`, `'job:paused'`, `'job:resumed'`, `'job:heartbeat:timeout'`, `'automation:triggered'` via TypeScript does not produce type errors

### T-002-2 Wildcard subscription receives new event types

- Subscribe to `'*'`
- Publish `'job:paused'`
- Listener fires with correct `AppEvent.type`

### T-002-3 EventBus cleanup

- After `eventBus.clear()`, no listeners fire on publish

---

## Group 3 — IPC Protocol Tests (TASK-006, TASK-008)

### T-006-1 Worker sends 'ready' on startup

- Fork `worker-host.js`
- Within 3000ms, receive `{ type: 'ready' }` message
- No other messages before 'ready'

### T-006-2 Worker responds to 'ping' with 'pong'

- After 'start' command, send `{ command: 'ping' }`
- Receive `{ type: 'pong', timestamp: string }` within 500ms
- `timestamp` is a valid ISO date string

### T-006-3 Worker handles 'cancel' gracefully

- Start a long-running mock job (minimum 10s)
- Send `{ command: 'cancel' }` after 1s
- Receive `{ type: 'cancelled', cleanedUp: boolean }` within 15s
- Worker process exits with code 0
- No zombie process remains

### T-006-4 Worker handles 'pause' gracefully

- Start a multi-step mock job
- Send `{ command: 'pause' }` mid-execution
- Receive `{ type: 'paused', checkpoint: object }` within 10s
- Worker process exits with code 0

### T-006-5 Worker handles 'resume' with checkpoint

- Pause a job as above
- Re-start with `_checkpoint` in payload
- Verify plugin reads `ctx.getCheckpoint()` and resumes from saved step (not step 0)

### T-006-6 Unknown command type

- Send `{ command: 'unknown_command' }`
- Worker does not crash, logs warning, continues waiting

### T-006-7 JobContext interface satisfaction

- `ctx.isPaused()` returns false by default
- After `{ command: 'pause' }` message, `ctx.isPaused()` returns true
- `ctx.dbPath` is non-empty string ending in `.db`
- `ctx.saveCheckpoint({ x: 1 })` causes `{ type: 'checkpoint', data: { x: 1 } }` to be received in Main

---

## Group 4 — Scheduler Tests (TASK-009, TASK-010, TASK-011, TASK-013, TASK-014, TASK-015, TASK-016)

### T-009-1 Worker stdout is captured

- `console.log('hello')` inside worker → AppLogger.info is called in Main
- Worker stderr → AppLogger.error is called in Main
- Worker process does NOT output to parent terminal (verified by absence in test output)

### T-009-2 Worker env is minimal

- Worker receives `WORKSPACES_DB_DIR` in `process.env`
- Worker does NOT receive `HOME`, `PATH`, `USERNAME`, or other parent variables

### T-010-1 Heartbeat fires correctly

- Configure `heartbeatIntervalMs = 500`, `heartbeatTimeoutMs = 2000`
- Start a worker that does not respond to 'ping'
- Within 2500ms, worker is killed and job status becomes `'failed'`
- Error message contains `'Heartbeat timeout'`
- `activeWorkers` map no longer contains jobId
- EventBus event `'job:heartbeat:timeout'` is emitted

### T-010-2 Healthy worker is not killed by watchdog

- Start a worker that correctly responds to 'ping'
- Run for 10s with `heartbeatIntervalMs = 500`
- Worker is not killed
- Job completes normally

### T-011-1 Soft cancel works on Windows

- Start a job with a mock plugin that checks `ctx.isCancelled()` every 100ms
- Call `cancelJob(jobId)`
- Receive `{ type: 'cancelled' }` within 2s
- Job status is `'cancelled'` in SQLite
- No SIGTERM/SIGKILL is sent (verified by absence of 'SIGTERM' in cancel path when soft cancel succeeds)

### T-011-2 Hard kill fallback fires if worker ignores cancel

- Start a worker that ignores `{ command: 'cancel' }`
- Call `cancelJob(jobId)` with `cancelTimeoutMs = 3000`
- After 3000ms, worker is force-killed
- Job status is `'cancelled'` with error message indicating force-kill

### T-011-3 Queued job cancel (no active worker)

- Submit a job that is `queued` but not dispatched
- Call `cancelJob(jobId)`
- Job status is `'cancelled'` immediately without forking a worker

### T-013-1 Per-type concurrency limits

- Configure `scraper:maps` limit = 1
- Submit 3 `scraper:maps` jobs
- At tick: only 1 is dispatched, 2 remain `queued`
- After first completes, second is dispatched
- Other job types are not blocked by `scraper:maps` slots

### T-013-2 Global concurrency cap

- Configure `maxConcurrency = 2`
- Submit 3 jobs of different types
- At most 2 workers are active simultaneously
- Third job dispatches when one completes

### T-014-1 Pause persists checkpoint to SQLite

- Start a multi-step job
- Call `pauseJob(jobId)`
- Verify `jobs.checkpointData` is non-NULL in SQLite
- Verify `jobs.status = 'paused'` in SQLite
- Verify `jobs.checkpointAt` is set

### T-014-2 Resume re-queues with checkpoint

- Pause a job (from T-014-1)
- Call resumeJob(jobId) (via IPC)
- Verify `jobs.status = 'queued'` in SQLite
- On next dispatch, worker receives `payload._checkpoint` matching saved checkpoint

### T-015-1 WAIT timer resumption

- Insert a `sequence_execution` with `status='waiting'`, `nextExecutionAt = 1 second ago`
- Trigger scheduler tick
- Verify a new `automation:workflow` job is queued with correct `executionId`
- Verify no duplicate jobs if tick fires again

### T-015-2 Future WAIT is not resumed early

- Insert a `sequence_execution` with `nextExecutionAt = 60 seconds from now`
- Trigger scheduler tick
- Verify no new jobs are queued

### T-016-1 Interrupted job recovery on start

- Insert a job with `status='interrupted'` and type `'crawler:website'`
- Call `recoverInterruptedJobs()`
- Verify job status becomes `'queued'`

### T-016-2 Non-recoverable job types stay interrupted

- Insert a job with `status='interrupted'` and type `'outreach:campaign'`
- Call `recoverInterruptedJobs()`
- Verify job remains `'interrupted'` (not re-queued)

---

## Group 5 — Plugin Registry Tests (TASK-007)

### T-007-1 Registration

- `registry.register('test:job', fn)` succeeds
- `registry.resolve('test:job')` returns `fn`
- `registry.listTypes()` returns `['test:job']`

### T-007-2 Duplicate registration guard

- `registry.register('test:job', fn)` twice → throws `Error: Plugin 'test:job' already registered`

### T-007-3 Unknown type resolution

- `registry.resolve('unknown:type')` returns `null`

---

## Group 6 — Scraper Plugin Tests (TASK-017)

### T-017-1 Real scrape produces database records

- Run `scrapeMaps(ctx)` with query `"dentists in boston"`, limit 3
- Verify ≥ 1 row in `companies` table in SQLite
- Verify `companies.name` is non-empty
- Verify `companies.website` is a valid URL or NULL

### T-017-2 Duplicate detection

- Insert a company with `domain = 'apexdental.com'`
- Run `scrapeMaps(ctx)` that encounters the same domain
- Verify the company is NOT inserted twice
- Verify `skippedCount` in job result is ≥ 1

### T-017-3 Progress updates fire

- Run `scrapeMaps(ctx)` with limit 5
- Verify ≥ 1 `{ type: 'progress' }` message received during execution

### T-017-4 Cancellation stops browser

- Start `scrapeMaps(ctx)`
- Send cancel after 2s
- Verify worker exits cleanly (no orphaned Chromium processes)
- Verify job status is `'cancelled'`

### T-017-5 Browser context closed on success

- Run `scrapeMaps(ctx)` to completion
- Verify no orphaned `chromium` processes remain in OS process list

---

## Group 7 — Crawler Plugin Tests (TASK-018)

### T-018-1 Real website crawl produces contacts

- Given a known website (use a test fixture or a public website with email disclosure)
- Run `crawlWebsite(ctx)` with `maxPages = 5`, `maxDepth = 2`
- Verify ≥ 1 row in `contacts` table
- Verify `contacts.email` matches email format regex

### T-018-2 robots.txt disallow respected

- Use a website with a `robots.txt` that disallows `/private/`
- Run crawler
- Verify no requests are made to `/private/*` URLs

### T-018-3 Duplicate email skipped

- Pre-insert a contact with email `founder@example.com`
- Crawl a site that produces the same email
- Verify only 1 contact row with that email

### T-018-4 Crawl depth limit respected

- Configure `maxDepth = 1`
- Verify crawler does not follow links 2 levels deep

### T-018-5 Checkpoint saves visited URLs

- Start crawl with `maxPages = 10`
- Pause after 3 pages
- Verify checkpoint contains visited URL set
- Resume — verify those 3 pages are not re-crawled

### T-018-6 Company crawlStatus updated

- Company starts with `crawlStatus = 'pending'`
- After successful crawl: `crawlStatus = 'completed'`, `crawledAt` is set
- After failed crawl: `crawlStatus = 'failed'`, `crawlError` is set

---

## Group 8 — Outreach Plugin Tests (TASK-020)

### T-020-1 Real email sends successfully (integration test — requires SMTP config)

- Configure test SMTP credentials (Mailtrap or equivalent)
- Run `dispatchOutreach(ctx)` for 1 contact
- Verify email appears in test inbox

### T-020-2 SMTP failure is logged

- Configure invalid SMTP credentials
- Run plugin
- Verify `sequence_logs` row with `status = 'failed'`, `message` contains SMTP error

### T-020-3 Daily limit is respected

- Configure `email_accounts.dailyLimit = 2`
- Submit 3 contacts
- Verify only 2 emails are sent, third is deferred or skipped with log

### T-020-4 Cancelled mid-send does not duplicate

- Start outreach for 5 contacts
- Cancel after 2 sends
- Verify exactly 2 `sequence_logs` rows have `status = 'sent'`
- Verify no partial sends

---

## Group 9 — Automation Engine Tests (TASK-021, TASK-022)

### T-021-1 Trigger fires on crm:created

- Publish `crm:created` with `entityType: 'company'`
- A sequence with trigger `COMPANY_CREATED` is active
- Verify `automation:workflow` job is inserted into SQLite `jobs` table within 100ms

### T-021-2 Deduplication prevents double-queueing

- Trigger fires twice for same sequence + entity
- Verify only 1 automation:workflow job is queued

### T-021-3 Inactive sequences do not trigger

- Sequence with `status = 'inactive'`
- Publish matching trigger event
- Verify no job is queued

### T-022-1 Full sequence execution — success path

- Sequence: [ASSIGN_TAG, FINISH_SEQUENCE]
- Run `executeAutomationWorkflow(ctx)`
- Verify contact has the tag in SQLite
- Verify execution `status = 'completed'`
- Verify 2 rows in `sequence_logs`

### T-022-2 WAIT step — exits with waiting status

- Sequence: [WAIT 5s, FINISH_SEQUENCE]
- Run plugin
- Verify plugin returns `{ status: 'waiting', resumeAt: string }`
- Verify `sequence_executions.status = 'waiting'`
- Verify `sequence_executions.nextExecutionAt` is ~5s from now

### T-022-3 WAIT step — resumes correctly after timer

- Continue from T-022-2
- Wait for timer
- Scheduler tick queues resume job
- Resume plugin runs from `currentStep = 1`
- Execution completes with `status = 'completed'`

### T-022-4 CONDITION step — halt on false

- Sequence: [CONDITION{ type: 'HAS_TAG', tag: 'vip' }, SEND_EMAIL, FINISH]
- Contact does not have 'vip' tag
- Run plugin
- Verify SEND_EMAIL is NOT executed
- Execution status = 'completed' (halted gracefully)

### T-022-5 Cancel mid-sequence

- Sequence with 5 steps
- Send cancel after step 2
- Verify execution `status = 'cancelled'`
- Verify `cancelledAt` is set in sequence_executions

---

## Group 10 — API Automation Migration Tests (TASK-023)

### T-023-1 API AutomationService has no executeNextStep

- TypeScript compilation succeeds with method removed
- Calling `service.executeNextStep(id)` at runtime → `TypeError: service.executeNextStep is not a function`

### T-023-2 startExecution returns immediately

- POST to start execution endpoint
- Response time ≤ 200ms (was previously unbounded due to recursive execution)
- Response body contains execution record with `status: 'PENDING'`

### T-023-3 No server-side email sending

- Trigger a sequence start via API
- Verify no emails are sent from API server
- Verify no entries in SMTP log from API process

---

## Group 11 — EventBridge Tests (TASK-012)

### T-012-1 Job progress reaches renderer

- Submit a job with progress-emitting mock plugin
- Subscribe to `window.ipc.on('job:progress', handler)` in test renderer
- Verify `handler` is called with correct `{ jobId, progress, metadata }` within 100ms of worker sending progress

### T-012-2 Bridge reinitializes on workspace switch

- Activate workspace A, subscribe to events
- Switch to workspace B
- Events from workspace A do not fire in workspace B context

### T-012-3 Bridge cleanup on stop

- Stop WorkspaceRuntime
- Publish event on now-dead EventBus
- Verify no `webContents.send()` calls fire (no errors thrown)

---

## Group 12 — Recovery and Crash Tests

### T-CRASH-1 Worker crash marks job failed

- Start a job
- Force-kill worker process from outside (SIGKILL)
- Verify job status becomes `'failed'` within 2s
- Verify `activeWorkers` no longer contains jobId

### T-CRASH-2 App restart recovers interrupted jobs

- Start a job (status becomes 'running')
- Simulate app restart (call WorkspaceRuntime.stop() then start())
- Verify job transitions to `'interrupted'` then back to `'queued'`

### T-CRASH-3 SQLite WAL integrity after worker crash

- Worker is mid-transaction when killed
- Verify SQLite database passes `PRAGMA integrity_check` after crash

### T-CRASH-4 Overdue WAIT executions resume on restart

- Insert sequence_execution with `status='waiting'` and `nextExecutionAt` in the past
- Call `WorkspaceRuntime.start()`
- Verify `automation:workflow` job is queued within 2s of start

---

## Group 13 — Performance Tests

### T-PERF-1 Scheduler tick overhead

- 100 jobs in queue, 3 active workers
- Verify tick completes in < 50ms under load

### T-PERF-2 Worker startup time

- Measure time from `fork()` to `{ type: 'ready' }` message
- Verify startup time ≤ 1000ms (target: ≤ 500ms)

### T-PERF-3 SQLite write throughput

- Bulk insert 1000 companies via `saveMany()`
- Verify completes in ≤ 3s

### T-PERF-4 Crawler concurrency

- Run `crawler:website` with `concurrency = 3`
- Verify CPU stays below 80% on reference hardware

---

## Group 14 — Acceptance Tests (End-to-End)

### T-ACC-1 Full discovery → crawl → outreach pipeline

- Submit `scraper:maps` job for "dentists boston" (limit 5)
- After completion: 5 companies in SQLite
- Auto-queued `crawler:website` runs and finds ≥ 1 contact per company
- Manual: user starts `outreach:campaign` job
- ≥ 1 email appears in test inbox
- All execution records present in SQLite and synced to MongoDB

### T-ACC-2 Sequence automation end-to-end

- Create a sequence: [WAIT 5s, SEND_EMAIL{ template: 'intro' }, FINISH]
- Create a company → triggers automation
- After 5s: email sent to contact
- `sequence_executions.status = 'completed'`

### T-ACC-3 Cancel from UI cancels worker

- User submits job via UI
- Job shows 'running' with progress in UI (EventBridge working)
- User clicks Cancel
- Job status changes to 'cancelled' in UI within 20s
- No orphaned worker processes

### T-ACC-4 Pause and resume from UI

- Job shows progress in UI
- User clicks Pause
- Job shows 'paused' in UI
- User clicks Resume
- Job continues from checkpoint (progress does not reset to 0)

### T-ACC-5 App restart resumes interrupted jobs

- Long-running job in progress
- Close and reopen app
- Job re-appears as 'queued' and resumes within 10s of app boot
