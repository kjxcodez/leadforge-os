# LeadForge OS Forensic Architecture Audit — Part 3: Data Flow & Catalogs

This document provides a trace of data paths for all 12 platform entities, catalogs every API and IPC route, and documents the client SDK.

---

## 1. Data Flow Audit

For every major entity in LeadForge OS, data originates in the UI and travels through local repositories (reading/writing to SQLite via IPC) and background synchronization processes (draining sync queues to hit remote APIs via the SDK client to update MongoDB Atlas).

The table below lists the code files participating in each entity's pipeline:

| Entity | UI Screen | Custom Hook | Local Repo / Cache | Preload / IPC | SDK Client Module | Hono API Router | Backend Service / Repo | MongoDB / SQLite Tables |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **User** | `LoginScreen.tsx` / `RegisterScreen.tsx` | `useAuth.ts` | None | `preload/index.ts` / `ipc/auth.ts` | `sdk/src/modules/auth.ts` | `routes/auth/index.ts` | `UserService` | `users` collection / `users` table |
| **Workspace** | `WorkspaceSettingsScreen.tsx` | `useWorkspace.ts` | `local-workspace.ts` | `preload/index.ts` / `ipc/workspace.ts` | `sdk/src/modules/workspaces.ts` | `routes/business.ts` | `WorkspaceService` | `workspaces` collection / `workspaces` table |
| **Company** | `CompaniesScreen.tsx` | `useEntity.ts` | `local-crm.ts` (`companies`) | `preload/index.ts` / `ipc/crm.ts` | `sdk/src/modules/companies.ts` | `routes/business.ts` | `CompanyService` / `CompanyRepository` | `companies` collection / `companies` table |
| **Contact** | `ContactsScreen.tsx` | `useEntity.ts` | `local-crm.ts` (`contacts`) | `preload/index.ts` / `ipc/crm.ts` | `sdk/src/modules/contacts.ts` | `routes/business.ts` | `ContactService` / `ContactRepository` | `contacts` collection / `contacts` table |
| **Campaign** | `CampaignsScreen.tsx` | `useEntity.ts` | `local-crm.ts` (`campaigns`) | `preload/index.ts` / `ipc/crm.ts` | `sdk/src/modules/campaigns.ts` | `routes/business.ts` | `CampaignService` / `CampaignRepository` | `campaigns` collection / `campaigns` table |
| **Discovery Job** | `DiscoveryScreen.tsx` | `useWorkspaceQuery.ts` | `local-crm.ts` (`discovery_jobs`) | `preload/index.ts` / `ipc/discovery.ts` | `sdk/src/modules/discovery.ts` | `routes/business.ts` | `DiscoveryService` | `discoveryjobs` collection / `discovery_jobs` table |
| **Discovery Result**| `DiscoveryScreen.tsx` | `useWorkspaceQuery.ts` | `local-crm.ts` (`discovery_results`) | `preload/index.ts` / `ipc/discovery.ts` | `sdk/src/modules/discovery.ts` | `routes/business.ts` | `DiscoveryService` | `discoveryresults` / `discovery_results` table |
| **Email Account** | `SettingsScreen.tsx` | `useWorkspaceQuery.ts` | `local-crm.ts` (`email_accounts`) | `preload/index.ts` / `ipc/outreach.ts` | `sdk/src/modules/outreach.ts` | `routes/business.ts` | `OutreachService` | `emailaccounts` / `email_accounts` table |
| **Template** | `SettingsScreen.tsx` | `useWorkspaceQuery.ts` | `local-crm.ts` (`templates`) | `preload/index.ts` / `ipc/outreach.ts` | `sdk/src/modules/outreach.ts` | `routes/business.ts` | `OutreachService` | `emailtemplates` / `templates` table |
| **Sequence** | `AutomationScreen.tsx` | `useWorkspaceQuery.ts` | `local-crm.ts` (`sequences`) | `preload/index.ts` / `ipc/automation.ts` | `sdk/src/modules/automation.ts`| `routes/automation.ts` | `AutomationService` | `sequences` collection / `sequences` table |
| **Execution** | `AutomationScreen.tsx` | `useWorkspaceQuery.ts` | `local-crm.ts` (`sequence_executions`)| `preload/index.ts` / `ipc/automation.ts` | `sdk/src/modules/automation.ts`| `routes/automation.ts` | `AutomationService` | `sequenceexecutions` / `sequence_executions` table |
| **Activity** | `DashboardScreen.tsx` | `useWorkspaceQuery.ts` | `local-crm.ts` (`activities`) | `preload/index.ts` / `ipc/crm.ts` | `sdk/src/modules/activities.ts`| `routes/business.ts` | `ActivityService` / `ActivityRepository` | `activities` collection / `activities` table |

