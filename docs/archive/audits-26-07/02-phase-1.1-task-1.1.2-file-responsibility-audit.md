# Forensic Audit: Task 1.1.2 — Detailed File Responsibility & Dependency Audit

## Executive Summary

This document performs an exhaustive, line-by-line forensic responsibility and dependency analysis of every file participating in the manual automation execution path within LeadForge OS. Building upon the runtime call graph established in Task 1.1.1, this audit analyzes why each file exists, what responsibilities it owns, what contracts it relies upon, how data flows through it, its side effects, failure modes, architectural boundaries, and coupling levels.

A total of 19 files across 7 architectural layers (Renderer UI, Renderer Hooks/Repositories, IPC Preload Bridge, Electron Main Process, Shared SDK, API Server, and MongoDB Models) are analyzed in full detail.

---

## Scope & Methodology

- **Scope**: Every file participating directly or indirectly in the manual execution path (`sequence:start`).
- **Methodology**: Static analysis of current source code. Zero assumptions, zero hypotheses, zero proposed fixes.
- **Evidence Standard**: Every assertion is backed by exact file paths, line references, and implementation code.
- **Confidence Rating**:
  - **HIGH**: Source code verified line-by-line.
  - **MEDIUM**: Indirect path verified via schema/interface.
  - **LOW**: Ambiguous or partial implementation.
  - **NOT VERIFIED**: Code absent or unverified.

---

## Individual File Responsibility Audits

---

### 1. `apps/desktop/src/renderer/screens/AutomationScreen.tsx`

- **Basic Information**:
  - **File Path**: [`apps/desktop/src/renderer/screens/AutomationScreen.tsx`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/screens/AutomationScreen.tsx)
  - **Layer**: Renderer UI
  - **Module**: Sales Automation UI
  - **Responsibility**: Presenting the sequence template dashboard, sequence builder editor, and execution monitor; capturing user click events to manually start sequences.
- **Runtime Purpose**:
  - Serves as the primary user entry point for viewing sequence card templates and starting manual sequence executions.
- **Ownership**:
  - **Owns**: React presentation state (`activeTab`, `editorOpen`, `selectedExecutionId`), user interaction event handlers (`handleManualTrigger`), UI alert prompts.
  - **Does NOT Own**: Workspace context retrieval, sequence execution state machine, local database queries, IPC payload dispatch logic.
- **Dependencies**:
  - **Imports**: `react`, `@tanstack/react-query`, `../hooks/useWorkspace`, `../hooks/use-automation`, `lucide-react`, `sonner`.
  - **Imported By**: [`apps/desktop/src/renderer/App.tsx`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/App.tsx).
  - **Runtime Dependencies**: React runtime, `@tanstack/react-query` QueryClient, `useStartSequence` hook.
  - **Compile-time Dependencies**: TypeScript JSX compiler, Vite bundler.
- **Entry Points**:
  - `AutomationScreen()` (Default React Component export, rendered when active route/tab is "automation").
  - `handleManualTrigger(seqId: string)` (Line 219, triggered by user clicking "Run" button on sequence card).
- **Exit Points**:
  - `startSequenceMutation.mutate({ sequenceId: seqId, contactId, companyId: null })` (Line 221, invokes `useStartSequence` mutation).
- **Data Flow**:
  - User click on "Run" button -> `seqId` passed to `handleManualTrigger` -> browser `prompt()` captures `contactId` -> payload `{ sequenceId: seqId, contactId, companyId: null }` passed to `startSequenceMutation.mutate()`.
- **Contracts**:
  - UI Component Contract (`AutomationScreenProps`: none).
  - Hook Contract: expects `useStartSequence()` to expose a TanStack `useMutation` result with `.mutate()`.
- **Side Effects**:
  - Triggers browser modal dialog (`prompt`).
  - Dispatches React Query mutation state change.
- **Failure Modes**:
  - **Immediate Failure**: If `useStartSequence()` hook fails or throws, button click handler crashes or uncaught promise rejection occurs.
  - **Indirect Failure**: UI state remains unchanged; toast error message rendered if mutation `onError` catches exception.
  - **Survives**: Non-automation tabs in Desktop UI remain interactive.
- **Replaceability**:
  - High. The UI screen can be replaced or redesigned completely as long as it invokes `useStartSequence().mutate()`.
- **Confidence**: HIGH (Source code inspected, lines 1-704).
- **Classification**:
  - **Architectural Role**: UI
  - **Criticality**: Critical (Entry point for manual execution).
  - **Single Responsibility Audit**: Violates Single Responsibility Principle. Combines dashboard metrics presentation, sequence builder modal editor, execution logs modal, and manual execution triggers in a single 704-line file.
  - **Hidden Responsibilities**: Executes browser native `prompt()` dialog for `contactId` input directly inside event handler.
  - **Architectural Boundary Audit**: Respects boundary. Does not import main process or IPC APIs directly; delegates strictly to React hooks.

---

### 2. `apps/desktop/src/renderer/hooks/use-automation.ts`

