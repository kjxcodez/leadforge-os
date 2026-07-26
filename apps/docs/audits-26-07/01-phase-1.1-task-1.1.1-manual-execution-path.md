# Forensic Audit: Task 1.1.1 — Complete Manual Execution Path

## Executive Summary

This forensic audit documents the end-to-end execution path for manually-triggered automation sequences in LeadForge OS. Tracing directly from the user interface trigger down to database persistence, this audit establishes the exact runtime call sequence, ownership boundaries, data transformations, and persistence targets of the current implementation.

The primary finding of this audit is that **manual execution triggers currently bypass the desktop local job scheduler entirely**. When a user triggers an automation manually (e.g., clicking "Run" on a sequence card), the request flows from the React Renderer component via IPC (`sequence:start`) to the Electron Main process, which directly delegates execution to the remote API server over HTTP via `@leadforge/sdk`. The API server creates a `sequence_execution` record in **MongoDB** with status `PENDING` and writes an initial trigger log to `sequence_logs` in MongoDB. The API returns the execution payload back to the Electron Main process, which caches a snapshot in local SQLite (`sequence_executions` table) and returns it to the UI. At no point during a manual trigger is a job created in the desktop local SQLite `jobs` table or registered with the local `JobScheduler`.

---

## Scope

This audit traces **only** the manual execution path initiated by explicit user interaction in the desktop application renderer.

- **Starting Point**: Renderer UI trigger (`AutomationScreen.tsx` -> "Run" button)
- **Ending Point**: MongoDB persistence (`sequence_executions` and `sequence_logs` collections)
- **Out of Scope**:
  - Background Job Scheduler (`JobScheduler`, `JobWorker`)
  - Event-driven triggers (`CONTACT_CREATED`, `TAG_ADDED`, etc.)
  - Cron / recurring interval execution
  - STEP / WAIT execution loops
  - Failure recovery & retry handlers

---

## Methodology

This audit was conducted strictly through static code analysis of the current LeadForge OS repository state (`leadforge-os`). All statements, graphs, data flow mappings, and ownership evaluations in this document are derived directly from source code implementation evidence. 

Confidence scores are assigned per layer based on verifiable source code evidence:
- **HIGH**: Complete source code trace confirmed from call site to implementation.
- **MEDIUM**: Indirect path confirmed via abstraction, schema interface, or dynamic dispatch.
- **LOW**: Incomplete call chain or unverified runtime behavior.
- **NOT VERIFIED**: Code absent, unverified, or ambiguous.

---

## Runtime Call Graph

The exact order of runtime function calls for manual automation execution is as follows:

```
[Renderer] AutomationScreen.handleManualTrigger(seqId)
  ↓
[Renderer] useStartSequence().mutate({ sequenceId, contactId, companyId })
  ↓
[Renderer] SyncSequenceExecutionRepository.create({ sequenceId, contactId, companyId, workspaceId })
  ↓
[Renderer] BaseSyncRepository.create() -> DOMAIN_CHANNELS['sequence_executions'].create ('sequence:start')
  ↓
[Renderer] window.ipc.invoke('sequence:start', record)
  ↓
[Preload] contextBridge IPC handler -> ipcRenderer.invoke('sequence:start', payload)
  ↓
[Electron Main] safeRegister('sequence:start', async (_event, { sequenceId, contactId, companyId }))
  ↓
[Electron Main] WorkspaceManager.getActiveRuntime()
  ↓
[SDK Client] sdk.executions.start(sequenceId, contactId, companyId)
  ↓
[SDK Module] ExecutionsModule.start(sequenceId, contactId, companyId)
  ↓
[SDK HTTP] HttpClient.post('/automation/executions/start', { sequenceId, contactId, companyId })
  ↓
[HTTP Network Request] POST /automation/executions/start (Headers: Content-Type, Authorization: Bearer <token>)
  ↓
[API Route] automationRouter.post('/executions/start', async (c) => ...)
  ↓
[API Route] getWorkspaceId(c)
  ↓
[API Service] AutomationService.startExecution(sequenceId, payload)
  ↓
[API Model] SequenceModel.findOne({ _id: sequenceId, workspaceId })
  ↓
[API Model] SequenceExecutionModel.findOne({ workspaceId, sequenceId, status: { $in: [...] }, contactId, companyId })
  ↓
[API Model] new SequenceExecutionModel({ _id, sequenceId, workspaceId, contactId, companyId, status: "PENDING", ... })
  ↓
[MongoDB Persistence] exec.save() -> writes to 'sequence_executions' MongoDB collection
  ↓
[API Service] AutomationService.logStep(executionId, 0, "TRIGGER", "SUCCESS", "Sequence manually triggered.")
  ↓
[MongoDB Persistence] new SequenceLogModel(...).save() -> writes to 'sequence_logs' MongoDB collection
  ↓
[MongoDB Persistence] SequenceExecutionModel.findByIdAndUpdate(executionId, { $push: { logs: ... } })
  ↓
[API Return] Returns Mongoose document -> c.json(successResponse(exec))
  ↓
[SDK Return] HttpClient parses ApiResponse -> returns SequenceExecution object
  ↓
[Electron Main] LocalCRMRepository.save('sequence_executions', { ...res, workspaceId: runtime.workspaceId }, true)
  ↓
[Desktop SQLite Cache] SQLite inserts/updates record in local 'sequence_executions' table
  ↓
[Renderer Return] IPC resolves promise -> useMutation onSuccess invalidates ['sequence_executions', 'list', workspaceId]
```