---

## 2. API Catalog

All routes are mounted on `apps/api/src/routes/index.ts` under `/api/v1`.

### 2.1 Auth Routes (`/api/v1/auth/*`)
- **POST `/auth/login`**
  - Validation: `loginDtoSchema`
  - Handler: `auth.api.signInEmail` inside [routes/auth/index.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/auth/index.ts)
  - Security: None (public guest route)
  - Return Type: `AuthResponse` ({ token: string, user: UserDTO })
- **POST `/auth/signup`**
  - Validation: `registerDtoSchema`
  - Handler: `auth.api.signUpEmail`
  - Security: None (public guest route)
  - Return Type: `AuthResponse`
- **POST `/auth/logout`**
  - Handler: `auth.api.signOut`
  - Security: `authMiddleware`
  - Return Type: `{ success: boolean }`
- **GET `/auth/session`**
  - Handler: `auth.api.getSession`
  - Security: `authMiddleware`
  - Return Type: `SessionResponse` ({ token: string, user: UserDTO } | null)

### 2.2 Workspace Routes (`/api/v1/workspaces/*`)
- **GET `/workspaces`**
  - Handler: `WorkspaceService.listUserWorkspaces` inside [routes/business.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts)
  - Security: `authMiddleware`
  - Return Type: `Workspace[]`
- **POST `/workspaces`**
  - Validation: `createWorkspaceDtoSchema`
  - Handler: `WorkspaceService.createWorkspace`
  - Security: `authMiddleware`
  - Return Type: `Workspace`
- **PATCH `/workspaces/:id`**
  - Validation: `updateWorkspaceDtoSchema`
  - Handler: `WorkspaceService.updateWorkspace`
  - Security: `authMiddleware` + member check
  - Return Type: `Workspace`
- **DELETE `/workspaces/:id`**
  - Handler: `WorkspaceService.softDeleteWorkspace`
  - Security: `authMiddleware` + Owner check
  - Return Type: `{ success: true }`
- **POST `/workspaces/:id/invite`**
  - Validation: `inviteMemberDtoSchema`
  - Handler: `WorkspaceService.inviteMember`
  - Security: `authMiddleware` + Admin/Owner check
  - Return Type: `Workspace`
- **POST `/workspaces/invites/:token/accept`**
  - Handler: `WorkspaceService.acceptInvite`
  - Security: `authMiddleware`
  - Return Type: `Workspace`

### 2.3 CRM Business Routes (`/api/v1/*`)
Every route below is protected by `authMiddleware` and `workspaceMiddleware` (verifying workspace membership scoping headers).

- **GET `/companies`**: Queries workspace companies list.
- **GET `/companies/:id`**: Gets single company.
- **POST `/companies`**: Creates company. Validation: `createCompanyDtoSchema`.
- **PATCH `/companies/:id`**: Updates company. Validation: `updateCompanyDtoSchema`.
- **DELETE `/companies/:id`**: Soft-deletes company.
- **GET `/contacts`**: Queries contacts.
- **POST `/contacts`**: Creates contact. Validation: `createContactDtoSchema`.
- **PATCH `/contacts/:id`**: Updates contact. Validation: `updateContactDtoSchema`.
- **DELETE `/contacts/:id`**: Soft-deletes contact.
- **GET `/campaigns`**: Queries campaigns.
- **POST `/campaigns`**: Creates campaign. Validation: `createCampaignDtoSchema`.
- **PATCH `/campaigns/:id`**: Updates campaign. Validation: `updateCampaignDtoSchema`.
- **DELETE `/campaigns/:id`**: Soft-deletes campaign.
- **GET `/activities`**: Queries activities timeline.

### 2.4 Automation Routes (`/api/v1/automation/*`)
- **GET `/automation/sequences`**: Lists sequences.
- **POST `/automation/sequences`**: Creates sequence.
- **PATCH `/automation/sequences/:id`**: Updates sequence.
- **DELETE `/automation/sequences/:id`**: Deletes sequence.
- **POST `/automation/executions/start`**: Starts sequence execution on lead.
- **POST `/automation/executions/:id/stop`**: Halts active execution.
- **GET `/automation/executions/:id/logs`**: Fetches runtime logs.

---

## 3. IPC Catalog

The preload bridge `apps/desktop/src/preload/index.ts` exposes a strict list of channels accessed by `window.ipc.invoke`.