- **Basic Information**:
  - **File Path**: [`apps/desktop/src/renderer/hooks/use-automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/hooks/use-automation.ts)
  - **Layer**: Renderer Hook
  - **Module**: Automation Hooks
  - **Responsibility**: Providing React Query custom hooks (`useSequences`, `useSequenceExecutions`, `useStartSequence`, `useStopSequence`) for sequence management.
- **Runtime Purpose**:
  - Encapsulates TanStack Query mutation and query hooks, tying workspace context to repository invocations and managing query invalidation & toasts.
- **Ownership**:
  - **Owns**: TanStack Query key definitions (`['sequence_executions', 'list', workspaceId]`), mutation lifecycles, UI toast notifications on success/error.
  - **Does NOT Own**: Repository storage logic, IPC channel dispatch, active workspace state management.
- **Dependencies**:
  - **Imports**: `@tanstack/react-query`, `./useWorkspace`, `../repositories/sync` (`SyncSequenceRepository`, `SyncSequenceExecutionRepository`, `SyncSequenceLogRepository`), `sonner`.
  - **Imported By**: [`apps/desktop/src/renderer/screens/AutomationScreen.tsx`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/screens/AutomationScreen.tsx).
  - **Runtime Dependencies**: `useWorkspace()` hook, `SyncSequenceExecutionRepository`.
- **Entry Points**:
  - `useStartSequence()` (Exported function, lines 74-104).
- **Exit Points**:
  - `SyncSequenceExecutionRepository.create({ sequenceId, contactId, companyId, workspaceId })` (Line 89).
- **Data Flow**:
  - Receives `{ sequenceId, contactId, companyId }` from mutation caller -> fetches `activeWorkspace.id` from `useWorkspace()` -> constructs payload `{ sequenceId, contactId, companyId, workspaceId }` -> passes to `SyncSequenceExecutionRepository.create()`.
- **Contracts**:
  - React Hook Contract: returns `UseMutationResult` object.
  - Repository Contract: expects `SyncSequenceExecutionRepository.create(payload)` to return a Promise resolving to created execution.
- **Side Effects**:
  - Invalidates TanStack Query cache key `['sequence_executions', 'list', workspaceId]`.
  - Emits `toast.success('Sequence execution started.')` or `toast.error()`.
- **Failure Modes**:
  - **Immediate Failure**: If `workspaceId` is empty or undefined, repository call receives empty string; backend rejects with `Workspace context required`.
  - **Indirect Failure**: `onError` callback triggers error toast.
- **Replaceability**:
  - High. Can be replaced with standard async functions or custom state managers without affecting repository or main process.
- **Confidence**: HIGH (Source code inspected, lines 1-124).
- **Classification**:
  - **Architectural Role**: Hook
  - **Criticality**: Critical (Connects UI components to repository layer).
  - **Single Responsibility Audit**: Follows Single Responsibility Principle. Acts purely as a hook wrapper around automation repository operations.
  - **Hidden Responsibilities**: None.
  - **Architectural Boundary Audit**: Respects boundary. Does not access window IPC directly; delegates to `SyncSequenceExecutionRepository`.

---

### 3. `apps/desktop/src/renderer/repositories/sync.ts`

- **Basic Information**:
  - **File Path**: [`apps/desktop/src/renderer/repositories/sync.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/sync.ts)
  - **Layer**: Renderer Repository
  - **Module**: Client Sync Repositories
  - **Responsibility**: Mapping entity repository operations to desktop IPC channels and fallback local database channels.
- **Runtime Purpose**:
  - Implements `ISyncRepository<T>` contract (`BaseSyncRepository<T>`), mapping table names (`sequence_executions`) to IPC channel definitions (`create: 'sequence:start'`).
- **Ownership**:
  - **Owns**: Domain channel mapping configuration (`DOMAIN_CHANNELS`), client-side UUID generation (`crypto.randomUUID()`), IPC channel lookup.
  - **Does NOT Own**: Main process IPC execution, remote SDK communication, SQLite queries.
- **Dependencies**:
  - **Imports**: `../../main/database/contracts` (`ISyncRepository`), `./remote`.
  - **Imported By**: [`apps/desktop/src/renderer/hooks/use-automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/hooks/use-automation.ts).
  - **Runtime Dependencies**: `window.ipc` bridge exposed via preload script.
- **Entry Points**:
  - `SyncSequenceExecutionRepository.create(data)` (Line 100, method on `BaseSyncRepository` instance).
- **Exit Points**:
  - `window.ipc.invoke('sequence:start', record)` (Line 108).
- **Data Flow**:
  - Input: `data` object `{ sequenceId, contactId, companyId, workspaceId }`.
  - Transformation: Checks `(data as any).id || crypto.randomUUID()`, creates `record = { ...data, id }`.
  - Output: Passes `record` to `window.ipc.invoke('sequence:start', record)`.
- **Contracts**:
  - `ISyncRepository<T>` interface contract.
  - IPC Bridge Contract: `window.ipc.invoke(channel, payload)`.
- **Side Effects**:
  - Invokes desktop IPC call across process boundary.
- **Failure Modes**:
  - **Immediate Failure**: If `window.ipc` is undefined (e.g. running in standard browser without preload), throws `TypeError: Cannot read properties of undefined (reading 'invoke')`.
  - **Indirect Failure**: IPC promise rejection propagates up to caller.
- **Replaceability**:
  - Medium. Requires maintaining `ISyncRepository` interface compatibility.
- **Confidence**: HIGH (Source code inspected, lines 1-196).
- **Classification**:
  - **Architectural Role**: Repository
  - **Criticality**: Critical (Bridge between Renderer JavaScript environment and Electron IPC).
  - **Single Responsibility Audit**: Follows Single Responsibility Principle. Acts as repository wrapper mapping entities to IPC channels.
  - **Hidden Responsibilities**: Generates client-side UUID (`crypto.randomUUID()`) inside `create()` method.
  - **Architectural Boundary Audit**: Boundary Bridge. Transmits calls across Renderer -> Preload boundary via `window.ipc`.

---

### 4. `apps/desktop/src/preload/index.ts`

- **Basic Information**:
  - **File Path**: [`apps/desktop/src/preload/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/preload/index.ts)
  - **Layer**: IPC / Preload Bridge
  - **Module**: Electron Preload
  - **Responsibility**: Safely exposing IPC invoke/on bridge methods to the Renderer via Electron `contextBridge`.
- **Runtime Purpose**:
  - Isolates Renderer execution environment while providing explicit, whitelisted access to Electron Main process IPC channels.
- **Ownership**:
  - **Owns**: IPC channel whitelist array (`validChannels`), `window.ipc` global object declaration.
  - **Does NOT Own**: IPC handler execution logic, payload validation, business logic.
- **Dependencies**:
  - **Imports**: `electron` (`contextBridge`, `ipcRenderer`), `@leadforge/schema`.
  - **Imported By**: Loaded directly by Electron main process during `BrowserWindow` creation.
  - **Runtime Dependencies**: Electron `ipcRenderer` native module.
- **Entry Points**:
  - `window.ipc.invoke(channel, payload)` (Line 67).
- **Exit Points**:
  - `ipcRenderer.invoke(channel, payload)` (Line 117).
- **Data Flow**:
  - Receives `channel` string (`'sequence:start'`) and `payload` -> checks `validChannels.includes(channel)` -> forwards to `ipcRenderer.invoke(channel, payload)`.
- **Contracts**:
  - `IpcBridge` interface exposed on global `window` object.
- **Side Effects**:
  - Cross-process IPC invocation from Renderer process to Main process.
- **Failure Modes**:
  - **Immediate Failure**: If `channel` is not in `validChannels`, throws `Error: Unauthorized IPC channel: sequence:start`.
- **Replaceability**:
  - Low. Electron security architecture mandates preload scripts for context-isolated IPC.
- **Confidence**: HIGH (Source code inspected, lines 1-184).
- **Classification**:
  - **Architectural Role**: IPC / Infrastructure
  - **Criticality**: Critical (IPC Guard & Context Bridge).
  - **Single Responsibility Audit**: Follows Single Responsibility Principle. Whitelists and bridges IPC calls.
  - **Hidden Responsibilities**: None.
  - **Architectural Boundary Audit**: Boundary Security Guard. Enforces process isolation boundaries between Chromium Renderer and Node.js Main process.

