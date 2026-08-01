# LeadForge OS — IPC Registry Audit

This document inventories the Electron Inter-Process Communication (IPC) channels registered in the main process and accessed from the renderer.

---

## 1. IPC Registration Coordinator

IPC channels are registered using `safeRegister` (defined in [`helper.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/helper.ts#L7)) inside the entry coordinator `registerAllIpc` ([`register.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/register.ts#L17)).
`safeRegister` ensures that HMR hot reloads do not trigger Electron channel duplication crashes by removing old handlers before appending new ones.

---

## 2. IPC Channels Directory

### 2.1. Authentication channels
Registered in [`ipc/auth.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/auth.ts).

* **`auth:login`**
  - **Main Handler**: Calls `sdk.auth.login(payload)`, updates session token, sets workspace HTTP headers (lines 13-25).
  - **Input**: `{ email, password }`
  - **Output**: `AuthResponse`
  - **Renderer Caller**: `AuthService.login()` in [`services/auth-service.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/services/auth-service.ts#L52).

* **`auth:register`**
  - **Main Handler**: Calls `sdk.auth.register(payload)`, updates session token, sets workspace HTTP headers (lines 27-39).
  - **Input**: `{ email, password, name }`
  - **Output**: `AuthResponse`
  - **Renderer Caller**: `AuthService.register()` in [`services/auth-service.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/services/auth-service.ts#L64).

* **`auth:logout`**
  - **Main Handler**: Calls `sdk.auth.logout()`, clears token and workspace headers (lines 41-50).
  - **Input**: `void`
  - **Output**: `void`
  - **Renderer Caller**: `AuthService.logout()` in [`services/auth-service.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/services/auth-service.ts#L75).

* **`auth:session`**
  - **Main Handler**: Calls `sdk.auth.session()` (line 52).
  - **Input**: `void`
  - **Output**: Session payload or `null`
  - **Renderer Caller**: `AuthService.restoreSession()` in [`services/auth-store.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/services/auth-service.ts#L36).

* **`system:status`**
  - **Main Handler**: Returns hardcoded online status array (line 56).
  - **Input**: `void`
  - **Output**: `Array<{ name: string, status: string }>`
  - **Renderer Caller**: Unused by the renderer.

* **`ipc:test`**
  - **Main Handler**: Returns static ok payload (line 63).
  - **Input**: `void`
  - **Output**: `{ status: 'ok', timestamp: number }`
  - **Renderer Caller**: `ipc.test()` exposed on preload window context (line 5).

---

### 2.2. Workspace Management channels
Registered in [`ipc/workspace.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/workspace.ts).

* **`workspaces:create`**
  - **Main Handler**: Calls `sdk.workspaces.create(payload)` (line 8).
  - **Input**: `CreateWorkspaceDto`
  - **Output**: `Workspace`
  - **Renderer Caller**: `WorkspaceService.createWorkspace()` in [`services/workspace-service.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/services/workspace-service.ts#L29).

* **`workspaces:list`**
  - **Main Handler**: Calls `sdk.workspaces.list()` (line 13).
  - **Input**: `void`
  - **Output**: `Workspace[]`
  - **Renderer Caller**: `WorkspaceService.listWorkspaces()` in [`services/workspace-service.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/services/workspace-service.ts#L17).

* **`workspaces:update`**
  - **Main Handler**: Calls `sdk.workspaces.update(payload.id, payload.dto)` (line 18).
  - **Input**: `{ id: string, dto: UpdateWorkspaceDto }`
  - **Output**: `Workspace`
  - **Renderer Caller**: `WorkspaceService.updateWorkspace()` in [`services/workspace-service.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/services/workspace-service.ts#L38).

* **`workspaces:delete`**
  - **Main Handler**: Calls `sdk.workspaces.delete(id)` (line 23).
  - **Input**: `string` (or payload object containing `id` or `workspaceId`)
  - **Output**: `void`
  - **Renderer Caller**: `WorkspaceService.deleteWorkspace()` in [`services/workspace-service.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/services/workspace-service.ts#L47).

* **`workspaces:get`**
  - **Main Handler**: Calls `sdk.workspaces.get(id)` (line 28).
  - **Input**: `string`
  - **Output**: `Workspace`
  - **Renderer Caller**: `WorkspaceService.getWorkspace()` in [`services/workspace-service.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/services/workspace-service.ts#L54).

* **`workspaces:members:list`**
  - **Main Handler**: Calls `sdk.workspaces.listMembers(id)` (line 34).
  - **Input**: `string`
  - **Output**: `WorkspaceMember[]`
  - **Renderer Caller**: `WorkspaceService.listMembers()` in [`services/workspace-service.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/services/workspace-service.ts#L61).

* **`workspaces:members:invite`**
  - **Main Handler**: Calls `sdk.workspaces.inviteMember(id, dto)` (line 39).
  - **Input**: `{ id: string, dto: InviteMemberDto }` (Wait! In `workspace-service.ts` line 74: renderer passes `{ id, dto }`. But the main IPC handler does `sdk.workspaces.inviteMember(payload.workspaceId || payload.id, { email: payload.email, role: payload.role })`. Wait! `payload.dto` is completely ignored by the handler! It expects `email` and `role` to be spread on the root of `payload`!
    Let's check:
    ```typescript
    safeRegister('workspaces:members:invite', async (_event, payload) => {
      return sdk.workspaces.inviteMember(payload.workspaceId || payload.id, { email: payload.email, role: payload.role });
    });
    ```
    But `workspace-service.ts` calls it as:
    `window.ipc.invoke('workspaces:members:invite', { id, dto })` where `dto` is `{ email, role }`.
    Since `payload` is `{ id, dto }`, `payload.email` and `payload.role` are `undefined`!
    So this method fails and invites members with undefined email and role! This is a massive, proven bug.)
  - **Output**: `Workspace`
  - **Renderer Caller**: `WorkspaceService.inviteMember()` in [`services/workspace-service.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/services/workspace-service.ts#L73).

* **`workspaces:members:updateRole`**
  - **Main Handler**: Calls `sdk.workspaces.updateMemberRole(payload.id, payload.userId, payload.role)` (line 44).
  - **Input**: `{ id: string, userId: string, role: WorkspaceRole }` (Wait! In `workspace-service.ts` line 81: it invokes it with `{ id, memberId, role }`. So it passes `memberId`, but the main handler reads `payload.userId`!
    Since `memberId !== userId`, `payload.userId` will be `undefined`!
    So the SDK is called with `undefined` member ID, causing role updates to crash! This is another massive integration bug!)
  - **Output**: `Workspace`
  - **Renderer Caller**: `WorkspaceService.updateMemberRole()` in [`services/workspace-service.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/services/workspace-service.ts#L80).

* **`workspaces:members:remove`**
  - **Main Handler**: Calls `sdk.workspaces.removeMember(payload.id, payload.userId)` (line 49).
  - **Input**: `{ id: string, userId: string }` (Wait! In `workspace-service.ts` line 88: it invokes it with `{ id, memberId }`. So it passes `memberId`, but the main handler reads `payload.userId`!
    Since `memberId !== userId`, `payload.userId` will be `undefined`!
    So member removal will fail and crash! This is a third workspace integration bug!)
  - **Output**: `Workspace`
  - **Renderer Caller**: `WorkspaceService.removeMember()` in [`services/workspace-service.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/services/workspace-service.ts#L87).

* **`workspaces:members:leave`**
  - **Main Handler**: Calls `sdk.workspaces.leave(id)` (line 54).
  - **Input**: `string`
  - **Output**: `Workspace`
  - **Renderer Caller**: `WorkspaceService.leaveWorkspace()` in [`services/workspace-service.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/services/workspace-service.ts#L95).

* **`workspaces:members:transferOwnership`**
  - **Main Handler**: Calls `sdk.workspaces.transferOwnership(payload.id, payload.newOwnerId)` (line 59).
  - **Input**: `{ id: string, newOwnerId: string }`
  - **Output**: `Workspace`
  - **Renderer Caller**: `WorkspaceService.transferOwnership()` in [`services/workspace-service.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/services/workspace-service.ts#L101).

* **`workspaces:invites:list`**
  - **Main Handler**: Calls `sdk.workspaces.listPendingInvites()` (line 65).
  - **Input**: `void`
  - **Output**: `Workspace[]`
  - **Renderer Caller**: `WorkspaceService.listPendingInvites()` in [`services/workspace-service.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/services/workspace-service.ts#L108).

* **`workspaces:invites:accept`**
  - **Main Handler**: Calls `sdk.workspaces.acceptInvite(payload)` (line 70).
  - **Input**: `string` (Wait! In `workspace-service.ts` line 121: it passes `token` (string) as payload. But in `ipc/index.ts` type definition and in the SDK acceptInvite method, it is resolved correctly. Let's see: `sdk.workspaces.acceptInvite(payload)` expects a token string, which is correct.)
  - **Output**: `Workspace`
  - **Renderer Caller**: `WorkspaceService.acceptInvite()` in [`services/workspace-service.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/services/workspace-service.ts#L120).

* **`workspaces:invites:decline`**
  - **Main Handler**: Calls `sdk.workspaces.declineInvite(payload)` (line 75).
  - **Input**: `string`
  - **Output**: `Workspace`
  - **Renderer Caller**: `WorkspaceService.declineInvite()` in [`services/workspace-service.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/services/workspace-service.ts#L127).

---

### 2.3. CRM Cache channels (SQLite Caching Layer)
Registered in [`ipc/crm.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/crm.ts).

* **`companies:list`**
  - **Main Handler**: Queries local SQLite cache `companies` table using `LocalCRMRepository.findMany` (line 10).
  - **Input**: `{ workspaceId: string, filter?: any }`
  - **Output**: Array of cached companies
  - **Renderer Callers**:
    - `BaseSyncRepository.findMany()` in [`repositories/sync.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/sync.ts#L69).
    - Also called directly by the unused `RemoteCompanyRepository.list()`.

* **`companies:get`**
  - **Main Handler**: Queries local SQLite cache `companies` table by ID (line 15).
  - **Input**: `{ workspaceId: string, id: string }`
  - **Output**: Cached company record
  - **Renderer Callers**:
    - `BaseSyncRepository.findById()` in [`repositories/sync.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/sync.ts#L54).
    - **Broken caller**: `RemoteCompanyRepository.get(id)` in [`repositories/remote.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/remote.ts#L8) calls `window.ipc.invoke('companies:get', id)` passing raw ID string instead of the required object structure, causing crashes.

* **`companies:create`**
  - **Main Handler**: Writes new record to local SQLite cache table and inserts a `CREATE` transaction task in `sync_queue` table (line 21).
  - **Input**: `any` (expects company object containing `workspaceId`)
  - **Output**: Saved company record
  - **Renderer Callers**:
    - `BaseSyncRepository.create()` in [`repositories/sync.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/sync.ts#L92).
    - **Duplicate caller**: `RemoteCompanyRepository.create()` in [`repositories/remote.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/remote.ts#L15) also invokes this channel. Since the IPC handler inserts tasks in `sync_queue`, executing it in `QueueProcessor` creates infinite re-queue loops.

* **`companies:update`**
  - **Main Handler**: Overwrites local record in SQLite and appends an `UPDATE` transaction task in `sync_queue` table (line 26).
  - **Input**: `{ id: string, dto: any }`
  - **Output**: Updated company record
  - **Renderer Callers**:
    - `BaseSyncRepository.update()` in [`repositories/sync.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/sync.ts#L119).
    - **Duplicate/Broken caller**: `RemoteCompanyRepository.update()` in [`repositories/remote.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/remote.ts#L19).

* **`companies:delete`**
  - **Main Handler**: Marks record as soft-deleted in SQLite and queues a `DELETE` task in `sync_queue` table (line 31).
  - **Input**: `{ workspaceId: string, id: string }`
  - **Output**: `void`
  - **Renderer Callers**:
    - `BaseSyncRepository.delete()` in [`repositories/sync.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/sync.ts#L148).
    - **Broken caller**: `RemoteCompanyRepository.delete(id)` in [`repositories/remote.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/remote.ts#L24) calls `window.ipc.invoke('companies:delete', id)` passing raw ID string instead of the required object structure, causing crashes.

* **`contacts:list`**
  - **Main Handler**: Queries SQLite `contacts` table (line 38).
  - **Input**: `{ workspaceId: string, filter?: any }`
  - **Output**: Array of contacts
  - **Renderer Callers**:
    - `BaseSyncRepository.findMany()` in [`repositories/sync.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/sync.ts#L69).
    - Also called directly by the unused `RemoteContactRepository.list()`.
    - **Broken callers**:
      - `CampaignsScreen.tsx:L87` calls `window.ipc.invoke('contacts:list', {})` (passes empty object instead of `workspaceId`).
      - `AutomationScreen.tsx:L86` calls `window.ipc.invoke('contacts:list', {})` (passes empty object).
      Both of these trigger `workspaceId is required.` errors and crash the screens.

* **`contacts:get`**
  - **Main Handler**: Queries SQLite `contacts` table by ID (line 43).
  - **Input**: `{ workspaceId: string, id: string }`
  - **Output**: Contact record
  - **Renderer Callers**:
    - `BaseSyncRepository.findById()` in [`repositories/sync.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/sync.ts#L54).
    - **Broken caller**: `RemoteContactRepository.get(id)` in [`repositories/remote.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/remote.ts#L33) calls `window.ipc.invoke('contacts:get', id)` (raw ID string instead of object), causing crashes.

* **`contacts:create`**
  - **Main Handler**: Inserts contact into SQLite and schedules sync via `sync_queue` (line 49).
  - **Input**: Contact object (expects `workspaceId`)
  - **Output**: Contact record
  - **Renderer Callers**:
    - `BaseSyncRepository.create()` in `sync.ts`.
    - `RemoteContactRepository.create()` in `remote.ts`.

* **`contacts:update`**
  - **Main Handler**: Updates contact in SQLite and schedules sync (line 54).
  - **Input**: `{ id: string, dto: any }`
  - **Output**: Contact record
  - **Renderer Callers**:
    - `BaseSyncRepository.update()` in `sync.ts`.
    - `RemoteContactRepository.update()` in `remote.ts`.

* **`contacts:delete`**
  - **Main Handler**: Marks contact as soft-deleted in SQLite and schedules sync (line 59).
  - **Input**: `{ workspaceId: string, id: string }`
  - **Output**: `void`
  - **Renderer Callers**:
    - `BaseSyncRepository.delete()` in `sync.ts`.
    - **Broken caller**: `RemoteContactRepository.delete(id)` in [`repositories/remote.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/remote.ts#L49) calls `window.ipc.invoke('contacts:delete', id)` (passes raw ID string instead of object).

* **`campaigns:list`**
  - **Main Handler**: Queries SQLite `campaigns` table (line 66).
  - **Input**: `{ workspaceId: string, filter?: any }`
  - **Output**: Array of campaigns
  - **Renderer Callers**:
    - `BaseSyncRepository.findMany()` in `sync.ts`.
    - Also called directly by the unused `RemoteCampaignRepository.list()`.
    - **Broken callers**:
      - `CampaignsScreen.tsx:L79` calls `window.ipc.invoke('campaigns:list', undefined)` (passes `undefined` instead of `workspaceId`).
      - `AutomationScreen.tsx:L95` calls `window.ipc.invoke('campaigns:list', undefined)` (passes `undefined`).
      Both of these trigger `workspaceId is required.` errors and crash the screens.

* **`campaigns:get`**
  - **Main Handler**: Queries SQLite `campaigns` table by ID (line 71).
  - **Input**: `{ workspaceId: string, id: string }`
  - **Output**: Campaign record
  - **Renderer Callers**:
    - `BaseSyncRepository.findById()` in `sync.ts`.
    - **Broken caller**: `RemoteCampaignRepository.get(id)` in [`repositories/remote.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/remote.ts#L58) calls `window.ipc.invoke('campaigns:get', id)` (passes raw ID string).

* **`campaigns:create`**
  - **Main Handler**: Inserts campaign into SQLite and schedules sync (line 77).
  - **Input**: Campaign object
  - **Output**: Campaign record
  - **Renderer Callers**:
    - `BaseSyncRepository.create()` in `sync.ts`.
    - `RemoteCampaignRepository.create()` in `remote.ts`.

* **`campaigns:update`**
  - **Main Handler**: Updates campaign in SQLite and schedules sync (line 82).
  - **Input**: `{ id: string, dto: any }`
  - **Output**: Campaign record
  - **Renderer Callers**:
    - `BaseSyncRepository.update()` in `sync.ts`.
    - `RemoteCampaignRepository.update()` in `remote.ts`.

* **`campaigns:delete`**
  - **Main Handler**: Marks campaign as soft-deleted in SQLite and schedules sync (line 87).
  - **Input**: `{ workspaceId: string, id: string }`
  - **Output**: `void`
  - **Renderer Callers**:
    - `BaseSyncRepository.delete()` in `sync.ts`.
    - **Broken caller**: `RemoteCampaignRepository.delete(id)` in [`repositories/remote.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/remote.ts#L74) calls `window.ipc.invoke('campaigns:delete', id)`.

* **`activities:list`**
  - **Main Handler**: Queries SQLite `activities` table (line 94).
  - **Input**: `{ workspaceId: string, filter?: any }`
  - **Output**: Array of activities
  - **Renderer Callers**:
    - `BaseSyncRepository.findMany()` in `sync.ts`.
    - `RemoteActivityRepository.list()` in `remote.ts`.

---

### 2.4. Generic SQLite Database Cache channels
Registered in [`ipc/database.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/database.ts).

* **`db:find`** / **`db:findById`** / **`db:save`** / **`db:saveMany`** / **`db:softDelete`** / **`db:delete`**
  - **Main Handlers**: Accesses tables dynamically inside Mongoose-like SQLite connection helper.
  - **Renderer Callers**: Bypassed for CRM tables, but used as fallback for non-CRM tables like `discovery_jobs`, `sequences`, `sequence_executions`, and `sequence_logs` in [`repositories/sync.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/sync.ts).

* **`db:workspaces:findMany`** / **`db:workspaces:saveMany`**
  - **Main Handlers**: Directly queries or writes to `workspaces` table in the local global cache database.
  - **Renderer Callers**: Unused by the renderer.

* **`db:queue:push`** / **`db:queue:pop`** / **`db:queue:list`** / **`db:queue:update`** / **`db:queue:remove`**
  - **Main Handlers**: Manage offline mutation queue records in `sync_queue` table.
  - **Renderer Callers**: Invoked by `QueueProcessor` inside [`sync/queue-processor.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/sync/queue-processor.ts) and fallback write methods in [`repositories/sync.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/sync.ts).

---

### 2.5. Lead Discovery channels
Registered in [`ipc/discovery.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/discovery.ts).

* **`discovery:list`** / **`discovery:create`** / **`discovery:get`** / **`discovery:results`** / **`discovery:import`** / **`discovery:skip`**
  - **Main Handlers**: Directly call corresponding `sdk.discovery` methods.
  - **Renderer Callers**: Called by `RemoteDiscoveryJobRepository` in [`repositories/remote.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/remote.ts#L106-L126).
  - **Status**: **UNUSED BY RENDERER SCREEN** (The `DiscoveryScreen.tsx` bypasses these entirely and uses the native `scheduler:jobs` IPC channels to launch and poll scraper tasks).

---

### 2.6. Native Electron Window & OS utilities
Registered in [`ipc/electron.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/electron.ts).

* **`electron:setActiveWorkspace`** / **`electron:getActiveWorkspace`** / **`electron:version`** / **`electron:platform`** / **`electron:openUrl`** / **`electron:notify`**
  - **Main Handlers**: Interface with Electron lifecycle, set current workspace runtime context, trigger window shells and native OS notifications.
  - **Renderer Callers**: Called by `WorkspaceService` and `ElectronService` inside the renderer app.

---

### 2.7. Email Accounts & Templates (Outreach) channels
Registered in [`ipc/outreach.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/outreach.ts).

* **`email-accounts:list`** / **`email-accounts:create`** / **`email-accounts:delete`** / **`email-accounts:test`**
  - **Main Handlers**: Forward queries to `sdk.outreach.listAccounts()`, `createAccount()`, `deleteAccount()`, and `verifyAccount()`.
  - **Renderer Caller**: Called directly by `CampaignsScreen.tsx` (lines 63, 108, 126, 135).

* **`templates:list`** / **`templates:create`** / **`templates:delete`** / **`templates:preview`**
  - **Main Handlers**: Forward queries to `sdk.outreach` template methods.
  - **Renderer Caller**: Called directly by `CampaignsScreen.tsx` and `AutomationScreen.tsx`.

* **`campaigns:schedule`**
  - **Main Handler**: Forwards to `sdk.campaigns.schedule(id)` which triggers backend SMTP send loop (line 43).
  - **Input**: `string` (Campaign ID)
  - **Output**: `void`
  - **Renderer Caller**: Called directly by `CampaignsScreen.tsx` (line 181).

---

### 2.8. Automation Sequences & Executions channels
Registered in [`ipc/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/automation.ts).

* **`sequence:list`** / **`sequence:get`** / **`sequence:create`** / **`sequence:update`** / **`sequence:delete`**
  - **Main Handlers**: Forward requests directly to `sdk.sequences` methods.
  - **Renderer Callers**: Called by `RemoteSequenceRepository` in `remote.ts` and `AutomationScreen.tsx`.

* **`sequence:start`** / **`sequence:stop`** / **`execution:list`** / **`execution:get`** / **`execution:logs`**
  - **Main Handlers**: Forward requests directly to `sdk.executions` methods.
  - **Renderer Callers**: Called by `RemoteSequenceExecutionRepository` and `AutomationScreen.tsx`.

---

### 2.9. Concurrency Scheduler channels
Registered in [`ipc/scheduler.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/scheduler.ts).

* **`scheduler:jobs:submit`**
  - **Main Handler**: Inserts job metadata into the SQLite database `jobs` table inside a workspace (line 10).
  - **Input**: `{ workspaceId, type, payload, priority, maxRetries }`
  - **Output**: `{ id, workspaceId, type, status: 'queued' }`
  - **Renderer Caller**: `DiscoveryScreen.tsx` (line 69) to start Google Maps scraper jobs.

* **`scheduler:jobs:list`**
  - **Main Handler**: Selects all job rows from SQLite `jobs` table (line 35).
  - **Input**: `{ workspaceId }`
  - **Output**: `Job[]`
  - **Renderer Caller**: `DiscoveryScreen.tsx` (line 50) to display running scraper jobs.

* **`scheduler:jobs:cancel`**
  - **Main Handler**: Terminates active child processes via SIGTERM and updates status to `cancelled` in SQLite (line 49).
  - **Input**: `{ workspaceId, jobId }`
  - **Output**: `void`
  - **Renderer Caller**: `DiscoveryScreen.tsx` (line 85).

---

## IPC Registry Summary

* **Registered channels**: 83
* **Unused channels**: 1
  - `system:status` (registered in main process, but never called by the renderer or preload script).

* **Duplicate channels**: None (channels have distinct namespaces, although CRM and Generic DB cache paths duplicate functionality).
* **Renderer calling missing channels**: None.
* **Registered but never called by renderer**:
  - `discovery:list`
  - `discovery:create`
  - `discovery:get`
  - `discovery:results`
  - `discovery:import`
  - `discovery:skip`
  - `db:workspaces:findMany`
  - `db:workspaces:saveMany`
  All other registered channels are called by the renderer.

* **Called but never registered**: None (All `window.ipc.invoke` calls have a corresponding `safeRegister` handler).

* **Deprecated channels**: None.

* **Channels bypassing repository (direct to SQLite)**:
  - `scheduler:jobs:submit`
  - `scheduler:jobs:list`
  - `scheduler:jobs:cancel`
  These write directly to the local SQLite database.

* **Channels bypassing sync (direct to SDK)**:
  - `email-accounts:list`
  - `email-accounts:create`
  - `email-accounts:delete`
  - `email-accounts:test`
  - `templates:list`
  - `templates:create`
  - `templates:delete`
  - `templates:preview`
  - `campaigns:schedule`
  - `sequence:list`
  - `sequence:get`
  - `sequence:create`
  - `sequence:update`
  - `sequence:delete`
  - `sequence:start`
  - `sequence:stop`
  - `execution:list`
  - `execution:get`
  - `execution:logs`
  These call remote API servers via the SDK directly, bypassing the local SQLite caching layer.

* **Channels directly calling SDK**:
  - `auth:login`
  - `auth:register`
  - `auth:logout`
  - `auth:session`
  - `workspaces:create`
  - `workspaces:list`
  - `workspaces:update`
  - `workspaces:delete`
  - `workspaces:get`
  - `workspaces:members:list`
  - `workspaces:members:invite`
  - `workspaces:members:updateRole`
  - `workspaces:members:remove`
  - `workspaces:members:leave`
  - `workspaces:members:transferOwnership`
  - `workspaces:invites:list`
  - `workspaces:invites:accept`
  - `workspaces:invites:decline`
  - `discovery:list`
  - `discovery:create`
  - `discovery:get`
  - `discovery:results`
  - `discovery:import`
  - `discovery:skip`
  - All outreach and automation channels listed above.
