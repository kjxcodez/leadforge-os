# LeadForge OS — SDK Audit

This document details the audit of the `@leadforge/sdk` package located in `packages/sdk`.

---

## 1. SDK Http Request Client

The core client logic is implemented in [`packages/sdk/src/http/client.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/http/client.ts).

* **Uses fetch?**: Yes, relies on native `fetch` (lines 54).
* **Workspace header**: Spreads `this.config.headers` into the fetch options (line 21). However, the client has **no dynamic workspace parameterization** per request; header configuration is global and static. Dynamic updates must be applied by mutating the global custom headers object passed at instantiation.
* **Authentication**: Resolved via `tokenResolver` callback (line 24). If a token is retrieved, it is appended as an `Authorization: Bearer <token>` header (line 27).
* **Retries**: Retries are enabled by default (2 retries, meaning 3 total attempts) with exponential backoff:
  ```typescript
  await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 200));
  ```
* **Timeouts**: No timeout parameters are set. Fetch runs indefinitely until browser/node defaults are exceeded.
* **Error handling**: Checks `!response.ok` or `!payload.success` (line 62). Throws custom `SdkError` wrapping backend messages and codes.
* **Unauthorized handler**: Executes `onUnauthorized` hook on `401` responses (line 56).

---

## 2. Exported SDK Modules Catalog

The SDK client exposes the following modules configured in [`client/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/client/index.ts):

* `sdk.health`
* `sdk.auth`
* `sdk.companies`
* `sdk.contacts`
* `sdk.campaigns`
* `sdk.outreach`
* `sdk.workspaces`
* `sdk.discovery`
* `sdk.activities`
* `sdk.sequences`
* `sdk.executions`

---

## 3. Detailed SDK Methods Audit

### 3.1. `health` Module
Declared in [`modules/health.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/health.ts).

#### `getStatus()`
* **HTTP Method**: `GET`
* **Endpoint**: `/health`
* **Input**: None
* **Output**: `Promise<HealthStatus>`
* **Where Used**: Unused in desktop app renderer or sync engine.

---

### 3.2. `auth` Module
Declared in [`modules/auth.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/auth.ts).

