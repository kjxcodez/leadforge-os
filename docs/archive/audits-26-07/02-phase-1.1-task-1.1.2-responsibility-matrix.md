# Forensic Audit: Task 1.1.2 — Responsibility & Ownership Matrices

This document presents the detailed architectural responsibility, ownership, business logic, persistence, transport, and validation matrices for all files participating in the manual automation execution path.

---

## 1. Ownership Matrix

| File                          | Layer         | Owner Component   | Owned Responsibilities                                                 | Explicitly Unowned Responsibilities               |
| :---------------------------- | :------------ | :---------------- | :--------------------------------------------------------------------- | :------------------------------------------------ |
| `AutomationScreen.tsx`        | Renderer UI   | Frontend UI       | UI state, button click handlers, prompt dialogs                        | Business rules, database persistence, IPC routing |
| `use-automation.ts`           | Renderer Hook | Frontend Hook     | TanStack Query invalidation, toast alerts, hook options                | Local/remote repository logic, IPC transport      |
| `sync.ts`                     | Renderer Repo | Client Repository | Entity-to-IPC channel mapping, client UUID generation                  | IPC channel execution, SQLite/MongoDB storage     |
| `preload/index.ts`            | IPC Guard     | Electron Preload  | Channel whitelisting (`validChannels`), `window.ipc` bridge            | Request payload processing, business rules        |
| `schema/src/ipc/index.ts`     | Schema        | Shared Contracts  | `IpcChannelMap` TypeScript interface definitions                       | Runtime code execution                            |
| `main/ipc/register.ts`        | Main Process  | IPC Registrar     | Grouping domain module registrations                                   | Handler callback implementation                   |
| `main/ipc/automation.ts`      | Main Process  | IPC Controller    | Handling `'sequence:start'`, calling SDK, updating SQLite cache        | Job scheduling, API endpoint implementation       |
| `main/ipc/helper.ts`          | Main Process  | IPC Utility       | HMR safe handler registration/deregistration                           | Domain logic                                      |
| `workspace-manager.ts`        | Main Process  | Context Manager   | Active workspace runtime singleton, DB handles                         | IPC routing, HTTP requests                        |
| `local-crm.ts`                | Desktop DB    | Local SQLite Repo | Compiling prepared SQL queries, SQLite CRUD writes                     | Network sync queue processing                     |
| `sdk/client/index.ts`         | Shared SDK    | SDK Facade        | Grouping SDK module properties                                         | HTTP transport implementation details             |
| `sdk/modules/automation.ts`   | Shared SDK    | SDK Module        | Formatting API endpoint routes (`/executions/start`)                   | Native `fetch` handling, error retry loop         |
| `sdk/http/client.ts`          | Shared SDK    | SDK Transport     | `Authorization` header injection, JSON stringifying, `fetch` calls     | API endpoint path definitions                     |
| `routes/automation.ts`        | API Server    | HTTP Router       | Endpoint route matching (`POST /executions/start`), JSON responses     | Database queries, domain validation rules         |
| `automation.service.ts`       | API Server    | Domain Service    | Sequence validation, execution duplicate checking, MongoDB persistence | HTTP routing, desktop SQLite local caching        |
| `sequence.model.ts`           | API DB        | MongoDB Model     | `sequences` Mongoose schema & index definition                         | Template business validation rules                |
| `sequence-execution.model.ts` | API DB        | MongoDB Model     | `sequence_executions` Mongoose schema, status enum, indexes            | State machine execution loop                      |
| `sequence-log.model.ts`       | API DB        | MongoDB Model     | `sequence_logs` Mongoose schema & index definition                     | Log message generation logic                      |
| `workspace.plugin.ts`         | API DB        | MongoDB Plugin    | Workspace isolation middleware on Mongoose hooks                       | Collection schema definitions                     |

---

## 2. Architectural Boundary Matrix