---

## Forward Dependency Graph

```
AutomationScreen.tsx [Renderer UI]
  └─► use-automation.ts [React Query Hook]
       └─► sync.ts [BaseSyncRepository]
            └─► preload/index.ts [Electron Preload Bridge]
                 └─► main/ipc/automation.ts [Main Process IPC Handler]
                      ├─► workspace-manager.ts [Runtime Context]
                      ├─► packages/sdk/src/modules/automation.ts [SDK ExecutionsModule]
                      │    └─► packages/sdk/src/http/client.ts [SDK HttpClient]
                      │         └─► HTTP POST /automation/executions/start
                      │              └─► apps/api/src/routes/automation.ts [Hono Router]
                      │                   └─► apps/api/src/services/automation/automation.service.ts [Domain Service]
                      │                        ├─► sequence.model.ts [Mongoose Sequence Model]
                      │                        ├─► sequence-execution.model.ts [Mongoose Execution Model]
                      │                        └─► sequence-log.model.ts [Mongoose Log Model]
                      │                             └─► MongoDB Database
                      └─► local-crm.ts [Main Process Local Cache Repository]
                           └─► SQLite Database (sequence_executions table)
```

---

## Reverse Dependency Graph

```
MongoDB Database (sequence_executions & sequence_logs collections)
  ▲
  │ (Mongoose Documents)
sequence-execution.model.ts / sequence-log.model.ts
  ▲
  │ (exec.save() / logStep())
automation.service.ts (AutomationService.startExecution)
  ▲
  │ (service.startExecution())
routes/automation.ts (automationRouter.post('/executions/start'))
  ▲
  │ (HTTP POST Request / Response)
sdk/http/client.ts (HttpClient.post)
  ▲
  │ (this.client.post('/automation/executions/start'))
sdk/modules/automation.ts (ExecutionsModule.start)
  ▲
  │ (sdk.executions.start())
main/ipc/automation.ts (IPC Handler 'sequence:start')
  ▲
  │ (ipcRenderer.invoke('sequence:start'))
preload/index.ts (window.ipc.invoke)
  ▲
  │ (BaseSyncRepository.create())
sync.ts (SyncSequenceExecutionRepository)
  ▲
  │ (useStartSequence().mutate())
use-automation.ts (useStartSequence hook)
  ▲
  │ (handleManualTrigger)
AutomationScreen.tsx (Sales Automation Screen UI)
```

---

## Data Flow

