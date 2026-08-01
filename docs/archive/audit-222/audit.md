# Forensic Audit V2 — LeadForge OS Automation Engine

## Summary of Completed Audit

A complete forensic audit of the LeadForge OS automation runtime has been conducted strictly using source code evidence.

### Document Saved
- Repository Documentation: [forensic-audit-v2.md](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/docs/forensic-audit-v2.md)

---

## Key Audit Findings

### 1. Engine Core & Reliable Runtime (STAB-013A to STAB-013E)
- **Sequential Execution Loop**: Workers execute consecutive synchronous steps in a single execution loop inside `executeAutomationWorkflow()` ([automation.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/automation.ts#L1194)).
- **Safety Guards**: Loop iteration limit (100 per run), total execution timeout (300s), step execution timeout (60s via `Promise.race`), and jump count limit (100 jumps).
- **Concurrency & Locking**: Execution locks stored in `automation_locks` SQLite table per `(sequenceId, entityId)`.
- **State & Checkpoints**: `ExecutionContext` and step progress are atomically written to `sequence_executions` and `sequence_logs` in local SQLite.
- **Branching & Variables**: Full expression engine supporting `IF`, `GOTO`, `LABEL`, `SKIP`, `SET_VARIABLE` with variable/secret resolution (`{{secret.KEY}}`).
- **Integrations**: Extensible `ActionRegistry` supporting `SEND_EMAIL` (nodemailer SMTP), `HTTP_REQUEST` (fetch with header/body redaction and retry classification), `ASSIGN_TAG`, `UPDATE_STAGE`.

### 2. Architectural Defects Identified

> [!CAUTION]
> **DEFECT-001: Manual Execution Trigger Path Bypass**
>
> The `sequence:start` IPC channel ([ipc/automation.ts:66](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/automation.ts#L66)) invokes `sdk.executions.start()`, creating a record in **MongoDB** via the remote API. It **does not queue a job in the local SQLite `jobs` table**.
> Because `JobScheduler` only polls local SQLite, **manually triggered sequences from the UI are never executed by the desktop worker.**
>
> *Only event-driven sequences (evaluated via `AutomationTriggerEvaluator`) are currently executed locally.*

> [!WARNING]
> **DEFECT-002: UI Cancellation (`sequence:stop`) Does Not Stop Desktop Worker**
>
> The `sequence:stop` IPC handler updates MongoDB via API, but fails to call `JobScheduler.cancelJob()` or signal the running worker process. A running worker will continue step execution until completion or wait state.

> [!WARNING]
> **DEFECT-003: Dual Data Store Synchronization Gap**
>
> Execution listing/log endpoints (`execution:list`, `execution:get`, `execution:logs`) query the API server's MongoDB instance. Local executions created and completed by the desktop runtime in SQLite are missing from these views.

> [!NOTE]
> **DEFECT-004: SMTP Failure Classification**
>
> `SEND_EMAIL.supportsRetry` returns `true` unconditionally. Permanent SMTP failures (e.g. 550 User Unknown, bad auth) are retried unnecessarily instead of halting retries immediately.

---

## Complete End-to-End Call Graph

```
Renderer UI
  │
  ├──> electron:setActiveWorkspace ──> WorkspaceManager ──> WorkspaceRuntime.start()
  │                                                           │
  │                                                           ├─> JobScheduler (polls SQLite `jobs` every 1s)
  │                                                           │    └─> fork('worker.js')
  │                                                           │         └─> executeAutomationWorkflow()
  │                                                           │              ├─> ActionRegistry[step.type].execute()
  │                                                           │              └─> process.send(automation_event)
  │                                                           │
  │                                                           ├─> AutomationTriggerEvaluator
  │                                                           │    └─> Subscribes to LocalEventBus (crm:created, etc.)
  │                                                           │         └─> INSERT INTO jobs (`automation:workflow`)
  │                                                           │
  │                                                           └─> EventBridge ──> BrowserWindow.webContents.send()
  │
  └──> sequence:start (MANUAL UI TRIGGER - BROKEN PATH)
       └─> SDK ──> Remote API Server ──> MongoDB (never reaches local JobScheduler)
```

---

## Recommended Next Phase

Remediate **DEFECT-001** and **DEFECT-002** by routing `sequence:start` and `sequence:stop` IPC channels directly to the local SQLite database and `JobScheduler` instance.