| File                        | Layer          | Resides In Boundary     | Crosses Boundary To       | Boundary Guard Mechanism                                 | Source Code Reference        |
| :-------------------------- | :------------- | :---------------------- | :------------------------ | :------------------------------------------------------- | :--------------------------- |
| `AutomationScreen.tsx`      | Renderer UI    | Chromium Renderer       | Renderer Hook             | JavaScript function import                               | `AutomationScreen.tsx:L12`   |
| `use-automation.ts`         | Renderer Hook  | Chromium Renderer       | Renderer Repository       | ES Module import                                         | `use-automation.ts:L3`       |
| `sync.ts`                   | Renderer Repo  | Chromium Renderer       | Electron Preload Bridge   | `window.ipc.invoke()` call                               | `sync.ts:L108`               |
| `preload/index.ts`          | Preload Bridge | Context Isolation Guard | Electron Main Process     | `validChannels` whitelist check + `ipcRenderer.invoke()` | `preload/index.ts:L116-L117` |
| `main/ipc/automation.ts`    | Main IPC       | Electron Node.js Main   | Remote SDK & Local SQLite | `sdk.executions.start()` & `LocalCRMRepository.save()`   | `automation.ts:L66-L67`      |
| `sdk/modules/automation.ts` | SDK Module     | SDK Client Library      | SDK HTTP Transport        | `this.client.post()` invocation                          | `automation.ts:L46`          |
| `sdk/http/client.ts`        | SDK Transport  | Client Process          | Remote API Server         | Native `fetch()` HTTP POST request                       | `client.ts:L54`              |
| `routes/automation.ts`      | API Router     | API HTTP Gateway        | API Domain Service        | `AutomationService.startExecution()` invocation          | `routes/automation.ts:L78`   |
| `automation.service.ts`     | API Service    | API Application Layer   | MongoDB Database          | Mongoose Model `.save()` & `.findOne()` calls            | `automation.service.ts:L106` |

---

## 3. Business Logic Matrix

| File                          | Contains Business Logic? | Logic Description                                                                                                                                                                                                            | Code Location                     |
| :---------------------------- | :----------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------- |
| `AutomationScreen.tsx`        | NO                       | Presentation layer only. Captures prompt input and dispatches mutation.                                                                                                                                                      | `AutomationScreen.tsx:L219`       |
| `use-automation.ts`           | NO                       | Orchestrates TanStack Query mutation invalidation and toast feedback.                                                                                                                                                        | `use-automation.ts:L74`           |
| `sync.ts`                     | NO                       | Maps domain entity names to IPC channel strings.                                                                                                                                                                             | `sync.ts:L46`                     |
| `preload/index.ts`            | NO                       | Whitelists IPC channel names.                                                                                                                                                                                                | `preload/index.ts:L97`            |
| `schema/src/ipc/index.ts`     | NO                       | TypeScript interface definitions.                                                                                                                                                                                            | `schema/src/ipc/index.ts:L322`    |
| `main/ipc/automation.ts`      | PARTIAL                  | Intercepts IPC call, injects workspace context, triggers remote SDK, writes local cache.                                                                                                                                     | `automation.ts:L63`               |
| `sdk/modules/automation.ts`   | NO                       | Endpoint string mapping.                                                                                                                                                                                                     | `automation.ts:L45`               |
| `sdk/http/client.ts`          | NO                       | HTTP transport error wrapping and retries.                                                                                                                                                                                   | `client.ts:L52`                   |
| `routes/automation.ts`        | NO                       | Context workspace ID verification and JSON response formatting.                                                                                                                                                              | `routes/automation.ts:L74`        |
| `automation.service.ts`       | **YES**                  | **Core Business Rules**: Verifies sequence template status, enforces duplicate active execution check (`status: { $in: [RUNNING, WAITING, PENDING] }`), initializes step pointer to `0`, sets initial status to `"PENDING"`. | `automation.service.ts:L73-L111`  |
| `sequence.model.ts`           | NO                       | Schema field definitions.                                                                                                                                                                                                    | `sequence.model.ts:L23`           |
| `sequence-execution.model.ts` | NO                       | Status enum constraints (`"PENDING"`, `"RUNNING"`, etc.).                                                                                                                                                                    | `sequence-execution.model.ts:L48` |
| `sequence-log.model.ts`       | NO                       | Schema field definitions.                                                                                                                                                                                                    | `sequence-log.model.ts:L15`       |
| `workspace.plugin.ts`         | NO                       | Mongoose query scoping middleware.                                                                                                                                                                                           | `workspace.plugin.ts:L1`          |

---

## 4. Persistence Matrix

