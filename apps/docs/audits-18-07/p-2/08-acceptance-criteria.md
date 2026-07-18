# LeadForge OS — Acceptance Criteria

> **Document Type**: Implementation Contract  
> **Source Specs**: All Phase 8 specifications  
> **Phase**: 9 — Implementation  
> **Format**: Each criterion is objective and measurable. No vague statements.

---

## AC-001 — Worker Host Build

| # | Criterion | Pass Condition |
|---|---|---|
| 1 | Worker compiles | `pnpm build` completes without errors and produces `dist/worker/worker-host.js` (or equivalent path agreed in TASK-005) |
| 2 | Worker is importable | `node dist/worker/worker-host.js` starts without `MODULE_NOT_FOUND` error |
| 3 | Scheduler path matches | `fork()` in scheduler resolves to the exact path of the compiled worker file |
| 4 | Dev mode works | `pnpm dev` starts without path errors; worker-host changes are picked up on rebuild |

---

## AC-002 — IPC Protocol

| # | Criterion | Pass Condition |
|---|---|---|
| 1 | Ready handshake | Worker sends `{ type: 'ready' }` within 1000ms of fork |
| 2 | Heartbeat response | Worker responds `{ type: 'pong' }` within 500ms of `{ command: 'ping' }` |
| 3 | Soft cancel — worker exits | Worker exits with code `0` within 15s of receiving `{ command: 'cancel' }` |
| 4 | Soft cancel — cleanup confirmed | Worker sends `{ type: 'cancelled', cleanedUp: boolean }` before exiting |
| 5 | Pause response | Worker sends `{ type: 'paused', checkpoint: object }` within 30s of `{ command: 'pause' }` |
| 6 | Progress message structure | Every `{ type: 'progress' }` message contains `progress: number (0–100)` |
| 7 | No extra process.exit() calls | Plugins do not call `process.exit()` directly; only worker-host manages process termination |

---

## AC-003 — Heartbeat / Watchdog

| # | Criterion | Pass Condition |
|---|---|---|
| 1 | Stalled worker detected | A worker that stops responding to 'ping' is killed within `heartbeatTimeoutMs + heartbeatIntervalMs` (default: 40s) |
| 2 | Stalled job marked failed | After kill, `jobs.status = 'failed'` within 2s, `jobs.error = 'Heartbeat timeout'` |
| 3 | Queue unblocked | After stalled worker is killed, scheduler dispatches next queued job on next tick |
| 4 | Healthy workers not killed | A correctly behaving worker is not killed by the watchdog during a 15-minute scrape session |
| 5 | Event published | `'job:heartbeat:timeout'` event is emitted on LocalEventBus |

---

## AC-004 — Cancellation (Windows-safe)

| # | Criterion | Pass Condition |
|---|---|---|
| 1 | Cancel reaches worker | Worker `isCancelledState = true` is set within 500ms of cancel call |
| 2 | Cancel completes cleanly | `jobs.status = 'cancelled'` in SQLite within 20s of user cancel request |
| 3 | No SQLite corruption | After cancel: `PRAGMA integrity_check` returns `ok` |
| 4 | No orphaned processes | No `node` or `chromium` child processes remain after cancel (verified via OS process list) |
| 5 | Windows SIGTERM not used | On Windows, `process.send({ command: 'cancel' })` is used — NOT `worker.kill('SIGTERM')` as the first action |
| 6 | Hard kill fallback fires | If worker ignores cancel for 15s, `worker.kill('SIGKILL')` is called and job is marked cancelled |

---

## AC-005 — Pause / Resume

| # | Criterion | Pass Condition |
|---|---|---|
| 1 | Pause stores checkpoint | `jobs.checkpointData` is non-NULL after pause, contains valid JSON |
| 2 | Pause status correct | `jobs.status = 'paused'` in SQLite |
| 3 | Resume re-queues | After resume IPC call, `jobs.status = 'queued'` within 200ms |
| 4 | Resume with checkpoint | Dispatched worker receives `payload._checkpoint` matching stored checkpoint |
| 5 | Progress does not reset | After resume, `ctx.getCheckpoint()` returns data; plugin does not start from step 0 |
| 6 | Queued job can be paused | A job in `queued` status can be paused without forking a worker (status set to `paused` directly) |