### 1. Request Payload Construction (Renderer)
- **Origin**: `AutomationScreen.tsx` L219 (`handleManualTrigger`)
- **Initial Data**: `{ sequenceId: string, contactId: string | null, companyId: null }`
- **Hook Transformation**: `use-automation.ts` L89 (`useStartSequence`) injects `workspaceId` from active context (`useWorkspace()`).
- **Repository Transformation**: `sync.ts` L104 (`BaseSyncRepository.create`) attaches client-generated `id = crypto.randomUUID()` if missing.
- **Payload at IPC Boundary**:
  ```json
  {
    "id": "c7b3a981-...",
    "sequenceId": "seq_123",
    "contactId": "cnt_456",
    "companyId": null,
    "workspaceId": "ws_789"
  }
  ```

### 2. Desktop Main Process Payload Handling
- **IPC Handler**: `main/ipc/automation.ts` L63 (`safeRegister('sequence:start')`)
- **Destructuring**: Handler extracts `{ sequenceId, contactId, companyId }`.
- **SDK Invocation**: Calls `sdk.executions.start(sequenceId, contactId, companyId)`. `workspaceId` is attached via the SDK client instance header/token configuration.

### 3. Network Transport (SDK to API)
- **Serialization**: `packages/sdk/src/http/client.ts` L49 executes `JSON.stringify({ sequenceId, contactId, companyId })`.
- **HTTP Request**: `POST /automation/executions/start`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <token>`

### 4. API Request Processing & Scoping
- **Context Extraction**: `apps/api/src/routes/automation.ts` L75 extracts `workspaceId` from request context (`getWorkspaceId(c)`).
- **Body Parsing**: `c.req.json()` deserializes `{ sequenceId, contactId, companyId }`.
- **Service Layer**: `AutomationService.startExecution(sequenceId, payload)` validates sequence existence and checks duplicate running executions.

### 5. MongoDB Persistence Object Construction
- **Document Creation**: `AutomationService.startExecution` instantiates `SequenceExecutionModel`:
  ```typescript
  {
    _id: payload.id || payload._id || undefined,
    sequenceId: "seq_123",
    workspaceId: "ws_789",
    contactId: "cnt_456" || null,
    companyId: null,
    status: "PENDING",
    currentStep: 0,
    startedAt: new Date(),
    logs: []
  }
  ```
- **MongoDB Collection Target**: `sequence_executions`
- **Initial Log Creation**: `AutomationService.logStep` inserts initial log into `sequence_logs` collection and pushes entry into `exec.logs` array in `sequence_executions`.

### 6. Response & Local SQLite Caching
- **API Response**: `successResponse(exec)` wraps Mongoose document into `{ success: true, data: { ...exec } }`.
- **SDK Return**: `HttpClient.request` unwraps `payload.data` and returns `SequenceExecution` to IPC handler.
- **SQLite Local Write**: `main/ipc/automation.ts` L67 executes `LocalCRMRepository.save('sequence_executions', { ...res, workspaceId }, true)`.
- **Cache Persistence Target**: Local SQLite database file associated with workspace (`sequence_executions` table).

---

## Ownership Analysis

### 1. Renderer Layer (`AutomationScreen.tsx`, `use-automation.ts`, `sync.ts`)
- **Owner**: Desktop Frontend / Renderer
- **Why it exists**: Renders sequence cards, collects manual execution parameters (e.g. contact ID), triggers mutations, and displays execution status.
- **What it owns**: UI state, form inputs, React Query mutation lifecycles, user feedback toasts.
- **What it does NOT own**: Orchestration logic, sequence state transitions, database writes, IPC channel handling.

### 2. Preload & IPC Boundary (`preload/index.ts`, `packages/schema/src/ipc`)
- **Owner**: Electron IPC Infrastructure
- **Why it exists**: Provides a secure context bridge between isolated Renderer renderer process and Node.js Main process.
- **What it owns**: IPC channel whitelisting (`validChannels`), TypeScript request/response contracts (`IpcChannelMap`).
- **What it does NOT own**: Business logic, API calls, persistent storage.

### 3. Electron Main Process IPC Controller (`main/ipc/automation.ts`, `workspace-manager.ts`)
- **Owner**: Electron Main Application Layer
- **Why it exists**: Handles IPC invocations from Renderer, manages active workspace runtime contexts, coordinates SDK calls, and writes local cache entries.
- **What it owns**: Workspace context validation (`WorkspaceManager`), IPC channel registration (`sequence:start`), invoking remote SDK, writing SQLite cache via `LocalCRMRepository`.
- **What it does NOT own**: Sequence step execution logic, job scheduling (currently bypassed), remote API business logic.

### 4. SDK Layer (`packages/sdk`)
- **Owner**: Shared Client Library / SDK
- **Why it exists**: Encapsulates REST API HTTP communication into strongly typed TypeScript methods.
- **What it owns**: HTTP client configuration, URL formatting, header injection (`Authorization`), request/response JSON serialization, retry backoff logic.
- **What it does NOT own**: UI state, database persistence, main process local caching.

### 5. API Layer (`apps/api/src/routes/automation.ts`, `AutomationService.ts`)
- **Owner**: Backend Service Layer
- **Why it exists**: Handles remote HTTP endpoints, enforces backend security/workspace access control, executes domain validation, and manages MongoDB operations.
- **What it owns**: Endpoint routing, workspace isolation verification, execution duplicate prevention, MongoDB document creation & updates, log generation.
- **What it does NOT own**: Desktop client local SQLite caching, UI rendering.

### 6. MongoDB Persistence Layer (`sequence.model.ts`, `sequence-execution.model.ts`, `sequence-log.model.ts`)
- **Owner**: Central Database (MongoDB)
- **Why it exists**: Multi-tenant persistent store for cloud-synced sequence templates, execution state, and historical logs.
- **What it owns**: Document schemas, default value generation, workspace indexing, data persistence.
- **What it does NOT own**: Application logic, transport protocol, local client state.

---

## Runtime Ownership Matrix

| Layer | Owner | Input | Output | Primary Dependencies | Source Code Evidence | Confidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Renderer UI** | Frontend UI | User click on "Run" button (`seqId`, prompt `contactId`) | Mutation trigger object | `useStartSequence`, TanStack Query | `AutomationScreen.tsx:L219-L222` | HIGH |
| **Renderer Hook** | Frontend Hook | `{ sequenceId, contactId, companyId }` | `SyncSequenceExecutionRepository.create()` Promise | `useWorkspace`, `SyncSequenceExecutionRepository` | `use-automation.ts:L74-L104` | HIGH |
| **Renderer Repo** | Frontend Repository | Execution record object | `window.ipc.invoke('sequence:start', record)` | `DOMAIN_CHANNELS`, `window.ipc` | `sync.ts:L46-L52`, `sync.ts:L100-L109` | HIGH |
| **Preload Bridge** | IPC Infrastructure | Channel string (`'sequence:start'`), payload | `ipcRenderer.invoke()` Promise | Electron `contextBridge`, `ipcRenderer` | `preload/index.ts:L97`, `preload/index.ts:L116-L118` | HIGH |
| **Main Process IPC** | Electron Main Process | IPC event, `{ sequenceId, contactId, companyId }` | Execution object returned from SDK | `WorkspaceManager`, `SdkClient`, `LocalCRMRepository` | `main/ipc/automation.ts:L63-L69` | HIGH |
| **SDK Module** | SDK Client Library | `sequenceId`, `contactId`, `companyId` | `HttpClient.post()` Promise | `HttpClient` | `packages/sdk/src/modules/automation.ts:L45-L51` | HIGH |
| **SDK Transport** | SDK HTTP Transport | Path (`'/automation/executions/start'`), JSON body | Parsed `ApiResponse<SequenceExecution>` data | native `fetch()`, `JSON.stringify` | `packages/sdk/src/http/client.ts:L40-L71` | HIGH |
| **API Route** | API Server Router | Hono Context (`c`), HTTP Request Body | JSON HTTP Response (`successResponse`) | `OpenAPIHono`, `AutomationService` | `apps/api/src/routes/automation.ts:L74-L80` | HIGH |
| **API Service** | API Domain Service | `sequenceId`, `{ contactId, companyId }` | Mongoose `SequenceExecutionDocument` | `SequenceModel`, `SequenceExecutionModel`, `SequenceLogModel` | `automation.service.ts:L73-L111` | HIGH |
| **MongoDB Model** | MongoDB Engine | Mongoose document instance | Persisted MongoDB Document (`_id`, timestamps) | `mongoose`, `workspacePlugin` | `sequence-execution.model.ts:L19-L82`, `sequence-log.model.ts:L15-L56` | HIGH |

---

## File Inventory

The complete inventory of files participating in the manual execution path:

1. [`apps/desktop/src/renderer/screens/AutomationScreen.tsx`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/screens/AutomationScreen.tsx)
2. [`apps/desktop/src/renderer/hooks/use-automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/hooks/use-automation.ts)
3. [`apps/desktop/src/renderer/repositories/sync.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/sync.ts)
4. [`apps/desktop/src/preload/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/preload/index.ts)
5. [`packages/schema/src/ipc/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/schema/src/ipc/index.ts)
6. [`apps/desktop/src/main/ipc/register.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/register.ts)
7. [`apps/desktop/src/main/ipc/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/automation.ts)
8. [`apps/desktop/src/main/lib/workspace-manager.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/lib/workspace-manager.ts)
9. [`apps/desktop/src/main/database/repositories/local-crm.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/repositories/local-crm.ts)
10. [`packages/sdk/src/client/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/client/index.ts)
11. [`packages/sdk/src/modules/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/automation.ts)
12. [`packages/sdk/src/http/client.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/http/client.ts)
13. [`apps/api/src/routes/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/automation.ts)
14. [`apps/api/src/services/automation/automation.service.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/services/automation/automation.service.ts)
15. [`apps/api/src/db/models/sequence.model.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/db/models/sequence.model.ts)
16. [`apps/api/src/db/models/sequence-execution.model.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/db/models/sequence-execution.model.ts)
17. [`apps/api/src/db/models/sequence-log.model.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/db/models/sequence-log.model.ts)
18. [`apps/api/src/db/plugins/workspace.plugin.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/db/plugins/workspace.plugin.ts)

