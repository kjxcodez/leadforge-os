# Forensic Audit: Task 1.1.3 — Ownership & Responsibility Model Audit

## Executive Summary

This document establishes the formal ownership model for the manual automation execution path in LeadForge OS. Building on the runtime call graph from Task 1.1.1 and the file responsibility analysis from Task 1.1.2, this audit evaluates every architectural layer and core function along the execution path to answer four fundamental questions:
1. **Who owns it?** (Owner component / layer)
2. **What responsibilities does it own?** (Explicit responsibilities & non-responsibilities)
3. **What inputs does it receive?** (Origin, format, validation, input owner)
4. **What outputs does it produce?** (Destination, format, transformation, output owner)

This audit exposes the structural ownership boundaries, ownership transfer handoffs, hidden ownership patterns, and architectural ownership violations in the current implementation.

---

## Scope & Methodology

- **Scope**: Manual sequence execution path triggered via UI (`sequence:start`).
- **Methodology**: Static analysis of current repository source code (`leadforge-os`).
- **Evidence Standard**: Strictly backed by code implementation. No speculation or refactoring proposals.
- **Confidence Scoring**:
  - **HIGH**: Source code verified line-by-line.
  - **MEDIUM**: Indirect path verified via interface/schema.
  - **LOW**: Ambiguous or partial implementation.
  - **NOT VERIFIED**: Unverified behavior.

---

## Layer Ownership Audit

### 1. Renderer UI Layer (`AutomationScreen.tsx`)
- **Purpose**: Render UI sequence cards, trigger manual execution prompt, display execution states.
- **Owner**: Frontend UI Presentation Layer.
- **Responsibilities**: Render sequence list, capture user clicks, invoke prompt dialog for `contactId`, dispatch React Query mutation.
- **Explicit Non-Responsibilities**: Business logic, workspace context retrieval, IPC channel invocation, database caching.
- **Inputs**:
  - `sequences` array (from `useSequences` query).
  - `activeWorkspace` context (from `useWorkspace` hook).
  - User click event & user text input (`contactId` prompt).
- **Outputs**:
  - Object payload `{ sequenceId: string, contactId: string | null, companyId: null }` passed to `startSequenceMutation.mutate()`.
- **Confidence**: HIGH.

### 2. Renderer Hook Layer (`use-automation.ts`)
- **Purpose**: Encapsulate React Query mutation lifecycle (`useStartSequence`) for starting sequences.
- **Owner**: Frontend Custom Hooks Layer.
- **Responsibilities**: Retrieve active `workspaceId`, combine mutation parameters, trigger repository `create()`, handle query invalidation & toasts.
- **Explicit Non-Responsibilities**: Repository selection, IPC channel mapping, database operations.
- **Inputs**: `{ sequenceId: string, contactId?: string | null, companyId?: string | null }` from UI caller.
- **Outputs**: Output payload from `SyncSequenceExecutionRepository.create()` passed back to mutation promise.
- **Confidence**: HIGH.

### 3. Renderer Repository Layer (`sync.ts`)
- **Purpose**: Map entity repository operations to desktop IPC channels.
- **Owner**: Client Sync Repository Layer.
- **Responsibilities**: Map table `sequence_executions` to channel `'sequence:start'` in `DOMAIN_CHANNELS`, generate client-side UUID if missing (`crypto.randomUUID()`), invoke `window.ipc.invoke()`.
- **Explicit Non-Responsibilities**: Main process IPC execution, remote HTTP requests, SQLite storage.
- **Inputs**: `data` object `{ sequenceId, contactId, companyId, workspaceId }`.
- **Outputs**: `record` object `{ ...data, id: string }` passed to `window.ipc.invoke('sequence:start', record)`.
- **Confidence**: HIGH.

### 4. IPC Preload Bridge Layer (`preload/index.ts`)
- **Purpose**: Provide context-isolated IPC bridge between Renderer and Main process.
- **Owner**: Electron Security & Infrastructure Layer.
- **Responsibilities**: Whitelist channel names (`validChannels`), forward calls via `ipcRenderer.invoke()`.
- **Explicit Non-Responsibilities**: Business rules, payload validation, main process execution.
- **Inputs**: `channel: string` (`'sequence:start'`), `payload: object`.
- **Outputs**: Calls `ipcRenderer.invoke(channel, payload)` returning a Promise.
- **Confidence**: HIGH.

