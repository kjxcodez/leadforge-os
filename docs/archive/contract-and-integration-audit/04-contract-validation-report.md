# LeadForge OS — Contract Validation Report

This report consolidates and analyzes integration gaps, bugs, and architectural conflicts discovered between the Hono API, `@leadforge/sdk`, the Electron IPC layer, main process repositories, and the renderer application.

---

## 1. End-to-End Integration Matrix

The following matrix tracks the status of each system feature across all architectural layers.

| Feature Area | API Router | SDK Client | Electron IPC | Main Repository | SQLite DB | Renderer Service | Status & Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Workspaces** | YES | YES | YES | YES | YES | YES | **OK** |
| **Companies** | YES | YES | YES | YES | YES | YES | **OK (Local-first sync enabled)** |
| **Contacts** | YES | YES | YES | YES | YES | YES | **OK (Local-first sync enabled)** |
| **Campaigns** | YES | YES | YES | YES | YES | YES | **OK (Local-first sync enabled)** |
| **Outreach** | NO | YES | NO | NO | YES | NO | **BROKEN (API endpoints missing)** |
| **Discovery** | YES | YES | YES | NO | YES | YES | **OK (Scrapers query scheduler directly)** |
| **Automation** | YES | YES | YES | NO | YES | YES | **OK (Direct SDK path enabled)** |
| **Activities** | YES | YES | YES | YES | YES | YES | **OK (Local-first read cache)** |
| **Authentication**| YES | YES | YES | NO | YES | YES | **OK** |

---

## 2. Critical & Broken Integrations

