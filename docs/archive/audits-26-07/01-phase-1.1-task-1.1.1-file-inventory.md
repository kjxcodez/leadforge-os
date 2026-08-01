# Forensic Audit: Task 1.1.1 — Manual Execution Path File Inventory

This document inventory details every file participating in the manual automation execution path from the desktop application Renderer UI down to MongoDB database persistence.

---

## 1. Renderer Layer Files

### 1. `apps/desktop/src/renderer/screens/AutomationScreen.tsx`
- **Path**: [`apps/desktop/src/renderer/screens/AutomationScreen.tsx`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/screens/AutomationScreen.tsx)
- **Purpose**: Sales automation sequence card dashboard, sequence builder editor modal, and execution monitor table screen.
- **Responsibility**: List sequence cards, present "Run" action button, collect target `contactId` via prompt dialog, and trigger execution mutation (`handleManualTrigger`).
- **Imports**: `react`, `@tanstack/react-query`, `../hooks/useWorkspace`, `../hooks/use-automation`, `lucide-react`, `sonner`.
- **Imported By**: [`apps/desktop/src/renderer/App.tsx`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/App.tsx)
- **Runtime Role**: UI Trigger & User Input Layer.

### 2. `apps/desktop/src/renderer/hooks/use-automation.ts`
- **Path**: [`apps/desktop/src/renderer/hooks/use-automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/hooks/use-automation.ts)
- **Purpose**: React Query hooks encapsulating CRUD operations and mutation triggers for sequences and sequence executions.
- **Responsibility**: Provides `useStartSequence()` mutation hook which injects active `workspaceId` and invokes `SyncSequenceExecutionRepository.create()`. Handles query cache invalidation and UI toast feedback.
- **Imports**: `@tanstack/react-query`, `./useWorkspace`, `../repositories/sync`, `sonner`.
- **Imported By**: [`apps/desktop/src/renderer/screens/AutomationScreen.tsx`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/screens/AutomationScreen.tsx)
- **Runtime Role**: Renderer State Management & Data Hook Layer.

### 3. `apps/desktop/src/renderer/repositories/sync.ts`
- **Path**: [`apps/desktop/src/renderer/repositories/sync.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/sync.ts)
- **Purpose**: Client-side synchronizing repository abstraction that maps entity operations to desktop IPC channels.
- **Responsibility**: Exports `SyncSequenceExecutionRepository` (instance of `BaseSyncRepository<'sequence_executions'>`). Maps `create` to IPC channel `'sequence:start'` via `DOMAIN_CHANNELS`. Generates client-side UUID if absent and invokes `window.ipc.invoke('sequence:start', record)`.
- **Imports**: `../../main/database/contracts`, `./remote`.
- **Imported By**: [`apps/desktop/src/renderer/hooks/use-automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/hooks/use-automation.ts)
- **Runtime Role**: Renderer Repository & IPC Dispatch Abstraction.

---

## 2. IPC & Bridge Layer Files

### 4. `apps/desktop/src/preload/index.ts`
- **Path**: [`apps/desktop/src/preload/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/preload/index.ts)
- **Purpose**: Electron preload script providing a secure IPC context bridge between Renderer and Main processes.
- **Responsibility**: Exposes `window.ipc.invoke(channel, payload)` to window context using Electron `contextBridge`. Validates channel against `validChannels` whitelist (containing `'sequence:start'`) and invokes `ipcRenderer.invoke`.
- **Imports**: `electron` (`contextBridge`, `ipcRenderer`), `@leadforge/schema`.
- **Imported By**: Electron `BrowserWindow` webPreferences (loaded automatically by Electron runtime).
- **Runtime Role**: IPC Preload Context Bridge & Channel Guard.

