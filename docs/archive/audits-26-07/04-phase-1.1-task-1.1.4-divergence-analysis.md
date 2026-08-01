# Forensic Audit: Task 1.1.4 — Divergence Analysis

## Executive Summary

This document presents the detailed Divergence Register and architectural comparative analysis between the **Manual Execution Path (Path A)** and the **Event Trigger Execution Path (Path B)** in LeadForge OS.

Every divergence is identified with exact file paths, line references, execution ownership transitions, persistence targets, and state impacts based strictly on active source code implementation evidence.

---

## Divergence Register

### DIV-001: Execution Initiator & Entry Point Divergence

- **Divergence Title**: Execution Trigger & Entry Mechanism Inversion
- **Current Behavior**: Path A is initiated from Chromium Renderer UI via Electron IPC; Path B is initiated from Main process Node.js event bus subscription.
- **Manual Path Implementation**: [`AutomationScreen.tsx:L219`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/screens/AutomationScreen.tsx#L219) captures user click and invokes `startSequenceMutation.mutate()`, which calls `window.ipc.invoke('sequence:start')`.
- **Event Path Implementation**: [`automation-trigger.ts:L181`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/automation-trigger.ts#L181) registers `eventBus.subscribe()` callbacks for domain events (`crm:created`, `job:completed`, etc.), invoking `onEvent(event)`.
- **First Point of Divergence**: `window.ipc.invoke('sequence:start')` ([`sync.ts:L108`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/sync.ts#L108)) vs `eventBus.subscribe()` ([`automation-trigger.ts:L182`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/automation-trigger.ts#L182)).
- **Execution Ownership**: Path A is owned by IPC Handler -> SDK -> API; Path B is owned by `AutomationTriggerEvaluator` in Main process.
- **State Impact**: Path A creates React Query UI mutation state; Path B creates no UI state.
- **Persistence Impact**: Path A produces no local persistence at entry point; Path B evaluates local SQLite templates instantly.
- **Synchronization Impact**: Path A is synchronous across IPC; Path B is asynchronous event-driven.
- **Evidence**:
  - Path A: `AutomationScreen.tsx:L219-L222`, `sync.ts:L100-L108`.
  - Path B: `automation-trigger.ts:L166-L189`.
- **Confidence**: HIGH.

---

### DIV-002: Local Job Scheduler & SQLite Queue Bypass Divergence

- **Divergence Title**: Manual Trigger Bypasses Desktop Local Job Scheduler & SQLite `jobs` Table
- **Current Behavior**: Path A completely bypasses the local `JobScheduler` and SQLite `jobs` table, delegating execution over HTTP; Path B inserts an `automation:workflow` job into SQLite `jobs` table for local scheduler processing.
- **Manual Path Implementation**: Handler in [`main/ipc/automation.ts:L66`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/automation.ts#L66) directly executes `await sdk.executions.start(sequenceId, contactId, companyId)`. Zero SQLite `jobs` rows created.
- **Event Path Implementation**: [`automation-trigger.ts:L347`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/automation-trigger.ts#L347) executes `this.stmtInsertJob.run(jobId, this.workspaceId, payload)` inserting a row into `jobs` table (`type = 'automation:workflow'`, `status = 'queued'`).
- **First Point of Divergence**: `main/ipc/automation.ts:L66` (`sdk.executions.start`) vs `automation-trigger.ts:L347` (`stmtInsertJob.run`).
- **Execution Ownership**: Path A delegates to API; Path B delegates to `JobScheduler` & `JobWorker`.
- **State Impact**: Path A job status is never tracked in desktop local scheduler state; Path B status transitions `queued` -> `starting` -> `running` in SQLite.
- **Persistence Impact**: Path A writes no job row in local SQLite; Path B inserts job row in SQLite `jobs` table.
- **Synchronization Impact**: Path A has no local scheduler queue; Path B integrates with local worker queue.
- **Evidence**:
  - Path A: `main/ipc/automation.ts:L63-L69`.
  - Path B: `automation-trigger.ts:L154-L157`, `L337-L347`.
- **Confidence**: HIGH.

---

### DIV-003: Execution Primary Authority Divergence

- **Divergence Title**: Execution Primary Host Authority Inversion (API Server vs Desktop Worker)
- **Current Behavior**: Path A executes sequence creation and logging logic on the remote API server (`apps/api`); Path B executes workflow step logic on the local desktop worker (`executeAutomationWorkflow`).
- **Manual Path Implementation**: Remote API route [`routes/automation.ts:L78`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/automation.ts#L78) invokes [`AutomationService.startExecution()`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/services/automation/automation.service.ts#L73) on the backend server.
- **Event Path Implementation**: Desktop worker host [`worker-host.ts:L53`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/worker-host.ts#L53) invokes [`executeAutomationWorkflow()`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/automation.ts#L823) inside local Node.js worker process.
- **First Point of Divergence**: `sdk.executions.start()` ([`sdk/modules/automation.ts:L46`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/automation.ts#L46)) vs `executeAutomationWorkflow()` ([`plugins/automation.ts:L823`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/automation.ts#L823)).
- **Execution Ownership**: Path A is owned by API Server Node process; Path B is owned by Desktop Main/Worker process.
- **State Impact**: Path A state is controlled by API backend; Path B state is controlled by desktop worker process.
- **Persistence Impact**: Path A creates Mongoose documents on remote server; Path B updates SQLite database tables locally.
- **Synchronization Impact**: Path A depends on active internet connection to API; Path B executes completely offline on desktop.
- **Evidence**:
  - Path A: `apps/api/src/services/automation/automation.service.ts:L73-L111`.
  - Path B: `apps/desktop/src/main/workers/plugins/automation.ts:L823-L860`.
- **Confidence**: HIGH.

---

### DIV-004: Primary Persistence Target Inversion Divergence

- **Divergence Title**: Primary Database Storage Target Inversion (MongoDB vs SQLite)
- **Current Behavior**: Path A treats MongoDB as primary storage and desktop SQLite as secondary read cache; Path B treats desktop SQLite as primary source of truth and MongoDB as eventual sync destination.
- **Manual Path Implementation**: `AutomationService.startExecution()` in `automation.service.ts:L106` calls `await exec.save()` directly writing to MongoDB `sequence_executions` collection. `main/ipc/automation.ts:L67` then writes to SQLite via `LocalCRMRepository.save()` with `skipQueue = true`.
- **Event Path Implementation**: `executeAutomationWorkflow` writes execution state, step progress, and logs directly to local SQLite database tables. Enqueues sync records into local SQLite `sync_queue` table.
- **First Point of Divergence**: `exec.save()` (Mongoose/MongoDB) vs `db.prepare().run()` (better-sqlite3/SQLite).
- **Execution Ownership**: Path A MongoDB owned; Path B SQLite owned.
- **State Impact**: Path A MongoDB record created synchronously; Path B SQLite record created synchronously.
- **Persistence Impact**: Path A primary target is cloud MongoDB; Path B primary target is local desktop SQLite file.
- **Synchronization Impact**: Path A uses read-cache snapshot write without `sync_queue`; Path B uses background `SyncEngine` queue processing.
- **Evidence**:
  - Path A: `automation.service.ts:L106`, `main/ipc/automation.ts:L67`.
  - Path B: `plugins/automation.ts:L844-L860`, `automation-trigger.ts:L347`.
- **Confidence**: HIGH.

---

### DIV-005: Synchronization Protocol Divergence

- **Divergence Title**: Direct HTTP Return Caching vs Asynchronous Local-First Queue Synchronization
- **Current Behavior**: Path A returns execution data via HTTP response and writes a read cache directly without queueing; Path B inserts records into local `sync_queue` table for background synchronization by `SyncEngine`.
- **Manual Path Implementation**: `main/ipc/automation.ts:L67` calls `LocalCRMRepository.save('sequence_executions', { ...res, workspaceId: runtime.workspaceId }, true)`. The `true` parameter explicitly flags `skipQueue = true`, preventing insertion into `sync_queue`.
- **Event Path Implementation**: Local desktop operations insert change mutations into local `sync_queue` table, processed asynchronously by `SyncEngine` / `QueueProcessor`.
- **First Point of Divergence**: `skipQueue = true` ([`main/ipc/automation.ts:L67`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/automation.ts#L67)) vs `sync_queue` insertion.
- **Execution Ownership**: Path A Main process direct write; Path B `SyncEngine` background processor.
- **State Impact**: Path A SQLite record marked as non-queued; Path B SQLite record queued for remote sync.
- **Persistence Impact**: Path A bypasses desktop `sync_queue` table; Path B writes to `sync_queue` table.
- **Synchronization Impact**: Path A relies on remote-first HTTP sync; Path B relies on local-first SWR queue sync.
- **Evidence**:
  - Path A: `main/ipc/automation.ts:L67`, `local-crm.ts:L54`.
  - Path B: `plugins/automation.ts`, `sync.ts:L121-L128`.
- **Confidence**: HIGH.

---

### DIV-006: Duplicate Execution Prevention Mechanics Divergence

- **Divergence Title**: Remote MongoDB Duplicate Check vs Desktop Multi-Table SQLite Duplicate Check
- **Current Behavior**: Path A checks duplicate active executions on MongoDB via `AutomationService`; Path B checks duplicate active runs across both SQLite `jobs` table AND SQLite `sequence_executions` table in `AutomationTriggerEvaluator`.
- **Manual Path Implementation**: `AutomationService.startExecution` in [`automation.service.ts:L82-L92`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/services/automation/automation.service.ts#L82-L92) queries MongoDB `SequenceExecutionModel` for `{ status: { $in: [RUNNING, WAITING, PENDING] }, contactId, companyId }`.
- **Event Path Implementation**: `AutomationTriggerEvaluator` in [`automation-trigger.ts:L307-L333`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/automation-trigger.ts#L307-L333) executes two prepared SQL queries against SQLite:
  1. `stmtCheckExistingJob`: Checks `jobs` table for `type = 'automation:workflow'` with `status IN ('queued', 'starting', 'running', 'retrying')`.
  2. `stmtCheckExistingExecution`: Checks `sequence_executions` table for `status IN ('running', 'waiting')`.
- **First Point of Divergence**: MongoDB `.findOne()` vs SQLite `stmtCheckExistingJob.get()` & `stmtCheckExistingExecution.get()`.
- **Execution Ownership**: Path A remote API service; Path B local Main process evaluator.
- **State Impact**: Path A prevents duplicate MongoDB documents; Path B prevents duplicate SQLite jobs AND duplicate SQLite execution records.
- **Persistence Impact**: Path A queries MongoDB engine; Path B queries local SQLite engine.
- **Synchronization Impact**: Path A requires online API check; Path B performs instant local SQLite check.
- **Evidence**:
  - Path A: `automation.service.ts:L82-L92`.
  - Path B: `automation-trigger.ts:L135-L152`, `L307-L333`.
- **Confidence**: HIGH.

---

## Architectural Rule Verification Matrix

| Architectural Rule                                   | Path A (Manual Path) | Path B (Event Path) | Evidence                                                                                                                                                                                           | Confidence |
| :--------------------------------------------------- | :------------------- | :------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- |
| **Rule 1: Desktop owns execution**                   | ❌ **VIOLATED**      | ✅ **COMPLIANT**    | Path A: `main/ipc/automation.ts:L66` calls `sdk.executions.start()` (remote API owns execution). Path B: `worker-host.ts:L53` calls `executeAutomationWorkflow()` (desktop worker owns execution). | HIGH       |
| **Rule 2: Everything executes locally**              | ❌ **VIOLATED**      | ✅ **COMPLIANT**    | Path A: Execution created and managed on remote API server (`apps/api`). Path B: Executed inside local desktop worker process (`plugins/automation.ts`).                                           | HIGH       |
| **Rule 3: SQLite is source of truth**                | ❌ **VIOLATED**      | ✅ **COMPLIANT**    | Path A: Primary record created in MongoDB; SQLite written secondarily as cache via `LocalCRMRepository.save()`. Path B: Primary record written to SQLite; synced to MongoDB.                       | HIGH       |
| **Rule 4: API is passive**                           | ❌ **VIOLATED**      | ✅ **COMPLIANT**    | Path A: API actively handles `POST /executions/start`, creates execution, checks duplicates, logs steps. Path B: API receives background sync updates via `SyncEngine`.                            | HIGH       |
| **Rule 5: Everything syncs through SyncEngine**      | ❌ **VIOLATED**      | ✅ **COMPLIANT**    | Path A: `main/ipc/automation.ts:L67` uses `skipQueue = true`, bypassing `sync_queue`. Path B: Uses `sync_queue` table for background sync.                                                         | HIGH       |
| **Rule 6: Business logic belongs in Desktop**        | ❌ **VIOLATED**      | ✅ **COMPLIANT**    | Path A: Sequence validation, status initialization, duplicate checking executed in API `AutomationService`. Path B: Evaluated in `AutomationTriggerEvaluator` & worker.                            | HIGH       |
| **Rule 7: Renderer never talks directly to MongoDB** | ✅ **COMPLIANT**     | ✅ **COMPLIANT**    | Path A: Renderer calls `window.ipc.invoke()`, which calls Main process, which calls SDK -> API -> MongoDB. Path B: Event driven in Main process.                                                   | HIGH       |

---

## Data Ownership Comparison

| Entity / Object                            | Path A Owner                                         | Path B Owner                                          | Same Owner? | Evidence                                                                        |
| :----------------------------------------- | :--------------------------------------------------- | :---------------------------------------------------- | :---------- | :------------------------------------------------------------------------------ |
| **Trigger Payload**                        | Renderer UI (`AutomationScreen.tsx`)                 | Desktop `LocalEventBus` (`AppEvent`)                  | NO          | `AutomationScreen.tsx:L219` vs `automation-trigger.ts:L213`                     |
| **Job Record (`jobs` table)**              | **Does not exist** (Bypassed)                        | Desktop `JobScheduler` & SQLite `jobs` table          | NO          | `automation.ts:L66` (None) vs `automation-trigger.ts:L347` (`INSERT INTO jobs`) |
| **Execution ID (`id` / `_id`)**            | Client `sync.ts` or MongoDB `SequenceExecutionModel` | Desktop `AutomationTriggerEvaluator` (`randomUUID()`) | NO          | `sync.ts:L104` / `automation.service.ts` vs `automation-trigger.ts:L337`        |
| **Execution Object (`SequenceExecution`)** | Remote API Server (`AutomationService`)              | Desktop Worker (`executeAutomationWorkflow`)          | NO          | `automation.service.ts:L94` vs `plugins/automation.ts:L844`                     |
| **Execution Status (`"PENDING"`)**         | Remote API Server (`AutomationService`)              | Desktop SQLite database table                         | NO          | `automation.service.ts:L100` vs `plugins/automation.ts`                         |
| **Execution Logs (`SequenceLog`)**         | Central MongoDB (`sequence_logs` & `$push`)          | Desktop SQLite `sequence_logs` table                  | NO          | `automation.service.ts:L145` vs `plugins/automation.ts`                         |