---

### 5. `packages/schema/src/ipc/index.ts`

- **Basic Information**:
  - **File Path**: [`packages/schema/src/ipc/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/schema/src/ipc/index.ts)
  - **Layer**: Schema / Type Contract
  - **Module**: IPC Schemas
  - **Responsibility**: Defining TypeScript interfaces and type mappings for all IPC channels across desktop modules.
- **Runtime Purpose**:
  - Provides compile-time type safety for `window.ipc.invoke()` and `ipcMain.handle()` channel inputs and outputs.
- **Ownership**:
  - **Owns**: `IpcChannelMap` TypeScript type definitions.
  - **Does NOT Own**: Runtime execution or validation.
- **Dependencies**:
  - **Imports**: Zod schemas and domain interface definitions from `@leadforge/schema`.
  - **Imported By**: [`apps/desktop/src/preload/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/preload/index.ts), [`apps/desktop/src/main/ipc/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/automation.ts).
- **Entry Points**:
  - Type definition export `IpcChannelMap['sequence:start']` (Line 322).
- **Exit Points**:
  - None (Compile-time contract).
- **Data Flow**:
  - Compile-time type validation of `{ sequenceId: string; contactId?: string | null; companyId?: string | null }` -> `SequenceExecution`.
- **Contracts**:
  - TypeScript Type Mapping Contract.
- **Side Effects**:
  - None (Zero runtime code emitted for type declarations).
- **Failure Modes**:
  - **Compile-time Failure**: Type mismatches in IPC invoke payloads trigger TypeScript compilation errors.
- **Replaceability**:
  - High (Compile-time definition).
- **Confidence**: HIGH (Source code inspected).
- **Classification**:
  - **Architectural Role**: Configuration / Contract
  - **Criticality**: Medium (Compile-time contract safety).
  - **Single Responsibility Audit**: Follows Single Responsibility Principle.
  - **Hidden Responsibilities**: None.
  - **Architectural Boundary Audit**: Cross-cutting contract shared between Renderer and Main processes.

---

### 6. `apps/desktop/src/main/ipc/register.ts`

- **Basic Information**:
  - **File Path**: [`apps/desktop/src/main/ipc/register.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/register.ts)
  - **Layer**: Electron Main Process
  - **Module**: IPC Registry
  - **Responsibility**: Central initialization function registering all IPC module handlers in the main process.
- **Runtime Purpose**:
  - Bootstraps IPC channel handlers on application startup, injecting dependencies (`SdkClient`) into domain IPC modules.
- **Ownership**:
  - **Owns**: Master IPC registration sequence.
  - **Does NOT Own**: Handler implementation logic.
- **Dependencies**:
  - **Imports**: `./automation` (`registerAutomationIpc`), `@leadforge/sdk`, and other domain IPC module registrars.
  - **Imported By**: Main process startup script (`apps/desktop/src/main/index.ts`).
- **Entry Points**:
  - `registerIpcHandlers(sdk: SdkClient)` (Exported function).
- **Exit Points**:
  - `registerAutomationIpc(sdk)` (Line 42).
- **Data Flow**:
  - Receives `sdk` instance -> passes `sdk` to `registerAutomationIpc(sdk)`.
- **Contracts**:
  - IPC Registration Bootstrap Contract.
- **Side Effects**:
  - Registers handlers on Electron `ipcMain`.
- **Failure Modes**:
  - **Immediate Failure**: If registration fails during startup, IPC channels remain unregistered, causing renderer IPC invocations to timeout or fail.
- **Replaceability**:
  - Low. Required for main process initialization.
- **Confidence**: HIGH (Source code inspected).
- **Classification**:
  - **Architectural Role**: Infrastructure / Bootstrap
  - **Criticality**: Critical (IPC Handler Registrar).
  - **Single Responsibility Audit**: Follows Single Responsibility Principle.
  - **Hidden Responsibilities**: None.
  - **Architectural Boundary Audit**: Internal Main Process Layer.

---

### 7. `apps/desktop/src/main/ipc/automation.ts`

- **Basic Information**:
  - **File Path**: [`apps/desktop/src/main/ipc/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/automation.ts)
  - **Layer**: Electron Main Process IPC Controller
  - **Module**: Automation IPC Handlers
  - **Responsibility**: Defining IPC invocation handlers for sequences and sequence executions.
- **Runtime Purpose**:
  - Serves as the main process controller for `'sequence:start'`. Obtains workspace runtime context, invokes remote SDK, and caches result in local SQLite.
- **Ownership**:
  - **Owns**: IPC channel handler registration for `'sequence:start'`, `'sequence:stop'`, `'execution:list'`, `'execution:get'`, `'execution:logs'`.
  - **Does NOT Own**: Local job scheduling (bypassed), SDK HTTP execution, SQLite query string compilation.
- **Dependencies**:
  - **Imports**: `./helper` (`safeRegister`), `@leadforge/sdk` (`SdkClient`), `../lib/workspace-manager` (`WorkspaceManager`), `../database/repositories/local-crm` (`LocalCRMRepository`).
  - **Imported By**: [`apps/desktop/src/main/ipc/register.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/register.ts).
  - **Runtime Dependencies**: `WorkspaceManager`, `sdk.executions`, `LocalCRMRepository`.
- **Entry Points**:
  - `registerAutomationIpc(sdk: SdkClient)` (Line 9).
  - Handler callback for `'sequence:start'` (Lines 63-69).
- **Exit Points**:
  - `WorkspaceManager.getActiveRuntime()` (Line 64).
  - `sdk.executions.start(sequenceId, contactId, companyId)` (Line 66).
  - `LocalCRMRepository.save('sequence_executions', { ...res, workspaceId: runtime.workspaceId }, true)` (Line 67).
- **Data Flow**:
  - Input: IPC event and payload `{ sequenceId, contactId, companyId }`.
  - Execution: Calls `sdk.executions.start()` -> receives remote execution object `res` -> constructs `{ ...res, workspaceId: runtime.workspaceId }` -> calls `LocalCRMRepository.save()` -> returns `res`.
- **Contracts**:
  - `ipcMain.handle('sequence:start')` handler contract.
  - SDK Contract: expects `sdk.executions.start()` to return `SequenceExecution`.
  - Local Repository Contract: expects `LocalCRMRepository.save(table, record, skipQueue)` to write SQLite row.
- **Side Effects**:
  - Network HTTP call to API server via SDK.
  - Disk write to desktop SQLite database (`sequence_executions` table).
- **Failure Modes**:
  - **Immediate Failure**: If no active workspace runtime exists (`WorkspaceManager.getActiveRuntime()` returns null), throws `Error: No active workspace runtime`.
  - **Network Failure**: If SDK call fails (e.g. API server offline), IPC promise rejects, local SQLite cache write is skipped, error returned to renderer.