### 5. `packages/schema/src/ipc/index.ts`
- **Path**: [`packages/schema/src/ipc/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/schema/src/ipc/index.ts)
- **Purpose**: Shared IPC channel map interface definitions and contract schemas across desktop layers.
- **Responsibility**: Defines TypeScript types for `IpcChannelMap['sequence:start']` (`input`, `output`).
- **Imports**: Zod schemas and domain interface contracts from `@leadforge/schema`.
- **Imported By**: [`apps/desktop/src/preload/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/preload/index.ts), [`apps/desktop/src/main/ipc/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/automation.ts)
- **Runtime Role**: Type Schema Contract Definition.

---

## 3. Desktop Main Process Layer Files

### 6. `apps/desktop/src/main/ipc/register.ts`
- **Path**: [`apps/desktop/src/main/ipc/register.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/register.ts)
- **Purpose**: Main process IPC bootstrap registry initializing domain channel handlers.
- **Responsibility**: Invokes `registerAutomationIpc(sdk)` passing the main process `SdkClient` instance.
- **Imports**: `./automation`, `@leadforge/sdk`, and other IPC registrar modules.
- **Imported By**: [`apps/desktop/src/main/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/index.ts)
- **Runtime Role**: IPC Registrar & Initialization Entry Point.

### 7. `apps/desktop/src/main/ipc/automation.ts`
- **Path**: [`apps/desktop/src/main/ipc/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/automation.ts)
- **Purpose**: Main process IPC handlers for sequence templates and automation sequence executions.
- **Responsibility**: Registers IPC channel `'sequence:start'`. Retrieves active workspace runtime via `WorkspaceManager.getActiveRuntime()`, calls `sdk.executions.start(sequenceId, contactId, companyId)`, caches execution payload in local SQLite via `LocalCRMRepository.save('sequence_executions', ...)`, and returns response object to renderer.
- **Imports**: `./helper`, `@leadforge/sdk`, `../lib/workspace-manager`, `../database/repositories/local-crm`.
- **Imported By**: [`apps/desktop/src/main/ipc/register.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/register.ts)
- **Runtime Role**: Electron Main Process IPC Controller.

### 8. `apps/desktop/src/main/lib/workspace-manager.ts`
- **Path**: [`apps/desktop/src/main/lib/workspace-manager.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/lib/workspace-manager.ts)
- **Purpose**: Context manager providing workspace runtime context and SQLite database connections in the Main process.
- **Responsibility**: Supplies `WorkspaceManager.getActiveRuntime()` method returning active `workspaceId` and active runtime handle.
- **Imports**: Workspace connection utilities and database handlers.
- **Imported By**: [`apps/desktop/src/main/ipc/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/automation.ts)
- **Runtime Role**: Desktop Main Process Context Provider.

### 9. `apps/desktop/src/main/database/repositories/local-crm.ts`
- **Path**: [`apps/desktop/src/main/database/repositories/local-crm.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/repositories/local-crm.ts)
- **Purpose**: SQLite database repository for client-side local caching of workspace entities.
- **Responsibility**: Provides `LocalCRMRepository.save(tableName, record, skipQueue)` to insert or update execution cache rows in the local SQLite database.
- **Imports**: `../connection` (`getDatabase`).
- **Imported By**: [`apps/desktop/src/main/ipc/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/automation.ts)
- **Runtime Role**: SQLite Local Cache Persistence Repository.

---

## 4. Shared SDK & Transport Files

### 10. `packages/sdk/src/client/index.ts`
- **Path**: [`packages/sdk/src/client/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/client/index.ts)
- **Purpose**: Main `SdkClient` class organizing API resource modules.
- **Responsibility**: Instantiates `HttpClient` and initializes `this.executions = new ExecutionsModule(this.httpClient)`.
- **Imports**: `../http/client`, `../modules/automation`.
- **Imported By**: [`apps/desktop/src/main/ipc/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/automation.ts)
- **Runtime Role**: SDK Client Orchestrator.

### 11. `packages/sdk/src/modules/automation.ts`
- **Path**: [`packages/sdk/src/modules/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/automation.ts)
- **Purpose**: SDK API module for automation sequences and sequence executions.
- **Responsibility**: Defines `ExecutionsModule.start(sequenceId, contactId, companyId)` method calling `this.client.post<SequenceExecution>('/automation/executions/start', { sequenceId, contactId, companyId })`.
- **Imports**: `../http/client`, `@leadforge/schema`.
- **Imported By**: [`packages/sdk/src/client/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/client/index.ts)
- **Runtime Role**: SDK API Resource Method Layer.

### 12. `packages/sdk/src/http/client.ts`
- **Path**: [`packages/sdk/src/http/client.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/http/client.ts)
- **Purpose**: HTTP client wrapper for API network communications, error parsing, and retries.
- **Responsibility**: Injects request headers (`Content-Type`, `Authorization`), stringifies payload body, performs native `fetch()` POST request to API, checks response status, and returns payload data.
- **Imports**: `../errors`, `@leadforge/schema`.
- **Imported By**: [`packages/sdk/src/client/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/client/index.ts), [`packages/sdk/src/modules/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/automation.ts)
- **Runtime Role**: SDK HTTP Transport Layer.