### 5. Electron Main Process IPC Controller Layer (`main/ipc/automation.ts`)
- **Purpose**: Handle IPC invocation `'sequence:start'` in the Node.js Main process.
- **Owner**: Desktop Main Application Controller.
- **Responsibilities**: Retrieve active workspace runtime via `WorkspaceManager`, call `sdk.executions.start()`, cache returned execution in SQLite via `LocalCRMRepository.save()`.
- **Explicit Non-Responsibilities**: Desktop job scheduling (bypassed), API route handling, MongoDB persistence.
- **Inputs**: IPC Event, `{ sequenceId: string, contactId: string | null, companyId: string | null }`.
- **Outputs**: `res` (SequenceExecution object returned from SDK and sent across IPC to Renderer).
- **Confidence**: HIGH.

### 6. Desktop Main Process Workspace Runtime Layer (`workspace-manager.ts`)
- **Purpose**: Singleton provider for active workspace runtime state and SQLite database connection handles.
- **Owner**: Desktop Context Provider Layer.
- **Responsibilities**: Expose `WorkspaceManager.getActiveRuntime()` method returning `workspaceId` and active database handle.
- **Explicit Non-Responsibilities**: Network calls, IPC routing.
- **Inputs**: None on getter.
- **Outputs**: Active `WorkspaceRuntime` object or `null`.
- **Confidence**: HIGH.

### 7. Shared SDK Client & Module Layer (`packages/sdk`)
- **Purpose**: Provide strongly-typed TypeScript methods wrapping REST API endpoints.
- **Owner**: Client SDK Library Layer.
- **Responsibilities**: Format endpoint route `/automation/executions/start`, encapsulate parameters, invoke `HttpClient.post()`.
- **Explicit Non-Responsibilities**: Main process IPC handling, local caching, backend database storage.
- **Inputs**: `sequenceId: string`, `contactId?: string | null`, `companyId?: string | null`.
- **Outputs**: `SequenceExecution` object parsed from HTTP JSON response.
- **Confidence**: HIGH.

### 8. Shared SDK HTTP Transport Layer (`packages/sdk/src/http/client.ts`)
- **Purpose**: Low-level network transport executing native `fetch()` calls.
- **Owner**: SDK Transport Layer.
- **Responsibilities**: Inject `Authorization: Bearer <token>` and `Content-Type: application/json` headers, serialize body via `JSON.stringify`, execute `fetch()`, handle error codes, parse `ApiResponse<T>`.
- **Explicit Non-Responsibilities**: Endpoint mapping, UI state, database persistence.
- **Inputs**: `method: 'POST'`, `path: '/automation/executions/start'`, `body: object`.
- **Outputs**: Parsed `payload.data` object.
- **Confidence**: HIGH.

### 9. API Server Router Layer (`routes/automation.ts`)
- **Purpose**: OpenAPI Hono HTTP router endpoints on API backend.
- **Owner**: Backend HTTP Gateway Layer.
- **Responsibilities**: Route matching (`POST /executions/start`), extract `workspaceId` from context (`getWorkspaceId(c)`), parse body (`c.req.json()`), call `AutomationService.startExecution()`, format JSON response via `successResponse()`.
- **Explicit Non-Responsibilities**: Business validation rules, MongoDB queries.
- **Inputs**: Hono context `c` (containing HTTP Request & context variables).
- **Outputs**: JSON HTTP response `{ success: true, data: exec, error: null }`.
- **Confidence**: HIGH.

### 10. API Server Domain Service Layer (`automation.service.ts`)
- **Purpose**: Backend business logic service for sequences and executions.
- **Owner**: Backend Application Domain Layer.
- **Responsibilities**: Sequence existence verification, duplicate active execution check, `SequenceExecutionModel` document initialization (`status: "PENDING"`, `currentStep: 0`), execution saving, logging step to `SequenceLogModel`, pushing log to execution document.
- **Explicit Non-Responsibilities**: Desktop local SQLite caching, local job scheduling, HTTP route definitions.
- **Inputs**: `sequenceId: string`, `payload: { contactId?: string, companyId?: string }`.
- **Outputs**: Saved Mongoose `SequenceExecutionDocument`.
- **Confidence**: HIGH.

### 11. MongoDB Data Models Layer (`sequence-execution.model.ts`, `sequence-log.model.ts`)
- **Purpose**: Mongoose schemas and model definitions for MongoDB collections.
- **Owner**: Central Database Model Layer.
- **Responsibilities**: Define field layouts, indexes (`{ workspaceId: 1, status: 1, nextExecutionAt: 1 }`), status enum constraints, workspace scoping plugin attachment.
- **Explicit Non-Responsibilities**: Service orchestration, HTTP transport.
- **Inputs**: Document creation object / query filter object.
- **Outputs**: BSON database records stored in MongoDB.
- **Confidence**: HIGH.