- **Replaceability**:
  - High. This handler is the exact site where local job scheduling or remote SDK delegation behavior is controlled.
- **Confidence**: HIGH (Source code inspected, lines 1-109).
- **Classification**:
  - **Architectural Role**: IPC / Controller
  - **Criticality**: Critical (Core execution dispatcher in Main process).
  - **Single Responsibility Audit**: Violates Single Responsibility Principle. Acts as an IPC controller AND performs database caching directly inside the handler callback.
  - **Hidden Responsibilities**: Directly calls `LocalCRMRepository.save()` with `skipQueue = true` to perform local SQLite write after remote SDK execution succeeds.
  - **Architectural Boundary Audit**: Boundary Crossing Controller. Receives IPC from Renderer, delegates to remote SDK over HTTP, and writes to local SQLite database. Bypasses local `JobScheduler`.

---

### 8. `apps/desktop/src/main/ipc/helper.ts`

- **Basic Information**:
  - **File Path**: [`apps/desktop/src/main/ipc/helper.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/helper.ts)
  - **Layer**: Electron Main Process Helper
  - **Module**: IPC Utilities
  - **Responsibility**: Providing safe registration wrapper for Electron `ipcMain.handle` channels.
- **Runtime Purpose**:
  - Prevents Electron duplicate IPC handler registration crashes during Vite Hot Module Replacement (HMR) in development mode.
- **Ownership**:
  - **Owns**: `REGISTERED_IPC_CHANNELS` Set, `safeRegister` function.
  - **Does NOT Own**: Channel logic.
- **Dependencies**:
  - **Imports**: `electron` (`ipcMain`).
  - **Imported By**: [`apps/desktop/src/main/ipc/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/automation.ts).
- **Entry Points**:
  - `safeRegister(channel, handler)` (Line 9).
- **Exit Points**:
  - `ipcMain.removeHandler(channel)` (Line 10).
  - `ipcMain.handle(channel, handler)` (Line 11).
- **Data Flow**:
  - Removes existing channel handler on `ipcMain` -> registers new handler -> adds channel string to `REGISTERED_IPC_CHANNELS` set.
- **Contracts**:
  - `ipcMain` registration contract.
- **Side Effects**:
  - Mutates `ipcMain` channel handlers registry.
- **Failure Modes**:
  - **Immediate Failure**: If `ipcMain` registration fails, Electron throws error.
- **Replaceability**:
  - High. Could use standard `ipcMain.handle` directly if HMR handler cleanup is handled elsewhere.
- **Confidence**: HIGH (Source code inspected, lines 1-14).
- **Classification**:
  - **Architectural Role**: Utility / Infrastructure
  - **Criticality**: Medium (Dev/HMR safety utility).
  - **Single Responsibility Audit**: Follows Single Responsibility Principle.
  - **Hidden Responsibilities**: None.
  - **Architectural Boundary Audit**: Internal Main Process Utility.

---

### 9. `apps/desktop/src/main/lib/workspace-manager.ts`

- **Basic Information**:
  - **File Path**: [`apps/desktop/src/main/lib/workspace-manager.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/lib/workspace-manager.ts)
  - **Layer**: Electron Main Process Context
  - **Module**: Workspace Manager
  - **Responsibility**: Managing active workspace runtime state, SQLite database handles, and workspace environment configurations in the Main process.
- **Runtime Purpose**:
  - Provides singleton access to the active workspace runtime (`WorkspaceManager.getActiveRuntime()`), supplying the active `workspaceId` required for scoping database writes and IPC actions.
- **Ownership**:
  - **Owns**: Active workspace runtime instance pointer, SQLite database connection map.
  - **Does NOT Own**: IPC routing, network calls, frontend state.
- **Dependencies**:
  - **Imports**: SQLite database connection utilities, workspace types.
  - **Imported By**: [`apps/desktop/src/main/ipc/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/automation.ts).
- **Entry Points**:
  - `WorkspaceManager.getActiveRuntime()` (Static method).
- **Exit Points**:
  - Returns active `WorkspaceRuntime` object or `null`.
- **Data Flow**:
  - Returns in-memory active runtime object `{ workspaceId: string, db: Database, ... }`.
- **Contracts**:
  - Runtime Context Provider Contract.
- **Side Effects**:
  - None on read (`getActiveRuntime`).
- **Failure Modes**:
  - **Immediate Failure**: If no workspace is selected, returns `null`, causing `automation.ts` to throw `No active workspace runtime`.
- **Replaceability**:
  - Low. Essential context provider for multi-tenant desktop architecture.
- **Confidence**: HIGH (Source code inspected).
- **Classification**:
  - **Architectural Role**: Runtime / Context
  - **Criticality**: Critical (Provides workspace scoping context).
  - **Single Responsibility Audit**: Follows Single Responsibility Principle.
  - **Hidden Responsibilities**: None.
  - **Architectural Boundary Audit**: Internal Main Process Context Manager.

---

### 10. `apps/desktop/src/main/database/repositories/local-crm.ts`

- **Basic Information**:
  - **File Path**: [`apps/desktop/src/main/database/repositories/local-crm.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/repositories/local-crm.ts)
  - **Layer**: Desktop SQLite Database Layer
  - **Module**: Local CRM Repository
  - **Responsibility**: Executing prepared SQLite queries for entity tables (`sequence_executions`, `sequences`, `contacts`, etc.) within workspace database files.
- **Runtime Purpose**:
  - Provides SQLite CRUD operations (`findMany`, `findById`, `save`, `softDelete`) on local SQLite database files per workspace.
- **Ownership**:
  - **Owns**: Dynamic SQL query string compilation, prepared statement execution (`db.prepare()`), SQLite schema column verification (`pragma table_info`).
  - **Does NOT Own**: Remote API synchronization, business logic validation.
- **Dependencies**:
  - **Imports**: `../connection` (`getDatabase`).
  - **Imported By**: [`apps/desktop/src/main/ipc/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/automation.ts).
  - **Runtime Dependencies**: `better-sqlite3` database handle from `getDatabase(workspaceId)`.
- **Entry Points**:
  - `LocalCRMRepository.save(tableName, record, skipQueue)` (Line 54).
- **Exit Points**:
  - `db.prepare(query).run(...params)` (SQLite execution).
- **Data Flow**:
  - Receives `tableName` (`'sequence_executions'`), `record` object, and `skipQueue` boolean.
  - Validates `record.workspaceId`.
  - Compiles `INSERT OR REPLACE INTO sequence_executions (...) VALUES (...)` SQL query.
  - Executes prepared statement against workspace SQLite database file.
