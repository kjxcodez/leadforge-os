# Forensic Audit: Task 1.1.4 — Manual Path vs. Event Trigger Path Comparison

## Executive Summary

This forensic audit compares the **Manual Execution Path (Path A)** and the **Event Trigger Execution Path (Path B)** in LeadForge OS. Based on empirical static code analysis of the active repository, this document establishes the exact call traces, ownership handoffs, persistence strategies, and points of divergence between how manual UI triggers and background event triggers execute automations.

The central finding of this comparison is that **Path A and Path B follow completely inverted execution architectures**.
- **Path A (Manual Trigger)** follows a **Remote-First Architecture**: The Renderer UI calls IPC (`sequence:start`), which delegates execution directly over HTTP via `@leadforge/sdk` to the remote API server (`apps/api`). The API server creates execution records in **MongoDB** as primary storage, and the desktop Main process receives the result and caches a snapshot in local SQLite. Path A bypasses the desktop `JobScheduler`, local SQLite `jobs` table, and `JobWorker` entirely.
- **Path B (Event Trigger)** follows a **Local-First Architecture**: An event on the desktop `LocalEventBus` is intercepted by `AutomationTriggerEvaluator` in the desktop Main process. It evaluates trigger criteria, checks duplicate queued/active runs against local SQLite, and enqueues an `automation:workflow` job into the local SQLite `jobs` table. The desktop `JobScheduler` polls SQLite, picks up the queued job, and executes it locally inside `executeAutomationWorkflow` (desktop `JobWorker`). Execution progress is written to local SQLite as the primary source of truth, and state changes are synced to remote MongoDB asynchronously via `SyncEngine` / `sync_queue`.

---

## Scope

This comparative audit is strictly limited to:
- **Path A (Manual Execution Path)**: `AutomationScreen.tsx` -> `useStartSequence` -> `sync.ts` -> `preload/index.ts` -> `main/ipc/automation.ts` -> `@leadforge/sdk` -> `routes/automation.ts` -> `AutomationService` -> `MongoDB` -> `SQLite Cache`.
- **Path B (Event Trigger Execution Path)**: `LocalEventBus` (`crm:created`, `job:completed`, etc.) -> `AutomationTriggerEvaluator` (`automation-trigger.ts`) -> SQLite `jobs` table (`automation:workflow`) -> `JobScheduler` (`scheduler.ts`) -> `JobWorker` / `executeAutomationWorkflow` (`plugins/automation.ts`) -> SQLite primary database -> `SyncEngine` / `sync_queue` -> MongoDB.

Out of Scope: WAIT step recovery, retry backoff, workflow cancellation, crash recovery, and diagnostic logging.

---

## Methodology

This audit evaluates actual source code files in `apps/desktop` and `apps/api`. No speculative statements, future plans, or refactoring designs are included. Confidence scores are assigned per section based on verifiable evidence.

---

## Path Summaries