---

## Evidence Register

| ID | Location | Evidence / Source Code | Findings / Reasoning | Confidence |
| :--- | :--- | :--- | :--- | :--- |
| **EV-001** | `AutomationScreen.tsx:L219-L222` | `const handleManualTrigger = (seqId: string) => { const contactId = prompt(...) || ''; startSequenceMutation.mutate({ sequenceId: seqId, contactId, companyId: null }); };` | Manual trigger is initiated from UI button click in `AutomationScreen.tsx`. | HIGH |
| **EV-002** | `use-automation.ts:L74-L95` | `export function useStartSequence() { ... return useMutation({ mutationFn: async ({ sequenceId, contactId, companyId }) => SyncSequenceExecutionRepository.create({ sequenceId, contactId, companyId, workspaceId }) }); }` | React Query mutation delegates create operation to `SyncSequenceExecutionRepository`. | HIGH |
| **EV-003** | `sync.ts:L46-L52, L100-L108` | `sequence_executions: { ... create: 'sequence:start' }; ... async create(data) { ... return window.ipc.invoke(channels.create as any, record); }` | `BaseSyncRepository` maps `sequence_executions` creation to IPC channel `'sequence:start'`. | HIGH |
| **EV-004** | `preload/index.ts:L97, L116-L118` | `'sequence:start', ... if (validChannels.includes(channel)) return ipcRenderer.invoke(channel, payload);` | Preload script validates `'sequence:start'` against channel whitelist and passes call to Electron main process. | HIGH |
| **EV-005** | `main/ipc/automation.ts:L63-L69` | `safeRegister('sequence:start', async (_event, { sequenceId, contactId, companyId }) => { const runtime = WorkspaceManager.getActiveRuntime(); ... const res = await sdk.executions.start(sequenceId, contactId, companyId); await LocalCRMRepository.save('sequence_executions', { ...res, workspaceId: runtime.workspaceId }, true); return res; });` | Main process IPC handler calls `sdk.executions.start()` directly over HTTP to remote API, completely bypassing desktop local `JobScheduler`. | HIGH |
| **EV-006** | `sdk/modules/automation.ts:L45-L51` | `public async start(sequenceId: string, contactId?: string | null, companyId?: string | null): Promise<SequenceExecution> { return this.client.post<SequenceExecution>('/automation/executions/start', { sequenceId, contactId, companyId }); }` | SDK Executions module posts payload to remote API HTTP endpoint `/automation/executions/start`. | HIGH |
| **EV-007** | `sdk/http/client.ts:L40-L71` | `const response = await fetch(url, requestOptions); const payload = (await response.json()) as ApiResponse<T>; return payload.data;` | SDK HTTP client executes native `fetch()` POST request and deserializes JSON response. | HIGH |
| **EV-008** | `routes/automation.ts:L74-L80` | `automationRouter.post("/executions/start", async (c) => { const wsId = getWorkspaceId(c); const body = await c.req.json(); const service = new AutomationService(wsId); const exec = await service.startExecution(body.sequenceId, body); return c.json(successResponse(exec)); });` | API route receives HTTP POST request, validates workspace ID, and invokes `AutomationService.startExecution()`. | HIGH |
| **EV-009** | `automation.service.ts:L73-L111` | `public async startExecution(...) { const seq = await SequenceModel.findOne(...); const exec = new SequenceExecutionModel({ ... status: ExecutionStatus.PENDING, currentStep: 0, ... }); await exec.save(); await this.logStep(exec._id.toString(), 0, "TRIGGER", "SUCCESS", "Sequence manually triggered."); return exec; }` | `AutomationService` verifies sequence, creates new `SequenceExecutionModel` document with status `PENDING`, saves to MongoDB, logs trigger step to `sequence_logs` in MongoDB, and returns document. | HIGH |
| **EV-010** | `sequence-execution.model.ts:L19-L82` | `const sequenceExecutionSchema = new Schema<SequenceExecutionDocument>({ _id: { type: String, ... }, sequenceId: { type: String, required: true }, status: { type: String, enum: ["PENDING", "RUNNING", "WAITING", "COMPLETED", "FAILED", "CANCELLED"] }, ... });` | Mongoose schema defines structural layout and indexes for `sequence_executions` MongoDB collection. | HIGH |