### 12. Desktop SQLite Repository Layer (`local-crm.ts`)
- **Purpose**: Execute SQLite CRUD operations on local workspace database file.
- **Owner**: Desktop Local Storage Layer.
- **Responsibilities**: Prepared statement compilation, table column checking, executing `INSERT OR REPLACE INTO sequence_executions`.
- **Explicit Non-Responsibilities**: Remote network sync queue, business validation.
- **Inputs**: `tableName: 'sequence_executions'`, `record: object`, `skipQueue: boolean`.
- **Outputs**: Disk database write to SQLite file.
- **Confidence**: HIGH.

---

## Function Ownership Audit

| Function Name | Source File | Owner Component | Responsibilities | Inputs | Outputs / Return Value | State Modified | Persistence Performed | Confidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `handleManualTrigger` | `AutomationScreen.tsx:L219` | Renderer UI | Prompt user for `contactId`, trigger start mutation | `seqId: string` | `void` | Prompt UI state | None | HIGH |
| `useStartSequence` | `use-automation.ts:L74` | Renderer Hook | Attach `workspaceId`, invoke repository create, invalidate cache | `{ sequenceId, contactId, companyId }` | `UseMutationResult` | React Query cache state | None | HIGH |
| `BaseSyncRepository.create` | `sync.ts:L100` | Renderer Repo | Map entity to IPC channel `'sequence:start'`, assign UUID | `data: T & { workspaceId }` | `Promise<T>` | None | None (Delegates to IPC) | HIGH |
| `window.ipc.invoke` | `preload/index.ts:L67` | Preload Bridge | Check channel whitelist, forward to `ipcRenderer.invoke` | `channel: string`, `payload: any` | `Promise<any>` | None | None | HIGH |
| `'sequence:start' IPC Handler` | `automation.ts:L63` | Main IPC | Fetch active runtime, call SDK start execution, save to local SQLite | `_event`, `{ sequenceId, contactId, companyId }` | `Promise<SequenceExecution>` | None | Desktop SQLite (`sequence_executions`) | HIGH |
| `WorkspaceManager.getActiveRuntime` | `workspace-manager.ts` | Main Context | Provide active workspace runtime singleton | None | `WorkspaceRuntime \| null` | None | None | HIGH |
| `sdk.executions.start` | `sdk/modules/automation.ts:L45` | SDK Module | Construct request payload, invoke HTTP client POST | `sequenceId`, `contactId`, `companyId` | `Promise<SequenceExecution>` | None | None | HIGH |
| `HttpClient.post` / `request` | `sdk/http/client.ts:L34` | SDK Transport | Inject headers, stringify JSON, execute `fetch()`, parse ApiResponse | `method`, `path`, `body` | `Promise<T>` | Retry count state | None (HTTP Network I/O) | HIGH |
| `POST /executions/start Route` | `routes/automation.ts:L74` | API Router | Extract `workspaceId`, parse request JSON, call service | Hono Context `c` | `c.json(successResponse(exec))` | None | None | HIGH |
| `getWorkspaceId` | `routes/automation.ts:L9` | API Router | Validate presence of `workspaceId` in Hono context | Context `c` | `string` (workspace ID) | None | None | HIGH |
| `AutomationService.startExecution` | `automation.service.ts:L73` | API Service | Validate sequence, check active duplicate, instantiate & save execution, log step | `sequenceId`, `payload` | `Promise<SequenceExecutionDocument>` | Execution state ("PENDING") | Central MongoDB (`sequence_executions` & `sequence_logs`) | HIGH |
| `AutomationService.logStep` | `automation.service.ts:L138` | API Service | Create `SequenceLogModel` doc, push log into `SequenceExecution.logs` array | `executionId`, `step`, `action`, `status`, `message` | `Promise<void>` | None | Central MongoDB (`sequence_logs` & `sequence_executions.logs`) | HIGH |
| `LocalCRMRepository.save` | `local-crm.ts:L54` | SQLite Repo | Validate `workspaceId`, compile prepared SQL statement, execute run | `tableName`, `record`, `skipQueue` | `Promise<any>` | None | Desktop SQLite file write | HIGH |

---

## Responsibility Transfers & Ownership Handoffs