---

## AC-006 — Per-Type Concurrency

| # | Criterion | Pass Condition |
|---|---|---|
| 1 | `scraper:maps` limit = 1 | At most 1 `scraper:maps` worker runs simultaneously, regardless of global concurrency |
| 2 | `crawler:website` limit = 2 | At most 2 `crawler:website` workers run simultaneously |
| 3 | Global cap honored | Total active workers never exceeds `maxConcurrency` |
| 4 | Types do not share limits | A `scraper:maps` slot being full does not prevent `crawler:website` jobs from dispatching if their type limit allows |
| 5 | Limits are configurable | Changing a type limit in the settings table takes effect on the next scheduler tick |

---

## AC-007 — Progress Relay to Renderer

| # | Criterion | Pass Condition |
|---|---|---|
| 1 | Progress event arrives | Within 200ms of worker sending `{ type: 'progress' }`, renderer receives `window.ipc.on('job:progress', ...)` callback |
| 2 | Correct payload | Renderer receives `{ jobId, progress, metadata }` matching what worker sent |
| 3 | Completion event arrives | `'job:completed'` IPC event is received in renderer |
| 4 | Failure event arrives | `'job:failed'` IPC event is received in renderer with error message |
| 5 | No cross-workspace events | Events from workspace A do not fire in workspace B renderer context |
| 6 | Bridge survives restart | After workspace switch, bridge re-attaches and events flow correctly |

---

## AC-008 — Job State Machine

| # | Criterion | Pass Condition |
|---|---|---|
| 1 | `starting` state exists | Job transitions to `'starting'` immediately after fork, before 'ready' is received |
| 2 | All terminal states are final | No code path transitions a job from `completed`, `failed`, or `cancelled` to any other state |
| 3 | Transition guard enforced | Attempting an invalid transition (e.g., `completed → running`) throws or is prevented |
| 4 | `interrupted` on shutdown | Jobs in `running` state become `interrupted` when `scheduler.stop()` is called |
| 5 | `retrying` uses scheduledAt | Retrying jobs are not re-dispatched until `scheduledAt <= now` |

---

## AC-009 — Interrupted Job Recovery

| # | Criterion | Pass Condition |
|---|---|---|
| 1 | Recovery runs on start | `recoverInterruptedJobs()` is called in `WorkspaceRuntime.start()` before any dispatch |
| 2 | Auto-recoverable types re-queued | `scraper:maps`, `crawler:website`, `enrich:website`, `automation:workflow` transitions from `interrupted` to `queued` |
| 3 | Non-recoverable types stay | `outreach:campaign` remains `interrupted` — requires explicit user re-queue |
| 4 | WAIT resumptions recovered | Overdue `sequence_executions` with `status='waiting'` get `automation:workflow` jobs queued on startup |

---

## AC-010 — Google Maps Scraper (Real)

| # | Criterion | Pass Condition |
|---|---|---|
| 1 | Produces real data | Given query `"dentists boston"` and limit 5, produces ≥ 1 company row in SQLite within 120s |
| 2 | Data quality | `companies.name` is non-empty, non-template string |
| 3 | Deduplication | Running the same query twice does not insert duplicate companies (same domain) |
| 4 | Progress fires | ≥ 1 `{ type: 'progress' }` message per company discovered |
| 5 | Checkpoint saves | `jobs.checkpointData` is updated every 10 companies |
| 6 | Clean exit | No Chromium processes remain after job completes or is cancelled |

---

## AC-011 — Website Crawler (Real)

| # | Criterion | Pass Condition |
|---|---|---|
| 1 | Finds contact emails | Given a company website that has emails, produces ≥ 1 contact in SQLite |
| 2 | Email format valid | All inserted `contacts.email` values pass format validation regex |
| 3 | robots.txt respected | URLs in robots.txt `Disallow` blocks are not requested |
| 4 | Depth limit enforced | Crawler does not follow links deeper than `maxDepth` |
| 5 | Company status updated | `companies.crawlStatus = 'completed'` after successful crawl |
| 6 | No duplicate emails | Running crawler twice on same site does not duplicate contact rows |