| File                     | Target Storage Engine | Operation Type              | Table / Collection Target | Record Structure / Fields                                                                                        |
| :----------------------- | :-------------------- | :-------------------------- | :------------------------ | :--------------------------------------------------------------------------------------------------------------- |
| `main/ipc/automation.ts` | Desktop SQLite        | `INSERT OR REPLACE`         | `sequence_executions`     | `{ ...res, workspaceId }`                                                                                        |
| `local-crm.ts`           | Desktop SQLite        | Prepared SQL Execution      | `sequence_executions`     | Dynamically compiled SQL parameter array                                                                         |
| `automation.service.ts`  | Central MongoDB       | `Document.save()`           | `sequence_executions`     | `{ _id, sequenceId, workspaceId, contactId, companyId, status: "PENDING", currentStep: 0, startedAt, logs: [] }` |
| `automation.service.ts`  | Central MongoDB       | `Document.save()`           | `sequence_logs`           | `{ workspaceId, executionId, timestamp, step: 0, action: "TRIGGER", status: "SUCCESS", message }`                |
| `automation.service.ts`  | Central MongoDB       | `findByIdAndUpdate ($push)` | `sequence_executions`     | Appends log entry object into `logs` array                                                                       |

---

## 5. Transport Matrix

| Transport Boundary      | Sender Component                          | Receiver Component                          | Transport Protocol      | Serialization Standard                   |
| :---------------------- | :---------------------------------------- | :------------------------------------------ | :---------------------- | :--------------------------------------- |
| **Renderer to Preload** | `sync.ts` (`window.ipc.invoke`)           | `preload/index.ts`                          | Electron Context Bridge | In-memory JS Object                      |
| **Preload to Main IPC** | `preload/index.ts` (`ipcRenderer.invoke`) | `main/ipc/automation.ts` (`ipcMain.handle`) | Electron IPC Pipe       | Electron Structured Clone Algorithm      |
| **Main Process to API** | `sdk/http/client.ts` (`fetch()`)          | `routes/automation.ts` (`OpenAPIHono`)      | HTTP POST / REST        | JSON (`JSON.stringify` / `c.req.json()`) |
| **API to MongoDB**      | `automation.service.ts` (`exec.save()`)   | MongoDB Database Server                     | MongoDB Wire Protocol   | BSON (Binary JSON)                       |

---

## 6. Validation Matrix

| File                          | Validation Type       | Validation Rules Enforced                                                                                                                  | Failure Action                                                                                   |
| :---------------------------- | :-------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------- |
| `AutomationScreen.tsx`        | UI Input              | Captures optional `contactId` string from prompt                                                                                           | If cancelled, defaults `contactId` to empty string                                               |
| `use-automation.ts`           | State Guard           | Verifies `workspaceId` presence from `useWorkspace()`                                                                                      | Rejects request if `workspaceId` is missing                                                      |
| `sync.ts`                     | Channel Verification  | Matches `sequence_executions` entity to `sequence:start` in `DOMAIN_CHANNELS`                                                              | Throws error if channel mapping is undefined                                                     |
| `preload/index.ts`            | Security Guard        | Checks `validChannels.includes(channel)` whitelist                                                                                         | Throws `Error: Unauthorized IPC channel: sequence:start`                                         |
| `main/ipc/automation.ts`      | Runtime Guard         | Checks `WorkspaceManager.getActiveRuntime()` for non-null active runtime                                                                   | Throws `Error: No active workspace runtime`                                                      |
| `local-crm.ts`                | SQL Safety            | Validates `tableName` against regex `/^[a-zA-Z0-9_]+$/` and checks `workspaceId` presence                                                  | Throws `Invalid table name` or `workspaceId is required`                                         |
| `sdk/http/client.ts`          | HTTP Status Guard     | Checks `response.ok` and `payload.success === true`                                                                                        | Throws `SdkError` with status code and message                                                   |
| `routes/automation.ts`        | Auth / Tenant Guard   | Checks `c.get("workspaceId")` context variable                                                                                             | Throws `ForbiddenError("Workspace context required.")`                                           |
| `automation.service.ts`       | Domain Business Guard | 1. Verifies sequence exists via `SequenceModel.findOne()`. 2. Checks for active duplicate execution via `SequenceExecutionModel.findOne()` | 1. Throws `Error("Sequence not found.")`. 2. Returns existing execution to prevent duplicate run |
| `sequence-execution.model.ts` | Schema Enforcement    | Validates `sequenceId` presence and `status` enum values (`PENDING`, `RUNNING`, etc.)                                                      | Throws Mongoose `ValidationError`                                                                |
