# LeadForge OS — Breaking Changes

> **Document Type**: Implementation Contract  
> **Source Specs**: All Phase 8 specifications  
> **Phase**: 9 — Implementation  
> **Format**: Each change is classified by severity (BREAKING / NON-BREAKING / DEPRECATION) and layer (API / Desktop-Main / Desktop-Worker / Renderer / Shared)

---

## BC-001 — API: Automation execution removed from AutomationService

| Field | Detail |
|---|---|
| **Severity** | BREAKING |
| **Layer** | API |
| **Source Spec** | automation_engine_spec.md §1 |
| **Description** | `AutomationService.executeNextStep()` and `AutomationService.handleEvent()` will be deleted from `apps/api`. `startExecution()` will no longer call `executeNextStep()` recursively. |
| **Affected Files** | `apps/api/src/services/automation/automation.service.ts`, all API routes calling these methods |
| **Who Is Affected** | Any client (including the renderer) that relies on POSTing to an API route and expecting a sequence to begin executing server-side. Any MongoDB sequence_execution records with status `IN_PROGRESS` will become orphaned. |
| **Migration Strategy** | 1. Complete TASK-022 (AutomationWorkflowPlugin on desktop) and TASK-021 (AutomationTriggerEvaluator) fully before removing API methods. 2. Drain all in-flight server-side executions (mark them FAILED on the API with reason 'Migrated to desktop runtime'). 3. Remove methods from API. 4. Desktop SyncEngine will push new execution records from SQLite to MongoDB going forward. |
| **Rollback** | Revert `automation.service.ts` to previous commit if desktop automation is not yet operational. |

---

## BC-002 — Desktop-Worker: IPC message protocol extended

| Field | Detail |
|---|---|
| **Severity** | BREAKING |
| **Layer** | Desktop-Worker |
| **Source Spec** | worker_runtime_spec.md §4.2 |
| **Description** | The current IPC protocol is `{ command: 'start' }` → `{ type: 'progress/success/error/log' }`. New protocol adds `cancel`, `pause`, `resume`, `ping` commands from Main→Worker and `ready`, `pong`, `checkpoint`, `paused`, `cancelled` from Worker→Main. |
| **Affected Files** | `apps/desktop/src/main/workers/worker-host.ts`, `apps/desktop/src/main/services/scheduler.ts` |
| **Who Is Affected** | Any existing plugin that calls `process.exit()` immediately on success — this is now handled via `{ type: 'success' }` + graceful exit only. Any worker that does not send `{ type: 'ready' }` will block the new protocol handshake. |
| **Migration Strategy** | 1. Implement new message types in TASK-006. 2. Update all existing plugins (scraper.ts, enricher.ts, outreach.ts) to not call `process.exit()` directly — instead send `{ type: 'success' }` and let the host handle exit. 3. Update Main-side `worker.on('message')` to handle all new message types before deploying. |
| **Rollback** | Not safely rollback-able once plugins are updated. Deploy both sides simultaneously. |

---

## BC-003 — Desktop-Main: Scheduler fork options changed

| Field | Detail |
|---|---|
| **Severity** | BREAKING |
| **Layer** | Desktop-Main |
| **Source Spec** | worker_runtime_spec.md §4.7 |
| **Description** | `fork()` options change from `stdio: 'inherit'` to `stdio: ['ignore','pipe','pipe','ipc']`. Environment changes from `{ ...process.env }` to minimal whitelist. `execArgv` added for dev mode. |
| **Affected Files** | `apps/desktop/src/main/services/scheduler.ts` |
| **Who Is Affected** | Worker processes that relied on `process.env.HOME` or other parent environment variables for configuration. Any worker using `process.env.*` that is not in the whitelist will receive `undefined`. |
| **Migration Strategy** | Audit all worker plugins for `process.env.*` usage. Move any required env variables to the minimal whitelist in the fork options. For credentials, read from SQLite instead of environment. |
| **Rollback** | Revert `fork()` options in scheduler.ts. |

---