---

## AC-012 — Outreach Plugin (Real SMTP)

| # | Criterion | Pass Condition |
|---|---|---|
| 1 | Real email sent | Email appears in test inbox (Mailtrap or equivalent) |
| 2 | Credential not logged | SMTP password does not appear in `system_logs` or JSONL log files |
| 3 | TLS enforced | SMTP transport uses `secure: true` or `requireTLS: true` — unencrypted connections are rejected |
| 4 | Rate limit respected | With `dailyLimit = 2`, only 2 emails sent per day; 3rd is skipped |
| 5 | Failure logged | Invalid SMTP target produces `sequence_logs` row with `status = 'failed'` |

---

## AC-013 — Automation Trigger

| # | Criterion | Pass Condition |
|---|---|---|
| 1 | Trigger fires on create | Within 100ms of `crm:created` EventBus event, matching sequences produce `automation:workflow` jobs |
| 2 | Dedup works | Same event published twice produces only 1 job (not 2) |
| 3 | Inactive sequences not triggered | Sequences with `status != 'active'` do not produce jobs |
| 4 | No trigger on wrong type | `crm:created` for `'company'` does not trigger sequences with `CONTACT_CREATED` trigger |

---

## AC-014 — Sequence Execution Engine

| # | Criterion | Pass Condition |
|---|---|---|
| 1 | Linear sequence completes | Sequence with [ASSIGN_TAG, FINISH] sets tag and marks execution `completed` |
| 2 | WAIT step suspends | WAIT step writes `nextExecutionAt`, exits with `waiting` status — does not block |
| 3 | WAIT step resumes | After `nextExecutionAt` passes, scheduler re-queues resume job within 2s |
| 4 | CONDITION halts cleanly | False condition stops execution at that step; status is `completed` (not `failed`) |
| 5 | All step types write logs | Every step produces a `sequence_logs` row |
| 6 | Cancel mid-sequence | Cancel command stops at next step boundary; `cancelledAt` is set |

---

## AC-015 — API Automation Migration

| # | Criterion | Pass Condition |
|---|---|---|
| 1 | `executeNextStep` deleted | Method does not exist in compiled API bundle |
| 2 | `handleEvent` deleted | Method does not exist in compiled API bundle |
| 3 | API does not send emails | No SMTP calls from API process after migration |
| 4 | startExecution returns immediately | Response time ≤ 200ms (was previously unbounded) |
| 5 | Existing automation data safe | MongoDB `sequence_executions` records are not corrupted or deleted by migration |

---

## AC-016 — SQLite Migrations

| # | Criterion | Pass Condition |
|---|---|---|
| 1 | Idempotent | Running `runMigrations()` twice does not error or produce schema changes on second run |
| 2 | Pre-008 backup created | File `leadforge_{workspaceId}.db.pre008.bak` exists before migration 008 runs |
| 3 | Data preserved | All rows present before migration 008 are present after migration 008 |
| 4 | `starting` status insertable | `INSERT INTO jobs ... status='starting'` succeeds after migration 008 |
| 5 | New columns exist | After migration 009, `SELECT crawlStatus, score FROM companies` does not error |

---

## AC-017 — No Duplicate Jobs

| # | Criterion | Pass Condition |
|---|---|---|
| 1 | idempotencyKey prevents duplicate | Submitting 2 jobs with same `idempotencyKey` returns first job ID both times |
| 2 | WAIT resumption dedup | Scheduler tick does not queue 2 resume jobs for same `executionId` |
| 3 | Automation trigger dedup | Same event published twice does not produce 2 jobs for same sequence+entity |

---

## AC-018 — End-to-End Pipeline

| # | Criterion | Pass Condition |
|---|---|---|
| 1 | Pipeline completes | scraper:maps → crawler:website → enrich:website chain runs to completion without manual intervention |
| 2 | Data in MongoDB | After sync, companies and contacts appear in MongoDB Atlas collection |
| 3 | Real-time UI | Progress bars and status badges update without page refresh |
| 4 | App restart safe | If app is closed and reopened mid-pipeline, pipeline resumes without data loss |