- **Contracts**:
  - Local Database Persistence Contract.
- **Side Effects**:
  - Writes/updates row in local SQLite disk database.
- **Failure Modes**:
  - **Immediate Failure**: If `record.workspaceId` is missing, throws `Error: workspaceId is required for SQLite crm repository writes`. If `tableName` fails regex validation, throws `Invalid table name`.
- **Replaceability**:
  - Medium. Could be replaced with an ORM (e.g. Drizzle, Prisma) or alternate SQLite wrapper.
- **Confidence**: HIGH (Source code inspected, lines 1-228).
- **Classification**:
  - **Architectural Role**: Database / Persistence
  - **Criticality**: Critical (Local SQLite Caching Layer).
  - **Single Responsibility Audit**: Follows Single Responsibility Principle. Focuses on SQLite CRUD query execution.
  - **Hidden Responsibilities**: Inspects `table_info` pragma dynamically to check for `deletedAt` column presence before compiling queries.
  - **Architectural Boundary Audit**: Local Storage Layer. Executes SQLite filesystem writes for main process.

---

### 11. `packages/sdk/src/client/index.ts`

- **Basic Information**:
  - **File Path**: [`packages/sdk/src/client/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/client/index.ts)
  - **Layer**: Shared SDK
  - **Module**: SDK Client
  - **Responsibility**: Instantiating and exposing API resource modules on a central `SdkClient` class instance.
- **Runtime Purpose**:
  - Serves as the top-level API client facade for desktop and external consumers, grouping domain modules (`executions`, `sequences`, `contacts`, etc.).
- **Ownership**:
  - **Owns**: Module instantiation (`this.executions = new ExecutionsModule(this.httpClient)`), `HttpClient` instance lifecycle.
  - **Does NOT Own**: HTTP transport implementation, API business logic, UI state.
- **Dependencies**:
  - **Imports**: `../http/client` (`HttpClient`), `../modules/automation` (`ExecutionsModule`), and other SDK module classes.
  - **Imported By**: [`apps/desktop/src/main/ipc/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/automation.ts), [`apps/desktop/src/main/ipc/register.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/register.ts).
- **Entry Points**:
  - `new SdkClient(config)` constructor.
  - `sdk.executions` property getter.
- **Exit Points**:
  - Delegated method calls to module instances (`this.executions.start()`).
- **Data Flow**:
  - Pass-through caller to `ExecutionsModule`.
- **Contracts**:
  - SDK Client Facade Contract.
- **Side Effects**:
  - Instantiates `HttpClient`.
- **Failure Modes**:
  - **Immediate Failure**: Unhandled invalid `baseUrl` configuration prevents HTTP requests from completing.
- **Replaceability**:
  - High. Facade layer around HTTP client modules.
- **Confidence**: HIGH (Source code inspected).
- **Classification**:
  - **Architectural Role**: SDK / Infrastructure
  - **Criticality**: Critical (API Client Access Point).
  - **Single Responsibility Audit**: Follows Single Responsibility Principle. Facade pattern implementation.
  - **Hidden Responsibilities**: None.
  - **Architectural Boundary Audit**: Shared Client Library Boundary. Encapsulates HTTP client interactions.

---

### 12. `packages/sdk/src/modules/automation.ts`

- **Basic Information**:
  - **File Path**: [`packages/sdk/src/modules/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/automation.ts)
  - **Layer**: Shared SDK Module
  - **Module**: Automation SDK Module
  - **Responsibility**: Defining strongly-typed SDK method calls for sequence templates (`SequencesModule`) and executions (`ExecutionsModule`).
- **Runtime Purpose**:
  - Maps domain method signatures (`sdk.executions.start(sequenceId, contactId, companyId)`) to API endpoint routes (`POST /automation/executions/start`).
- **Ownership**:
  - **Owns**: Endpoint path definitions (`/automation/executions/start`), method signature interfaces for automation resources.
  - **Does NOT Own**: Network transport logic, response parsing, main process local caching.
- **Dependencies**:
  - **Imports**: `../http/client` (`HttpClient`), `@leadforge/schema` (`SequenceExecution`, `SequenceLog`).
  - **Imported By**: [`packages/sdk/src/client/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/client/index.ts).
  - **Runtime Dependencies**: `HttpClient` instance.
- **Entry Points**:
  - `ExecutionsModule.start(sequenceId, contactId, companyId)` (Lines 45-51).
- **Exit Points**:
  - `this.client.post<SequenceExecution>('/automation/executions/start', { sequenceId, contactId, companyId })` (Line 46).
- **Data Flow**:
  - Input: `sequenceId: string`, `contactId?: string | null`, `companyId?: string | null`.
  - Transformation: Wraps parameters into request body object `{ sequenceId, contactId, companyId }`.
  - Output: Passes path string and body object to `this.client.post()`.
- **Contracts**:
  - `ExecutionsModule` API Method Contract.
- **Side Effects**:
  - Invokes `HttpClient.post()`.
- **Failure Modes**:
  - **Immediate Failure**: Throws `SdkError` if `HttpClient` request fails or receives HTTP error response.
- **Replaceability**:
  - Medium. Maps 1-to-1 with API REST endpoints.
- **Confidence**: HIGH (Source code inspected, lines 1-61).
- **Classification**:
  - **Architectural Role**: SDK / Module
  - **Criticality**: Critical (SDK Domain Method Provider).
  - **Single Responsibility Audit**: Follows Single Responsibility Principle. Groups sequence and execution API calls.
  - **Hidden Responsibilities**: None.
  - **Architectural Boundary Audit**: SDK Client Domain Layer. Converts function calls to HTTP endpoints.

---

### 13. `packages/sdk/src/http/client.ts`

- **Basic Information**:
  - **File Path**: [`packages/sdk/src/http/client.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/http/client.ts)
  - **Layer**: Shared SDK Transport
  - **Module**: HTTP Client
  - **Responsibility**: Executing native `fetch` requests, resolving authentication headers, stringifying JSON bodies, parsing `ApiResponse<T>`, and managing exponential backoff retries.
- **Runtime Purpose**:
  - Low-level network transport implementation for the SDK, standardizing HTTP requests, error handling (`SdkError`), and token injection across all API endpoints.
- **Ownership**:
  - **Owns**: Header injection (`Content-Type`, `Authorization`), JSON body serialization (`JSON.stringify`), native `fetch` call execution, status code checking, retry loop, error normalization.
  - **Does NOT Own**: Endpoint route definitions, UI logic, database writes.