## BC-004 — Desktop-Main: Worker host path changes

| Field | Detail |
|---|---|
| **Severity** | BREAKING |
| **Layer** | Desktop-Main |
| **Source Spec** | worker_runtime_spec.md §4.1 |
| **Description** | The worker host path currently uses `join(__dirname, 'worker.js')` which assumes the worker is compiled as part of the main bundle. After TASK-005, it compiles to a separate path (`dist/worker/worker-host.js` or similar). The path reference in `scheduler.ts` must be updated. |
| **Affected Files** | `apps/desktop/src/main/services/scheduler.ts`, `apps/desktop/electron.vite.config.js` |
| **Who Is Affected** | Any environment (dev, prod) where `fork()` is called — the path will be wrong until both TASK-005 and the scheduler path update are deployed together. |
| **Migration Strategy** | TASK-005 and the scheduler path update (TASK-009) must be deployed atomically — not separately. |
| **Rollback** | Revert both `electron.vite.config.js` and the path reference in `scheduler.ts` together. |

---

## BC-005 — Desktop-Main: JobScheduler.cancelJob() signature changes

| Field | Detail |
|---|---|
| **Severity** | BREAKING (internal) |
| **Layer** | Desktop-Main |
| **Source Spec** | worker_runtime_spec.md §3.3, job_lifecycle_spec.md §5 |
| **Description** | `cancelJob()` currently calls `worker.kill('SIGTERM')` synchronously. After TASK-011, it will send `{ command: 'cancel' }` via IPC and wait for `{ type: 'cancelled' }` response with a 15s hard-kill fallback. The function may become async. |
| **Affected Files** | `apps/desktop/src/main/services/scheduler.ts`, `apps/desktop/src/main/ipc/scheduler.ts` |
| **Who Is Affected** | The IPC handler `scheduler:jobs:cancel` — if it calls `cancelJob()` and expects a synchronous result, it will break. The IPC handler must be updated to await the soft-cancel result. |
| **Migration Strategy** | Update `cancelJob()` to return `Promise<void>`. Update the IPC handler to `await cancelJob(...)`. Update the IPC return value to indicate cancel is in progress (not completed synchronously). |
| **Rollback** | Revert to SIGTERM-based cancel in scheduler.ts. Note: this is unsafe on Windows. |

---

## BC-006 — Desktop-Main: JobScheduler.tick() query extended

| Field | Detail |
|---|---|
| **Severity** | NON-BREAKING (internal) |
| **Layer** | Desktop-Main |
| **Source Spec** | job_lifecycle_spec.md §2, automation_engine_spec.md §4.2 |
| **Description** | The tick() function adds a second query block for WAIT resumption (`SELECT from sequence_executions WHERE status='waiting' AND nextExecutionAt <= datetime('now')`). The original job dispatch query is modified to filter `scheduledAt <= datetime('now')` for retrying jobs. |
| **Affected Files** | `apps/desktop/src/main/services/scheduler.ts` |
| **Who Is Affected** | The existing retry behavior. Currently `retrying` jobs are dispatched immediately. After this change, they wait until `scheduledAt` elapses. This is a behavioral change that may cause test failures. |
| **Migration Strategy** | Ensure all test cases that verify retry behavior are updated to account for the new `scheduledAt` delay. Verify that migration 008 has added `scheduledAt` before this code runs. |

---

## BC-007 — Desktop-Main: WorkspaceRuntime.start() gains new responsibilities

| Field | Detail |
|---|---|
| **Severity** | NON-BREAKING (additive) |
| **Layer** | Desktop-Main |
| **Source Spec** | runtime_dependency_graph.md §7 |
| **Description** | `WorkspaceRuntime.start()` will call three new methods: `automationTrigger.start()`, `eventBridge.start()`, `recoverInterruptedJobs()`, `resumeOverdueWaitJobs()`. |
| **Affected Files** | `apps/desktop/src/main/lib/workspace-runtime.ts` |
| **Who Is Affected** | App startup time may increase by ~50ms due to the interrupted job recovery query. |
| **Migration Strategy** | Additive changes. No existing functionality broken. Recovery queries must run before scheduler.start() to avoid double-dispatching. |

