# LeadForge OS — Complete Hono API Inventory

This document acts as the definitive inventory of the Hono API endpoints implemented in the `apps/api` service.

---

## 1. System Health Check & Info routes

### `GET /api/v1/`

- **Route**: `/` (under `healthRouter` mounted on root `/`)
- **Handler File**: [`apps/api/src/routes/health/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/health/index.ts#L36)
- **Handler Function**: Route handler for `infoRoute`
- **Authentication Middleware**: None
- **Workspace Middleware**: None
- **Validation Schema**: None
- **Input DTO**: None
- **Output DTO**: `apiInfoSchema` (injected in `successResponse`)
- **Status Codes**: `200`
- **Error Responses**: None
- **SDK Equivalent**: None
- **Used by renderer?**: No
- **Used by desktop?**: No
- **Used by IPC?**: No
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION (Static JSON payload returned)

### `GET /api/v1/health`

- **Route**: `/health` (under `healthRouter` mounted on root `/`)
- **Handler File**: [`apps/api/src/routes/health/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/health/index.ts#L54)
- **Handler Function**: Route handler for `healthRoute`
- **Authentication Middleware**: None
- **Workspace Middleware**: None
- **Validation Schema**: None
- **Input DTO**: None
- **Output DTO**: `healthStatusSchema` (injected in `successResponse`)
- **Status Codes**: `200` (healthy), `500` (database degraded)
- **Error Responses**: `500`
- **SDK Equivalent**: `sdk.health.getStatus()` in [`health.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/health.ts#L11)
- **Used by renderer?**: No
- **Used by desktop?**: No
- **Used by IPC?**: No (The IPC channel `system:status` returns mock static statuses directly without invoking SDK/API)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION (Performs active Mongoose DB state check `db.checkHealth()`)

### `GET /api/v1/version`

- **Route**: `/version` (under `healthRouter` mounted on root `/`)
- **Handler File**: [`apps/api/src/routes/health/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/health/index.ts#L80)
- **Handler Function**: Route handler for `versionRoute`
- **Authentication Middleware**: None
- **Workspace Middleware**: None
- **Validation Schema**: None
- **Input DTO**: None
- **Output DTO**: `versionInfoSchema`
- **Status Codes**: `200`
- **Error Responses**: None
- **SDK Equivalent**: None
- **Used by renderer?**: No
- **Used by desktop?**: No
- **Used by IPC?**: No
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION (Exposes NodeJS `process.version` and `process.env.NODE_ENV`)

---

## 2. Authentication routes

### `POST /api/v1/auth/login`

- **Route**: `/login` (under `authRouter` mounted on `/auth`)
- **Handler File**: [`apps/api/src/routes/auth/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/auth/index.ts#L29)
- **Handler Function**: Route handler for `loginRoute`
- **Authentication Middleware**: None
- **Workspace Middleware**: None
- **Validation Schema**: `loginDtoSchema`
- **Input DTO**: `LoginDto`
- **Output DTO**: `{ token: string, user: AuthUser }`
- **Status Codes**: `200`, `400` (invalid inputs), `401` (invalid credentials)
- **Error Responses**: `400`/`401` wrapped in `ErrorResponseSchema`
- **SDK Equivalent**: `sdk.auth.login(dto)` in [`auth.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/auth.ts#L7)
- **Used by renderer?**: Yes (via `AuthService.login`)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`auth:login` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION (Integrates Better Auth `auth.api.signInEmail`)

### `POST /api/v1/auth/signup`

- **Route**: `/signup` (under `authRouter` mounted on `/auth`)
- **Handler File**: [`apps/api/src/routes/auth/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/auth/index.ts#L90)
- **Handler Function**: Route handler for `signupRoute`
- **Authentication Middleware**: None
- **Workspace Middleware**: None
- **Validation Schema**: `registerDtoSchema`
- **Input DTO**: `RegisterDto`
- **Output DTO**: `{ token: string, user: AuthUser }`
- **Status Codes**: `200`, `400` (invalid parameters or duplicate user)
- **Error Responses**: `400` wrapped in `ErrorResponseSchema`
- **SDK Equivalent**: `sdk.auth.register(dto)` in [`auth.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/auth.ts#L11)
- **Used by renderer?**: Yes (via `AuthService.register`)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`auth:register` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION (Integrates Better Auth `auth.api.signUpEmail`)

### `POST /api/v1/auth/logout`

- **Route**: `/logout` (under `authRouter` mounted on `/auth`)
- **Handler File**: [`apps/api/src/routes/auth/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/auth/index.ts#L144)
- **Handler Function**: Route handler for `logoutRoute`
- **Authentication Middleware**: None
- **Workspace Middleware**: None
- **Validation Schema**: None
- **Input DTO**: None
- **Output DTO**: `{ success: boolean }`
- **Status Codes**: `200`
- **Error Responses**: None
- **SDK Equivalent**: `sdk.auth.logout()` in [`auth.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/auth.ts#L15)
- **Used by renderer?**: Yes (via `AuthService.logout`)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`auth:logout` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION (Integrates Better Auth `auth.api.signOut`)

### `GET /api/v1/auth/session`

- **Route**: `/session` (under `authRouter` mounted on `/auth`)
- **Handler File**: [`apps/api/src/routes/auth/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/auth/index.ts#L170)
- **Handler Function**: Route handler for `sessionRoute`
- **Authentication Middleware**: None
- **Workspace Middleware**: None
- **Validation Schema**: None
- **Input DTO**: None
- **Output DTO**: `{ token: string, user: AuthUser }` or `null`
- **Status Codes**: `200`
- **Error Responses**: None (auth failures caught internally to return 200 with `null` data payload)
- **SDK Equivalent**: `sdk.auth.session()` in [`auth.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/auth.ts#L19)
- **Used by renderer?**: Yes (via `AuthService.restoreSession`)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`auth:session` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION (Integrates Better Auth `auth.api.getSession`)

---

## 3. Workspace Management routes

> [!WARNING]
> The Hono route wildcard pattern is declared as `apiRouter.use("/workspaces/*", authMiddleware, workspaceMiddleware)` in [`routes/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/index.ts#L30).
> In Hono, a path pattern `/workspaces/*` does **not** match the root `/workspaces` path without a trailing slash.
> Consequently, `GET /workspaces` and `POST /workspaces` endpoints will **bypass** the global `authMiddleware` and `workspaceMiddleware` routing chains.
> However, these handlers manually invoke `getUserId(c)` which throws `ForbiddenError` if the authentication context is missing.

### `GET /api/v1/workspaces`

- **Route**: `/` (under `workspacesRouter` mounted on `/workspaces`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L55)
- **Handler Function**: Route handler for `listWorkspacesRoute`
- **Authentication Middleware**: Bypassed (due to route path wildcard pattern matching bug)
- **Workspace Middleware**: Bypassed
- **Validation Schema**: None
- **Input DTO**: None
- **Output DTO**: successResponse wrapping array of Workspace
- **Status Codes**: `200`, `403` (from internal `getUserId` if unauthorized)
- **Error Responses**: `403` Forbidden
- **SDK Equivalent**: `sdk.workspaces.list()` in [`workspaces.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/workspaces.ts#L18)
- **Used by renderer?**: Yes (via `WorkspaceService.listWorkspaces` -> `workspaces:list` IPC)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`workspaces:list` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION (Queries database `WorkspaceService.listUserWorkspaces`)

### `GET /api/v1/workspaces/:id`

- **Route**: `/{id}` (under `workspacesRouter` mounted on `/workspaces`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L74)
- **Handler Function**: Route handler for `getWorkspaceRoute`
- **Authentication Middleware**: `authMiddleware`
- **Workspace Middleware**: `workspaceMiddleware`
- **Validation Schema**: URL Param validation schema `z.object({ id: z.string() })`
- **Input DTO**: URL Params `{ id: string }`
- **Output DTO**: Workspace details
- **Status Codes**: `200`, `404` (Workspace not found)
- **Error Responses**: `404` NotFound
- **SDK Equivalent**: `sdk.workspaces.get(id)` in [`workspaces.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/workspaces.ts#L14)
- **Used by renderer?**: Yes (via `WorkspaceService.getWorkspace` -> `workspaces:get` IPC)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`workspaces:get` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

### `POST /api/v1/workspaces`

- **Route**: `/` (under `workspacesRouter` mounted on `/workspaces`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L97)
- **Handler Function**: Route handler for `createWorkspaceRoute`
- **Authentication Middleware**: Bypassed (due to path pattern bug)
- **Workspace Middleware**: Bypassed
- **Validation Schema**: `createWorkspaceDtoSchema`
- **Input DTO**: `CreateWorkspaceDto`
- **Output DTO**: Newly created Workspace record
- **Status Codes**: `200`, `403` (if unauthorized)
- **Error Responses**: `403` Forbidden
- **SDK Equivalent**: `sdk.workspaces.create(dto)` in [`workspaces.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/workspaces.ts#L22)
- **Used by renderer?**: Yes (via `WorkspaceService.createWorkspace` -> `workspaces:create` IPC)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`workspaces:create` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

### `PATCH /api/v1/workspaces/:id`

- **Route**: `/{id}` (under `workspacesRouter` mounted on `/workspaces`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L129)
- **Handler Function**: Route handler for `updateWorkspaceRoute`
- **Authentication Middleware**: `authMiddleware`
- **Workspace Middleware**: `workspaceMiddleware`
- **Validation Schema**: Param: `z.object({ id: z.string() })`, Body: `updateWorkspaceDtoSchema`
- **Input DTO**: Update body fields
- **Output DTO**: Updated Workspace record
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.workspaces.update(id, dto)` in [`workspaces.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/workspaces.ts#L26)
- **Used by renderer?**: Yes (via `WorkspaceService.updateWorkspace` -> `workspaces:update` IPC)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`workspaces:update` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

### `DELETE /api/v1/workspaces/:id`

- **Route**: `/{id}` (under `workspacesRouter` mounted on `/workspaces`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L158)
- **Handler Function**: Route handler for `deleteWorkspaceRoute`
- **Authentication Middleware**: `authMiddleware`
- **Workspace Middleware**: `workspaceMiddleware`
- **Validation Schema**: Param: `z.object({ id: z.string() })`
- **Input DTO**: None
- **Output DTO**: `{ success: boolean }`
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.workspaces.delete(id)` in [`workspaces.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/workspaces.ts#L30)
- **Used by renderer?**: Yes (via `WorkspaceService.deleteWorkspace` -> `workspaces:delete` IPC)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`workspaces:delete` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION (Soft deletes workspace in DB)

---

## 4. Workspace Membership & Invitations routes

### `POST /api/v1/workspaces/:id/invite`

- **Route**: `/{id}/invite` (under `workspacesRouter` mounted on `/workspaces`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L181)
- **Handler Function**: Route handler for `inviteMemberRoute`
- **Authentication Middleware**: `authMiddleware`
- **Workspace Middleware**: `workspaceMiddleware`
- **Validation Schema**: Param: `z.object({ id: z.string() })`, Body: `inviteMemberDtoSchema`
- **Input DTO**: `{ email: string, role: string }`
- **Output DTO**: Updated Workspace record
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.workspaces.inviteMember(id, dto)` in [`workspaces.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/workspaces.ts#L34)
- **Used by renderer?**: Yes (via `WorkspaceService.inviteMember` -> `workspaces:members:invite` IPC)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`workspaces:members:invite` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

### `GET /api/v1/workspaces/:id/members`

- **Route**: `/{id}/members` (under `workspacesRouter` mounted on `/workspaces`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L210)
- **Handler Function**: Route handler for `listMembersRoute`
- **Authentication Middleware**: `authMiddleware`
- **Workspace Middleware**: `workspaceMiddleware`
- **Validation Schema**: Param: `z.object({ id: z.string() })`
- **Input DTO**: None
- **Output DTO**: Array of member objects
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.workspaces.listMembers(id)` in [`workspaces.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/workspaces.ts#L38)
- **Used by renderer?**: Yes (via `WorkspaceService.listMembers` -> `workspaces:members:list` IPC)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`workspaces:members:list` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

### `PATCH /api/v1/workspaces/:id/members/:memberId/role`

- **Route**: `/{id}/members/{memberId}/role` (under `workspacesRouter` mounted on `/workspaces`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L232)
- **Handler Function**: Route handler for `updateMemberRoleRoute`
- **Authentication Middleware**: `authMiddleware`
- **Workspace Middleware**: `workspaceMiddleware`
- **Validation Schema**: Param: `z.object({ id: z.string(), memberId: z.string() })`, Body: `updateMemberRoleDtoSchema`
- **Input DTO**: `{ role: string }`
- **Output DTO**: Updated Workspace record
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.workspaces.updateMemberRole(id, memberId, role)` in [`workspaces.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/workspaces.ts#L42)
- **Used by renderer?**: Yes (via `WorkspaceService.updateMemberRole` -> `workspaces:members:updateRole` IPC)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`workspaces:members:updateRole` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

### `DELETE /api/v1/workspaces/:id/members/:memberId`

- **Route**: `/{id}/members/{memberId}` (under `workspacesRouter` mounted on `/workspaces`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L261)
- **Handler Function**: Route handler for `removeMemberRoute`
- **Authentication Middleware**: `authMiddleware`
- **Workspace Middleware**: `workspaceMiddleware`
- **Validation Schema**: Param: `z.object({ id: z.string(), memberId: z.string() })`
- **Input DTO**: None
- **Output DTO**: Updated Workspace record
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.workspaces.removeMember(id, memberId)` in [`workspaces.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/workspaces.ts#L46)
- **Used by renderer?**: Yes (via `WorkspaceService.removeMember` -> `workspaces:members:remove` IPC)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`workspaces:members:remove` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

### `POST /api/v1/workspaces/:id/leave`

- **Route**: `/{id}/leave` (under `workspacesRouter` mounted on `/workspaces`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L284)
- **Handler Function**: Route handler for `leaveWorkspaceRoute`
- **Authentication Middleware**: `authMiddleware`
- **Workspace Middleware**: `workspaceMiddleware`
- **Validation Schema**: Param: `z.object({ id: z.string() })`
- **Input DTO**: None
- **Output DTO**: Updated Workspace record
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.workspaces.leave(id)` in [`workspaces.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/workspaces.ts#L50)
- **Used by renderer?**: Yes (via `WorkspaceService.leaveWorkspace` -> `workspaces:members:leave` IPC)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`workspaces:members:leave` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

### `POST /api/v1/workspaces/:id/transfer-ownership`

- **Route**: `/{id}/transfer-ownership` (under `workspacesRouter` mounted on `/workspaces`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L307)
- **Handler Function**: Route handler for `transferOwnershipRoute`
- **Authentication Middleware**: `authMiddleware`
- **Workspace Middleware**: `workspaceMiddleware`
- **Validation Schema**: Param: `z.object({ id: z.string() })`, Body: `z.object({ newOwnerId: z.string() })`
- **Input DTO**: `{ newOwnerId: string }`
- **Output DTO**: Updated Workspace record
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.workspaces.transferOwnership(id, newOwnerId)` in [`workspaces.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/workspaces.ts#L54)
- **Used by renderer?**: Yes (via `WorkspaceService.transferOwnership` -> `workspaces:members:transferOwnership` IPC)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`workspaces:members:transferOwnership` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

### `GET /api/v1/workspaces/invites/pending`

- **Route**: `/invites/pending` (under `workspacesRouter` mounted on `/workspaces`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L338)
- **Handler Function**: Route handler for `listUserInvitesRoute`
- **Authentication Middleware**: Bypassed (due to pattern matching bug on root path, but verified manually in handler from session)
- **Workspace Middleware**: Bypassed
- **Validation Schema**: None
- **Input DTO**: None
- **Output DTO**: Array of pending invite Workspace records
- **Status Codes**: `200`
- **Error Responses**: None (returns empty array if user email is not set)
- **SDK Equivalent**: `sdk.workspaces.listPendingInvites()` in [`workspaces.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/workspaces.ts#L58)
- **Used by renderer?**: Yes (via `WorkspaceService.listPendingInvites` -> `workspaces:invites:list` IPC)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`workspaces:invites:list` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

### `POST /api/v1/workspaces/invites/accept`

- **Route**: `/invites/accept` (under `workspacesRouter` mounted on `/workspaces`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L360)
- **Handler Function**: Route handler for `acceptInviteRoute`
- **Authentication Middleware**: Bypassed (but manually checks user ID via helper `getUserId` inside handler)
- **Workspace Middleware**: Bypassed
- **Validation Schema**: `acceptInviteDtoSchema`
- **Input DTO**: `{ token: string }`
- **Output DTO**: Updated Workspace record
- **Status Codes**: `200`, `403` (if unauthorized)
- **Error Responses**: `403` Forbidden
- **SDK Equivalent**: `sdk.workspaces.acceptInvite(token)` in [`workspaces.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/workspaces.ts#L62)
- **Used by renderer?**: Yes (via `WorkspaceService.acceptInvite` -> `workspaces:invites:accept` IPC)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`workspaces:invites:accept` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

### `POST /api/v1/workspaces/invites/decline`

- **Route**: `/invites/decline` (under `workspacesRouter` mounted on `/workspaces`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L387)
- **Handler Function**: Route handler for `declineInviteRoute`
- **Authentication Middleware**: Bypassed (but manually checks user ID via helper `getUserId` inside handler)
- **Workspace Middleware**: Bypassed
- **Validation Schema**: `acceptInviteDtoSchema`
- **Input DTO**: `{ token: string }`
- **Output DTO**: Updated Workspace record
- **Status Codes**: `200`, `403` (if unauthorized)
- **Error Responses**: `403` Forbidden
- **SDK Equivalent**: `sdk.workspaces.declineInvite(token)` in [`workspaces.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/workspaces.ts#L66)
- **Used by renderer?**: Yes (via `WorkspaceService.declineInvite` -> `workspaces:invites:decline` IPC)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`workspaces:invites:decline` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

---

## 5. Companies CRM routes

### `GET /api/v1/companies`

- **Route**: `/` (under `companiesRouter` mounted on `/companies`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L499)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware` (Note: bypassed if path is `/companies` due to Hono pattern matching bug)
- **Workspace Middleware**: `workspaceMiddleware` (bypassed if path is `/companies`)
- **Validation Schema**: None
- **Input DTO**: Query params `page`, `limit`
- **Output DTO**: Array of Company records
- **Status Codes**: `200`, `403` (throws if workspace context missing)
- **Error Responses**: `403` Forbidden
- **SDK Equivalent**: `sdk.companies.list()` in [`companies.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/companies.ts#L7)
- **Used by renderer?**: No (Renderer bypasses remote endpoints and reads from local SQLite DB cache directly)
- **Used by desktop?**: No
- **Used by IPC?**: No (The IPC handler `companies:list` queries local SQLite cache directly)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

### `GET /api/v1/companies/:id`

- **Route**: `/:id` (under `companiesRouter` mounted on `/companies`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L508)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware`
- **Workspace Middleware**: `workspaceMiddleware`
- **Validation Schema**: None
- **Input DTO**: URL Param `{ id: string }`
- **Output DTO**: Company record
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.companies.get(id)` in [`companies.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/companies.ts#L14)
- **Used by renderer?**: No
- **Used by desktop?**: No
- **Used by IPC?**: No (The IPC handler `companies:get` queries local SQLite cache directly)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

### `POST /api/v1/companies`

- **Route**: `/` (under `companiesRouter` mounted on `/companies`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L516)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware` (bypassed if path is `/companies`)
- **Workspace Middleware**: `workspaceMiddleware` (bypassed if path is `/companies`)
- **Validation Schema**: None
- **Input DTO**: JSON Payload (matches `CreateCompanyDto` structure)
- **Output DTO**: Created Company record
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.companies.create(dto)` in [`companies.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/companies.ts#L18)
- **Used by renderer?**: No (Renderer writes to local SQLite DB directly, which places a mutation task in `sync_queue`)
- **Used by desktop?**: Yes (Mutations in `sync_queue` are sequentially synced to the server by the `SyncEngine` running in the main process)
- **Used by IPC?**: No (The IPC handler `companies:create` writes to SQLite)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION (Saves record, creates workspace audit log, and triggers `COMPANY_CREATED` automation event)

### `PATCH /api/v1/companies/:id`

- **Route**: `/:id` (under `companiesRouter` mounted on `/companies`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L533)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware`
- **Workspace Middleware**: `workspaceMiddleware`
- **Validation Schema**: None
- **Input DTO**: Update JSON Payload (matches `UpdateCompanyDto` structure)
- **Output DTO**: Updated Company record
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.companies.update(id, dto)` in [`companies.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/companies.ts#L22)
- **Used by renderer?**: No
- **Used by desktop?**: Yes (via `SyncEngine` sequential background processing)
- **Used by IPC?**: No
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION (Updates record, creates workspace audit log)

### `DELETE /api/v1/companies/:id`

- **Route**: `/:id` (under `companiesRouter` mounted on `/companies`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L547)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware`
- **Workspace Middleware**: `workspaceMiddleware`
- **Validation Schema**: None
- **Input DTO**: URL Param `{ id: string }`
- **Output DTO**: `{ success: boolean }`
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.companies.delete(id)` in [`companies.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/companies.ts#L26)
- **Used by renderer?**: No
- **Used by desktop?**: Yes (via `SyncEngine` sequential background processing)
- **Used by IPC?**: No
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION (Soft deletes in API DB, logs workspace activity)

---

## 6. Contacts CRM routes

### `GET /api/v1/contacts`

- **Route**: `/` (under `contactsRouter` mounted on `/contacts`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L563)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware` (bypassed if path is `/contacts`)
- **Workspace Middleware**: `workspaceMiddleware` (bypassed if path is `/contacts`)
- **Validation Schema**: None
- **Input DTO**: Query params `page`, `limit`
- **Output DTO**: Array of Contact records
- **Status Codes**: `200`, `403`
- **Error Responses**: `403` Forbidden
- **SDK Equivalent**: `sdk.contacts.list()` in [`contacts.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/contacts.ts#L7)
- **Used by renderer?**: No
- **Used by desktop?**: No
- **Used by IPC?**: No (IPC handler `contacts:list` queries local SQLite cache directly)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

### `GET /api/v1/contacts/:id`

- **Route**: `/:id` (under `contactsRouter` mounted on `/contacts`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L572)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware`
- **Workspace Middleware**: `workspaceMiddleware`
- **Validation Schema**: None
- **Input DTO**: URL Param `{ id: string }`
- **Output DTO**: Contact record
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.contacts.get(id)` in [`contacts.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/contacts.ts#L14)
- **Used by renderer?**: No
- **Used by desktop?**: No
- **Used by IPC?**: No
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

### `POST /api/v1/contacts`

- **Route**: `/` (under `contactsRouter` mounted on `/contacts`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L580)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware` (bypassed if path is `/contacts`)
- **Workspace Middleware**: `workspaceMiddleware` (bypassed if path is `/contacts`)
- **Validation Schema**: None
- **Input DTO**: JSON Payload (matches `CreateContactDto`)
- **Output DTO**: Created Contact record
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.contacts.create(dto)` in [`contacts.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/contacts.ts#L18)
- **Used by renderer?**: No (writes directly to SQLite DB)
- **Used by desktop?**: Yes (via `SyncEngine` sequential background processing)
- **Used by IPC?**: No
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION (Saves record, creates workspace audit log, and triggers `CONTACT_CREATED` automation event)

### `PATCH /api/v1/contacts/:id`

- **Route**: `/:id` (under `contactsRouter` mounted on `/contacts`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L600)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware`
- **Workspace Middleware**: `workspaceMiddleware`
- **Validation Schema**: None
- **Input DTO**: Update JSON Payload (matches `UpdateContactDto`)
- **Output DTO**: Updated Contact record
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.contacts.update(id, dto)` in [`contacts.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/contacts.ts#L22)
- **Used by renderer?**: No
- **Used by desktop?**: Yes (via `SyncEngine` sequential background processing)
- **Used by IPC?**: No
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION (Updates record, logs activity, and conditionally fires automation triggers like `PIPELINE_STAGE_CHANGED`, `EMAIL_REPLIED`, `EMAIL_BOUNCED`, and `TAG_ADDED` based on updated fields)

### `DELETE /api/v1/contacts/:id`

- **Route**: `/:id` (under `contactsRouter` mounted on `/contacts`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L640)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware`
- **Workspace Middleware**: `workspaceMiddleware`
- **Validation Schema**: None
- **Input DTO**: URL Param `{ id: string }`
- **Output DTO**: `{ success: boolean }`
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.contacts.delete(id)` in [`contacts.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/contacts.ts#L26)
- **Used by renderer?**: No
- **Used by desktop?**: Yes (via `SyncEngine` sequential background processing)
- **Used by IPC?**: No
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION (Soft deletes in API DB, logs workspace activity)

---

## 7. Campaigns CRM & Scheduling routes

### `GET /api/v1/campaigns`

- **Route**: `/` (under `campaignsRouter` mounted on `/campaigns`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L656)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware` (bypassed if path is `/campaigns`)
- **Workspace Middleware**: `workspaceMiddleware` (bypassed if path is `/campaigns`)
- **Validation Schema**: None
- **Input DTO**: Query params `page`, `limit`
- **Output DTO**: Array of Campaign records
- **Status Codes**: `200`, `403`
- **Error Responses**: `403` Forbidden
- **SDK Equivalent**: `sdk.campaigns.list()` in [`campaigns.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/campaigns.ts#L7)
- **Used by renderer?**: No
- **Used by desktop?**: No
- **Used by IPC?**: No (IPC handler `campaigns:list` queries local SQLite cache directly)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

### `GET /api/v1/campaigns/:id`

- **Route**: `/:id` (under `campaignsRouter` mounted on `/campaigns`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L665)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware`
- **Workspace Middleware**: `workspaceMiddleware`
- **Validation Schema**: None
- **Input DTO**: URL Param `{ id: string }`
- **Output DTO**: Campaign record
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.campaigns.get(id)` in [`campaigns.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/campaigns.ts#L14)
- **Used by renderer?**: No
- **Used by desktop?**: No
- **Used by IPC?**: No
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

### `POST /api/v1/campaigns`

- **Route**: `/` (under `campaignsRouter` mounted on `/campaigns`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L673)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware` (bypassed if path is `/campaigns`)
- **Workspace Middleware**: `workspaceMiddleware` (bypassed if path is `/campaigns`)
- **Validation Schema**: None
- **Input DTO**: JSON Payload (matches `CreateCampaignDto`)
- **Output DTO**: Created Campaign record
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.campaigns.create(dto)` in [`campaigns.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/campaigns.ts#L18)
- **Used by renderer?**: No (writes directly to SQLite DB)
- **Used by desktop?**: Yes (via `SyncEngine` sequential background processing)
- **Used by IPC?**: No
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION (Saves record, creates workspace audit log)

### `PATCH /api/v1/campaigns/:id`

- **Route**: `/:id` (under `campaignsRouter` mounted on `/campaigns`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L686)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware`
- **Workspace Middleware**: `workspaceMiddleware`
- **Validation Schema**: None
- **Input DTO**: Update JSON Payload (matches `UpdateCampaignDto`)
- **Output DTO**: Updated Campaign record
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.campaigns.update(id, dto)` in [`campaigns.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/campaigns.ts#L22)
- **Used by renderer?**: No
- **Used by desktop?**: Yes (via `SyncEngine` sequential background processing)
- **Used by IPC?**: No
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION (Updates record, logs activity)

### `DELETE /api/v1/campaigns/:id`

- **Route**: `/:id` (under `campaignsRouter` mounted on `/campaigns`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L700)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware`
- **Workspace Middleware**: `workspaceMiddleware`
- **Validation Schema**: None
- **Input DTO**: URL Param `{ id: string }`
- **Output DTO**: `{ success: boolean }`
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.campaigns.delete(id)` in [`campaigns.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/campaigns.ts#L26)
- **Used by renderer?**: No
- **Used by desktop?**: Yes (via `SyncEngine` sequential background processing)
- **Used by IPC?**: No
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION (Soft deletes in API DB, logs workspace activity)

### `POST /api/v1/campaigns/:id/schedule`

- **Route**: `/:id/schedule` (under `campaignsRouter` mounted on `/campaigns`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L714)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware`
- **Workspace Middleware**: `workspaceMiddleware`
- **Validation Schema**: None
- **Input DTO**: URL Param `{ id: string }`
- **Output DTO**: `{ success: boolean }`
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.campaigns.schedule(id)` in [`campaigns.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/campaigns.ts#L29)
- **Used by renderer?**: Yes (via `CampaignsScreen.tsx` run campaign trigger)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`campaigns:schedule` channel in `outreach.ts` IPC)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION (Launches background send loop `runCampaignSendLoop` on backend via `OutreachService`)

---

## 8. Outreach Email Accounts & Templates routes

### `GET /api/v1/outreach/accounts`

- **Route**: `/accounts` (under `outreachRouter` mounted on `/outreach`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L724)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware` (bypassed if path is `/outreach`)
- **Workspace Middleware**: `workspaceMiddleware` (bypassed if path is `/outreach`)
- **Validation Schema**: None
- **Input DTO**: None
- **Output DTO**: Array of EmailAccount records
- **Status Codes**: `200`, `403`
- **Error Responses**: `403` Forbidden
- **SDK Equivalent**: `sdk.outreach.listAccounts()` in [`outreach.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/outreach.ts#L30)
- **Used by renderer?**: Yes (via `CampaignsScreen.tsx` accounts query)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`email-accounts:list` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

### `POST /api/v1/outreach/accounts`

- **Route**: `/accounts` (under `outreachRouter` mounted on `/outreach`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L731)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware` (bypassed if path is `/outreach`)
- **Workspace Middleware**: `workspaceMiddleware` (bypassed if path is `/outreach`)
- **Validation Schema**: None
- **Input DTO**: JSON Payload (matches `CreateEmailAccountDto`)
- **Output DTO**: Created EmailAccount record
- **Status Codes**: `200`, `403`
- **Error Responses**: `403` Forbidden
- **SDK Equivalent**: `sdk.outreach.createAccount(dto)` in [`outreach.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/outreach.ts#L34)
- **Used by renderer?**: Yes (via `CampaignsScreen.tsx` add account form)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`email-accounts:create` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

### `DELETE /api/v1/outreach/accounts/:id`

- **Route**: `/accounts/:id` (under `outreachRouter` mounted on `/outreach`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L739)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware`
- **Workspace Middleware**: `workspaceMiddleware`
- **Validation Schema**: None
- **Input DTO**: URL Param `{ id: string }`
- **Output DTO**: `{ success: boolean }`
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.outreach.deleteAccount(id)` in [`outreach.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/outreach.ts#L38)
- **Used by renderer?**: Yes (via `CampaignsScreen.tsx` delete button)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`email-accounts:delete` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

### `POST /api/v1/outreach/accounts/:id/verify`

- **Route**: `/accounts/:id/verify` (under `outreachRouter` mounted on `/outreach`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L747)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware`
- **Workspace Middleware**: `workspaceMiddleware`
- **Validation Schema**: None
- **Input DTO**: URL Param `{ id: string }`
- **Output DTO**: `{ verified: boolean }`
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.outreach.verifyAccount(id)` in [`outreach.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/outreach.ts#L42)
- **Used by renderer?**: Yes (via `CampaignsScreen.tsx` test connection button)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`email-accounts:test` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION (Attempts connection validation to SMTP host)

### `GET /api/v1/outreach/templates`

- **Route**: `/templates` (under `outreachRouter` mounted on `/outreach`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L755)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware` (bypassed if path is `/outreach`)
- **Workspace Middleware**: `workspaceMiddleware` (bypassed if path is `/outreach`)
- **Validation Schema**: None
- **Input DTO**: None
- **Output DTO**: Array of EmailTemplate records
- **Status Codes**: `200`, `403`
- **Error Responses**: `403` Forbidden
- **SDK Equivalent**: `sdk.outreach.listTemplates()` in [`outreach.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/outreach.ts#L48)
- **Used by renderer?**: Yes (via `CampaignsScreen.tsx` and `AutomationScreen.tsx` template queries)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`templates:list` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

### `POST /api/v1/outreach/templates`

- **Route**: `/templates` (under `outreachRouter` mounted on `/outreach`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L762)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware` (bypassed if path is `/outreach`)
- **Workspace Middleware**: `workspaceMiddleware` (bypassed if path is `/outreach`)
- **Validation Schema**: None
- **Input DTO**: JSON Payload (matches `CreateEmailTemplateDto`)
- **Output DTO**: Created EmailTemplate record
- **Status Codes**: `200`, `403`
- **Error Responses**: `403` Forbidden
- **SDK Equivalent**: `sdk.outreach.createTemplate(dto)` in [`outreach.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/outreach.ts#L52)
- **Used by renderer?**: Yes (via `CampaignsScreen.tsx` template designer form)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`templates:create` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

### `DELETE /api/v1/outreach/templates/:id`

- **Route**: `/templates/:id` (under `outreachRouter` mounted on `/outreach`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L770)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware`
- **Workspace Middleware**: `workspaceMiddleware`
- **Validation Schema**: None
- **Input DTO**: URL Param `{ id: string }`
- **Output DTO**: `{ success: boolean }`
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.outreach.deleteTemplate(id)` in [`outreach.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/outreach.ts#L56)
- **Used by renderer?**: Yes (via `CampaignsScreen.tsx` template delete action)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`templates:delete` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

### `GET /api/v1/outreach/templates/:id/preview`

- **Route**: `/templates/:id/preview` (under `outreachRouter` mounted on `/outreach`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L778)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware`
- **Workspace Middleware**: `workspaceMiddleware`
- **Validation Schema**: None
- **Input DTO**: URL Param `{ id: string }`, Query parameter `contactId`
- **Output DTO**: `{ subject: string, body: string }` (HTML template compiled with contact variables)
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.outreach.previewTemplate(id, contactId)` in [`outreach.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/outreach.ts#L60)
- **Used by renderer?**: Yes (via `CampaignsScreen.tsx` preview popup)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`templates:preview` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION (Interprets Liquid/mustache brackets and returns rendered strings)

---

## 9. Discovery & Scraper routes

### `POST /api/v1/discovery/search`

- **Route**: `/search` (under `discoveryRouter` mounted on `/discovery`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L415)
- **Handler Function**: Route handler for `discoverySearchRoute`
- **Authentication Middleware**: `authMiddleware` (bypassed if path is `/discovery`)
- **Workspace Middleware**: `workspaceMiddleware` (bypassed if path is `/discovery`)
- **Validation Schema**: Body: `z.object({ query: z.string() })`
- **Input DTO**: `{ query: string }`
- **Output DTO**: Mocked discovered payload of companies and contacts
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: None (Missing SDK implementation!)
- **Used by renderer?**: No
- **Used by desktop?**: No
- **Used by IPC?**: No
- **Used by tests?**: No
- **Status**: MOCK IMPLEMENTATION (Hardcoded return values inside handler)

### `GET /api/v1/discovery/jobs`

- **Route**: `/jobs` (under `discoveryRouter` mounted on `/discovery`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L448)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware` (bypassed if path is `/discovery`)
- **Workspace Middleware**: `workspaceMiddleware` (bypassed if path is `/discovery`)
- **Validation Schema**: None
- **Input DTO**: Query params `page`, `limit`
- **Output DTO**: Array of DiscoveryJob records
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.discovery.listJobs(filters)` in [`discovery.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/discovery.ts#L47)
- **Used by renderer?**: No (Screen reads direct scheduler list instead)
- **Used by desktop?**: Yes (Declared as IPC `discovery:list` but never called by renderer)
- **Used by IPC?**: Yes (`discovery:list` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

### `POST /api/v1/discovery/jobs`

- **Route**: `/jobs` (under `discoveryRouter` mounted on `/discovery`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L457)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware` (bypassed if path is `/discovery`)
- **Workspace Middleware**: `workspaceMiddleware` (bypassed if path is `/discovery`)
- **Validation Schema**: None
- **Input DTO**: `{ name: string, provider: string, query: string }`
- **Output DTO**: Newly created DiscoveryJob record
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.discovery.createJob(payload)` in [`discovery.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/discovery.ts#L55)
- **Used by renderer?**: No
- **Used by desktop?**: Yes (Registered under IPC `discovery:create` but never called)
- **Used by IPC?**: Yes (`discovery:create` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

### `GET /api/v1/discovery/jobs/:id`

- **Route**: `/jobs/:id` (under `discoveryRouter` mounted on `/discovery`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L465)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware`
- **Workspace Middleware**: `workspaceMiddleware`
- **Validation Schema**: None
- **Input DTO**: URL Param `{ id: string }`
- **Output DTO**: DiscoveryJob details
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.discovery.getJob(id)` in [`discovery.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/discovery.ts#L62)
- **Used by renderer?**: No
- **Used by desktop?**: Yes (Registered under IPC `discovery:get` but never called)
- **Used by IPC?**: Yes (`discovery:get` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

### `GET /api/v1/discovery/jobs/:id/results`

- **Route**: `/jobs/:id/results` (under `discoveryRouter` mounted on `/discovery`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L473)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware`
- **Workspace Middleware**: `workspaceMiddleware`
- **Validation Schema**: None
- **Input DTO**: URL Param `{ id: string }`
- **Output DTO**: Array of scraped DiscoveryResult records
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.discovery.getJobResults(id)` in [`discovery.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/discovery.ts#L69)
- **Used by renderer?**: No
- **Used by desktop?**: Yes (Registered under IPC `discovery:results` but never called)
- **Used by IPC?**: Yes (`discovery:results` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

### `POST /api/v1/discovery/results/:id/import`

- **Route**: `/results/:id/import` (under `discoveryRouter` mounted on `/discovery`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L481)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware`
- **Workspace Middleware**: `workspaceMiddleware`
- **Validation Schema**: None
- **Input DTO**: URL Param `{ id: string }`
- **Output DTO**: Updated DiscoveryResult
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.discovery.importResult(id)` in [`discovery.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/discovery.ts#L76)
- **Used by renderer?**: No
- **Used by desktop?**: Yes (Registered under IPC `discovery:import` but never called)
- **Used by IPC?**: Yes (`discovery:import` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

### `POST /api/v1/discovery/results/:id/skip`

- **Route**: `/results/:id/skip` (under `discoveryRouter` mounted on `/discovery`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L489)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware`
- **Workspace Middleware**: `workspaceMiddleware`
- **Validation Schema**: None
- **Input DTO**: URL Param `{ id: string }`
- **Output DTO**: Updated DiscoveryResult
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.discovery.skipResult(id)` in [`discovery.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/discovery.ts#L83)
- **Used by renderer?**: No
- **Used by desktop?**: Yes (Registered under IPC `discovery:skip` but never called)
- **Used by IPC?**: Yes (`discovery:skip` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

---

## 10. Audit Activities log routes

### `GET /api/v1/activities`

- **Route**: `/` (under `activitiesRouter` mounted on `/activities`)
- **Handler File**: [`apps/api/src/routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts#L789)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware` (bypassed if path is `/activities`)
- **Workspace Middleware**: `workspaceMiddleware` (bypassed if path is `/activities`)
- **Validation Schema**: None
- **Input DTO**: Query params `page`, `limit`
- **Output DTO**: Array of Activity logs
- **Status Codes**: `200`, `403`
- **Error Responses**: `403` Forbidden
- **SDK Equivalent**: `sdk.activities.list(filters)` in [`activities.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/activities.ts#L12)
- **Used by renderer?**: No (Renderer queries local SQLite tables instead)
- **Used by desktop?**: No
- **Used by IPC?**: No (The IPC handler `activities:list` queries local SQLite cache directly)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

---

## 11. Automation Sequences & Executions routes

### `GET /api/v1/automation/sequences`

- **Route**: `/sequences` (under `automationRouter` mounted on `/automation`)
- **Handler File**: [`apps/api/src/routes/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/automation.ts#L17)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware` (bypassed if path is `/automation`)
- **Workspace Middleware**: `workspaceMiddleware` (bypassed if path is `/automation`)
- **Validation Schema**: None
- **Input DTO**: None
- **Output DTO**: Array of Sequence records
- **Status Codes**: `200`, `403`
- **Error Responses**: `403` Forbidden
- **SDK Equivalent**: `sdk.sequences.list()` in [`automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/automation.ts#L13)
- **Used by renderer?**: Yes (via `SyncSequenceRepository.listAndSync` -> `sequence:list` IPC)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`sequence:list` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

### `GET /api/v1/automation/sequences/:id`

- **Route**: `/sequences/:id` (under `automationRouter` mounted on `/automation`)
- **Handler File**: [`apps/api/src/routes/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/automation.ts#L24)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware`
- **Workspace Middleware**: `workspaceMiddleware`
- **Validation Schema**: None
- **Input DTO**: URL Param `{ id: string }`
- **Output DTO**: Sequence record
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.sequences.get(id)` in [`automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/automation.ts#L17)
- **Used by renderer?**: Yes (via `SyncSequenceRepository.findById` -> `sequence:get` IPC)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`sequence:get` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

### `POST /api/v1/automation/sequences`

- **Route**: `/sequences` (under `automationRouter` mounted on `/automation`)
- **Handler File**: [`apps/api/src/routes/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/automation.ts#L32)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware` (bypassed if path is `/automation`)
- **Workspace Middleware**: `workspaceMiddleware` (bypassed if path is `/automation`)
- **Validation Schema**: None
- **Input DTO**: JSON Payload (matches `CreateSequenceDto`)
- **Output DTO**: Created Sequence record
- **Status Codes**: `200`, `403`
- **Error Responses**: `403` Forbidden
- **SDK Equivalent**: `sdk.sequences.create(dto)` in [`automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/automation.ts#L21)
- **Used by renderer?**: Yes (via `AutomationScreen.tsx` add form -> `sequence:create` IPC)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`sequence:create` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

### `PATCH /api/v1/automation/sequences/:id`

- **Route**: `/sequences/:id` (under `automationRouter` mounted on `/automation`)
- **Handler File**: [`apps/api/src/routes/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/automation.ts#L40)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware`
- **Workspace Middleware**: `workspaceMiddleware`
- **Validation Schema**: None
- **Input DTO**: Update JSON Payload (matches `UpdateSequenceDto`)
- **Output DTO**: Updated Sequence record
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.sequences.update(id, dto)` in [`automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/automation.ts#L25)
- **Used by renderer?**: Yes (via `AutomationScreen.tsx` edit form -> `sequence:update` IPC)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`sequence:update` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

### `DELETE /api/v1/automation/sequences/:id`

- **Route**: `/sequences/:id` (under `automationRouter` mounted on `/automation`)
- **Handler File**: [`apps/api/src/routes/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/automation.ts#L49)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware`
- **Workspace Middleware**: `workspaceMiddleware`
- **Validation Schema**: None
- **Input DTO**: URL Param `{ id: string }`
- **Output DTO**: `{ success: boolean }`
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.sequences.delete(id)` in [`automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/automation.ts#L29)
- **Used by renderer?**: Yes (via `AutomationScreen.tsx` delete button -> `sequence:delete` IPC)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`sequence:delete` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION (Deletes sequence from DB)

### `GET /api/v1/automation/executions`

- **Route**: `/executions` (under `automationRouter` mounted on `/automation`)
- **Handler File**: [`apps/api/src/routes/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/automation.ts#L59)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware` (bypassed if path is `/automation`)
- **Workspace Middleware**: `workspaceMiddleware` (bypassed if path is `/automation`)
- **Validation Schema**: None
- **Input DTO**: None
- **Output DTO**: Array of SequenceExecution records
- **Status Codes**: `200`, `403`
- **Error Responses**: `403` Forbidden
- **SDK Equivalent**: `sdk.executions.list()` in [`automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/automation.ts#L37)
- **Used by renderer?**: Yes (via `SyncSequenceExecutionRepository.listAndSync` -> `execution:list` IPC)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`execution:list` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

### `GET /api/v1/automation/executions/:id`

- **Route**: `/executions/:id` (under `automationRouter` mounted on `/automation`)
- **Handler File**: [`apps/api/src/routes/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/automation.ts#L66)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware`
- **Workspace Middleware**: `workspaceMiddleware`
- **Validation Schema**: None
- **Input DTO**: URL Param `{ id: string }`
- **Output DTO**: SequenceExecution details
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.executions.get(id)` in [`automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/automation.ts#L41)
- **Used by renderer?**: Yes (via `SyncSequenceExecutionRepository.findById` -> `execution:get` IPC)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`execution:get` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

### `POST /api/v1/automation/executions/start`

- **Route**: `/executions/start` (under `automationRouter` mounted on `/automation`)
- **Handler File**: [`apps/api/src/routes/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/automation.ts#L74)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware` (bypassed if path is `/automation`)
- **Workspace Middleware**: `workspaceMiddleware` (bypassed if path is `/automation`)
- **Validation Schema**: None
- **Input DTO**: `{ sequenceId: string, contactId?: string, companyId?: string }`
- **Output DTO**: Started SequenceExecution details
- **Status Codes**: `200`, `403`
- **Error Responses**: `403` Forbidden
- **SDK Equivalent**: `sdk.executions.start(sequenceId, contactId, companyId)` in [`automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/automation.ts#L45)
- **Used by renderer?**: Yes (via `useStartSequence` hook -> `sequence:start` IPC)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`sequence:start` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION (Spawns a sequence execution thread on the backend)

### `POST /api/v1/automation/executions/:id/stop`

- **Route**: `/executions/:id/stop` (under `automationRouter` mounted on `/automation`)
- **Handler File**: [`apps/api/src/routes/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/automation.ts#L82)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware`
- **Workspace Middleware**: `workspaceMiddleware`
- **Validation Schema**: None
- **Input DTO**: URL Param `{ id: string }`
- **Output DTO**: Stopped SequenceExecution details
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.executions.stop(id)` in [`automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/automation.ts#L53)
- **Used by renderer?**: Yes (via `useStopSequence` hook -> `sequence:stop` IPC)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`sequence:stop` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

### `GET /api/v1/automation/executions/:id/logs`

- **Route**: `/executions/:id/logs` (under `automationRouter` mounted on `/automation`)
- **Handler File**: [`apps/api/src/routes/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/automation.ts#L90)
- **Handler Function**: Anonymous handler
- **Authentication Middleware**: `authMiddleware`
- **Workspace Middleware**: `workspaceMiddleware`
- **Validation Schema**: None
- **Input DTO**: URL Param `{ id: string }`
- **Output DTO**: Array of SequenceLog records
- **Status Codes**: `200`
- **Error Responses**: Standard middleware errors
- **SDK Equivalent**: `sdk.executions.getLogs(id)` in [`automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/automation.ts#L57)
- **Used by renderer?**: Yes (via `useSequenceLogs` hook -> `execution:logs` IPC)
- **Used by desktop?**: Yes
- **Used by IPC?**: Yes (`execution:logs` channel)
- **Used by tests?**: No
- **Status**: REAL IMPLEMENTATION

---

## Endpoint Summaries

### Implemented Endpoints

All endpoints listed in this document are technically implemented, except for details listed below.

### Missing Endpoints

- `GET /api/v1/outreach` — Declared in `OutreachModule` SDK as `list()`, but no endpoint exists in the API.
- `POST /api/v1/outreach` — Declared in `OutreachModule` SDK as `send()`, but no endpoint exists in the API.

### Duplicate Endpoints

- None.

### Deprecated Endpoints

- None.

### Unused Endpoints

The following endpoints exist in the API but are never triggered by the desktop/renderer code:

- `GET /api/v1/`
- `GET /api/v1/version`
- `GET /api/v1/companies` (and `GET /companies/:id`)
- `GET /api/v1/contacts` (and `GET /contacts/:id`)
- `GET /api/v1/campaigns` (and `GET /campaigns/:id`)
- `GET /api/v1/activities`
- `GET /api/v1/discovery/jobs` (and sub-endpoints `GET /jobs/:id`, `GET /jobs/:id/results`, `POST /results/:id/import`, `POST /results/:id/skip`, `POST /jobs`)
- `POST /api/v1/discovery/search`

### Broken Endpoints

- `GET /api/v1/companies` (and list endpoints without trailing slash: `/contacts`, `/campaigns`, `/activities`, `/automation/sequences`, `/automation/executions`) — Bypasses `authMiddleware`/`workspaceMiddleware` in Hono because the wildcard pattern `/companies/*` does not match the trailing-slash-free root path. These requests fail with `403 Forbidden` (`Workspace context required.`) when hit directly via the SDK.

### Mock Endpoints

- `GET /api/v1/`
- `GET /api/v1/version`
- `POST /api/v1/discovery/search` (returns hardcoded JSON object)