---

## 5. API Backend Layer Files

### 13. `apps/api/src/routes/automation.ts`
- **Path**: [`apps/api/src/routes/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/automation.ts)
- **Purpose**: Hono OpenAPI router defining `/automation` HTTP endpoints in the API server.
- **Responsibility**: Defines `automationRouter.post("/executions/start", ...)` handler: extracts `workspaceId` from Hono context, parses JSON body, calls `AutomationService.startExecution()`, and returns `successResponse(exec)`.
- **Imports**: `@hono/zod-openapi`, `../services/automation/automation.service.js`, `../utils/index.js`, `../errors/index.js`.
- **Imported By**: [`apps/api/src/routes/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/index.ts)
- **Runtime Role**: API Server Router & Endpoint Handler.

### 14. `apps/api/src/services/automation/automation.service.ts`
- **Path**: [`apps/api/src/services/automation/automation.service.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/services/automation/automation.service.ts)
- **Purpose**: API domain service handling automation sequences and execution database logic.
- **Responsibility**: Implements `startExecution(sequenceId, payload)`: validates sequence in MongoDB via `SequenceModel`, checks for active duplicate executions in MongoDB via `SequenceExecutionModel`, creates new `SequenceExecutionModel` document with status `"PENDING"`, calls `this.logStep()` to insert initial trigger log to `sequence_logs` and push to execution `logs` array, and returns document.
- **Imports**: `../../db/models/sequence.model.js`, `../../db/models/sequence-execution.model.js`, `../../db/models/sequence-log.model.js`, `@leadforge/schema`.
- **Imported By**: [`apps/api/src/routes/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/automation.ts)
- **Runtime Role**: API Business Logic & Database Domain Service.

---

## 6. MongoDB Database Model Files

### 15. `apps/api/src/db/models/sequence.model.ts`
- **Path**: [`apps/api/src/db/models/sequence.model.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/db/models/sequence.model.ts)
- **Purpose**: Mongoose model and schema definition for the `sequences` MongoDB collection.
- **Responsibility**: Defines schema layout for sequence templates and applies workspace scoping plugin.
- **Imports**: `mongoose`, `../plugins/index.js`.
- **Imported By**: [`apps/api/src/services/automation/automation.service.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/services/automation/automation.service.ts)
- **Runtime Role**: MongoDB Sequence Model Schema.

### 16. `apps/api/src/db/models/sequence-execution.model.ts`
- **Path**: [`apps/api/src/db/models/sequence-execution.model.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/db/models/sequence-execution.model.ts)
- **Purpose**: Mongoose model and schema definition for the `sequence_executions` MongoDB collection.
- **Responsibility**: Defines schema layout for execution records (`status: "PENDING"`, `currentStep: 0`, `logs: []`, `startedAt`) and applies workspace scoping plugin.
- **Imports**: `mongoose`, `../plugins/index.js`.
- **Imported By**: [`apps/api/src/services/automation/automation.service.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/services/automation/automation.service.ts)
- **Runtime Role**: MongoDB Sequence Execution Target Model Schema.

### 17. `apps/api/src/db/models/sequence-log.model.ts`
- **Path**: [`apps/api/src/db/models/sequence-log.model.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/db/models/sequence-log.model.ts)
- **Purpose**: Mongoose model and schema definition for the `sequence_logs` MongoDB collection.
- **Responsibility**: Defines schema layout for execution history logs (`executionId`, `step`, `action`, `status`, `message`) and applies workspace scoping plugin.
- **Imports**: `mongoose`, `../plugins/index.js`.
- **Imported By**: [`apps/api/src/services/automation/automation.service.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/services/automation/automation.service.ts)
- **Runtime Role**: MongoDB Execution Log Target Model Schema.

### 18. `apps/api/src/db/plugins/workspace.plugin.ts`
- **Path**: [`apps/api/src/db/plugins/workspace.plugin.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/db/plugins/workspace.plugin.ts)
- **Purpose**: Mongoose schema plugin for automatic workspace scoping across MongoDB queries.
- **Responsibility**: Injects workspace isolation filter (`workspaceId`) on pre-find and pre-save hooks.
- **Imports**: `mongoose`.
- **Imported By**: `sequence.model.ts`, `sequence-execution.model.ts`, `sequence-log.model.ts`.
- **Runtime Role**: MongoDB Query Isolation Middleware Plugin.