---

## Findings

1. **Complete Remote Execution Routing**: Manual triggers originating in the UI do not enqueue jobs in the desktop SQLite database or local job scheduler (`JobScheduler`). The IPC handler `sequence:start` routes directly through `@leadforge/sdk` to the remote API server.
2. **MongoDB State Persistence**: The API server creates a `sequence_execution` record in MongoDB with status `PENDING` and writes an initial log entry to `sequence_logs` in MongoDB.
3. **Local SQLite Caching Only**: The desktop Main process receives the `sequence_execution` response from the API server and writes a read-only cache entry to SQLite via `LocalCRMRepository.save('sequence_executions', ...)` with `skipQueue = true`.

---

## Confidence Assessment

| Component | Verified Path | Evidence Source | Confidence |
| :--- | :--- | :--- | :--- |
| **Renderer Trigger** | UI -> Hook -> BaseSyncRepository -> `window.ipc.invoke` | `AutomationScreen.tsx`, `use-automation.ts`, `sync.ts` | **HIGH** |
| **IPC Infrastructure** | `window.ipc` -> Preload Whitelist -> Main Process Handler | `preload/index.ts`, `main/ipc/automation.ts` | **HIGH** |
| **SDK & Transport** | Main Handler -> `sdk.executions.start` -> `HttpClient.post` -> HTTP POST | `sdk/modules/automation.ts`, `sdk/http/client.ts` | **HIGH** |
| **API Server Routing** | Hono Endpoint -> `AutomationService.startExecution` | `routes/automation.ts`, `automation.service.ts` | **HIGH** |
| **Database Persistence** | Mongoose Models -> `SequenceExecutionModel.save()` -> MongoDB | `sequence-execution.model.ts`, `sequence-log.model.ts` | **HIGH** |
| **Local Desktop Caching**| Main Handler -> `LocalCRMRepository.save()` -> SQLite | `main/ipc/automation.ts`, `local-crm.ts` | **HIGH** |

**Overall Audit Confidence Level**: **HIGH**
