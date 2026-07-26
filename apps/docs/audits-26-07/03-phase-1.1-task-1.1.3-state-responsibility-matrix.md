# Forensic Audit: Task 1.1.3 — State & Responsibility Matrices

This document provides the formal responsibility, input, output, state ownership, responsibility transfer, lifecycle ownership, and ownership transfer graph matrices for the manual automation execution path.

---

## 1. Comprehensive Responsibility Matrix

| Component | Layer | Primary Owner | Owned Responsibilities | Inputs Received | Outputs Emitted | Side Effects | State Owned |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `AutomationScreen.tsx` | UI | Frontend UI | UI rendering, user prompt collection, triggering mutation | User mouse click & text prompt | `{ sequenceId, contactId, companyId: null }` | Opens prompt modal | Form state, prompt input state |
| `use-automation.ts` | Hook | Frontend Hook | Query cache invalidation, UI toast alerts, workspace ID injection | Trigger payload from UI | Execution object passed back to caller | Emits Sonner toast, invalidates query cache | React Query mutation state |
| `sync.ts` | Repo | Client Repo | Mapping table name to IPC channel (`'sequence:start'`), client UUID creation | Execution payload object | `window.ipc.invoke('sequence:start', record)` | Invokes IPC bridge | None |
| `preload/index.ts` | Preload | Electron Preload | Channel whitelisting (`validChannels`), IPC forwarding | Channel name & record payload | `ipcRenderer.invoke()` Promise | Cross-process IPC invocation | Global `window.ipc` object |
| `schema/src/ipc/index.ts` | Schema | Shared Schema | IPC channel interface contracts | None (Compile-time) | TypeScript types | None | None |
| `main/ipc/register.ts` | Main Process | Main Registrar | Registering domain IPC modules | `SdkClient` instance | `registerAutomationIpc(sdk)` invocation | Registers IPC handlers | Main process IPC handler registry |
| `main/ipc/automation.ts` | Main Process | Main Controller | Handling `'sequence:start'`, fetching active runtime, calling SDK, SQLite save | IPC event, `{ sequenceId, contactId, companyId }` | `res` (Execution object) | Desktop SQLite file write | None |
| `main/ipc/helper.ts` | Main Process | Main Utility | HMR safe handler registration | Channel name & handler callback | Handlers registered on `ipcMain` | Mutates `ipcMain` handler set | `REGISTERED_IPC_CHANNELS` Set |
| `workspace-manager.ts` | Main Process | Context Manager | Active workspace runtime singleton, database connection handles | None | Active `WorkspaceRuntime` object | None | Active workspace runtime pointer |
| `local-crm.ts` | Desktop DB | SQLite Repo | Compiling prepared SQL queries, executing `INSERT OR REPLACE` | `tableName`, `record`, `skipQueue` | SQL execution result | Writes row to local SQLite database file | SQLite file database state |
| `sdk/client/index.ts` | Shared SDK | SDK Facade | Grouping SDK resource modules | SDK Config | `SdkClient` instance | Instantiates `HttpClient` | SDK client instance state |
| `sdk/modules/automation.ts` | Shared SDK | SDK Module | Endpoint route path formatting (`/automation/executions/start`) | Method parameters | `this.client.post()` Promise | Invokes HTTP client | None |
| `sdk/http/client.ts` | Shared SDK | SDK Transport | Authorization header injection, JSON stringifying, native `fetch()` calls | Path string, body object | Parsed `ApiResponse.data` payload | Network HTTP POST I/O | Retry attempt counter state |
| `routes/automation.ts` | API Gateway | HTTP Router | Endpoint route matching, context workspace ID extraction, JSON response formatting | Hono Context `c` | HTTP JSON response (`successResponse`) | Serves HTTP response | None |
| `automation.service.ts` | API Service | Domain Service | Sequence validation, duplicate active execution check, MongoDB persistence, logging | `sequenceId`, payload object | Saved Mongoose `SequenceExecutionDocument` | Inserts MongoDB documents (`executions` & `logs`) | Execution state (`"PENDING"`) |
| `sequence.model.ts` | API DB | MongoDB Model | `sequences` schema & index definition | Query filters / document creation objects | Sequence Mongoose document | MongoDB read queries | MongoDB template document state |
| `sequence-execution.model.ts` | API DB | MongoDB Model | `sequence_executions` schema, status enum, compound index definition | Document creation objects | Execution Mongoose document | MongoDB insert/update writes | MongoDB execution document state |
| `sequence-log.model.ts` | API DB | MongoDB Model | `sequence_logs` schema & index definition | Log creation objects | Log Mongoose document | MongoDB insert writes | MongoDB log document state |
| `workspace.plugin.ts` | API DB | MongoDB Plugin | Mongoose pre-find and pre-save workspace isolation middleware | Mongoose schema | Modified query filter / document | Injects `workspaceId` onto queries | Mongoose query filter state |