### 3.1 Session & System Channels
- **`auth:login`**: Triggers Sdk login endpoint. Main Handler: [ipc/auth.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/auth.ts). Returns: `AuthResponse`.
- **`auth:register`**: Triggers Sdk signup endpoint. Main Handler: `ipc/auth.ts`.
- **`auth:logout`**: Clears stored tokens in Main. Main Handler: `ipc/auth.ts`.
- **`auth:session`**: Restores user session. Main Handler: `ipc/auth.ts`.
- **`electron:setActiveWorkspace`**: Sets active workspace ID header and saves to `config.json`. Main Handler: [ipc/electron.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/electron.ts).
- **`electron:getActiveWorkspace`**: Retrieves active workspace ID from `config.json`. Main Handler: `ipc/electron.ts`.

### 3.2 Cache Database Channels (SQLite)
- **`db:find`**: Queries cached records by table and workspace ID. Main Handler: [ipc/database.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/database.ts).
- **`db:findById`**: Resolves cached item by ID. Main Handler: `ipc/database.ts`.
- **`db:save`**: Inserts/Updates a record. Main Handler: `ipc/database.ts`.
- **`db:saveMany`**: Bulk saves records. Main Handler: `ipc/database.ts`.
- **`db:softDelete`**: Flags a record as deleted locally. Main Handler: `ipc/database.ts`.
- **`db:delete`**: Hard deletes a record from local storage. Main Handler: `ipc/database.ts`.

### 3.3 Offline Queue Channels
- **`db:queue:push`**: Adds a task to local sync queue table. Main Handler: `ipc/database.ts`.
- **`db:queue:pop`**: Fetches the oldest pending task. Main Handler: `ipc/database.ts`.
- **`db:queue:update`**: Increments retry counts and logs errors. Main Handler: `ipc/database.ts`.
- **`db:queue:remove`**: Deletes completed tasks. Main Handler: `ipc/database.ts`.

---

## 4. SDK Documentation

The SDK `@leadforge/sdk` wraps HTTP requests. It resolves authentication tokens automatically on every outgoing request via `tokenResolver` callback.

### 4.1 Modules and Exposed Interfaces

#### 4.1.1 `AuthModule`
- **`login(dto: LoginDto): Promise<AuthResponse>`**: Fires `POST /auth/login`.
- **`register(dto: RegisterDto): Promise<AuthResponse>`**: Fires `POST /auth/signup`.
- **`logout(): Promise<void>`**: Fires `POST /auth/logout`.
- **`session(): Promise<any>`**: Fires `GET /auth/session`.

#### 4.1.2 `WorkspacesModule`
- **`listWorkspaces(): Promise<Workspace[]>`**: Fires `GET /workspaces`.
- **`createWorkspace(dto: CreateWorkspaceDto): Promise<Workspace>`**: Fires `POST /workspaces`.
- **`updateWorkspace(id: string, dto: UpdateWorkspaceDto): Promise<Workspace>`**: Fires `PATCH /workspaces/:id`.
- **`deleteWorkspace(id: string): Promise<void>`**: Fires `DELETE /workspaces/:id`.
- **`listMembers(id: string): Promise<WorkspaceMember[]>`**: Fires `GET /workspaces/:id/members`.

#### 4.1.3 `CompaniesModule`
- **`list(filters: CompanyFilters): Promise<Company[]>`**: Fires `GET /companies`.
- **`create(dto: CreateCompanyDto): Promise<Company>`**: Fires `POST /companies`.
- **`update(id: string, dto: UpdateCompanyDto): Promise<Company>`**: Fires `PATCH /companies/:id`.
- **`delete(id: string): Promise<void>`**: Fires `DELETE /companies/:id`.

#### 4.1.4 `DiscoveryModule`
- **`listJobs(filters: any): Promise<DiscoveryJob[]>`**: Fires `GET /discovery/jobs`.
- **`createJob(dto: any): Promise<DiscoveryJob>`**: Fires `POST /discovery/jobs`.
- **`getJobResults(id: string): Promise<DiscoveryResult[]>`**: Fires `GET /discovery/jobs/:id/results`.
- **`importResult(id: string): Promise<any>`**: Fires `POST /discovery/results/:id/import`.

### 4.2 Error Handling
Every request that fails (HTTP status >= 400 or response `success: false`) throws an instance of `SdkError`.
```typescript
export class SdkError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number | null,
    public details?: any
  ) {
    super(message);
  }
}
```
This allows Electron Main to catch and format API errors cleanly before returning them over IPC.