- **Dependencies**:
  - **Imports**: `../errors` (`SdkError`), `@leadforge/schema` (`ApiResponse`).
  - **Imported By**: [`packages/sdk/src/client/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/client/index.ts), [`packages/sdk/src/modules/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/automation.ts).
  - **Runtime Dependencies**: Global `fetch` API.
- **Entry Points**:
  - `HttpClient.post<T>(path, body)` (Line 96).
  - Private `request<T>(method, path, body, options)` (Lines 34-90).
- **Exit Points**:
  - `fetch(url, requestOptions)` (Line 54).
- **Data Flow**:
  - Input: `method = 'POST'`, `path = '/automation/executions/start'`, `body = { sequenceId, contactId, companyId }`.
  - Transformations:
    1. Concatenates `${this.config.baseUrl}${path}`.
    2. Resolves token via `tokenResolver()` and sets header `Authorization: Bearer <token>`.
    3. Serializes `body` to string via `JSON.stringify(body)`.
    4. Executes `fetch()`.
    5. Parses response via `response.json()` to `ApiResponse<T>`.
    6. Returns `payload.data`.
- **Contracts**:
  - HTTP Transport & `ApiResponse<T>` Unwrapping Contract.
- **Side Effects**:
  - Makes network I/O HTTP request across network boundary.
- **Failure Modes**:
  - **Immediate Failure**: Network disconnect or 500 Server Error triggers `SdkError` throw after max retries (default 2 retries).
- **Replaceability**:
  - Medium. Could be replaced with Axios or Ky, but interface contract must remain identical.
- **Confidence**: HIGH (Source code inspected, lines 1-112).
- **Classification**:
  - **Architectural Role**: Transport / Infrastructure
  - **Criticality**: Critical (Core Network I/O Engine).
  - **Single Responsibility Audit**: Follows Single Responsibility Principle. Manages HTTP request/response lifecycle.
  - **Hidden Responsibilities**: Implements exponential backoff delay retry loop (`Math.pow(2, attempt) * 200`) directly inside `request()` method.
  - **Architectural Boundary Audit**: Process / Network Boundary. Crosses the boundary from client process to remote API server over HTTP.

---

### 14. `apps/api/src/routes/automation.ts`

- **Basic Information**:
  - **File Path**: [`apps/api/src/routes/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/automation.ts)
  - **Layer**: API Server Router
  - **Module**: Automation API Routes
  - **Responsibility**: Defining Hono OpenAPI router endpoints for automation sequences and executions (`POST /executions/start`).
- **Runtime Purpose**:
  - Receives incoming HTTP requests on the API server, extracts workspace context, parses request JSON, delegates to `AutomationService`, and formats standard API JSON responses.
- **Ownership**:
  - **Owns**: Endpoint path mapping (`/executions/start`), HTTP verb matching (`POST`), context workspace ID extraction (`getWorkspaceId`), JSON response wrapping (`successResponse`).
  - **Does NOT Own**: Domain business rules, database queries, execution state machine.
- **Dependencies**:
  - **Imports**: `@hono/zod-openapi`, `../services/automation/automation.service.js`, `../utils/index.js`, `../errors/index.js`.
  - **Imported By**: API master router (`apps/api/src/routes/index.ts`).
  - **Runtime Dependencies**: Hono context (`c`), `AutomationService`.
- **Entry Points**:
  - `automationRouter.post("/executions/start", async (c) => ...)` (Lines 74-80).
- **Exit Points**:
  - `getWorkspaceId(c)` (Line 75).
  - `c.req.json()` (Line 76).
  - `new AutomationService(wsId)` (Line 77).
  - `service.startExecution(body.sequenceId, body)` (Line 78).
  - `c.json(successResponse(exec))` (Line 79).
- **Data Flow**:
  - Input: Hono Context `c` containing request object and context variables (`workspaceId`).
  - Extraction: `wsId = c.get("workspaceId")`, `body = await c.req.json()`.
  - Service Call: `service.startExecution(body.sequenceId, body)`.
  - Output: `c.json({ success: true, data: exec, error: null })`.
- **Contracts**:
  - HTTP REST API Endpoint Contract.
  - Hono Middleware Context Contract.
- **Side Effects**:
  - Serves HTTP POST endpoint response.
- **Failure Modes**:
  - **Immediate Failure**: If `workspaceId` is missing in context, `getWorkspaceId` throws `ForbiddenError("Workspace context required.")`.
  - **Service Failure**: Exceptions thrown by `AutomationService` bubble up to Hono error handling middleware.
- **Replaceability**:
  - High. Can swap Hono for Express/Fastify without modifying `AutomationService`.
- **Confidence**: HIGH (Source code inspected, lines 1-97).
- **Classification**:
  - **Architectural Role**: API / Router
  - **Criticality**: Critical (API Endpoint Gateway).
  - **Single Responsibility Audit**: Follows Single Responsibility Principle. Acts as HTTP router delegating to domain service.
  - **Hidden Responsibilities**: None.
  - **Architectural Boundary Audit**: Network / Application Boundary. Receives external HTTP requests and delegates to internal API domain services.

---

### 15. `apps/api/src/services/automation/automation.service.ts`

- **Basic Information**:
  - **File Path**: [`apps/api/src/services/automation/automation.service.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/services/automation/automation.service.ts)
  - **Layer**: API Domain Service
  - **Module**: Automation Service
  - **Responsibility**: Implementing business logic for sequences, execution initialization, duplicate checking, status updates, and execution logging in MongoDB.
- **Runtime Purpose**:
  - Encapsulates backend business rules and MongoDB database operations for starting manual sequence executions.
- **Ownership**:
  - **Owns**: Execution duplicate prevention logic (`status: { $in: [RUNNING, WAITING, PENDING] }`), `SequenceExecutionModel` document initialization, execution step log creation (`logStep`), pushing logs to execution document array.
  - **Does NOT Own**: Desktop local SQLite caching, local desktop job scheduling, HTTP routing.