#### `login(dto)`
* **HTTP Method**: `POST`
* **Endpoint**: `/auth/login`
* **Input**: `LoginDto`
* **Output**: `Promise<AuthResponse>`
* **Where Used**: Called by Electron main process IPC handler `auth:login` ([`ipc/auth.ts:L15`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/auth.ts#L15)).

#### `register(dto)`
* **HTTP Method**: `POST`
* **Endpoint**: `/auth/signup`
* **Input**: `RegisterDto`
* **Output**: `Promise<AuthResponse>`
* **Where Used**: Called by Electron main process IPC handler `auth:register` ([`ipc/auth.ts:L29`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/auth.ts#L29)).

#### `logout()`
* **HTTP Method**: `POST`
* **Endpoint**: `/auth/logout`
* **Input**: None
* **Output**: `Promise<void>`
* **Where Used**: Called by Electron main process IPC handler `auth:logout` ([`ipc/auth.ts:L44`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/auth.ts#L44)).

#### `session()`
* **HTTP Method**: `GET`
* **Endpoint**: `/auth/session`
* **Input**: None
* **Output**: `Promise<any>`
* **Where Used**: Called by Electron main process IPC handler `auth:session` ([`ipc/auth.ts:L53`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/auth.ts#L53)).

---

### 3.3. `companies` Module
Declared in [`modules/companies.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/companies.ts).

#### `list(filters)`
* **HTTP Method**: `GET`
* **Endpoint**: `/companies`
* **Input**: `CompanyFilters` (serializes to query parameters)
* **Output**: `Promise<Company[]>`
* **Where Used**: Unused in desktop app.

#### `get(id)`
* **HTTP Method**: `GET`
* **Endpoint**: `/companies/${id}`
* **Input**: `string`
* **Output**: `Promise<Company>`
* **Where Used**: Unused in desktop app.

#### `create(dto)`
* **HTTP Method**: `POST`
* **Endpoint**: `/companies`
* **Input**: `CreateCompanyDto`
* **Output**: `Promise<Company>`
* **Where Used**: Called by `SyncEngine` polling processor in the main process ([`sync-engine.ts:L98`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/sync-engine.ts#L98)).

#### `update(id, dto)`
* **HTTP Method**: `PATCH`
* **Endpoint**: `/companies/${id}`
* **Input**: `UpdateCompanyDto`
* **Output**: `Promise<Company>`
* **Where Used**: Called by `SyncEngine` polling processor in the main process ([`sync-engine.ts:L100`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/sync-engine.ts#L100)).

#### `delete(id)`
* **HTTP Method**: `DELETE`
* **Endpoint**: `/companies/${id}`
* **Input**: `string`
* **Output**: `Promise<void>`
* **Where Used**: Called by `SyncEngine` polling processor in the main process ([`sync-engine.ts:L102`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/sync-engine.ts#L102)).

---

### 3.4. `contacts` Module
Declared in [`modules/contacts.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/contacts.ts).

#### `list(filters)`
* **HTTP Method**: `GET`
* **Endpoint**: `/contacts`
* **Input**: `ContactFilters`
* **Output**: `Promise<Contact[]>`
* **Where Used**: Unused in desktop app.

#### `get(id)`
* **HTTP Method**: `GET`
* **Endpoint**: `/contacts/${id}`
* **Input**: `string`
* **Output**: `Promise<Contact>`
* **Where Used**: Unused in desktop app.

#### `create(dto)`
* **HTTP Method**: `POST`
* **Endpoint**: `/contacts`
* **Input**: `CreateContactDto`
* **Output**: `Promise<Contact>`
* **Where Used**: Called by `SyncEngine` polling processor in the main process.

#### `update(id, dto)`
* **HTTP Method**: `PATCH`
* **Endpoint**: `/contacts/${id}`
* **Input**: `UpdateContactDto`
* **Output**: `Promise<Contact>`
* **Where Used**: Called by `SyncEngine` polling processor in the main process.

#### `delete(id)`
* **HTTP Method**: `DELETE`
* **Endpoint**: `/contacts/${id}`
* **Input**: `string`
* **Output**: `Promise<void>`
* **Where Used**: Called by `SyncEngine` polling processor in the main process.

---

### 3.5. `campaigns` Module
Declared in [`modules/campaigns.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/campaigns.ts).

#### `list(filters)`
* **HTTP Method**: `GET`
* **Endpoint**: `/campaigns`
* **Input**: `CampaignFilters`
* **Output**: `Promise<Campaign[]>`
* **Where Used**: Unused in desktop app.

#### `get(id)`
* **HTTP Method**: `GET`
* **Endpoint**: `/campaigns/${id}`
* **Input**: `string`
* **Output**: `Promise<Campaign>`
* **Where Used**: Unused in desktop app.

#### `create(dto)`
* **HTTP Method**: `POST`
* **Endpoint**: `/campaigns`
* **Input**: `CreateCampaignDto`
* **Output**: `Promise<Campaign>`
* **Where Used**: Called by `SyncEngine` polling processor in the main process.

#### `update(id, dto)`
* **HTTP Method**: `PATCH`
* **Endpoint**: `/campaigns/${id}`
* **Input**: `UpdateCampaignDto`
* **Output**: `Promise<Campaign>`
* **Where Used**: Called by `SyncEngine` polling processor in the main process.

#### `delete(id)`
* **HTTP Method**: `DELETE`
* **Endpoint**: `/campaigns/${id}`
* **Input**: `string`
* **Output**: `Promise<void>`
* **Where Used**: Called by `SyncEngine` polling processor in the main process.

#### `schedule(id)`
* **HTTP Method**: `POST`
* **Endpoint**: `/campaigns/${id}/schedule`
* **Input**: None (passes empty object `{}`)
* **Output**: `Promise<void>`
* **Where Used**: Called by Electron main process IPC handler `campaigns:schedule` ([`ipc/outreach.ts:L44`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/outreach.ts#L44)).

---

### 3.6. `outreach` Module
Declared in [`modules/outreach.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/outreach.ts).

#### `list(filters)`
* **HTTP Method**: `GET`
* **Endpoint**: `/outreach`
* **Input**: `OutreachFilters`
* **Output**: `Promise<Outreach[]>`
* **Status**: **POINTING TO MISSING ENDPOINT** (API does not implement `GET /outreach`).
* **Where Used**: Unused in desktop app.

#### `send(dto)`
* **HTTP Method**: `POST`
* **Endpoint**: `/outreach`
* **Input**: `CreateOutreachDto`
* **Output**: `Promise<Outreach>`
* **Status**: **POINTING TO MISSING ENDPOINT** (API does not implement `POST /outreach`).
* **Where Used**: Unused in desktop app.

#### `listAccounts()`
* **HTTP Method**: `GET`
* **Endpoint**: `/outreach/accounts`
* **Input**: None
* **Output**: `Promise<EmailAccount[]>`
* **Where Used**: Called by Electron main process IPC handler `email-accounts:list` ([`ipc/outreach.ts:L10`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/outreach.ts#L10)).

#### `createAccount(dto)`
* **HTTP Method**: `POST`
* **Endpoint**: `/outreach/accounts`
* **Input**: `CreateEmailAccountDto`
* **Output**: `Promise<EmailAccount>`
* **Where Used**: Called by Electron main process IPC handler `email-accounts:create` ([`ipc/outreach.ts:L14`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/outreach.ts#L14)).

#### `deleteAccount(id)`
* **HTTP Method**: `DELETE`
* **Endpoint**: `/outreach/accounts/${id}`
* **Input**: `string`
* **Output**: `Promise<void>`
* **Where Used**: Called by Electron main process IPC handler `email-accounts:delete` ([`ipc/outreach.ts:L18`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/outreach.ts#L18)).

#### `verifyAccount(id)`
* **HTTP Method**: `POST`
* **Endpoint**: `/outreach/accounts/${id}/verify`
* **Input**: None
* **Output**: `Promise<{ verified: boolean }>`
* **Where Used**: Called by Electron main process IPC handler `email-accounts:test` ([`ipc/outreach.ts:L22`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/outreach.ts#L22)).

#### `listTemplates()`
* **HTTP Method**: `GET`
* **Endpoint**: `/outreach/templates`
* **Input**: None
* **Output**: `Promise<EmailTemplate[]>`
* **Where Used**: Called by Electron main process IPC handler `templates:list` ([`ipc/outreach.ts:L27`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/outreach.ts#L27)).

#### `createTemplate(dto)`
* **HTTP Method**: `POST`
* **Endpoint**: `/outreach/templates`
* **Input**: `CreateEmailTemplateDto`
* **Output**: `Promise<EmailTemplate>`
* **Where Used**: Called by Electron main process IPC handler `templates:create` ([`ipc/outreach.ts:L31`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/outreach.ts#L31)).

#### `deleteTemplate(id)`
* **HTTP Method**: `DELETE`
* **Endpoint**: `/outreach/templates/${id}`
* **Input**: `string`
* **Output**: `Promise<void>`
* **Where Used**: Called by Electron main process IPC handler `templates:delete` ([`ipc/outreach.ts:L35`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/outreach.ts#L35)).

#### `previewTemplate(id, contactId)`
* **HTTP Method**: `GET`
* **Endpoint**: `/outreach/templates/${id}/preview`
* **Input**: `id: string, contactId?: string` (injected as query parameter)
* **Output**: `Promise<{ subject: string, body: string }>`
* **Where Used**: Called by Electron main process IPC handler `templates:preview` ([`ipc/outreach.ts:L39`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/outreach.ts#L39)).

---

### 3.7. `workspaces` Module
Declared in [`modules/workspaces.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/workspaces.ts).

#### `get(id)`
* **HTTP Method**: `GET`
* **Endpoint**: `/workspaces/${id}`
* **Input**: `string`
* **Output**: `Promise<Workspace>`
* **Where Used**: Called by Electron main process IPC handler `workspaces:get` ([`ipc/workspace.ts:L30`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/workspace.ts#L30)).

#### `list()`
* **HTTP Method**: `GET`
* **Endpoint**: `/workspaces`
* **Input**: None
* **Output**: `Promise<Workspace[]>`
* **Where Used**: Called by Electron main process IPC handler `workspaces:list` ([`ipc/workspace.ts:L15`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/workspace.ts#L15)).

#### `create(dto)`
* **HTTP Method**: `POST`
* **Endpoint**: `/workspaces`
* **Input**: `CreateWorkspaceDto`
* **Output**: `Promise<Workspace>`
* **Where Used**: Called by Electron main process IPC handler `workspaces:create` ([`ipc/workspace.ts:L10`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/workspace.ts#L10)).

#### `update(id, dto)`
* **HTTP Method**: `PATCH`
* **Endpoint**: `/workspaces/${id}`
* **Input**: `UpdateWorkspaceDto`
* **Output**: `Promise<Workspace>`
* **Where Used**: Called by Electron main process IPC handler `workspaces:update` ([`ipc/workspace.ts:L20`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/workspace.ts#L20)).

#### `delete(id)`
* **HTTP Method**: `DELETE`
* **Endpoint**: `/workspaces/${id}`
* **Input**: `string`
* **Output**: `Promise<void>`
* **Where Used**: Called by Electron main process IPC handler `workspaces:delete` ([`ipc/workspace.ts:L25`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/workspace.ts#L25)).

#### `inviteMember(id, dto)`
* **HTTP Method**: `POST`
* **Endpoint**: `/workspaces/${id}/invite`
* **Input**: `id: string, dto: InviteMemberDto`
* **Output**: `Promise<Workspace>`
* **Where Used**: Called by Electron main process IPC handler `workspaces:members:invite` ([`ipc/workspace.ts:L41`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/workspace.ts#L41)).

#### `listMembers(id)`
* **HTTP Method**: `GET`
* **Endpoint**: `/workspaces/${id}/members`
* **Input**: `string`
* **Output**: `Promise<WorkspaceMember[]>`
* **Where Used**: Called by Electron main process IPC handler `workspaces:members:list` ([`ipc/workspace.ts:L36`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/workspace.ts#L36)).

#### `updateMemberRole(id, memberId, role)`
* **HTTP Method**: `PATCH`
* **Endpoint**: `/workspaces/${id}/members/${memberId}/role`
* **Input**: `id: string, memberId: string, role: WorkspaceRole`
* **Output**: `Promise<Workspace>`
* **Where Used**: Called by Electron main process IPC handler `workspaces:members:updateRole` ([`ipc/workspace.ts:L46`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/workspace.ts#L46)).

#### `removeMember(id, memberId)`
* **HTTP Method**: `DELETE`
* **Endpoint**: `/workspaces/${id}/members/${memberId}`
* **Input**: `id: string, memberId: string`
* **Output**: `Promise<Workspace>`
* **Where Used**: Called by Electron main process IPC handler `workspaces:members:remove` ([`ipc/workspace.ts:L51`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/workspace.ts#L51)).

#### `leave(id)`
* **HTTP Method**: `POST`
* **Endpoint**: `/workspaces/${id}/leave`
* **Input**: `string`
* **Output**: `Promise<Workspace>`
* **Where Used**: Called by Electron main process IPC handler `workspaces:members:leave` ([`ipc/workspace.ts:L56`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/workspace.ts#L56)).

#### `transferOwnership(id, newOwnerId)`
* **HTTP Method**: `POST`
* **Endpoint**: `/workspaces/${id}/transfer-ownership`
* **Input**: `id: string, newOwnerId: string`
* **Output**: `Promise<Workspace>`
* **Where Used**: Called by Electron main process IPC handler `workspaces:members:transferOwnership` ([`ipc/workspace.ts:L61`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/workspace.ts#L61)).

#### `listPendingInvites()`
* **HTTP Method**: `GET`
* **Endpoint**: `/workspaces/invites/pending`
* **Input**: None
* **Output**: `Promise<Workspace[]>`
* **Where Used**: Called by Electron main process IPC handler `workspaces:invites:list` ([`ipc/workspace.ts:L67`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/workspace.ts#L67)).

#### `acceptInvite(token)`
* **HTTP Method**: `POST`
* **Endpoint**: `/workspaces/invites/accept`
* **Input**: `string` (sent inside JSON object `{ token }`)
* **Output**: `Promise<Workspace>`
* **Where Used**: Called by Electron main process IPC handler `workspaces:invites:accept` ([`ipc/workspace.ts:L72`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/workspace.ts#L72)).

#### `declineInvite(token)`
* **HTTP Method**: `POST`
* **Endpoint**: `/workspaces/invites/decline`
* **Input**: `string` (sent inside JSON object `{ token }`)
* **Output**: `Promise<Workspace>`
* **Where Used**: Called by Electron main process IPC handler `workspaces:invites:decline` ([`ipc/workspace.ts:L77`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/workspace.ts#L77)).

---

### 3.8. `discovery` Module
Declared in [`modules/discovery.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/discovery.ts).

#### `listJobs(filters)`
* **HTTP Method**: `GET`
* **Endpoint**: `/discovery/jobs`
* **Input**: filters object (converted to query string)
* **Output**: `Promise<DiscoveryJob[]>`
* **Where Used**: Called by Electron main process IPC handler `discovery:list` ([`ipc/discovery.ts:L9`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/discovery.ts#L9)).

#### `createJob(payload)`
* **HTTP Method**: `POST`
* **Endpoint**: `/discovery/jobs`
* **Input**: `{ name: string, provider: string, query: string }`
* **Output**: `Promise<DiscoveryJob>`
* **Where Used**: Called by Electron main process IPC handler `discovery:create` ([`ipc/discovery.ts:L13`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/discovery.ts#L13)).

#### `getJob(id)`
* **HTTP Method**: `GET`
* **Endpoint**: `/discovery/jobs/${id}`
* **Input**: `string`
* **Output**: `Promise<DiscoveryJob>`
* **Where Used**: Called by Electron main process IPC handler `discovery:get` ([`ipc/discovery.ts:L17`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/discovery.ts#L17)).

#### `getJobResults(id)`
* **HTTP Method**: `GET`
* **Endpoint**: `/discovery/jobs/${id}/results`
* **Input**: `string`
* **Output**: `Promise<DiscoveryResult[]>`
* **Where Used**: Called by Electron main process IPC handler `discovery:results` ([`ipc/discovery.ts:L21`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/discovery.ts#L21)).

#### `importResult(id)`
* **HTTP Method**: `POST`
* **Endpoint**: `/discovery/results/${id}/import`
* **Input**: `string`
* **Output**: `Promise<DiscoveryResult>`
* **Where Used**: Called by Electron main process IPC handler `discovery:import` ([`ipc/discovery.ts:L25`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/discovery.ts#L25)).

#### `skipResult(id)`
* **HTTP Method**: `POST`
* **Endpoint**: `/discovery/results/${id}/skip`
* **Input**: `string`
* **Output**: `Promise<DiscoveryResult>`
* **Where Used**: Called by Electron main process IPC handler `discovery:skip` ([`ipc/discovery.ts:L29`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/discovery.ts#L29)).

---

### 3.9. `activities` Module
Declared in [`modules/activities.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/activities.ts).

#### `list(filters)`
* **HTTP Method**: `GET`
* **Endpoint**: `/activities`
* **Input**: filters object (converted to query string)
* **Output**: `Promise<any[]>`
* **Where Used**: Called by Electron main process IPC handler `activities:list` (Wait! The IPC handler `activities:list` queries local SQLite cache directly, so this SDK method is never used).

---

### 3.10. `sequences` & `executions` Modules (Automation)
Declared in [`modules/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/automation.ts).

#### `sequences.list()`
* **HTTP Method**: `GET`
* **Endpoint**: `/automation/sequences`
* **Input**: None
* **Output**: `Promise<Sequence[]>`
* **Where Used**: Called by Electron main process IPC handler `sequence:list` ([`ipc/automation.ts:L10`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/automation.ts#L10)).

#### `sequences.get(id)`
* **HTTP Method**: `GET`
* **Endpoint**: `/automation/sequences/${id}`
* **Input**: `string`
* **Output**: `Promise<Sequence>`
* **Where Used**: Called by Electron main process IPC handler `sequence:get` ([`ipc/automation.ts:L14`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/automation.ts#L14)).

#### `sequences.create(dto)`
* **HTTP Method**: `POST`
* **Endpoint**: `/automation/sequences`
* **Input**: `CreateSequenceDto`
* **Output**: `Promise<Sequence>`
* **Where Used**: Called by Electron main process IPC handler `sequence:create` ([`ipc/automation.ts:L18`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/automation.ts#L18)).

#### `sequences.update(id, dto)`
* **HTTP Method**: `PATCH`
* **Endpoint**: `/automation/sequences/${id}`
* **Input**: `UpdateSequenceDto`
* **Output**: `Promise<Sequence>`
* **Where Used**: Called by Electron main process IPC handler `sequence:update` ([`ipc/automation.ts:L22`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/automation.ts#L22)).

#### `sequences.delete(id)`
* **HTTP Method**: `DELETE`
* **Endpoint**: `/automation/sequences/${id}`
* **Input**: `string`
* **Output**: `Promise<void>`
* **Where Used**: Called by Electron main process IPC handler `sequence:delete` ([`ipc/automation.ts:L26`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/automation.ts#L26)).

#### `executions.list()`
* **HTTP Method**: `GET`
* **Endpoint**: `/automation/executions`
* **Input**: None
* **Output**: `Promise<SequenceExecution[]>`
* **Where Used**: Called by Electron main process IPC handler `execution:list` ([`ipc/automation.ts:L39`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/automation.ts#L39)).

#### `executions.get(id)`
* **HTTP Method**: `GET`
* **Endpoint**: `/automation/executions/${id}`
* **Input**: `string`
* **Output**: `Promise<SequenceExecution>`
* **Where Used**: Called by Electron main process IPC handler `execution:get` ([`ipc/automation.ts:L43`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/automation.ts#L43)).

#### `executions.start(sequenceId, contactId, companyId)`
* **HTTP Method**: `POST`
* **Endpoint**: `/automation/executions/start`
* **Input**: `{ sequenceId, contactId, companyId }`
* **Output**: `Promise<SequenceExecution>`
* **Where Used**: Called by Electron main process IPC handler `sequence:start` ([`ipc/automation.ts:L31`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/automation.ts#L31)).

#### `executions.stop(id)`
* **HTTP Method**: `POST`
* **Endpoint**: `/automation/executions/${id}/stop`
* **Input**: None
* **Output**: `Promise<SequenceExecution>`
* **Where Used**: Called by Electron main process IPC handler `sequence:stop` ([`ipc/automation.ts:L35`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/automation.ts#L35)).

#### `executions.getLogs(id)`
* **HTTP Method**: `GET`
* **Endpoint**: `/automation/executions/${id}/logs`
* **Input**: `string`
* **Output**: `Promise<SequenceLog[]>`
* **Where Used**: Called by Electron main process IPC handler `execution:logs` ([`ipc/automation.ts:L47`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/automation.ts#L47)).

---

## SDK Coverage Report

* **Total SDK Methods**: 41
* **Methods Correctly Mapped**: 39
* **Methods Pointing to Missing Endpoints**: 2
  - `outreach.list()` points to `GET /outreach` which does not exist in the API router.
  - `outreach.send()` points to `POST /outreach` which does not exist in the API router.

* **Unused SDK Methods**: 16
  - `health.getStatus()`
  - `companies.list()`
  - `companies.get()`
  - `contacts.list()`
  - `contacts.get()`
  - `campaigns.list()`
  - `campaigns.get()`
  - `outreach.list()`
  - `outreach.send()`
  - `activities.list()`

* **Duplicate SDK Methods**: None.
* **Incorrect DTO Mappings**: None.
* **Incorrect Route Mappings**: None.

* **Potential Bugs**:
  - All resource list queries (like `sdk.companies.list()`, `sdk.contacts.list()`, `sdk.campaigns.list()`, `sdk.activities.list()`, `sdk.sequences.list()`, `sdk.executions.list()`) request the base resource path without a trailing slash (e.g. `/companies` instead of `/companies/`). This bypasses the Hono routing wildcard middleware `use("/companies/*", ...)` on the API, causing those requests to fail with `403 Forbidden` (`Workspace context required.`) when hit directly.