---

## BC-008 — Shared: JobStatus type gains `starting` state

| Field | Detail |
|---|---|
| **Severity** | BREAKING |
| **Layer** | Shared (desktop + renderer) |
| **Source Spec** | job_lifecycle_spec.md §1.2, worker_runtime_spec.md §2.2 |
| **Description** | `JobStatus` union in `apps/desktop/src/shared/types/job.ts` gains `'starting'`. The SQLite CHECK constraint is updated via migration 008. |
| **Affected Files** | `apps/desktop/src/shared/types/job.ts`, `apps/desktop/src/main/database/runner.ts` |
| **Who Is Affected** | Any renderer component that renders a status badge for jobs. If the renderer has a switch/case on `JobStatus` without a default, it will fail to render `starting` state. Any SQLite query that filters `status NOT IN (...)` must be updated. |
| **Migration Strategy** | Update all renderer status badge components to handle `'starting'` (show spinner, same as `'running'`). |
| **Rollback** | Remove `'starting'` from type and revert migration 008 (requires database backup restore). |

---

## BC-009 — Renderer: Job event subscription model changes

| Field | Detail |
|---|---|
| **Severity** | BREAKING (renderer) |
| **Layer** | Renderer |
| **Source Spec** | runtime_health_report.md §7 |
| **Description** | Currently the renderer polls job status via IPC `scheduler:jobs:list`. After TASK-012 (EventBridge), real-time events (`job:progress`, `job:completed`, `job:failed`) are sent via `win.webContents.send()`. The renderer must subscribe to these IPC events and update its state reactively, not only via polling. |
| **Affected Files** | `apps/desktop/src/preload/index.ts`, all renderer components displaying job status/progress |
| **Who Is Affected** | Jobs page, any dashboard component showing active job count, any component polling `scheduler:jobs:list`. |
| **Migration Strategy** | 1. Add event listeners in renderer (useEffect + `window.ipc.on('job:progress', ...)`) alongside existing polling. 2. Gradually reduce polling frequency once events are confirmed reliable. 3. Do not remove polling entirely until EventBridge is confirmed stable. |

---

## BC-010 — API: Automation routes become CRUD-only

| Field | Detail |
|---|---|
| **Severity** | BREAKING |
| **Layer** | API |
| **Source Spec** | automation_engine_spec.md §1.2 |
| **Description** | `POST /automations/executions/:id/start` currently triggers real step execution. After BC-001, it creates a PENDING record only. `POST /automations/events` (if it exists as a trigger endpoint) must be removed or made a no-op. |
| **Affected Files** | `apps/api/src/routes/automation.ts` (or equivalent), `apps/api/src/controllers/automation.controller.ts` |
| **Who Is Affected** | Any external client (webhook, third-party integration) that POSTs to the automation trigger endpoint expecting execution to begin. |
| **Migration Strategy** | Return `202 Accepted` with body `{ message: 'Execution will be handled by local desktop runtime' }` during transition. After full migration, return `200` with the created execution record only. |

---

## BC-011 — Desktop-Worker: handleJobSuccess() must not kill worker

| Field | Detail |
|---|---|
| **Severity** | NON-BREAKING (bug fix) |
| **Layer** | Desktop-Main |
| **Source Spec** | worker_runtime_spec.md §3.7 |
| **Description** | `handleJobSuccess()` currently calls `worker.kill('SIGTERM')` after receiving the success message. This is incorrect — the worker already called `process.exit(0)`. The kill call must be removed. |
| **Affected Files** | `apps/desktop/src/main/services/scheduler.ts` |
| **Who Is Affected** | May cause spurious error events on Windows if the process is already exiting when kill() is called. |
| **Migration Strategy** | Remove `worker.kill()` from `handleJobSuccess()`. Trust the worker to exit on its own after sending `{ type: 'success' }`. The `worker.on('exit')` handler already cleans up. |