```mermaid
flowchart TD
    subgraph HANDOFF_1["Handoff 1: UI to Hook"]
        UI_OWNER["AutomationScreen.tsx\n(Owns UI Click & User Prompt)"] -->|Passes { sequenceId, contactId }| HOOK_OWNER["use-automation.ts\n(Owns Mutation Lifecycle & Workspace Injection)"]
    end

    subgraph HANDOFF_2["Handoff 2: Hook to Repository"]
        HOOK_OWNER -->|Passes { sequenceId, contactId, companyId, workspaceId }| REPO_OWNER["sync.ts\n(Owns IPC Channel Mapping & UUID Assignment)"]
    end

    subgraph HANDOFF_3["Handoff 3: Repository to IPC Boundary"]
        REPO_OWNER -->|Passes 'sequence:start' + record| PRELOAD_OWNER["preload/index.ts\n(Owns Channel Security Whitelisting)"]
    end

    subgraph HANDOFF_4["Handoff 4: IPC Bridge to Main Controller"]
        PRELOAD_OWNER -->|Passes IPC Event + payload| MAIN_OWNER["main/ipc/automation.ts\n(Owns Main Process Context & Dual Dispatch)"]
    end

    subgraph HANDOFF_5["Handoff 5: Main Controller to SDK Transport"]
        MAIN_OWNER -->|Passes sequenceId, contactId, companyId| SDK_OWNER["packages/sdk\n(Owns HTTP Endpoint Formatting & Header Injection)"]
    end

    subgraph HANDOFF_6["Handoff 6: SDK Transport to API Server"]
        SDK_OWNER -->|Passes HTTP POST JSON Payload over Network| API_OWNER["apps/api/routes/automation.ts\n(Owns Request Unwrapping & Workspace Context Check)"]
    end

    subgraph HANDOFF_7["Handoff 7: API Gateway to Domain Service"]
        API_OWNER -->|Passes sequenceId + body| SVC_OWNER["apps/api/services/automation.service.ts\n(Owns Execution Business Rules & MongoDB Persistence)"]
    end

    subgraph HANDOFF_8["Handoff 8: Domain Service to MongoDB Engine"]
        SVC_OWNER -->|Passes Mongoose Document instance| MONGO_OWNER["MongoDB Database Engine\n(Owns Central Persistent Data)"]
    end

    subgraph HANDOFF_9["Handoff 9: Main Controller to SQLite Engine"]
        MAIN_OWNER -.->|Passes execution payload| SQLITE_OWNER["Desktop SQLite Engine\n(Owns Local Read Cache Data)"]
    end
```

---

## Hidden Ownership Patterns

1. **Client-Side Identifier Ownership**: `BaseSyncRepository.create` in `sync.ts` L104 automatically generates client-side UUIDs (`crypto.randomUUID()`) for entities before dispatching across IPC.
2. **Dual Log Persistence Ownership**: `AutomationService.logStep` in `automation.service.ts` L145-L167 owns dual writes: it saves a standalone log document to `sequence_logs` AND pushes the same log object into `SequenceExecution.logs` array via `findByIdAndUpdate`.
3. **SQLite Local Cache Bypass Ownership**: `main/ipc/automation.ts` L67 directly owns local SQLite write operations via `LocalCRMRepository.save('sequence_executions', ..., true)` with `skipQueue = true`, performing inline disk writes directly within the IPC handler.

---

## Architectural Ownership Observations

1. **IPC Handler Boundary Overreach**: `main/ipc/automation.ts` L63-L69 acts as an IPC controller but owns local SQLite disk persistence directly.
2. **Complete Local Scheduler Bypass**: The desktop local job scheduler (`JobScheduler`) owns no part of the manual execution path. Execution state creation is owned entirely by the remote API server and MongoDB.
3. **Unvalidated Prompt Input**: User string input from browser `prompt()` in `AutomationScreen.tsx` L220 is passed unvalidated into `startSequenceMutation.mutate()`.

---

## Confidence Assessment

| Component / Layer | Ownership Audit Status | Source Code Evidence | Confidence Level |
| :--- | :--- | :--- | :--- |
| **Renderer UI Layer** | Verified | `AutomationScreen.tsx:L219-L222` | **HIGH** |
| **Renderer Hook Layer** | Verified | `use-automation.ts:L74-L104` | **HIGH** |
| **Renderer Repository Layer** | Verified | `sync.ts:L46-L52, L100-L109` | **HIGH** |
| **IPC Preload Bridge** | Verified | `preload/index.ts:L97, L116-L118` | **HIGH** |
| **Main Process IPC Handler** | Verified | `automation.ts:L63-L69` | **HIGH** |
| **Workspace Runtime Provider** | Verified | `workspace-manager.ts` | **HIGH** |
| **SDK Transport Layer** | Verified | `sdk/modules/automation.ts`, `sdk/http/client.ts` | **HIGH** |
| **API Server Router** | Verified | `routes/automation.ts:L74-L80` | **HIGH** |
| **API Service Layer** | Verified | `automation.service.ts:L73-L111` | **HIGH** |
| **MongoDB Model Layer** | Verified | `sequence-execution.model.ts`, `sequence-log.model.ts` | **HIGH** |
| **Desktop SQLite Repository**| Verified | `local-crm.ts:L54-L60` | **HIGH** |

**Overall Audit Confidence Level**: **HIGH**