---

## 2. Input Ownership Matrix

| Input Field | Created By | Validated By | Modified By | Consumed By | Persisted By | Ultimate Owner |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `sequenceId` | UI Card / Template Builder | `AutomationService` (`SequenceModel.findOne`) | Unmodified | `use-automation`, `sync.ts`, `automation.ts`, SDK, API, MongoDB | `sequence_executions.sequenceId` (MongoDB & SQLite) | Frontend UI / Domain Service |
| `contactId` | UI Prompt (`prompt()`) | `AutomationService` (duplicate check) | `AutomationService` (`payload.contactId \|\| null`) | Hook, Repo, IPC, SDK, API, MongoDB | `sequence_executions.contactId` (MongoDB & SQLite) | User / Domain Service |
| `companyId` | UI Trigger (`null`) | None | Unmodified (`null`) | Hook, Repo, IPC, SDK, API, MongoDB | `sequence_executions.companyId` (MongoDB & SQLite) | Frontend UI |
| `workspaceId` | Workspace Context Provider | `use-automation`, `automation.ts`, `routes/automation.ts`, `workspace.plugin.ts` | Unmodified | Hook, Repo, IPC, Main IPC, SQLite, Hono, MongoDB | Scopes all MongoDB & SQLite records | Workspace Manager / Auth Context |
| `executionId` (`id` / `_id`)| `sync.ts` (`randomUUID`) / Mongoose default | Mongoose String ObjectId check | Mongoose maps `_id` to `id` | Main IPC, SQLite, SDK, API, MongoDB | Primary key in MongoDB & SQLite | `sync.ts` / Mongoose Model |
| `status` | `AutomationService` (`"PENDING"`) | `sequence-execution.model.ts` enum | Set to `"PENDING"` on create | Main IPC, SQLite, SDK, API, Renderer UI | `sequence_executions.status` (MongoDB & SQLite) | `AutomationService` |
| `currentStep` | `AutomationService` (`0`) | `sequence-execution.model.ts` default | Initialized to `0` | Log recorder, UI Execution Monitor | `sequence_executions.currentStep` (MongoDB & SQLite) | `AutomationService` |

---

## 3. Output Ownership Matrix

| Output Artifact | Produced By | Returned To | Cached By | Persisted By | Final Owner Component |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `SequenceExecution` Document | `AutomationService.startExecution()` | `routes/automation.ts` | Desktop SQLite (`sequence_executions`) | Central MongoDB (`sequence_executions` collection) | Central MongoDB Engine |
| `SequenceLog` Document | `AutomationService.logStep()` | `AutomationService` internal caller | Embedded in `SequenceExecution.logs` array | Central MongoDB (`sequence_logs` collection) | Central MongoDB Engine |
| HTTP Response JSON | `routes/automation.ts` (`c.json`) | `HttpClient` (SDK) | Unwrapped by `HttpClient.request` | Temporary Network Buffer | Hono OpenAPI Router |
| SQLite Cache Row | `LocalCRMRepository.save()` | `main/ipc/automation.ts` | Desktop SQLite file | Desktop SQLite database file | Desktop Local SQLite Engine |
| IPC Resolved Object | `main/ipc/automation.ts` handler | `preload/index.ts` -> Renderer Promise | Resolved Promise in Renderer | In-memory JS object | Electron IPC Bridge |
| React Query Cache Entry | `useStartSequence()` mutation trigger | `AutomationScreen.tsx` | TanStack `QueryClient` cache | In-memory React Query Store | TanStack Query Store |

---

## 4. State Ownership Matrix

| State Identifier | State Type | Created By | Mutated By | Read By | Persisted By | Destroyed By |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| UI Prompt Input State | Presentation State | `AutomationScreen.tsx` | User keystrokes | `handleManualTrigger` | None | Function scope exit |
| React Query Mutation State | Client Async State | `useStartSequence()` hook | TanStack Query lifecycle | `AutomationScreen.tsx` | None | Component unmount |
| Active Workspace Context | Environment State | `WorkspaceManager` / `useWorkspace` | Workspace selection UI | Main IPC, SQLite repo, API routes | Desktop Config File | Application shutdown |
| IPC Handler Registration | Infrastructure State | `main/ipc/register.ts` | `safeRegister()` helper | Electron `ipcMain` router | None | Application shutdown |
| Execution Domain State (`"PENDING"`) | Domain State | `AutomationService.startExecution()` | `AutomationService` | Execution table UI, worker (future) | MongoDB & SQLite | Database document deletion |
| Desktop SQLite Cache State | Local Cache State | `LocalCRMRepository.save()` | `LocalCRMRepository` | `LocalCRMRepository.findMany` | Local SQLite file | Database file reset |
| Central MongoDB Database State | Backend State | `exec.save()` in `AutomationService` | `AutomationService` | API router endpoints | MongoDB database disk | Database document deletion |

