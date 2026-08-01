# LeadForge OS — Complete Forensic Verification Report

> **Audit date**: 2026-07-17
> **Scope**: Every layer of the LeadForge OS monorepo — UI ↔ Repository ↔ IPC ↔ SQLite ↔ Sync ↔ SDK ↔ API ↔ MongoDB
> **Rule applied**: Every finding backed by file path, function name, and line number. No assumptions.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Part 1 — End-to-End Feature Verification](#part-1)
3. [Part 2 — Functional Verification Matrix](#part-2)
4. [Part 3 — UI → Repository Verification](#part-3)
5. [Part 4 — React Query Verification](#part-4)
6. [Part 5 — Repository Verification](#part-5)
7. [Part 6 — IPC Registry](#part-6)
8. [Part 7 — SDK Verification](#part-7)
9. [Part 8 — API Verification](#part-8)
10. [Part 9 — SQLite Verification](#part-9)
11. [Part 10 — Sync Queue Verification](#part-10)
12. [Part 11 — Worker Verification](#part-11)
13. [Part 12 — Runtime Logging](#part-12)
14. [Part 13 — Mock Data Audit](#part-13)
15. [Part 14 — Dead Code Audit](#part-14)
16. [Part 15 — Architecture Violations](#part-15)
17. [Deliverable 1 — Feature Verification Matrix](#d1)
18. [Deliverable 2 — Bug Register](#d2)
19. [Deliverable 3 — Architecture Violations](#d3)
20. [Deliverable 4 — Missing Implementations](#d4)
21. [Deliverable 5 — Dead Code Report](#d5)
22. [Deliverable 6 — Mock Data Report](#d6)
23. [Deliverable 7 — Runtime Logging Report](#d7)
24. [Deliverable 8 — Prioritized Repair Roadmap](#d8)

---

## 1. Architecture Overview {#1-architecture-overview}

The codebase is a **Turborepo monorepo** with the following packages:

| Package                 | Path                    | Purpose                                     |
| ----------------------- | ----------------------- | ------------------------------------------- |
| `apps/desktop`          | Electron app            | Main + Renderer + Preload (local-first CRM) |
| `apps/api`              | Hono-based REST API     | MongoDB backend, OpenAPI documented         |
| `apps/worker`           | **EMPTY directory**     | Intended worker service — never implemented |
| `apps/web`              | NOT VERIFIED            | Web frontend — not inspected                |
| `apps/docs`             | NOT VERIFIED            | Documentation site — not inspected          |
| `packages/sdk`          | HTTP SDK client         | Wraps API calls for Electron main process   |
| `packages/schema`       | Zod schemas + IPC types | Shared DTOs, entities, IPC channel map      |
| `packages/auth`         | NOT VERIFIED            | Auth utilities package                      |
| `packages/core`         | NOT VERIFIED            | Core shared utilities                       |
| `packages/integrations` | NOT VERIFIED            | Third-party integrations                    |
| `packages/logger`       | NOT VERIFIED            | Logger utilities                            |
| `packages/prompts`      | NOT VERIFIED            | AI prompt templates                         |
| `packages/workflows`    | NOT VERIFIED            | Workflow definitions                        |

**Data flow architecture** (intended):

```
React UI → SyncRepository → IPC invoke → Electron Main IPC handler
                                              ↓
                                     LocalCRMRepository (SQLite)
                                              ↓
                                     sync_queue INSERT (transactional)
                                              ↓
                             SyncEngine (Main Process, 5s poll)
                                    OR
                             QueueProcessor (Renderer, 60s poll)
                                              ↓
                                     SDK → API → MongoDB
```

---

## Part 1 — End-to-End Feature Verification {#part-1}

### Create Company — Full Trace

```
"+ Add Company" Button
  File: CompaniesScreen.tsx L134, L113
  Action: setCreateOpen(true)
    ↓
Dialog (shadcn/ui)
  File: CompaniesScreen.tsx L306-L313
    ↓
CompanyForm component
  File: components/crm/CompanyForm.tsx (exists per import at L10)
  Calls: onSubmit(data)
    ↓
handleCreate(data)
  File: CompaniesScreen.tsx L51-L54
  Calls: createMutation.mutateAsync(data)
    ↓
useCreateEntity(SyncCompanyRepository)
  File: hooks/useEntity.ts L38-L53
  mutationFn: repo.create({ ...data, workspaceId })
    ↓
BaseSyncRepository.create()
  File: repositories/sync.ts L87-L114
  DOMAIN_CHANNELS['companies'] EXISTS (L18-L25)
  Path taken: channels.create → window.ipc.invoke('companies:create', data)
    ↓
Preload bridge
  File: preload/index.ts L99-L100
  'companies:create' IS in validChannels (L55)
  Forwards to: ipcRenderer.invoke('companies:create', data)
    ↓
Main Process IPC Handler
  File: main/ipc/crm.ts L21-L24
  Handler: safeRegister('companies:create', async (_event, record) => ...)
  Calls: LocalCRMRepository.save('companies', record)
    ↓
LocalCRMRepository.save()
  File: main/database/repositories/local-crm.ts L48-L93
  1. Gets DB: getDatabase(workspaceId) — WORKSPACE-SCOPED SQLite
  2. INSERT OR REPLACE into companies table
  3. TRANSACTIONAL: Also inserts into sync_queue (L74-L88)
  Operation detected: 'CREATE' if new, 'UPDATE' if existing
    ↓
sync_queue populated
  Table: sync_queue
  Columns: id, workspaceId, entityType='companies', entityId, operation='CREATE',
           payload=JSON, version, retryCount=0
    ↓
SyncEngine (Main Process) — polls every 5s
  File: main/services/sync-engine.ts L38-L39
  OR
QueueProcessor (Renderer) — polls every 60s via SyncWorker
  File: renderer/sync/sync-worker.ts L28-L30
    ↓
SyncEngine.processQueue()
  File: main/services/sync-engine.ts L73-L141
  Pops from sync_queue, resolves SDK module:
    companies → sdk.companies.create(payload)
    ↓
SDK CompaniesModule.create()
  File: packages/sdk/src/modules/companies.ts L18-L19
  HTTP POST /companies via HttpClient
    ↓
API Route
  File: apps/api/src/routes/business.ts L516-L531
  companiesRouter.post("/") → CompanyService.createCompany()
  Also logs activity, triggers automation
    ↓
MongoDB write via Mongoose model
  File: apps/api/src/db/models/company.model.ts
    ↓
React Query Invalidation
  File: hooks/useEntity.ts L48-L51
  onSuccess: invalidateQueries(['companies', 'list', workspaceId])
    ↓
UI Re-renders with new company in the list
```

> [!IMPORTANT]
> **This flow is architecturally COMPLETE.** Every layer exists and is wired. The Create Company flow should work IF:
>
> 1. The `workspaceId` is properly set
> 2. The API server is reachable
> 3. The SQLite workspace database has been migrated

### Critical Finding: `id` Generation Gap

**BUG-001**: When `CompaniesScreen` calls `createMutation.mutateAsync(data)`, the `useCreateEntity` hook calls `repo.create({...data, workspaceId})`. In `BaseSyncRepository.create()` at [sync.ts L87-L93](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/sync.ts#L87-L93), when `DOMAIN_CHANNELS` exist (which they do for companies), it directly calls `window.ipc.invoke('companies:create', data)`. This passes the data straight to the CRM IPC handler.

In [crm.ts L21-L24](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/crm.ts#L21-L24), the handler calls `LocalCRMRepository.save('companies', record)`. In [local-crm.ts L48-L93](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/repositories/local-crm.ts#L48-L93), the `save()` method does `INSERT OR REPLACE` using `record.id`.

**The `id` is NEVER generated by the domain IPC path.** The `CompanyForm` would need to provide an `id` field, or the `BaseSyncRepository.create()` method's domain-channel path would need to generate one. In the fallback path (L96-L113), an `id` IS generated via `crypto.randomUUID()`, but the domain-channel path at L89-L93 skips this entirely.

If the form does not provide `record.id`, the SQLite `INSERT OR REPLACE` will fail or produce a record with `id = undefined`.

**Severity**: **P0 — Critical**
**Root cause**: [sync.ts L87-L93](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/sync.ts#L87-L93) — domain channel path does not generate UUID
**Also**: [crm.ts L21-L24](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/crm.ts#L21-L24) — handler does not generate UUID either

---

## Part 2 — Functional Verification Matrix {#part-2}

### Authentication

| Step                  | Status           | Evidence                                                                                                                                                                                                                                                                                                                                        |
| --------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login                 | ✅ WIRED         | [auth-service.ts L52-L58](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/services/auth-service.ts#L52-L58) → IPC `auth:login` → [auth.ts L13-L25](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/auth.ts#L13-L25) → `sdk.auth.login()` → POST `/auth/login` |
| Logout                | ✅ WIRED         | [auth-service.ts L75-L77](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/services/auth-service.ts#L75-L77) → IPC `auth:logout` → [auth.ts L41-L50](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/auth.ts#L41-L50) → clears token + workspace header        |
| Session Restore       | ✅ WIRED         | [useAuth.ts L53-L63](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/hooks/useAuth.ts#L53-L63) → `AuthService.restoreSession()` → IPC `auth:session` → `sdk.auth.session()` → GET `/auth/session`                                                                                                      |
| Session Persistence   | ⚠️ PARTIAL       | Token stored in main process memory only (`activeToken` variable in [index.ts L46](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/index.ts#L46)). **Not persisted to disk**. App restart loses session.                                                                                                   |
| Token Storage         | ❌ NOT PERSISTED | Token is an in-memory variable. No keychain, no localStorage, no file persistence. Session restore relies on backend cookie/session surviving.                                                                                                                                                                                                  |
| Protected Routes      | ✅ WIRED         | [guards.tsx L14-L27](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/router/guards.tsx#L14-L27) — checks `state.status === 'unauthenticated'` → redirect to `/auth/login`                                                                                                                              |
| Auth Middleware (API) | ✅ EXISTS        | [routes/index.ts L26-L33](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/index.ts#L26-L33) — `authMiddleware` + `workspaceMiddleware` applied to all business routes                                                                                                                                        |

### Workspace

| Step             | Status   | Evidence                                                                                                                                                                                                                                                                                                                                                           |
| ---------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Create           | ✅ WIRED | [useWorkspace.ts L22-L35](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/hooks/useWorkspace.ts#L22-L35) → IPC `workspaces:create` → [workspace.ts L8-L11](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/workspace.ts#L8-L11) → `sdk.workspaces.create()` → POST `/workspaces` |
| Update           | ✅ WIRED | Similar chain via IPC `workspaces:update`                                                                                                                                                                                                                                                                                                                          |
| Delete           | ✅ WIRED | Similar chain via IPC `workspaces:delete`                                                                                                                                                                                                                                                                                                                          |
| Switch           | ✅ WIRED | [workspace-store.tsx L98-L109](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/stores/workspace-store.tsx#L98-L109) → `WorkspaceService.syncActiveWorkspace()` → IPC `electron:setActiveWorkspace` → sets headers + persists to config.json + boots `WorkspaceRuntime`                                                    |
| Active Workspace | ✅ WIRED | Persisted via `config.json` in userData ([index.ts L14-L42](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/index.ts#L14-L42))                                                                                                                                                                                                |
| Member Invite    | ✅ WIRED | [useWorkspaceQuery.ts L43-L56](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/hooks/useWorkspaceQuery.ts#L43-L56) → IPC chain → SDK → API                                                                                                                                                                                |
| Role Update      | ✅ WIRED | Via `useUpdateMemberRole` hook                                                                                                                                                                                                                                                                                                                                     |

> [!WARNING]
> **BUG-002**: Workspace IPC handlers go **directly to SDK/API** and bypass local SQLite caching. The `workspaces` table exists in SQLite ([runner.ts L26-L36](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/runner.ts#L26-L36)) and `LocalWorkspaceRepository` exists ([local-workspace.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/repositories/local-workspace.ts)), but workspace IPC handlers NEVER write to SQLite. They always call `sdk.workspaces.*` directly. This means workspaces are **NOT available offline**.

### Companies

| Step        | Status         | Evidence                                                                                                                                                                                                  |
| ----------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create      | ⚠️ BUG-001     | Missing `id` generation in domain channel path                                                                                                                                                            |
| Update      | ✅ WIRED       | [sync.ts L116-L140](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/sync.ts#L116-L140) → IPC `companies:update` → `LocalCRMRepository.save()`       |
| Delete      | ✅ WIRED       | [sync.ts L142-L161](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/sync.ts#L142-L161) → IPC `companies:delete` → `LocalCRMRepository.softDelete()` |
| List        | ✅ WIRED       | `useEntityList(SyncCompanyRepository)` → IPC `companies:list` → `LocalCRMRepository.findMany()`                                                                                                           |
| Search      | ✅ CLIENT-SIDE | [CompaniesScreen.tsx L42-L49](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/screens/CompaniesScreen.tsx#L42-L49) — filters in-memory                           |
| Filtering   | ✅ CLIENT-SIDE | Status filter via `statusFilter` state                                                                                                                                                                    |
| Tags        | ✅ WIRED       | Via `updateMutation` passing `{ tags: newTags }`                                                                                                                                                          |
| Notes       | ✅ WIRED       | Via `updateMutation` passing `{ notes: json }`                                                                                                                                                            |
| Selection   | ✅ UI ONLY     | `selectedIds` state in [CompaniesScreen.tsx L26](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/screens/CompaniesScreen.tsx#L26)                                |
| Bulk Delete | ✅ WIRED       | [CompaniesScreen.tsx L73-L78](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/screens/CompaniesScreen.tsx#L73-L78) — Promise.all over deleteMutation             |
| Side Panel  | ✅ UI ONLY     | [CompaniesScreen.tsx L230-L303](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/screens/CompaniesScreen.tsx#L230-L303)                                           |

### Contacts

| Step               | Status       | Evidence                               |
| ------------------ | ------------ | -------------------------------------- |
| Create             | ⚠️ BUG-001   | Same id generation gap as Companies    |
| Update             | ✅ WIRED     | Same pattern as Companies              |
| Delete             | ✅ WIRED     | Same pattern as Companies              |
| List               | ✅ WIRED     | `useEntityList(SyncContactRepository)` |
| All other features | ✅ IDENTICAL | Same architecture as Companies         |

### Campaigns

| Step     | Status     | Evidence                                                                                                                                                                                                                      |
| -------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create   | ⚠️ BUG-001 | Same id generation gap                                                                                                                                                                                                        |
| CRUD     | ✅ WIRED   | Same pattern via `SyncCampaignRepository`                                                                                                                                                                                     |
| Schedule | ✅ WIRED   | IPC `campaigns:schedule` → [outreach.ts L43-L45](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/outreach.ts#L43-L45) → `sdk.campaigns.schedule()` → POST `/campaigns/{id}/schedule` |

### Discovery

| Step             | Status             | Evidence                                                                                                                                                                                                              |
| ---------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create Job       | ✅ API-ONLY        | IPC `discovery:create` → [discovery.ts L12-L14](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/discovery.ts#L12-L14) → `sdk.discovery.createJob()` → POST `/discovery/jobs` |
| List Jobs        | ✅ API-ONLY        | IPC `discovery:list` → `sdk.discovery.listJobs()`                                                                                                                                                                     |
| Results          | ✅ API-ONLY        | IPC `discovery:results` → `sdk.discovery.getJobResults()`                                                                                                                                                             |
| Import           | ✅ API-ONLY        | IPC `discovery:import` → `sdk.discovery.importResult()`                                                                                                                                                               |
| Skip             | ✅ API-ONLY        | IPC `discovery:skip` → `sdk.discovery.skipResult()`                                                                                                                                                                   |
| Local Worker     | ❌ NOT CONNECTED   | Discovery goes entirely through API. SQLite `discovery_jobs` / `discovery_results` tables exist but are NEVER written to from IPC handlers.                                                                           |
| Realtime updates | ❌ NOT IMPLEMENTED | No WebSocket, no SSE, no polling for job progress                                                                                                                                                                     |
| SQLite writes    | ❌ NEVER HAPPEN    | Discovery IPC handlers bypass SQLite entirely                                                                                                                                                                         |

> [!CAUTION]
> **BUG-003**: Discovery is 100% backend-dependent. All IPC handlers in [discovery.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/discovery.ts) call `sdk.discovery.*` directly. The SQLite tables `discovery_jobs` and `discovery_results` (created in migration [runner.ts L141-L183](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/runner.ts#L141-L183)) are NEVER read or written. Discovery is completely non-functional offline.

### Automation (Sequences)

| Step                 | Status             | Evidence                                                                                                                                                                     |
| -------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sequence CRUD        | ✅ API-ONLY        | IPC `sequence:*` → [automation.ts L7-L49](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/automation.ts#L7-L49) → `sdk.sequences.*` |
| Execution start/stop | ✅ API-ONLY        | IPC `sequence:start/stop` → `sdk.executions.start/stop()`                                                                                                                    |
| Execution logs       | ✅ API-ONLY        | IPC `execution:logs` → `sdk.executions.getLogs()`                                                                                                                            |
| Local SQLite         | ❌ NEVER USED      | Tables `sequences`, `sequence_executions`, `sequence_logs` exist but are never read/written from IPC                                                                         |
| Background worker    | ❌ NOT IMPLEMENTED | No local automation engine                                                                                                                                                   |

> **BUG-004**: Automation is 100% backend-dependent. Same issue as Discovery.

### Dashboard

| Widget                  | Data Source                                                       | Real/Mock         | Evidence                                                                                                                                                        |
| ----------------------- | ----------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Total Companies         | `useEntityList(SyncCompanyRepository)` → SQLite                   | ✅ REAL           | [DashboardScreen.tsx L24, L29](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/screens/DashboardScreen.tsx#L24)        |
| Total Contacts          | `useEntityList(SyncContactRepository)` → SQLite                   | ✅ REAL           | [DashboardScreen.tsx L25, L30](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/screens/DashboardScreen.tsx#L25)        |
| Outreach Campaigns      | `useEntityList(SyncCampaignRepository)` → SQLite                  | ✅ REAL           | [DashboardScreen.tsx L26, L31](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/screens/DashboardScreen.tsx#L26)        |
| System Uptime           | `'99.98%'`                                                        | ❌ **HARDCODED**  | [DashboardScreen.tsx L63](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/screens/DashboardScreen.tsx#L63)             |
| Outreach Activity Chart | `[35, 55, 75, 45, 65, 40, 50, 85, 60, 70, 48, 38]`                | ❌ **HARDCODED**  | [DashboardScreen.tsx L99](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/screens/DashboardScreen.tsx#L99)             |
| Recent Activity         | `useEntityList(SyncActivityRepository)` → SQLite activities table | ⚠️ REAL but empty | Activities table exists but nothing writes to it locally                                                                                                        |
| System Infrastructure   | `systemRunning` prop, hardcoded worker labels                     | ❌ **HARDCODED**  | [DashboardScreen.tsx L130-L145](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/screens/DashboardScreen.tsx#L130-L145) |
| Latency                 | `'42ms'` or `'Offline'`                                           | ❌ **HARDCODED**  | [DashboardScreen.tsx L152](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/screens/DashboardScreen.tsx#L152)           |
| IPC Status              | Passed as prop, hardcoded `"connected"`                           | ❌ **HARDCODED**  | [router/index.tsx L108](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/router/index.tsx#L108)                         |
| systemRunning           | Passed as prop, hardcoded `true`                                  | ❌ **HARDCODED**  | [router/index.tsx L106](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/router/index.tsx#L106)                         |
| onToggleSystem          | `() => {}`                                                        | ❌ **NOOP**       | [router/index.tsx L107](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/router/index.tsx#L107)                         |

---

## Part 3 — UI → Repository Verification {#part-3}

### CompaniesScreen Full Stack

```
CompaniesScreen (screens/CompaniesScreen.tsx)
  ↓ useEntityList(SyncCompanyRepository) → useQuery
  ↓ SyncCompanyRepository.listAndSync() → findMany()
  ↓ window.ipc.invoke('companies:list', {workspaceId, filter})
  ↓ [preload] validates channel → ipcRenderer.invoke
  ↓ [main/ipc/crm.ts] safeRegister('companies:list')
  ↓ LocalCRMRepository.findMany('companies', workspaceId, filter)
  ↓ getDatabase(workspaceId) → workspace-scoped SQLite
  ↓ SELECT * FROM companies WHERE workspaceId = ? AND deletedAt IS NULL
  ↓ Returns rows to renderer
  ↓ React Query caches, component renders table
```

**Sync to Remote** (background):

```
  SyncEngine (main/services/sync-engine.ts) polls every 5s
  ↓ SELECT * FROM sync_queue WHERE workspaceId = ?
  ↓ For each item: resolve SDK module → sdk.companies.create/update/delete
  ↓ DELETE FROM sync_queue WHERE id = ? (on success)
```

### ContactsScreen — IDENTICAL to CompaniesScreen

Uses `SyncContactRepository` which has the same `BaseSyncRepository` class with `tableName='contacts'` and `DOMAIN_CHANNELS['contacts']` mapping.

### CampaignsScreen — NOT VERIFIED in detail

Import exists in router. Uses `SyncCampaignRepository`. Same architecture.

### DiscoveryScreen — BROKEN PATH

```
DiscoveryScreen
  ↓ Uses SyncDiscoveryJobRepository (sync.ts L176)
  ↓ BaseSyncRepository with tableName='discovery_jobs'
  ↓ DOMAIN_CHANNELS does NOT have 'discovery_jobs' key (only companies, contacts, campaigns at L18-L40)
  ↓ Falls through to LEGACY PATH at L73: window.ipc.invoke('db:find', {tableName: 'discovery_jobs', ...})
  ↓ [main/ipc/database.ts] → LocalCRMRepository.findMany('discovery_jobs', ...)
  ↓ SQLite SELECT from discovery_jobs table
  ↓ Returns EMPTY (nothing ever writes to this table locally)
```

> [!CAUTION]
> **BUG-005**: DiscoveryScreen queries SQLite `discovery_jobs` table which is always empty. The discovery IPC handlers at [discovery.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/discovery.ts) go directly to SDK/API and never persist results to local SQLite. The screen may appear to work if the `SyncDiscoveryJobRepository` falls through to the `listAndSync` method, but `listAndSync` just calls `findMany` which reads from empty SQLite.

### AutomationScreen — SAME BROKEN PATTERN

Same issue: `SyncSequenceRepository` with tableName `'sequences'` has no `DOMAIN_CHANNELS` entry. Falls to legacy `db:find` path. SQLite `sequences` table is always empty.

---

## Part 4 — React Query Verification {#part-4}

| Entity            | Query Key                                     | Repository                   | Mutation Hooks                                          | Invalidation                       | Stale Time     | Workspace Isolation     |
| ----------------- | --------------------------------------------- | ---------------------------- | ------------------------------------------------------- | ---------------------------------- | -------------- | ----------------------- |
| Companies         | `['companies', 'list', workspaceId, filter]`  | `SyncCompanyRepository`      | `useCreateEntity`, `useUpdateEntity`, `useDeleteEntity` | ✅ on success                      | 5 min (global) | ✅ `workspaceId` in key |
| Contacts          | `['contacts', 'list', workspaceId, filter]`   | `SyncContactRepository`      | Same hooks                                              | ✅ on success                      | 5 min          | ✅                      |
| Campaigns         | `['campaigns', 'list', workspaceId, filter]`  | `SyncCampaignRepository`     | Same hooks                                              | ✅ on success                      | 5 min          | ✅                      |
| Activities        | `['activities', 'list', workspaceId, filter]` | `SyncActivityRepository`     | N/A (read-only)                                         | ✅ invalidated by entity mutations | 5 min          | ✅                      |
| Discovery         | `['discovery_jobs', 'list', workspaceId]`     | `SyncDiscoveryJobRepository` | NOT VERIFIED                                            | NOT VERIFIED                       | 5 min          | ✅                      |
| Sequences         | `['sequences', 'list', workspaceId]`          | `SyncSequenceRepository`     | NOT VERIFIED                                            | NOT VERIFIED                       | 5 min          | ✅                      |
| Workspace Members | `['workspace', wsId, 'members']`              | Direct IPC                   | Mutation hooks in useWorkspaceQuery.ts                  | ✅                                 | default        | ✅                      |
| Pending Invites   | `['user', 'invites', 'pending']`              | Direct IPC                   | Accept/Decline mutations                                | ✅                                 | default        | ❌ not workspace-scoped |

> [!NOTE]
> **Query key uses `repo.tableName`** ([useEntity.ts L12](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/hooks/useEntity.ts#L12)). This is the SQLite table name string, e.g. `'companies'`. This is correct and consistent.

> **BUG-006**: `useEntityList` uses `repo.tableName` as query key, but `BaseSyncRepository` constructor stores `tableName` as a `protected` property ([sync.ts L44](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/sync.ts#L44)). The `useEntityList` hook accesses `repo.tableName` which is NOT a public property accessor. In TypeScript strict mode, this would fail. In practice, it works because `protected` properties are accessible at runtime in JavaScript.

**Optimistic Updates**: ❌ NOT IMPLEMENTED — No `onMutate` handlers are defined in any mutation hook. All mutations wait for the async operation to complete before updating the UI.

**Workspace switching reset**: ✅ IMPLEMENTED — [workspace-store.tsx L108](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/stores/workspace-store.tsx#L108): `queryClient.resetQueries()` clears all caches on workspace switch.

---

## Part 5 — Repository Verification {#part-5}

### SyncCompanyRepository

| Aspect            | Value                                                                                         | Evidence                                                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local Repository  | `LocalCRMRepository` (via IPC `companies:*`)                                                  | [crm.ts L10-L24](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/crm.ts#L10-L24)                               |
| Remote Repository | `RemoteCompanyRepository` (passed but unused in domain path)                                  | [sync.ts L172](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/sync.ts#L172)                      |
| IPC Channels      | `companies:list`, `companies:get`, `companies:create`, `companies:update`, `companies:delete` | [sync.ts L19-L25](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/sync.ts#L19-L25)                |
| SDK Methods Used  | `sdk.companies.create/update/delete` (via SyncEngine)                                         | [sync-engine.ts L148](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/sync-engine.ts#L148)                |
| API Endpoints     | GET/POST/PATCH/DELETE `/companies`                                                            | [modules/companies.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/companies.ts)                            |
| Queue Operations  | sync_queue INSERT on save/saveMany/softDelete                                                 | [local-crm.ts L74-L88](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/repositories/local-crm.ts#L74-L88) |
| Offline           | ✅ Reads from SQLite, queues writes                                                           | Proven by architecture                                                                                                                                  |
| Online            | ✅ SyncEngine pushes queue to API                                                             | [sync-engine.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/sync-engine.ts)                          |

### SyncContactRepository / SyncCampaignRepository

IDENTICAL architecture to SyncCompanyRepository. Same `BaseSyncRepository` class, different table name.

### SyncDiscoveryJobRepository / SyncSequenceRepository / SyncSequenceExecutionRepository / SyncSequenceLogRepository

**⚠️ BROKEN**: These use `BaseSyncRepository` but:

1. No `DOMAIN_CHANNELS` entry → fall to legacy `db:find` path
2. The legacy path reads from SQLite which is always empty
3. The `remoteRepo` (e.g. `RemoteDiscoveryJobRepository`) is passed to constructor but **never used** by `BaseSyncRepository` in the domain-channel or fallback paths
4. These entities' IPC handlers go directly to SDK/API (not through `LocalCRMRepository`)

---

## Part 6 — IPC Registry {#part-6}

### Complete IPC Channel Registry

| Channel                                            | Registered In                                                                                                                           | Handler                          | Invoked By                   | Parameters                | DB Touched                    | SDK Used | Broken/Unused              |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ---------------------------- | ------------------------- | ----------------------------- | -------- | -------------------------- |
| `ipc:test`                                         | [auth.ts L63-L65](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/auth.ts#L63-L65)             | Returns `{status:'ok'}`          | Preload `test()`             | None                      | None                          | No       | ✅ Working                 |
| `auth:login`                                       | [auth.ts L13-L25](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/auth.ts#L13-L25)             | `sdk.auth.login()` + setToken    | AuthService                  | `{email, password}`       | None                          | ✅       | ✅ Working                 |
| `auth:register`                                    | [auth.ts L27-L39](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/auth.ts#L27-L39)             | `sdk.auth.register()` + setToken | AuthService                  | `{email, password, name}` | None                          | ✅       | ✅ Working                 |
| `auth:logout`                                      | [auth.ts L41-L50](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/auth.ts#L41-L50)             | `sdk.auth.logout()` + clear      | AuthService                  | None                      | None                          | ✅       | ✅ Working                 |
| `auth:session`                                     | [auth.ts L52-L54](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/auth.ts#L52-L54)             | `sdk.auth.session()`             | AuthService                  | None                      | None                          | ✅       | ✅ Working                 |
| `system:status`                                    | [auth.ts L56-L61](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/auth.ts#L56-L61)             | Returns hardcoded array          | NOT VERIFIED                 | None                      | None                          | No       | ❌ **MOCK**                |
| `companies:list`                                   | [crm.ts L10-L13](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/crm.ts#L10-L13)               | `LocalCRMRepository.findMany`    | SyncCompanyRepository        | `{workspaceId, filter}`   | SQLite companies              | No       | ✅ Working                 |
| `companies:get`                                    | [crm.ts L15-L19](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/crm.ts#L15-L19)               | `LocalCRMRepository.findById`    | SyncCompanyRepository        | `{workspaceId, id}`       | SQLite companies              | No       | ✅ Working                 |
| `companies:create`                                 | [crm.ts L21-L24](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/crm.ts#L21-L24)               | `LocalCRMRepository.save`        | SyncCompanyRepository        | record                    | SQLite companies + sync_queue | No       | ⚠️ BUG-001                 |
| `companies:update`                                 | [crm.ts L26-L29](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/crm.ts#L26-L29)               | `LocalCRMRepository.save`        | SyncCompanyRepository        | `{id, dto}`               | SQLite companies + sync_queue | No       | ✅ Working                 |
| `companies:delete`                                 | [crm.ts L31-L35](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/crm.ts#L31-L35)               | `LocalCRMRepository.softDelete`  | SyncCompanyRepository        | `{workspaceId, id}`       | SQLite companies + sync_queue | No       | ✅ Working                 |
| `contacts:list`                                    | [crm.ts L38-L41](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/crm.ts#L38-L41)               | Same pattern                     | SyncContactRepository        | Same                      | SQLite contacts               | No       | ✅                         |
| `contacts:get/create/update/delete`                | [crm.ts L43-L63](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/crm.ts#L43-L63)               | Same pattern                     | Same                         | Same                      | SQLite contacts               | No       | ⚠️ Same BUG-001 for create |
| `campaigns:list/get/create/update/delete`          | [crm.ts L65-L91](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/crm.ts#L65-L91)               | Same pattern                     | Same                         | Same                      | SQLite campaigns              | No       | ⚠️ Same BUG-001            |
| `activities:list`                                  | [crm.ts L93-L97](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/crm.ts#L93-L97)               | `LocalCRMRepository.findMany`    | SyncActivityRepository       | `{workspaceId, filter}`   | SQLite activities             | No       | ⚠️ Always empty            |
| `workspaces:*` (all 6)                             | [workspace.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/workspace.ts)                   | `sdk.workspaces.*`               | WorkspaceService             | Various                   | **None** (bypasses SQLite)    | ✅       | ✅ Working online          |
| `db:find/findById/save/saveMany/softDelete/delete` | [database.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/database.ts)                     | LocalCRMRepository               | Legacy fallback path         | Various                   | SQLite                        | No       | ✅ Working                 |
| `db:workspaces:findMany/saveMany`                  | [database.ts L48-L54](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/database.ts#L48-L54)     | LocalWorkspaceRepository         | NOT VERIFIED caller          | None / workspaces         | SQLite workspaces             | No       | ⚠️ Possibly unused         |
| `db:queue:*` (5 channels)                          | [database.ts L58-L81](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/database.ts#L58-L81)     | LocalQueueRepository             | QueueProcessor (renderer)    | Various                   | SQLite sync_queue             | No       | ✅ Working                 |
| `discovery:*` (6 channels)                         | [discovery.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/discovery.ts)                   | `sdk.discovery.*`                | RemoteDiscoveryJobRepository | Various                   | **None**                      | ✅       | ⚠️ API-only                |
| `email-accounts:*` (4)                             | [outreach.ts L9-L23](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/outreach.ts#L9-L23)       | `sdk.outreach.*`                 | NOT VERIFIED                 | Various                   | **None**                      | ✅       | ⚠️ API-only                |
| `templates:*` (4)                                  | [outreach.ts L26-L40](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/outreach.ts#L26-L40)     | `sdk.outreach.*`                 | NOT VERIFIED                 | Various                   | **None**                      | ✅       | ⚠️ API-only                |
| `campaigns:schedule`                               | [outreach.ts L43-L45](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/outreach.ts#L43-L45)     | `sdk.campaigns.schedule()`       | CampaignsScreen              | string id                 | **None**                      | ✅       | ⚠️ API-only                |
| `sequence:*` (5)                                   | [automation.ts L9-L27](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/automation.ts#L9-L27)   | `sdk.sequences.*`                | Remote repos                 | Various                   | **None**                      | ✅       | ⚠️ API-only                |
| `sequence:start/stop`                              | [automation.ts L30-L36](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/automation.ts#L30-L36) | `sdk.executions.*`               | Remote repos                 | Various                   | **None**                      | ✅       | ⚠️ API-only                |
| `execution:*` (3)                                  | [automation.ts L38-L48](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/automation.ts#L38-L48) | `sdk.executions.*`               | Remote repos                 | Various                   | **None**                      | ✅       | ⚠️ API-only                |
| `scheduler:jobs:*` (3)                             | [scheduler.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/scheduler.ts)                   | Direct SQLite                    | DiscoveryScreen (probably)   | Various                   | SQLite jobs                   | No       | ✅ Working                 |
| `electron:*` (5)                                   | [electron.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/electron.ts)                     | Native Electron                  | WorkspaceService + UI        | Various                   | config.json                   | No       | ✅ Working                 |

---

## Part 7 — SDK Verification {#part-7}

| Module             | Methods                                                                                                                                                   | HTTP Verb                     | Endpoint                                                       | Used By IPC                       | Unused Methods                    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------- | --------------------------------- | --------------------------------- |
| `AuthModule`       | `login`, `register`, `logout`, `session`                                                                                                                  | POST, POST, POST, GET         | `/auth/login`, `/auth/signup`, `/auth/logout`, `/auth/session` | All used by auth.ts               | None                              |
| `CompaniesModule`  | `list`, `get`, `create`, `update`, `delete`                                                                                                               | GET, GET, POST, PATCH, DELETE | `/companies*`                                                  | Used by SyncEngine                | None                              |
| `ContactsModule`   | `list`, `get`, `create`, `update`, `delete`                                                                                                               | GET, GET, POST, PATCH, DELETE | `/contacts*`                                                   | Used by SyncEngine                | None                              |
| `CampaignsModule`  | `list`, `get`, `create`, `update`, `delete`, `schedule`                                                                                                   | Various                       | `/campaigns*`                                                  | Used by SyncEngine + outreach IPC | None                              |
| `WorkspacesModule` | 13 methods                                                                                                                                                | Various                       | `/workspaces*`                                                 | All used by workspace.ts          | None                              |
| `DiscoveryModule`  | `listJobs`, `createJob`, `getJob`, `getJobResults`, `importResult`, `skipResult`                                                                          | Various                       | `/discovery/*`                                                 | All used by discovery.ts          | None                              |
| `OutreachModule`   | `list`, `send`, `listAccounts`, `createAccount`, `deleteAccount`, `verifyAccount`, `listTemplates`, `createTemplate`, `deleteTemplate`, `previewTemplate` | Various                       | `/outreach/*`                                                  | Most used by outreach.ts          | ❌ `list()` and `send()` — UNUSED |
| `SequencesModule`  | `list`, `get`, `create`, `update`, `delete`                                                                                                               | Various                       | `/automation/sequences*`                                       | All used by automation.ts         | None                              |
| `ExecutionsModule` | `list`, `get`, `start`, `stop`, `getLogs`                                                                                                                 | Various                       | `/automation/executions*`                                      | All used by automation.ts         | None                              |
| `HealthModule`     | NOT VERIFIED                                                                                                                                              | GET                           | `/health`                                                      | NOT VERIFIED                      | NOT VERIFIED                      |
| `ActivitiesModule` | NOT VERIFIED                                                                                                                                              | GET                           | `/activities`                                                  | NOT VERIFIED                      | NOT VERIFIED                      |

> [!WARNING]
> **BUG-007**: `OutreachModule.list()` and `OutreachModule.send()` are defined in [outreach.ts L17-L26](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/outreach.ts#L17-L26) but never called by any IPC handler. These are dead code.

### SDK ↔ API Contract Verification

| SDK Method                  | SDK Endpoint                   | API Route Path                                                                                                                                             | Match?       |
| --------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `auth.login()`              | POST `/auth/login`             | Router at `/auth` → handler                                                                                                                                | ✅           |
| `auth.register()`           | POST `/auth/signup`            | Depends on auth router config                                                                                                                              | NOT VERIFIED |
| `companies.create()`        | POST `/companies`              | `companiesRouter.post("/")` at [business.ts L516](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L516)     | ✅           |
| `companies.update()`        | PATCH `/companies/{id}`        | `companiesRouter.patch("/:id")` at [business.ts L533](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L533) | ✅           |
| `workspaces.inviteMember()` | POST `/workspaces/{id}/invite` | `inviteMemberRoute` at [business.ts L199](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L199)             | ✅           |
| All discovery endpoints     | Various `/discovery/*`         | `discoveryRouter.*` at [business.ts L448-L495](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L448-L495)   | ✅           |

> [!IMPORTANT]
> **BUG-008**: `WorkspaceService.inviteMember()` in [workspace-service.ts L73-L74](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/services/workspace-service.ts#L73-L74) sends `{ id, dto }` to IPC, but the IPC handler at [workspace.ts L39-L42](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/workspace.ts#L39-L42) destructures `payload.workspaceId || payload.id` and `payload.email, payload.role`. The renderer passes `{ id, dto: { email, role } }` but the IPC handler expects `payload.email` and `payload.role` at the top level. The email and role would be in `payload.dto`, not `payload` directly. **This is a payload mismatch bug**.

---

## Part 8 — API Verification {#part-8}

| Endpoint                                | Method                | Route File                                                                                                                        | Service                           | Repository          | Model                                       | Used?       |
| --------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------- | ------------------------------------------- | ----------- |
| `/health`                               | GET                   | routes/health/                                                                                                                    | N/A                               | N/A                 | N/A                                         | ✅          |
| `/auth/login`                           | POST                  | routes/auth/                                                                                                                      | Auth (Better Auth)                | UserRepository      | User                                        | ✅          |
| `/companies` (CRUD)                     | GET/POST/PATCH/DELETE | [business.ts L499-L559](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L499-L559) | CompanyService                    | CompanyRepository   | company.model                               | ✅          |
| `/contacts` (CRUD)                      | GET/POST/PATCH/DELETE | [business.ts L563-L652](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L563-L652) | ContactService                    | ContactRepository   | contact.model                               | ✅          |
| `/campaigns` (CRUD+schedule)            | Various               | [business.ts L656-L720](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L656-L720) | CampaignService + OutreachService | CampaignRepository  | campaign.model                              | ✅          |
| `/workspaces` (CRUD+members+invites)    | Various               | [business.ts L55-L409](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L55-L409)   | WorkspaceService                  | WorkspaceRepository | workspace.model                             | ✅          |
| `/discovery` (jobs+results+import+skip) | Various               | [business.ts L448-L495](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L448-L495) | DiscoveryService                  | N/A                 | discovery-job.model, discovery-result.model | ✅          |
| `/discovery/search`                     | POST                  | [business.ts L415-L446](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L415-L446) | **NONE** — returns hardcoded data | None                | None                                        | ❌ **MOCK** |
| `/outreach/accounts` (CRUD+verify)      | Various               | [business.ts L724-L753](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L724-L753) | OutreachService                   | OutreachRepository  | email-account.model                         | ✅          |
| `/outreach/templates` (CRUD+preview)    | Various               | [business.ts L755-L785](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L755-L785) | OutreachService                   | OutreachRepository  | email-template.model                        | ✅          |
| `/activities`                           | GET                   | [business.ts L789-L796](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L789-L796) | ActivityService                   | ActivityRepository  | activity.model                              | ✅          |
| `/automation/*`                         | Various               | [routes/automation.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/automation.ts)          | AutomationService                 | N/A                 | sequence.model etc.                         | ✅          |

---

## Part 9 — SQLite Verification {#part-9}

| Table                 | Who Writes                                                    | Who Reads                                               | Who Syncs                              | Never Used By                                                     |
| --------------------- | ------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------- |
| `users`               | ❌ NOBODY                                                     | ❌ NOBODY                                               | ❌ NOBODY                              | **Completely unused**                                             |
| `workspaces`          | `LocalWorkspaceRepository.save/saveMany`                      | `LocalWorkspaceRepository.findMany/findById`            | ❌ No sync                             | IPC `db:workspaces:*` handlers exist but callers are NOT VERIFIED |
| `companies`           | `LocalCRMRepository.save` via IPC `companies:create/update`   | `LocalCRMRepository.findMany` via IPC `companies:list`  | ✅ SyncEngine                          | ✅ Working                                                        |
| `contacts`            | Same as companies                                             | Same                                                    | ✅ SyncEngine                          | ✅ Working                                                        |
| `campaigns`           | Same as companies                                             | Same                                                    | ✅ SyncEngine                          | ✅ Working                                                        |
| `activities`          | ❌ NOBODY locally                                             | `LocalCRMRepository.findMany` via IPC `activities:list` | ❌ No sync                             | Always returns empty                                              |
| `outreach`            | ❌ NOBODY                                                     | ❌ NOBODY                                               | ❌ NOBODY                              | **Completely unused**                                             |
| `settings`            | ❌ NOBODY                                                     | ❌ NOBODY                                               | ❌ NOBODY                              | **Completely unused**                                             |
| `sync_queue`          | `LocalCRMRepository.save/saveMany/softDelete` (transactional) | SyncEngine + QueueProcessor + `db:queue:*`              | Processed by SyncEngine/QueueProcessor | ✅ Working                                                        |
| `sync_metadata`       | ❌ NOBODY                                                     | ❌ NOBODY                                               | ❌ NOBODY                              | **Completely unused**                                             |
| `discovery_jobs`      | ❌ NOBODY                                                     | Falls through from SyncDiscoveryJobRepository           | ❌ NOBODY                              | Always empty                                                      |
| `discovery_results`   | ❌ NOBODY                                                     | ❌ NOBODY                                               | ❌ NOBODY                              | **Completely unused**                                             |
| `email_accounts`      | ❌ NOBODY                                                     | ❌ NOBODY                                               | ❌ NOBODY                              | **Completely unused**                                             |
| `templates`           | ❌ NOBODY                                                     | ❌ NOBODY                                               | ❌ NOBODY                              | **Completely unused**                                             |
| `sequences`           | ❌ NOBODY                                                     | Falls through from SyncSequenceRepository               | ❌ NOBODY                              | Always empty                                                      |
| `sequence_executions` | ❌ NOBODY                                                     | Falls through                                           | ❌ NOBODY                              | Always empty                                                      |
| `sequence_logs`       | ❌ NOBODY                                                     | Falls through                                           | ❌ NOBODY                              | Always empty                                                      |
| `jobs`                | `scheduler:jobs:submit` IPC handler                           | `scheduler:jobs:list` IPC handler + JobScheduler tick   | N/A (local-only)                       | ✅ Working                                                        |
| `system_logs`         | `AppLogger.log()`                                             | ❌ No reader in IPC                                     | N/A                                    | Writes exist but no reader exposed                                |
| `_migrations`         | Migration runner                                              | Migration runner                                        | N/A                                    | ✅ Working                                                        |

> [!CAUTION]
> **BUG-009**: 10 out of 20 SQLite tables are **completely unused** or **always empty**. The tables `users`, `outreach`, `settings`, `sync_metadata`, `discovery_jobs`, `discovery_results`, `email_accounts`, `templates`, `sequences`, `sequence_executions`, `sequence_logs` have no local write path.

---

## Part 10 — Sync Queue Verification {#part-10}

| Operation           | Status             | Evidence                                                                                                                                                                        |
| ------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Insert              | ✅                 | `LocalCRMRepository.save/saveMany/softDelete` — transactional INSERT into sync_queue                                                                                            |
| Read                | ✅                 | SyncEngine reads all pending, QueueProcessor pops oldest                                                                                                                        |
| Retry               | ✅                 | SyncEngine increments `retryCount` on failure. QueueProcessor stops at `retryCount < 5`                                                                                         |
| Delete              | ✅                 | Removed after successful sync                                                                                                                                                   |
| Failure             | ✅                 | Error stored in `lastError` column                                                                                                                                              |
| Recovery            | ⚠️                 | SyncEngine retries on next 5s tick. No max retry limit in SyncEngine (unlike QueueProcessor's limit of 5)                                                                       |
| Conflict Resolution | ⚠️ LAST-WRITE-WINS | No version comparison. SyncEngine comment says "Last-Write-Wins"                                                                                                                |
| Offline mode        | ✅                 | QueueProcessor checks `navigator.onLine`. SyncEngine checks for network errors and suspends                                                                                     |
| Online mode         | ✅                 | SyncWorker listens for `online` event at [sync-worker.ts L33](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/sync/sync-worker.ts#L33) |
| Queue processor     | ✅ **DUAL**        | Both SyncEngine (Main, 5s) and QueueProcessor (Renderer, 60s) process the same queue                                                                                            |

> [!WARNING]
> **BUG-010**: There are **TWO queue processors** running simultaneously:
>
> 1. `SyncEngine` in Main process ([sync-engine.ts L39](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/sync-engine.ts#L39)) — polls every 5 seconds
> 2. `QueueProcessor` in Renderer process ([queue-processor.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/sync/queue-processor.ts)) via `SyncWorker` — polls every 60 seconds
>
> Both read from the same `sync_queue` table. This can cause **duplicate API calls** — SyncEngine processes an item, then QueueProcessor picks the same item before it's deleted. The SyncEngine reads ALL pending items without removing them first (no atomic pop), then processes and deletes one-by-one. Race condition is possible.

> [!NOTE]
> **BUG-011**: The `SyncWorker` is defined but **never started**. Searching the codebase, there is no call to `SyncWorker.start()`. The `SyncWorker` at [sync-worker.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/sync/sync-worker.ts) exports the object but it requires an explicit `start(queryClient, workspaceId)` call. No component or provider calls this. The renderer-side sync is **dead code**.

---

## Part 11 — Worker Verification {#part-11}

### Main Process Workers

| Worker               | File                                                                                                                                          | Status         | Evidence                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | -------------------------------------------------------- |
| **JobScheduler**     | [scheduler.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/scheduler.ts)                    | ✅ IMPLEMENTED | Polls every 1s, forks child processes, manages lifecycle |
| **SyncEngine**       | [sync-engine.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/sync-engine.ts)                | ✅ IMPLEMENTED | Polls every 5s, processes sync_queue                     |
| **WorkerHost**       | [worker-host.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/worker-host.ts)                 | ✅ IMPLEMENTED | Receives job via IPC, executes registered plugin         |
| **Scraper Plugin**   | [plugins/scraper.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/scraper.ts)         | EXISTS         | Not verified contents                                    |
| **Enricher Plugin**  | [plugins/enricher.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/enricher.ts)       | EXISTS         | Not verified contents                                    |
| **Outreach Plugin**  | [plugins/outreach.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/outreach.ts)       | EXISTS         | Not verified contents                                    |
| **Mock Test Plugin** | [worker-host.ts L15-L29](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/worker-host.ts#L15-L29) | ✅ MOCK        | Simulates 10 stages with 500ms delay                     |

### Renderer Workers

| Worker             | File                                                                                                                                   | Status           | Evidence                                         |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------ |
| **SyncWorker**     | [sync-worker.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/sync/sync-worker.ts)         | ❌ NEVER STARTED | Defined but `start()` never called anywhere      |
| **QueueProcessor** | [queue-processor.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/sync/queue-processor.ts) | ❌ DEAD CODE     | Only called by SyncWorker which is never started |

### External Workers

| Worker        | Location                                                                                   | Status                 |
| ------------- | ------------------------------------------------------------------------------------------ | ---------------------- |
| `apps/worker` | [apps/worker/](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/worker) | ❌ **EMPTY DIRECTORY** |

### Worker Lifecycle

| Aspect             | JobScheduler                                                         | SyncEngine                               |
| ------------------ | -------------------------------------------------------------------- | ---------------------------------------- |
| Entry point        | `WorkspaceRuntime.start()`                                           | `WorkspaceRuntime.start()`               |
| Trigger            | `WorkspaceManager.setActiveWorkspace()` → `WorkspaceRuntime.start()` | Same                                     |
| Start              | `setInterval(tick, 1000)`                                            | `setInterval(tick, 5000)`                |
| Stop               | `clearInterval` + `SIGTERM` all workers                              | `clearInterval`                          |
| SQLite interaction | Reads `jobs` table, updates status                                   | Reads/deletes `sync_queue` table         |
| Events emitted     | `job:started/progress/completed/failed/cancelled`                    | `sync:started/progress/completed/failed` |
| Cancellation       | ✅ Via `SIGTERM` to child process                                    | N/A                                      |

---

## Part 12 — Runtime Logging Report {#part-12}

| Observable                        | Status                    | Evidence                                                                                                                               |
| --------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Worker lifecycle                  | ✅                        | `AppLogger` writes to console + SQLite + JSONL file + IPC broadcast                                                                    |
| Discovery progress                | ❌ NOT OBSERVABLE         | Discovery goes through API, no local progress tracking                                                                                 |
| Queue processing (SyncEngine)     | ✅                        | `AppLogger.info/warn` calls throughout SyncEngine                                                                                      |
| Queue processing (QueueProcessor) | ⚠️ CONSOLE ONLY           | Uses `console.log/error` — not `AppLogger`                                                                                             |
| SQLite writes                     | ⚠️ PARTIAL                | `[SQLite]` console.log for migrations and connections, but not per-write                                                               |
| API failures                      | ✅                        | SDK `SdkError` thrown and caught by SyncEngine/handlers                                                                                |
| IPC failures                      | ⚠️ CONSOLE ONLY           | `console.error` in IPC handlers                                                                                                        |
| SDK failures                      | ✅                        | SdkError includes status code, message, code                                                                                           |
| Automation execution              | ❌ NOT LOCALLY OBSERVABLE | All automation runs on backend                                                                                                         |
| System log viewer                 | ❌ NOT EXPOSED            | `system_logs` table written but no IPC channel to read it                                                                              |
| Real-time log streaming           | ✅ PARTIAL                | `AppLogger` broadcasts via `win.webContents.send('system:log:event', record)` but renderer has no listener registered for this channel |

> [!WARNING]
> **BUG-012**: `AppLogger` sends real-time logs via IPC channel `system:log:event` ([logger.ts L119-L126](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/lib/logger.ts#L119-L126)), but:
>
> 1. `system:log:event` is NOT in the preload `validChannels` list for `on()` method
> 2. No renderer component subscribes to this channel
> 3. The `system_logs` table has no read IPC handler
>
> Result: Logs are written to console, SQLite, and files, but **never displayed in the UI**.

---

## Part 13 — Mock Data Audit {#part-13}

| Location                                                                                           | Type               | Classification                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard "System Uptime" = `'99.98%'`                                                             | Hardcoded string   | [DashboardScreen.tsx L63](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/screens/DashboardScreen.tsx#L63)             | **Accidentally shipped**              |
| Dashboard Outreach Chart data = `[35,55,75,45,...]`                                                | Hardcoded array    | [DashboardScreen.tsx L99](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/screens/DashboardScreen.tsx#L99)             | **Accidentally shipped**              |
| Dashboard Latency = `'42ms'`                                                                       | Hardcoded string   | [DashboardScreen.tsx L152](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/screens/DashboardScreen.tsx#L152)           | **Accidentally shipped**              |
| Dashboard `systemRunning = true`                                                                   | Hardcoded prop     | [router/index.tsx L106](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/router/index.tsx#L106)                         | **Accidentally shipped**              |
| Dashboard `ipcStatus = "connected"`                                                                | Hardcoded prop     | [router/index.tsx L108](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/router/index.tsx#L108)                         | **Accidentally shipped**              |
| Dashboard `onToggleSystem = () => {}`                                                              | Noop callback      | [router/index.tsx L107](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/router/index.tsx#L107)                         | **Accidentally shipped**              |
| Dashboard worker statuses (Job Worker, Scraper Engine, Email Worker)                               | Hardcoded labels   | [DashboardScreen.tsx L131-L134](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/screens/DashboardScreen.tsx#L131-L134) | **Accidentally shipped**              |
| `system:status` IPC = `[{name:'API Server',status:'online'},{name:'Database',status:'connected'}]` | Hardcoded response | [auth.ts L56-L61](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/auth.ts#L56-L61)                                     | **Accidentally shipped**              |
| Discovery `/search` endpoint returns hardcoded Acme Corp                                           | Mock API response  | [business.ts L436-L446](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L436-L446)                               | **Accidentally shipped**              |
| Worker mock test plugin                                                                            | Test/dev data      | [worker-host.ts L15-L29](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/worker-host.ts#L15-L29)                   | **Development-only**                  |
| Router "Coming Soon" placeholder                                                                   | UI placeholder     | [router/index.tsx L48-L55](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/router/index.tsx#L48-L55)                   | **Temporary** (used for Reports page) |

---

## Part 14 — Dead Code Audit {#part-14}

| Item                                            | Type                 | File                                                                                                                                             | Evidence                                                                       |
| ----------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `registerIpcHandler()`                          | Empty function       | [index.ts L107](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/index.ts#L107)                              | Empty function body, exported but never called                                 |
| `ipcHandlers` Map                               | Unused variable      | [index.ts L55](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/index.ts#L55)                                | Created but never populated or read                                            |
| `SyncWorker`                                    | Never started        | [sync-worker.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/sync/sync-worker.ts)                   | No call to `SyncWorker.start()` anywhere                                       |
| `QueueProcessor`                                | Never invoked        | [queue-processor.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/sync/queue-processor.ts)           | Only called by dead SyncWorker                                                 |
| `OutreachModule.list()`                         | Unused SDK method    | [outreach.ts L17-L22](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/outreach.ts#L17-L22)               | No IPC handler calls this                                                      |
| `OutreachModule.send()`                         | Unused SDK method    | [outreach.ts L24-L26](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/outreach.ts#L24-L26)               | No IPC handler calls this                                                      |
| `ISyncRepository.pushLocalMutations()`          | Empty implementation | [sync.ts L163-L165](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/sync.ts#L163-L165)     | Body is empty comment                                                          |
| `IRepository` interface                         | Unused               | [contracts.ts L4-L10](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/contracts.ts#L4-L10)         | Not directly implemented by any class                                          |
| `ILocalRepository` interface                    | Unused               | [contracts.ts L15-L18](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/contracts.ts#L15-L18)       | `LocalCRMRepository` is an object, not a class                                 |
| `IRemoteRepository` interface                   | Used but mismatched  | [contracts.ts L23-L29](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/contracts.ts#L23-L29)       | Remote repos implement it but `remoteRepo` is never used by BaseSyncRepository |
| `remoteRepo` constructor param                  | Unused               | [sync.ts L45-L46](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/sync.ts#L45-L46)         | Stored but never accessed                                                      |
| SQLite `users` table                            | Never used           | [runner.ts L14-L24](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/runner.ts#L14-L24)             | No read/write operations                                                       |
| SQLite `outreach` table                         | Never used           | [runner.ts L90-L99](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/runner.ts#L90-L99)             | No read/write operations                                                       |
| SQLite `settings` table                         | Never used           | [runner.ts L101-L110](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/runner.ts#L101-L110)         | No read/write operations                                                       |
| SQLite `sync_metadata` table                    | Never used           | [runner.ts L125-L132](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/runner.ts#L125-L132)         | No read/write operations                                                       |
| `apps/worker` directory                         | Empty                | [apps/worker/](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/worker)                                                       | Empty directory                                                                |
| `SessionRoute` component                        | Unused               | [guards.tsx L60-L69](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/router/guards.tsx#L60-L69)         | Defined but never rendered                                                     |
| `RemoteActivityRepository.create/update/delete` | Return null/void     | [remote.ts L90-L100](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/remote.ts#L90-L100)   | Stub implementations                                                           |
| `RemoteDiscoveryJobRepository.update/delete`    | Return null/void     | [remote.ts L119-L126](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/remote.ts#L119-L126) | Stub implementations                                                           |

---

## Part 15 — Architecture Violations {#part-15}

| Violation                                            | File                                                                                                                                                                                                                                                                    | Evidence                                                                                                                                         | Severity |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| **Renderer calling IPC db:queue directly**           | [queue-processor.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/sync/queue-processor.ts)                                                                                                                                  | Renderer-side QueueProcessor does remote API calls via RemoteRepositories and manages sync queue. This should be Main process only.              | Medium   |
| **Dual sync processors**                             | [sync-engine.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/sync-engine.ts) + [queue-processor.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/sync/queue-processor.ts) | Two separate systems (Main + Renderer) processing the same sync_queue. Duplication of responsibility.                                            | High     |
| **Discovery bypasses SQLite**                        | [discovery.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/discovery.ts)                                                                                                                                                   | IPC handlers go directly to SDK, bypassing local-first architecture                                                                              | High     |
| **Automation bypasses SQLite**                       | [automation.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/automation.ts)                                                                                                                                                 | Same violation as Discovery                                                                                                                      | High     |
| **Outreach bypasses SQLite**                         | [outreach.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/outreach.ts)                                                                                                                                                     | Same violation                                                                                                                                   | High     |
| **Workspace bypasses SQLite**                        | [workspace.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/workspace.ts)                                                                                                                                                   | SDK-direct, never caches locally                                                                                                                 | Medium   |
| **Business logic in UI**                             | [CompaniesScreen.tsx L42-L49](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/screens/CompaniesScreen.tsx#L42-L49)                                                                                                             | Search/filter logic done in-component instead of repository/query                                                                                | Low      |
| **Remote repository in renderer calls IPC directly** | [remote.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/remote.ts)                                                                                                                                            | `RemoteCompanyRepository` calls `window.ipc.invoke` directly, duplicating what the Sync repository already does                                  | Low      |
| **Migration runs on global DB only at startup**      | [index.ts L117](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/index.ts#L117)                                                                                                                                                     | `runMigrations()` at startup uses global DB. Workspace DBs get migrations via `WorkspaceRuntime.start()` but only when a workspace is activated. | Medium   |

---

## Deliverable 1 — Feature Verification Matrix {#d1}

| Feature          | UI  | Repository | IPC | SQLite     | Queue | Worker        | SDK | API | Mongo | Status             |
| ---------------- | --- | ---------- | --- | ---------- | ----- | ------------- | --- | --- | ----- | ------------------ |
| Auth Login       | ✅  | N/A        | ✅  | ❌         | ❌    | ❌            | ✅  | ✅  | ✅    | ✅ **WORKING**     |
| Auth Logout      | ✅  | N/A        | ✅  | ❌         | ❌    | ❌            | ✅  | ✅  | N/A   | ✅ **WORKING**     |
| Auth Session     | ✅  | N/A        | ✅  | ❌         | ❌    | ❌            | ✅  | ✅  | ✅    | ⚠️ No persistence  |
| Workspace Create | ✅  | N/A        | ✅  | ❌         | ❌    | ❌            | ✅  | ✅  | ✅    | ✅ Online only     |
| Workspace Switch | ✅  | N/A        | ✅  | ❌         | ❌    | ✅ Runtime    | ❌  | ❌  | ❌    | ✅ **WORKING**     |
| Company Create   | ✅  | ✅         | ✅  | ⚠️         | ✅    | ✅ SyncEngine | ✅  | ✅  | ✅    | ⚠️ **BUG-001**     |
| Company List     | ✅  | ✅         | ✅  | ✅         | ❌    | ❌            | ❌  | ❌  | ❌    | ✅ **WORKING**     |
| Company Update   | ✅  | ✅         | ✅  | ✅         | ✅    | ✅ SyncEngine | ✅  | ✅  | ✅    | ✅ **WORKING**     |
| Company Delete   | ✅  | ✅         | ✅  | ✅         | ✅    | ✅ SyncEngine | ✅  | ✅  | ✅    | ✅ **WORKING**     |
| Contact CRUD     | ✅  | ✅         | ✅  | ⚠️/✅      | ✅    | ✅            | ✅  | ✅  | ✅    | ⚠️ Same as Company |
| Campaign CRUD    | ✅  | ✅         | ✅  | ⚠️/✅      | ✅    | ✅            | ✅  | ✅  | ✅    | ⚠️ Same as Company |
| Discovery        | ✅  | ⚠️         | ✅  | ❌ Empty   | ❌    | ❌            | ✅  | ✅  | ✅    | ❌ **API-ONLY**    |
| Automation       | ✅  | ⚠️         | ✅  | ❌ Empty   | ❌    | ❌            | ✅  | ✅  | ✅    | ❌ **API-ONLY**    |
| Outreach         | ✅  | N/A        | ✅  | ❌         | ❌    | ❌            | ✅  | ✅  | ✅    | ❌ **API-ONLY**    |
| Dashboard        | ✅  | ✅ Partial | N/A | ✅ Partial | N/A   | N/A           | N/A | N/A | N/A   | ⚠️ **MOSTLY MOCK** |
| Member Invite    | ✅  | N/A        | ⚠️  | ❌         | ❌    | ❌            | ✅  | ✅  | ✅    | ⚠️ **BUG-008**     |

---

## Deliverable 2 — Bug Register {#d2}

| ID      | Severity | Title                                      | Root Cause                                                                                  | Files                                                                                                                                                                                                                                                                                                 |
| ------- | -------- | ------------------------------------------ | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BUG-001 | **P0**   | Create entity missing `id` generation      | Domain channel path in `BaseSyncRepository.create()` skips UUID generation                  | [sync.ts L87-L93](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/sync.ts#L87-L93), [crm.ts L21-L24](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/crm.ts#L21-L24)                                   |
| BUG-002 | **P1**   | Workspaces not cached in SQLite            | Workspace IPC handlers call SDK directly, never write to `LocalWorkspaceRepository`         | [workspace.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/workspace.ts)                                                                                                                                                                                 |
| BUG-003 | **P1**   | Discovery 100% backend-dependent           | All discovery IPC handlers call SDK directly, never write to local SQLite                   | [discovery.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/discovery.ts)                                                                                                                                                                                 |
| BUG-004 | **P1**   | Automation 100% backend-dependent          | Same as BUG-003 for automation                                                              | [automation.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/automation.ts)                                                                                                                                                                               |
| BUG-005 | **P1**   | DiscoveryScreen reads empty SQLite         | `SyncDiscoveryJobRepository` queries `discovery_jobs` table which is never populated        | [sync.ts L176](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/sync.ts#L176)                                                                                                                                                                    |
| BUG-006 | **P2**   | Protected member access in query key       | `repo.tableName` accessed from outside class (protected)                                    | [useEntity.ts L12](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/hooks/useEntity.ts#L12)                                                                                                                                                                   |
| BUG-007 | **P3**   | Unused SDK outreach methods                | `OutreachModule.list()` and `.send()` never called                                          | [outreach.ts L17-L26](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/outreach.ts#L17-L26)                                                                                                                                                                    |
| BUG-008 | **P1**   | Workspace invite payload mismatch          | Renderer sends `{ id, dto }`, IPC handler expects `payload.email, payload.role` flat        | [workspace-service.ts L73-L74](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/services/workspace-service.ts#L73-L74), [workspace.ts L39-L42](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/workspace.ts#L39-L42) |
| BUG-009 | **P2**   | 10+ unused SQLite tables                   | Tables created by migrations but never read or written                                      | [runner.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/runner.ts)                                                                                                                                                                                  |
| BUG-010 | **P1**   | Dual queue processors race condition       | SyncEngine (Main) and QueueProcessor (Renderer) both process sync_queue                     | [sync-engine.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/sync-engine.ts), [queue-processor.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/sync/queue-processor.ts)                                |
| BUG-011 | **P1**   | SyncWorker never started                   | `SyncWorker.start()` never called — renderer-side sync is dead code                         | [sync-worker.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/sync/sync-worker.ts)                                                                                                                                                                        |
| BUG-012 | **P2**   | System logs not displayed in UI            | `AppLogger` broadcasts logs but no renderer listener, no IPC read handler for `system_logs` | [logger.ts L119-L126](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/lib/logger.ts#L119-L126)                                                                                                                                                                   |
| BUG-013 | **P0**   | Token not persisted to disk                | `activeToken` is in-memory only; app restart loses session                                  | [index.ts L46](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/index.ts#L46)                                                                                                                                                                                     |
| BUG-014 | **P2**   | Discovery `/search` returns hardcoded mock | API endpoint returns fake Acme Corp data                                                    | [business.ts L436-L446](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L436-L446)                                                                                                                                                                     |

---

## Deliverable 3 — Architecture Violations {#d3}

See [Part 15](#part-15) above. Summary:

1. **Dual sync processors** — Main and Renderer both process sync_queue (HIGH)
2. **Discovery/Automation/Outreach bypass local-first** — Go straight to SDK (HIGH)
3. **Remote repository layer redundant** — remote.ts duplicates IPC calls already handled by sync.ts (MEDIUM)
4. **Business logic in UI components** — Search/filter in screen components (LOW)
5. **Global migration only at startup** — Workspace DBs only migrated when activated (MEDIUM)

---

## Deliverable 4 — Missing Implementations {#d4}

| Feature                       | What's Missing                                   | Current State                     |
| ----------------------------- | ------------------------------------------------ | --------------------------------- |
| Token persistence             | Secure storage (keychain/encrypted file)         | In-memory variable                |
| Discovery local worker        | Local scraping/enrichment without backend        | 100% API-dependent                |
| Automation local execution    | Local sequence execution engine                  | 100% API-dependent                |
| Outreach local SQLite caching | Local cache for email accounts/templates         | 100% API-dependent                |
| Dashboard real metrics        | Actual uptime, latency, chart data               | Hardcoded values                  |
| System log viewer             | UI component to display `system_logs`            | Table exists, no reader           |
| SyncWorker activation         | Start call in a provider/effect                  | Defined but dead                  |
| Optimistic UI updates         | `onMutate` handlers in React Query mutations     | Not implemented                   |
| `apps/worker` service         | Background job processing service                | Empty directory                   |
| Conflict resolution           | LWW implemented but no version comparison        | Comments mention it, not enforced |
| Activities local writes       | Something needs to populate the activities table | Only API writes activities        |
| Reports page                  | Full reporting feature                           | "Coming Soon" placeholder         |

---

## Deliverable 5 — Dead Code Report {#d5}

See [Part 14](#part-14) above.

**Key items**:

- `registerIpcHandler()` — empty exported function
- `ipcHandlers` Map — created, never used
- `SyncWorker` + `QueueProcessor` — renderer-side sync, never activated
- `OutreachModule.list()` and `.send()` — unused SDK methods
- `ISyncRepository.pushLocalMutations()` — empty method
- All remote repository instances passed to `BaseSyncRepository` — `remoteRepo` never accessed
- `SessionRoute` guard component — never rendered
- 6+ SQLite tables with zero I/O

---

## Deliverable 6 — Mock Data Report {#d6}

See [Part 13](#part-13) above.

**Summary**: 10 hardcoded/mock data points, all classified as "Accidentally Shipped" except the mock test worker plugin (Development-only) and "Coming Soon" placeholder (Temporary).

---

## Deliverable 7 — Runtime Logging Report {#d7}

See [Part 12](#part-12) above.

**Observable**: Worker lifecycle (via AppLogger), SyncEngine queue processing, SDK errors
**Missing**: Discovery progress, automation execution, system log viewer in UI, real-time log streaming to renderer

---

## Deliverable 8 — Prioritized Repair Roadmap {#d8}

### P0 — Critical (App-breaking)

#### P0-1: Fix entity ID generation in create flow

- **Problem**: BUG-001 — Create company/contact/campaign fails silently because no `id` is generated
- **Files**: [sync.ts L87-L93](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/sync.ts#L87-L93), [crm.ts L21-L24](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/crm.ts#L21-L24)
- **Fix**: Generate `crypto.randomUUID()` in `BaseSyncRepository.create()` before sending to IPC, or in the IPC handler itself
- **Dependencies**: None
- **Verification**: Create a company → verify it appears in SQLite with a valid UUID `id` → verify sync_queue entry

#### P0-2: Persist auth token to disk

- **Problem**: BUG-013 — Token lost on app restart
- **Files**: [index.ts L46](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/index.ts#L46), [auth.ts L16](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/auth.ts#L16)
- **Fix**: Write token to config.json alongside `activeWorkspaceId`, or use `safeStorage` / `keytar`
- **Dependencies**: None
- **Verification**: Login → close app → reopen → session restored without re-login

---

### P1 — High (Feature-breaking)

#### P1-1: Fix workspace invite payload mismatch

- **Problem**: BUG-008 — Invite member sends wrong payload structure
- **Files**: [workspace-service.ts L73-L74](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/services/workspace-service.ts#L73-L74), [workspace.ts L39-L42](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/workspace.ts#L39-L42)
- **Fix**: Align either the service payload or the IPC handler destructuring
- **Dependencies**: None
- **Verification**: Invite a member → verify API receives correct email and role

#### P1-2: Remove renderer-side sync (dead code) and consolidate to Main process

- **Problem**: BUG-010, BUG-011 — Dual sync, renderer side never starts
- **Files**: [sync-worker.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/sync/sync-worker.ts), [queue-processor.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/sync/queue-processor.ts)
- **Fix**: Delete renderer sync files. SyncEngine in Main process handles everything.
- **Dependencies**: None
- **Verification**: Create entity → sync_queue populated → SyncEngine processes within 5s → API call made → queue item removed

#### P1-3: Connect Discovery IPC handlers to local SQLite

- **Problem**: BUG-003, BUG-005 — Discovery reads empty local DB
- **Files**: [discovery.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/discovery.ts), `DOMAIN_CHANNELS` in [sync.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/sync.ts)
- **Fix**: IPC handlers should write API results to local SQLite tables, OR add discovery to `DOMAIN_CHANNELS` with local-first architecture
- **Dependencies**: Decide if discovery should be local-first or API-only
- **Verification**: Create discovery job → results visible offline in SQLite

#### P1-4: Connect Automation IPC handlers to local SQLite

- **Problem**: BUG-004 — Same as discovery
- **Files**: [automation.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/automation.ts)
- **Fix**: Same approach as P1-3
- **Dependencies**: P1-3 (use same pattern)
- **Verification**: Create sequence → visible in local SQLite

#### P1-5: Cache workspaces in local SQLite

- **Problem**: BUG-002 — Workspaces not available offline
- **Files**: [workspace.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/workspace.ts), [local-workspace.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/repositories/local-workspace.ts)
- **Fix**: Write SDK responses to `LocalWorkspaceRepository` in IPC handlers
- **Dependencies**: None
- **Verification**: List workspaces → kill API → list again → same results from SQLite

---

### P2 — Medium

#### P2-1: Replace all Dashboard hardcoded/mock data

- **Files**: [DashboardScreen.tsx](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/screens/DashboardScreen.tsx), [router/index.tsx L104-L111](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/router/index.tsx#L104-L111)
- **Dependencies**: P2-2 (needs log viewer for system status)

#### P2-2: Expose system_logs table via IPC + build log viewer

- **Files**: [logger.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/lib/logger.ts), new IPC handler, new UI component
- **Dependencies**: None

#### P2-3: Clean up unused SQLite tables

- **Files**: [runner.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/runner.ts)
- **Dependencies**: P1-3, P1-4 (may use these tables)

#### P2-4: Fix protected member access for query keys

- **Files**: [sync.ts L44](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/sync.ts#L44), [useEntity.ts L12](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/hooks/useEntity.ts#L12)
- **Fix**: Add public getter or make `tableName` public

---

### P3 — Low

#### P3-1: Remove dead code (`registerIpcHandler`, `ipcHandlers`, `SessionRoute`, unused remote repo stubs)

#### P3-2: Remove unused SDK methods (`OutreachModule.list/send`)

#### P3-3: Remove `remoteRepo` constructor parameter from `BaseSyncRepository`

#### P3-4: Implement optimistic updates in React Query mutations

#### P3-5: Remove discovery `/search` mock endpoint from API