### Path A Summary: Manual Execution Path (Remote-First)
1. User clicks "Run" on sequence card in [`AutomationScreen.tsx`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/screens/AutomationScreen.tsx#L219).
2. React Query hook [`useStartSequence()`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/hooks/use-automation.ts#L74) attaches `workspaceId` and calls [`SyncSequenceExecutionRepository.create()`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/sync.ts#L100).
3. `BaseSyncRepository` maps entity to IPC channel `'sequence:start'` and invokes `window.ipc.invoke()`.
4. Preload guard [`preload/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/preload/index.ts#L97) validates channel and calls `ipcRenderer.invoke()`.
5. IPC handler in [`main/ipc/automation.ts:L63`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/automation.ts#L63) calls `sdk.executions.start(sequenceId, contactId, companyId)` over HTTP.
6. SDK HTTP Client [`packages/sdk/src/http/client.ts:L54`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/http/client.ts#L54) executes `POST /automation/executions/start` network request.
7. API Hono router [`routes/automation.ts:L74`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/automation.ts#L74) receives request, checks workspace context, and calls `AutomationService.startExecution()`.
8. Backend service [`automation.service.ts:L73`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/services/automation/automation.service.ts#L73) validates sequence, creates `SequenceExecutionModel` document with status `"PENDING"`, logs step to `sequence_logs`, and saves directly to **MongoDB**.
9. API server returns JSON response to SDK -> Desktop Main process receives response -> writes snapshot to local desktop SQLite table `sequence_executions` via `LocalCRMRepository.save()` -> resolves IPC Promise in Renderer UI.

### Path B Summary: Event Trigger Execution Path (Local-First)
1. Domain event (e.g. `crm:created`, `job:completed`) is published on desktop [`LocalEventBus`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/lib/event-bus.ts).
2. [`AutomationTriggerEvaluator`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/automation-trigger.ts#L96) (subscribed via `start()`) receives event in `onEvent(event)`.
3. `mapEventToTriggerType(event)` maps event to `AutomationTriggerType` (e.g., `CONTACT_CREATED`).
4. Evaluator queries local SQLite `sequences` table for active templates matching workspace ID.
5. Evaluator checks duplicate jobs in local SQLite `jobs` table (`type = 'automation:workflow'`) and active executions in SQLite `sequence_executions` table.
6. If not duplicate, evaluator inserts job into local SQLite `jobs` table with `status = 'queued'`, `type = 'automation:workflow'`, `priority = 3` via `stmtInsertJob.run()`.
7. Evaluator publishes `automation:triggered` event on `LocalEventBus`.
8. Desktop [`JobScheduler`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/scheduler.ts) polls SQLite `jobs` table, claims queued job, and dispatches to [`JobWorker`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/worker-host.ts).
9. [`executeAutomationWorkflow`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/automation.ts#L823) executes workflow steps locally in desktop process, writes execution status and step logs to local SQLite as primary source of truth, and enqueues sync tasks into SQLite `sync_queue` for asynchronous background push to MongoDB via `SyncEngine`.

---

## Comparative Execution Trace

| Stage | Path A: Manual Execution | Path B: Event Trigger Execution | Architecture Comparison |
| :--- | :--- | :--- | :--- |
| **1. Trigger Origin** | Renderer UI button click (`AutomationScreen.tsx`) | Domain event on `LocalEventBus` (`automation-trigger.ts`) | Path A is User UI driven; Path B is EventBus driven. |
| **2. Transport Protocol** | Electron IPC (`sequence:start`) | In-memory event bus subscription (`LocalEventBus.subscribe`) | Path A uses IPC bridge; Path B uses Node.js event emitter. |
| **3. Context Resolution** | `useWorkspace` (Renderer) & `WorkspaceManager` (Main) | `WorkspaceRuntime` instance binding (`this.workspaceId`) | Both resolve workspace ID context successfully. |
| **4. Duplicate Prevention** | Evaluated on API server in `AutomationService` against MongoDB | Evaluated in Main process in `AutomationTriggerEvaluator` against SQLite | Path A checks remote MongoDB; Path B checks local SQLite. |
| **5. Job Scheduling** | **Bypassed completely**. No job created in SQLite `jobs` table. | **Queued in local SQLite**. `stmtInsertJob.run()` inserts `automation:workflow` job. | **Major Architectural Divergence**: Path A bypasses local scheduler; Path B uses local scheduler. |
| **6. Execution Authority** | Remote API Server (`apps/api/src/services/automation/automation.service.ts`) | Local Desktop Worker (`executeAutomationWorkflow` in `workers/plugins/automation.ts`) | **Major Ownership Divergence**: Path A execution is owned by API; Path B is owned by Desktop Worker. |
| **7. Primary Persistence Target** | Central **MongoDB** (`sequence_executions` & `sequence_logs` collections) | Local **SQLite** (`sequence_executions`, `sequence_logs`, and `jobs` tables) | **Major Persistence Divergence**: Path A writes MongoDB first; Path B writes SQLite first. |
| **8. Secondary Persistence / Sync** | Local **SQLite** written as read-only cache via `LocalCRMRepository.save()` | Remote **MongoDB** updated asynchronously via `sync_queue` / `SyncEngine` | Path A uses synchronous API return caching; Path B uses async queue sync. |
| **9. Return Path to UI** | Synchronous IPC Promise resolution -> React Query cache invalidation | Asynchronous background update -> Local database query / UI polling | Path A updates UI instantly; Path B updates UI via database observer/polling. |

---

## Comparative Call Graph

```mermaid
flowchart TD
    subgraph PATH_A["Path A: Manual Execution Path (Remote-First)"]
        A1["Renderer UI (AutomationScreen.tsx)"] -->|window.ipc.invoke| A2["Preload (index.ts)"]
        A2 -->|ipcRenderer.invoke| A3["Main Process IPC (automation.ts)"]
        A3 -->|sdk.executions.start| A4["Shared SDK (packages/sdk)"]
        A4 -->|HTTP POST /executions/start| A5["API Gateway (routes/automation.ts)"]
        A5 -->|startExecution()| A6["API Service (automation.service.ts)"]
        A6 -->|PRIMARY SAVE| A7[("Central MongoDB")]
        A3 -.->|READ-ONLY CACHE WRITE| A8[("Desktop SQLite")]
    end

    subgraph PATH_B["Path B: Event Trigger Path (Local-First)"]
        B1["Domain Event (LocalEventBus)"] -->|onEvent()| B2["AutomationTriggerEvaluator (automation-trigger.ts)"]
        B2 -->|stmtInsertJob.run()| B3[("Desktop SQLite jobs Table")]
        B3 -->|Polls queued jobs| B4["JobScheduler (scheduler.ts)"]
        B4 -->|Dispatches job| B5["JobWorker / executeAutomationWorkflow (plugins/automation.ts)"]
        B5 -->|PRIMARY SAVE| B6[("Desktop SQLite sequence_executions Table")]
        B5 -->|Enqueue sync task| B7[("Desktop SQLite sync_queue Table")]
        B7 -->|Async push| B8["SyncEngine / QueueProcessor"]
        B8 -->|ASYNC SYNC SAVE| B9[("Central MongoDB")]
    end
```

---

## Key Comparison Findings

1. **Inverted Authority**: Manual triggers delegate authority to the remote API server, whereas event triggers retain execution authority inside the desktop local worker.
2. **Scheduler Exclusion**: Manual execution triggers bypass the desktop SQLite `jobs` queue and `JobScheduler` entirely, preventing local job tracking, priority queueing, and local worker execution.
3. **Database Role Inversion**: For manual triggers, MongoDB is the primary source of truth and SQLite is a secondary read cache. For event triggers, SQLite is the primary source of truth and MongoDB is an eventual sync destination.