---

## 5. Lifecycle Ownership Matrix

| Lifecycle Stage | Stage Responsibility | Responsible Component | Triggering Event | Code Location |
| :--- | :--- | :--- | :--- | :--- |
| **1. Initialization** | Capture user trigger & collect input parameters | `AutomationScreen.tsx` | User click on sequence card "Run" button | `AutomationScreen.tsx:L219` |
| **2. Context Injection** | Attach active `workspaceId` to execution request | `use-automation.ts` | Mutation execution trigger | `use-automation.ts:L89` |
| **3. Client Identifier Assignment** | Generate client-side UUID if missing | `sync.ts` | `BaseSyncRepository.create()` execution | `sync.ts:L104` |
| **4. IPC Transport Guard** | Whitelist channel & bridge process boundary | `preload/index.ts` | `window.ipc.invoke('sequence:start')` call | `preload/index.ts:L116` |
| **5. Main Process Context Validation** | Obtain active main process workspace runtime handle | `main/ipc/automation.ts` | `'sequence:start'` IPC handler execution | `automation.ts:L64` |
| **6. SDK Request Packaging** | Format API URL path & inject auth headers | `packages/sdk` | `sdk.executions.start()` execution | `client.ts:L40` |
| **7. API Server Route Reception** | Match endpoint & extract request context `workspaceId` | `routes/automation.ts` | HTTP POST request arrival | `routes/automation.ts:L75` |
| **8. Domain Verification & Creation** | Verify sequence existence, check active duplicate, create execution doc | `automation.service.ts` | `AutomationService.startExecution()` call | `automation.service.ts:L73` |
| **9. Central Database Persistence** | Insert `SequenceExecution` & `SequenceLog` documents | MongoDB Engine | `exec.save()` & `log.save()` calls | `automation.service.ts:L106` |
| **10. Local Desktop Cache Persistence** | Write execution cache row into desktop SQLite database | Desktop SQLite Engine | `LocalCRMRepository.save('sequence_executions', ...)` call | `automation.ts:L67` |
| **11. Client Cache Synchronization** | Invalidate React Query list cache key & render UI toast | TanStack Query Client | IPC Promise resolution in Renderer | `use-automation.ts:L96` |

---

## 6. Ownership Transfer Graph

```mermaid
flowchart TD
    subgraph STAGE_1["1. UI State Ownership"]
        OWNER_1["AutomationScreen.tsx\n(Owns Form Input State)"]
    end

    subgraph STAGE_2["2. Hook Mutation Ownership"]
        OWNER_2["use-automation.ts\n(Owns React Query Mutation State)"]
    end

    subgraph STAGE_3["3. Repository Ownership"]
        OWNER_3["sync.ts\n(Owns Client UUID & Channel Mapping)"]
    end

    subgraph STAGE_4["4. IPC Boundary Ownership"]
        OWNER_4["preload/index.ts\n(Owns Channel Security Guard)"]
    end

    subgraph STAGE_5["5. Main Process Controller Ownership"]
        OWNER_5["main/ipc/automation.ts\n(Owns Workspace Runtime Validation & Dual Dispatch)"]
    end

    subgraph STAGE_6["6. SDK Transport Ownership"]
        OWNER_6["packages/sdk\n(Owns HTTP Headers & Fetch Request Lifecycle)"]
    end

    subgraph STAGE_7["7. API Gateway Ownership"]
        OWNER_7["routes/automation.ts\n(Owns HTTP Endpoint Matching & Workspace Context Extraction)"]
    end

    subgraph STAGE_8["8. Domain Service Ownership"]
        OWNER_8["automation.service.ts\n(Owns Business Rules, Execution State Initialization & MongoDB Saves)"]
    end

    subgraph STAGE_9["9. Database Storage Ownership"]
        OWNER_9[("MongoDB Engine\n(Owns Central Execution State)")]
        OWNER_10[("Desktop SQLite Engine\n(Owns Local Read Cache State)")]
    end

    OWNER_1 -->|Hands off { sequenceId, contactId }| OWNER_2
    OWNER_2 -->|Hands off { sequenceId, contactId, companyId, workspaceId }| OWNER_3
    OWNER_3 -->|Hands off record + 'sequence:start'| OWNER_4
    OWNER_4 -->|Hands off payload via IPC pipe| OWNER_5
    OWNER_5 -->|Hands off sequenceId, contactId, companyId| OWNER_6
    OWNER_6 -->|Hands off HTTP POST JSON Packet over Network| OWNER_7
    OWNER_7 -->|Hands off sequenceId + body| OWNER_8
    OWNER_8 -->|Persists Document| OWNER_9
    OWNER_5 -.->|Persists Cache Row| OWNER_10
```