- **Dependencies**:
  - **Imports**: `../../db/models/sequence.model.js`, `../../db/models/sequence-execution.model.js`, `../../db/models/sequence-log.model.js`, `@leadforge/schema`.
  - **Imported By**: [`apps/api/src/routes/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/automation.ts).
  - **Runtime Dependencies**: Mongoose models (`SequenceModel`, `SequenceExecutionModel`, `SequenceLogModel`).
- **Entry Points**:
  - `startExecution(sequenceId: string, payload: { contactId?: string; companyId?: string })` (Lines 73-111).
- **Exit Points**:
  - `SequenceModel.findOne({ _id: sequenceId, workspaceId: this.workspaceId })` (Lines 74-77).
  - `SequenceExecutionModel.findOne(...)` (Lines 82-88).
  - `exec.save()` (Line 106).
  - `this.logStep(exec._id.toString(), 0, "TRIGGER", "SUCCESS", ...)` (Line 108).
- **Data Flow**:
  - Input: `sequenceId`, `payload = { contactId, companyId }`.
  - Verification: Queries `SequenceModel` by `_id` and `workspaceId`. Throws `Sequence not found` if null.
  - Duplicate Check: Queries `SequenceExecutionModel` for existing active execution for same `contactId`/`companyId`. If found, returns existing execution.
  - Document Creation: Instantiates `new SequenceExecutionModel({ _id, sequenceId, workspaceId: this.workspaceId, contactId, companyId, status: "PENDING", currentStep: 0, startedAt: new Date(), logs: [] })`.
  - Persistence: Calls `await exec.save()`.
  - Logging: Calls `this.logStep()` which creates `SequenceLogModel` document and calls `SequenceExecutionModel.findByIdAndUpdate` with `$push: { logs: ... }`.
  - Output: Returns saved Mongoose `SequenceExecution` document.
- **Contracts**:
  - Backend Domain Service Contract.
- **Side Effects**:
  - Inserts document into `sequence_executions` MongoDB collection.
  - Inserts document into `sequence_logs` MongoDB collection.
  - Updates `sequence_executions` document array via `$push`.
- **Failure Modes**:
  - **Immediate Failure**: If sequence ID does not exist in MongoDB for workspace, throws `Error("Sequence not found.")`.
  - **Database Error**: MongoDB connection failure throws exception during `.findOne()` or `.save()`.
- **Replaceability**:
  - Low. Contains the core backend business rules for execution creation and logging.
- **Confidence**: HIGH (Source code inspected, lines 1-170).
- **Classification**:
  - **Architectural Role**: Service / Business Logic
  - **Criticality**: Critical (Core Backend Business Logic & MongoDB Persister).
  - **Single Responsibility Audit**: Violates Single Responsibility Principle. Performs sequence validation, duplicate checking, execution creation, AND double-logs step history (writing to both `SequenceLog` collection AND `$push`ing to `SequenceExecution.logs` array).
  - **Hidden Responsibilities**: Performs dual logging: writes log records to `SequenceLogModel` collection AND pushes identical log entries into `SequenceExecutionModel.logs` array via `findByIdAndUpdate`.
  - **Architectural Boundary Audit**: Domain Logic / Database Boundary. Coordinates business rule validation and MongoDB persistence.

---

### 16. `apps/api/src/db/models/sequence.model.ts`

- **Basic Information**:
  - **File Path**: [`apps/api/src/db/models/sequence.model.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/db/models/sequence.model.ts)
  - **Layer**: MongoDB Data Model
  - **Module**: Sequence Model
  - **Responsibility**: Mongoose schema and model definition for the `sequences` collection.
- **Runtime Purpose**:
  - Defines the database schema, indexes, and type interfaces for sequence template documents stored in MongoDB.
- **Ownership**:
  - **Owns**: `sequenceSchema` structure, `{ workspaceId: 1, name: 1 }` index, workspace isolation plugin hook.
  - **Does NOT Own**: Business validation rules, HTTP response formatting.
- **Dependencies**:
  - **Imports**: `mongoose`, `../plugins/index.js` (`workspacePlugin`).
  - **Imported By**: [`apps/api/src/services/automation/automation.service.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/services/automation/automation.service.ts).
- **Entry Points**:
  - `SequenceModel.findOne()`, `SequenceModel.find()` (Mongoose Model methods).
- **Exit Points**:
  - MongoDB wire protocol queries.
- **Data Flow**:
  - Compiles Mongoose query filters and maps raw MongoDB BSON documents to `SequenceDocument` TypeScript objects.
- **Contracts**:
  - Mongoose Document & Schema Contract.
- **Side Effects**:
  - Executes read queries against `sequences` MongoDB collection.
- **Failure Modes**:
  - **Immediate Failure**: Schema validation errors if required fields (`name`, `status`, `trigger`) are missing.
- **Replaceability**:
  - Low (MongoDB Schema definition).
- **Confidence**: HIGH (Source code inspected, lines 1-78).
- **Classification**:
  - **Architectural Role**: Database / Model
  - **Criticality**: Critical (Database Schema for Sequence Templates).
  - **Single Responsibility Audit**: Follows Single Responsibility Principle.
  - **Hidden Responsibilities**: Auto-generates String ObjectId for `_id` field if omitted (`default: () => new mongoose.Types.ObjectId().toString()`).
  - **Architectural Boundary Audit**: Database Persistence Layer.

---

### 17. `apps/api/src/db/models/sequence-execution.model.ts`

- **Basic Information**:
  - **File Path**: [`apps/api/src/db/models/sequence-execution.model.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/db/models/sequence-execution.model.ts)
  - **Layer**: MongoDB Data Model
  - **Module**: Sequence Execution Model
  - **Responsibility**: Mongoose schema and model definition for the `sequence_executions` collection.
- **Runtime Purpose**:
  - Defines database schema, status enums (`PENDING`, `RUNNING`, `WAITING`, `COMPLETED`, `FAILED`, `CANCELLED`), default values, and compound indexes for sequence execution state documents.
- **Ownership**:
  - **Owns**: `sequenceExecutionSchema` definition, compound index `{ workspaceId: 1, status: 1, nextExecutionAt: 1 }`, status enum constraints.
  - **Does NOT Own**: Service execution state transitions.
- **Dependencies**:
  - **Imports**: `mongoose`, `../plugins/index.js` (`workspacePlugin`).
  - **Imported By**: [`apps/api/src/services/automation/automation.service.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/services/automation/automation.service.ts).
- **Entry Points**:
  - `SequenceExecutionModel.findOne()`, `exec.save()`, `SequenceExecutionModel.findByIdAndUpdate()` (Mongoose Model methods).
- **Exit Points**:
  - MongoDB wire protocol writes and updates.
- **Data Flow**:
  - Receives model instantiation parameters -> validates against schema -> writes BSON document to `sequence_executions` collection.
- **Contracts**:
  - Mongoose Execution Schema Contract.
- **Side Effects**:
  - Disk write/update to MongoDB database (`sequence_executions` collection).
- **Failure Modes**:
  - **Immediate Failure**: Throws Mongoose ValidationError if `status` value is not in enum `["PENDING", "RUNNING", "WAITING", "COMPLETED", "FAILED", "CANCELLED"]` or if `sequenceId` is omitted.
- **Replaceability**:
  - Low (Core MongoDB document schema for executions).
- **Confidence**: HIGH (Source code inspected, lines 1-84).
- **Classification**:
  - **Architectural Role**: Database / Model
  - **Criticality**: Critical (Primary Database Target for Manual Executions).
  - **Single Responsibility Audit**: Follows Single Responsibility Principle. Defines execution document schema and indexes.
  - **Hidden Responsibilities**: Uses `Schema.Types.Mixed` for embedded `logs` array, allowing unstructured log objects to be embedded directly inside the execution document.
  - **Architectural Boundary Audit**: Database Persistence Layer.

---

### 18. `apps/api/src/db/models/sequence-log.model.ts`

- **Basic Information**:
  - **File Path**: [`apps/api/src/db/models/sequence-log.model.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/db/models/sequence-log.model.ts)
  - **Layer**: MongoDB Data Model
  - **Module**: Sequence Log Model
  - **Responsibility**: Mongoose schema and model definition for the `sequence_logs` collection.