### 2.1. Hono API Wildcard Path Bug Bypasses Middlewares (API ↔ SDK Mismatch)
* **Location**: [`apps/api/src/routes/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/index.ts#L26-L33)
* **Proven by Code**: The middleware protections are mounted using paths containing wildcards:
  ```typescript
  apiRouter.use("/companies/*", authMiddleware, workspaceMiddleware);
  ```
  In Hono, `/companies/*` matches sub-paths of `/companies/` (such as `/companies/` and `/companies/123`), but **does not** match the root route `/companies` (without trailing slash).
* **Impact**:
  When the SDK performs queries on resource list routes (e.g. calling `GET /companies` inside `sdk.companies.list()`), Hono routes the request to the handler, but completely **bypasses** both the `authMiddleware` and the `workspaceMiddleware`.
  Because the middleware is bypassed, the Hono context has no workspace context stored, causing `getWorkspaceId(c)` to throw `ForbiddenError("Workspace context required.")` and fail.
  Consequently, **all list requests sent directly via the SDK fail with 403 Forbidden**.

### 2.2. SQLite Schema Mismatch in Scraper Worker Task (Repository ↔ SQLite Mismatch)
* **Location**: [`apps/desktop/src/main/workers/plugins/scraper.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/scraper.ts#L82-L91)
* **Proven by Code**: The scraper worker writes scraped company entries into the workspace SQLite database:
  ```typescript
  db.prepare(`
    INSERT INTO sync_queue (id, workspaceId, entityType, entityId, operation, payload, retryCount, maxRetries, status, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, 'CREATE', ?, 0, 5, 'pending', datetime('now'), datetime('now'))
  `).run(...)
  ```
  However, migration `005_local_first_foundation` in [`database/runner.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/runner.ts#L320-L332) drops the old `sync_queue` table and recreates it with these columns:
  `id, workspaceId, entityType, entityId, operation, payload, version, retryCount, lastError, createdAt, updatedAt`
* **Impact**:
  The `sync_queue` table does **not** contain columns named `maxRetries` or `status`. Executing the scraper job crashes the worker thread instantly with `SqliteError: table sync_queue has no column named maxRetries`.
  This makes the Google Maps Scraper feature **completely broken**.

### 2.3. IPC Payload Destructuring & Mismatched Property Keys (Renderer ↔ IPC Mismatch)
We identified three independent workspace member operations that crash due to property/key mismatches:

1. **Workspace Invitations (`workspaces:members:invite`)**
   - **Renderer call** ([`workspace-service.ts:L74`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/services/workspace-service.ts#L74)):
     `window.ipc.invoke('workspaces:members:invite', { id, dto })` where `dto` contains `{ email, role }`.
   - **Main Handler** ([`ipc/workspace.ts:L41`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/workspace.ts#L41)):
     `sdk.workspaces.inviteMember(payload.workspaceId || payload.id, { email: payload.email, role: payload.role })`
   - **Mismatch**: The handler reads `payload.email` and `payload.role`, but the renderer wraps these properties inside `payload.dto` (e.g. `payload.dto.email`). As a result, the SDK receives `undefined` parameters.

2. **Workspace Member Role Changes (`workspaces:members:updateRole`)**
   - **Renderer call** ([`workspace-service.ts:L81`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/services/workspace-service.ts#L81)):
     `window.ipc.invoke('workspaces:members:updateRole', { id, memberId, role })`
   - **Main Handler** ([`ipc/workspace.ts:L46`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/workspace.ts#L46)):
     `sdk.workspaces.updateMemberRole(payload.id, payload.userId, payload.role)`
   - **Mismatch**: The handler extracts `payload.userId` from the payload, but the renderer passes it as `payload.memberId`. Because `userId` is `undefined`, the SDK role update fails.

3. **Workspace Member Removal (`workspaces:members:remove`)**
   - **Renderer call** ([`workspace-service.ts:L88`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/services/workspace-service.ts#L88)):
     `window.ipc.invoke('workspaces:members:remove', { id, memberId })`
   - **Main Handler** ([`ipc/workspace.ts:L51`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/workspace.ts#L51)):
     `sdk.workspaces.removeMember(payload.id, payload.userId)`
   - **Mismatch**: The handler reads `payload.userId`, but the renderer passes `payload.memberId`, causing member removal requests to crash.

### 2.4. Missing Workspace Scopes on IPC Screen Invocations (Renderer ↔ IPC Mismatch)
* **Location**: `CampaignsScreen.tsx` (lines 79, 87) & `AutomationScreen.tsx` (lines 86, 95)
* **Proven by Code**:
  - `CampaignsScreen.tsx` calls `window.ipc.invoke('campaigns:list', undefined)` and `window.ipc.invoke('contacts:list', {})`.
  - `AutomationScreen.tsx` calls `window.ipc.invoke('contacts:list', {})` and `window.ipc.invoke('campaigns:list', undefined)`.
  However, the Main process IPC handlers for these channels strictly require `workspaceId`:
  ```typescript
  safeRegister('contacts:list', async (_event, { workspaceId, filter }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    ...
  });
  ```
* **Impact**:
  Bypassing the repository abstractions and calling these channels directly without providing `workspaceId` causes instant query crashes. Consequently, **the Campaigns and Automation screens crash during initial load**.

### 2.5. Preload Security Boundary Blocks System Logging (IPC ↔ Preload Mismatch)
* **Location**: [`apps/desktop/src/main/lib/logger.ts:L121`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/lib/logger.ts#L121) and [`apps/desktop/src/preload/index.ts:L109-L126`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/preload/index.ts#L109-L126)
* **Proven by Code**:
  The main process logging service dispatches log events using:
  ```typescript
  win.webContents.send('system:log:event', record);
  ```
  However, the preload script enforces a strict whitelist check on listener channels:
  ```typescript
  const validChannels: Array<string> = [
    'companies:list',
    'companies:create',
    'system:status',
    'auth:login',
    'auth:register',
    'auth:logout',
    'auth:session',
    'workspaces:create',
    'workspaces:list',
  ];
  ```
* **Impact**:
  Because `'system:log:event'` is not in the preload script's whitelisted channels, the preload listener rejects the registration and throws `Error: Unauthorized IPC channel: system:log:event`. This blocks the renderer from receiving process logs.

---

## 3. Duplicate Queue Processing & Infinite Loops (Architectural Flaw)

An architectural conflict exists between the main process synchronization loop and the renderer process synchronization loop.

### The Conflict
1. **Main Process `SyncEngine`** ([`sync-engine.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/sync-engine.ts)):
   Checks the SQLite `sync_queue` table every 5 seconds. If items are found, it uses the SDK to sync them with the remote Hono API and deletes the item from `sync_queue` upon success.
2. **Renderer Process `SyncWorker`/`QueueProcessor`** ([`queue-processor.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/sync/queue-processor.ts)):
   Also checks the SQLite `sync_queue` table (every 60 seconds or on online reconnect). If items are found, it processes them sequentially.

### The Infinite Re-Queue Loop
When the renderer's `QueueProcessor` pops a `CREATE` company task, it calls:
```typescript
const serverRecord = await remoteRepo.create(parsed);
```
Where `remoteRepo` is `RemoteCompanyRepository` which resolves to:
```typescript
  async create(data: Record<string, any>): Promise<any> {
    return window.ipc.invoke('companies:create', data as any);
  },
```
This invokes the local IPC channel `companies:create`.
The local IPC handler in `crm.ts` calls:
```typescript
LocalCRMRepository.save('companies', record);
```
Inside `LocalCRMRepository.save()`, it performs local database writes and **appends a new CREATE task to the `sync_queue` table**.

Once the IPC call finishes, the renderer's `QueueProcessor` removes the original task:
```typescript
await window.ipc.invoke('db:queue:remove', { workspaceId, id });
```
This deletes the original task but leaves the new, identical task queued in `sync_queue`.

When the `QueueProcessor` runs again, it pops the new task and repeats the process. This generates **an infinite stream of duplicate sync tasks** without ever sending the data to the backend API server.

---

## 4. Dead Code & Unused Modules

* **Unused SDK Client Modules**:
  - `RemoteCompanyRepository`, `RemoteContactRepository`, `RemoteCampaignRepository`, `RemoteActivityRepository`, and `RemoteDiscoveryJobRepository` are declared in `remote.ts` and passed into `BaseSyncRepository` constructors.
  - However, `BaseSyncRepository` never references its `remoteRepo` constructor argument.
  - As a result, the SDK-wrapping remote repositories are completely unused. The renderer repository layer is decoupled from the SDK client.

* **Unused Background Worker Jobs**:
  - The child-process worker host ([`worker-host.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/worker-host.ts#L9-L10)) registers the `'enrich:website'` and `'outreach:campaign'` plugins.
  - However, the desktop app never submits jobs of these types to the database scheduler. The code for these background tasks is unused.

---

## 5. Mismatched CRM Entity Type Conversions

* **CRM Get By ID Mismatch**:
  - Preload types in `ipc/index.ts` specify the input parameter for `companies:get`, `contacts:get`, and `campaigns:get` as `string`.
  - The renderer remote repositories invoke these channels by passing raw ID strings:
    `window.ipc.invoke('companies:get', id)`
  - However, the main process handlers expect an object containing both the workspace ID and the entity ID:
    ```typescript
    safeRegister('companies:get', async (_event, { workspaceId, id }) => { ... })
    ```
  - When the main process tries to destructure the payload, both `workspaceId` and `id` evaluate to `undefined`, causing the handler to throw a validation error.
