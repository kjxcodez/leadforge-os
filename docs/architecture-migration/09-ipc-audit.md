# LeadForge OS — IPC Forensic Audit

## 1. Overview & Preload Security Model
The renderer process (React UI) communicates with the Electron Main process exclusively over asynchronous IPC channels registered via `contextBridge` in [`apps/desktop/src/preload/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/preload/index.ts#L1-L80).

IPC channel handlers are registered in [`apps/desktop/src/main/ipc/register.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/register.ts) using `safeRegister` ([`helper.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/helper.ts)).

---

## 2. IPC Channel Registry Audit

| IPC Module File | Channel Names | Underlying Storage / Logic Executed | Target Simplification |
| :--- | :--- | :--- | :--- |
| **`crm.ts`** | `companies:list`, `companies:query`, `companies:get`, `companies:create`, `companies:update`, `companies:delete`, `contacts:*` | Tries `sdk.companies.create()` directly, falls back to `LocalCRMRepository.save()` in SQLite | Direct API write -> Mongo; local SQLite update is cache-only refresh |
| **`campaigns-ipc.ts`**| `campaigns:list`, `campaigns:get`, `campaigns:create`, `campaigns:update`, `campaigns:delete` | Direct SDK call + local SQLite cache write | Direct API write -> Mongo |
| **`audiences-ipc.ts`**| `audiences:list`, `audiences:create`, `audiences:update`, `audiences:delete` | Local SQLite `LocalCRMRepository` write | Direct API write -> Mongo |
| **`automation.ts`** | `sequences:list`, `sequences:create`, `sequences:update`, `sequences:executions:*` | Local SQLite `sequences` & `sequence_executions` | Direct API write -> Mongo |
| **`discovery-ipc.ts`** | `discovery:start`, `discovery:list-runs`, `discovery:get-run` | SDK call + local `discovery_runs` table | Direct API write -> Mongo |
| **`outreach.ts`** | `email:accounts:list`, `email:accounts:connect`, `templates:list`, `templates:create` | Local `email_accounts` & `templates` tables | Direct API write -> Mongo |
| **`scheduler.ts`** | `scheduler:jobs:list`, `scheduler:jobs:pause`, `scheduler:jobs:cancel` | Direct query on SQLite `jobs` table | API `/jobs` query |
| **`workspace.ts`** | `workspace:get-active`, `workspace:set-active`, `workspace:list` | `WorkspaceManager.setActiveWorkspace()` | `WorkspaceManager` switches Mongo workspace context |
| **`database.ts`** | `database:query-raw`, `database:reset` | Direct raw SQL execution on SQLite | Eliminate raw SQL mutation capabilities |

---

## 3. Impact of MongoDB-First Architecture on IPC
Currently, several IPC channels write to SQLite locally and flag `syncStatus = 'pending'`.
In the target architecture:
1. IPC write channels (e.g. `companies:create`) call the API (`SdkClient`) directly.
2. The API persists the authoritative record in MongoDB and returns the saved document with its MongoDB `_id`.
3. The IPC response updates/refreshes the local SQLite read-cache with the authoritative MongoDB document.
4. If the device is offline, write operations surface a clear network error rather than creating conflicting local-only IDs.