- **Runtime Purpose**:
  - Defines the database schema and compound indexes (`{ workspaceId: 1, executionId: 1 }`) for execution audit trail logs stored in MongoDB.
- **Ownership**:
  - **Owns**: `sequenceLogSchema` structure, workspace indexing, default timestamp generation.
  - **Does NOT Own**: Log message generation.
- **Dependencies**:
  - **Imports**: `mongoose`, `../plugins/index.js` (`workspacePlugin`).
  - **Imported By**: [`apps/api/src/services/automation/automation.service.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/services/automation/automation.service.ts).
- **Entry Points**:
  - `log.save()`, `SequenceLogModel.find()` (Mongoose Model methods).
- **Exit Points**:
  - MongoDB wire protocol writes.
- **Data Flow**:
  - Receives `{ workspaceId, executionId, step, action, status, message }` -> writes BSON document to `sequence_logs` collection.
- **Contracts**:
  - Mongoose Log Schema Contract.
- **Side Effects**:
  - Disk write to MongoDB database (`sequence_logs` collection).
- **Failure Modes**:
  - **Immediate Failure**: Schema validation failure if `executionId`, `step`, `action`, or `status` are omitted.
- **Replaceability**:
  - Medium.
- **Confidence**: HIGH (Source code inspected, lines 1-57).
- **Classification**:
  - **Architectural Role**: Database / Model
  - **Criticality**: High (Audit trail log storage).
  - **Single Responsibility Audit**: Follows Single Responsibility Principle.
  - **Hidden Responsibilities**: None.
  - **Architectural Boundary Audit**: Database Persistence Layer.

---

### 19. `apps/api/src/db/plugins/workspace.plugin.ts`

- **Basic Information**:
  - **File Path**: [`apps/api/src/db/plugins/workspace.plugin.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/db/plugins/workspace.plugin.ts)
  - **Layer**: MongoDB Plugin / Middleware
  - **Module**: Workspace Scoping Plugin
  - **Responsibility**: Automatically enforcing workspace isolation across Mongoose queries and document saves.
- **Runtime Purpose**:
  - Intercepts Mongoose pre-find and pre-save hooks to automatically append `{ workspaceId }` to database operations, preventing cross-tenant data leaks.
- **Ownership**:
  - **Owns**: Mongoose middleware hooks (`pre('find')`, `pre('findOne')`, `pre('save')`), workspace ID schema field definition.
  - **Does NOT Own**: Business validation rules.
- **Dependencies**:
  - **Imports**: `mongoose`.
  - **Imported By**: `sequence.model.ts`, `sequence-execution.model.ts`, `sequence-log.model.ts`.
- **Entry Points**:
  - `workspacePlugin(schema)` (Plugin initializer function).
- **Exit Points**:
  - Intercepted Mongoose query execution.
- **Data Flow**:
  - Automatically injects `workspaceId: { type: String, required: true, index: true }` field onto schema and filters queries by active workspace context.
- **Contracts**:
  - Mongoose Plugin Middleware Contract.
- **Side Effects**:
  - Mutates Mongoose query filters and document attributes before database commands are sent to MongoDB.
- **Failure Modes**:
  - **Immediate Failure**: If document is saved without a `workspaceId`, pre-save hook throws validation exception.
- **Replaceability**:
  - Low (Core tenant security plugin for MongoDB).
- **Confidence**: HIGH (Source code inspected).
- **Classification**:
  - **Architectural Role**: Infrastructure / Middleware
  - **Criticality**: Critical (Multi-tenant security isolation engine).
  - **Single Responsibility Audit**: Follows Single Responsibility Principle.
  - **Hidden Responsibilities**: Implicitly alters query filter objects on all Mongoose read operations.
  - **Architectural Boundary Audit**: Database Infrastructure Layer.

---

## Architectural Boundary Audit

| File                        | Origin Boundary     | Destination Boundary      | Boundary Respected? | Boundary Violation Evidence                                                                                                                                                                    |
| :-------------------------- | :------------------ | :------------------------ | :------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AutomationScreen.tsx`      | Renderer UI         | Renderer Hooks            | YES                 | Calls `useStartSequence()` hook; does not touch IPC or Node.js directly.                                                                                                                       |
| `use-automation.ts`         | Renderer Hook       | Renderer Repository       | YES                 | Calls `SyncSequenceExecutionRepository.create()`; does not invoke IPC directly.                                                                                                                |
| `sync.ts`                   | Renderer Repository | Preload IPC Bridge        | YES                 | Invokes `window.ipc.invoke('sequence:start')`; delegates process crossing to preload.                                                                                                          |
| `preload/index.ts`          | Preload Script      | Main Process IPC          | YES                 | Validates channel against whitelist and delegates to `ipcRenderer.invoke()`.                                                                                                                   |
| `main/ipc/automation.ts`    | Main Process IPC    | Remote SDK & Local SQLite | NO                  | **Boundary Crossing Violation**: IPC handler receives trigger from UI, calls remote SDK over HTTP, AND writes directly to local SQLite database in one callback. Bypasses `JobScheduler`.      |
| `sdk/modules/automation.ts` | SDK Module          | SDK HTTP Transport        | YES                 | Formats endpoint path `/automation/executions/start` and passes to `HttpClient.post()`.                                                                                                        |
| `sdk/http/client.ts`        | SDK Client          | Remote API Server         | YES                 | Executes HTTP POST request over network using native `fetch()`.                                                                                                                                |
| `routes/automation.ts`      | API HTTP Router     | API Domain Service        | YES                 | Extracts workspace ID from HTTP context and delegates to `AutomationService`.                                                                                                                  |
| `automation.service.ts`     | API Domain Service  | MongoDB Database          | NO                  | **Dual Persistence Violation**: Creates `SequenceExecutionModel` document, creates `SequenceLogModel` document, AND pushes duplicate log object to `SequenceExecution.logs` array via `$push`. |
