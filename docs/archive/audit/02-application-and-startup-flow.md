# LeadForge OS Forensic Architecture Audit — Part 2: Application Entry, Startup, & Core Flows

This document details the layout, lifecycle, entry points, and workflows of both the API and Desktop applications.

---

## 1. Application Documentation

### 1.1 Backend API Server (`apps/api`)

The API Server handles business logic, tenant authentication via Better Auth, and Mongoose-based MongoDB interactions.

#### 1.1.1 Folder Layout

```text
apps/api/
├── src/
│   ├── config/                     # Environment variable parsing and logger config
│   ├── constants/                  # HTTP prefixes and global strings
│   ├── db/                         # MongoDB connections and Mongoose schemas
│   │   ├── connection/             # Singleton Mongoose manager & transaction runner
│   │   └── models/                 # Mongoose schema models (user, company, campaign, etc.)
│   ├── dto/                        # Data Transfer Object structures
│   ├── errors/                     # App-specific runtime error classes (ForbiddenError, etc.)
│   ├── lib/                        # OpenRouter and OpenSSL utilities
│   ├── middleware/                 # Request-id, logging, and token authorization middlewares
│   ├── openapi/                    # OpenAPI routes specification structures
│   ├── repositories/               # Mongoose DB querying interfaces
│   ├── routes/                     # Hono routing registers
│   │   ├── auth/                   # Mounts credentials/session routes
│   │   ├── health/                 # Aggregates system diagnostic checkers
│   │   ├── business.ts             # Contains CRM and Workspaces OpenAPI routing
│   │   └── index.ts                # Main API aggregation router
│   ├── services/                   # Business services layer (company.service, etc.)
│   ├── types/                      # Backend typescript definitions
│   ├── utils/                      # DTO mapping and wrapper helpers
│   ├── validators/                 # Custom body check guards
│   ├── app.ts                      # Instantiates and configures OpenAPIHono
│   └── index.ts                    # Spawns node server and starts background worker
├── package.json                    # Dependencies (hono, mongoose, better-auth)
└── tsconfig.json                   # TypeScript build settings
```

#### 1.1.2 Startup Lifecycle & Boot Sequence

1. **Shell Command**: `pnpm dev` launches `tsx watch src/index.ts`.
2. **Server Launch (`index.ts`)**: Invokes `@hono/node-server` `serve(...)` to bind the server to `env.PORT`.
3. **Database connection (`app.ts`)**: Invokes `db.connect()`, which triggers the Mongoose connection manager. This attempts to connect to the MongoDB URI with a 5-attempt retry limit.
4. **App Initialization**: Instantiates `OpenAPIHono`. It mounts standard compression and CORS headers, followed by `requestIdMiddleware` and `loggerMiddleware`.
5. **Route Mounting**: Mounts `apiRouter` on the `/api/v1` prefix.
6. **Automation Startup**: Invokes `SequenceWorker.start()` to spin up the background automation sequence queue processor.
7. **Signal Registration**: Binds listener events on `SIGINT` and `SIGTERM` to perform a graceful shutdown (stopping workers, closing the HTTP server, and disconnecting the database cleanly).

---

### 1.2 Electron Desktop client (`apps/desktop`)

Runs the user-facing GUI, maps IPC channels, and administers the SQLite read cache/write queue.

#### 1.2.1 Folder Layout

```text
apps/desktop/
├── src/
│   ├── main/                       # Electron main process
│   │   ├── database/               # better-sqlite3 connection & migration runner
│   │   │   └── repositories/       # Local database caching repositories
│   │   ├── ipc/                    # Domain-level handlers (auth, crm, database, etc.)
│   │   ├── lib/                    # Logger configuration
│   │   ├── services/               # [Stub / Reserved]
│   │   ├── windows/                # BrowserWindow setups
│   │   └── index.ts                # Main entrypoint
│   ├── preload/
│   │   └── index.ts                # contextBridge setup exposing safe IPC interfaces
│   ├── renderer/                   # React GUI application
│   │   ├── app/                    # Mounting layer
│   │   ├── components/             # Reusable UI controls and Shadcn primitives
│   │   ├── hooks/                  # Custom react hooks (useAuth, useWorkspace, useEntity)
│   │   ├── layouts/                # AppLayout, AuthLayout structures
│   │   ├── providers/              # AppProviders (React Query client initialization)
│   │   ├── repositories/           # Sync and remote repositories
│   │   ├── router/                 # React Router HashRouter mapping and guards
│   │   ├── screens/                # Dashboard, Companies, Discovery, etc.
│   │   ├── services/               # UI-side services (AuthService, WorkspaceService)
│   │   ├── stores/                 # Zustand-like context state stores
│   │   ├── styles/                 # global CSS theme imports
│   │   └── sync/                   # SyncWorker and QueueProcessor polling engines
│   └── shared/                     # Shared IPC types (IpcContract)
├── electron.vite.config.js         # electron-vite build options
├── electron-builder.yml            # Compilation parameters for packaging
└── package.json                    # Client dependencies (better-sqlite3, react, vite)
```

---

## 2. System Startup Flow

The diagram below traces the end-to-end boot sequence of the desktop app:

```text
Electron Starts
      │
      ▼
main/index.ts (whenReady)
      │
      ├───► Database: getDatabase() → runMigrations() (applies 001 to 004 sqlite schemas)
      │
      ├───► SDK Client: Instantiate SdkClient with process.env.API_URL
      │
      ├───► IPC: RegisterAllIpc() maps channels utilizing safeRegister()
      │
      └───► Window: Spawns BrowserWindow loading HashRouter index.html
                  │
                  ▼
            Renderer: main.tsx mounts AppProviders and AppRouter
                  │
                  ▼
            SessionBootstrap (router/index.tsx)
                  │
                  ▼
            useAuth().restoreSession() called
                  │
                  ├───► IPC: invoke('auth:session')
                  │      │
                  │      ▼
                  │     SDK Client GET /auth/session
                  │      │
                  │      ├───► If Valid: returns token & user DTO
                  │      │     │
                  │      │     ▼
                  │      │    setAuthenticated() in auth-store
                  │      │     │
                  │      │     ▼
                  │      │    WorkspaceService.listWorkspaces()
                  │      │    sets workspaces + active in workspace-store
                  │      │     │
                  │      │     ▼
                  │      │    Redirect to /dashboard (Protected Outlet)
                  │      │
                  │      └───► If Invalid: returns null
                  │            │
                  │            ▼
                  │           setUnauthenticated()
                  │            │
                  │            ▼
                  │           Redirect to /auth/login (Guest Outlet)
```

---

## 3. Authentication Flow

### 3.1 Session Restoration, Token Storage, and Headers

LeadForge OS uses Bearer token authentication.

- **Storage**: When a user logs in or registers successfully, the API server returns a token. The Electron Main process stores the token in memory (`activeToken` in `main/index.ts`). The SDK client uses a `tokenResolver` function `() => activeToken` to resolve this token dynamically.
- **Header Injection**: For every request generated by the SDK client, the HTTP client appends the header: `Authorization: Bearer <token>`.
- **Tenant Scope**: If an active workspace is selected, Electron Main injects `x-workspace-id` into the SDK custom headers object: `customHeaders['x-workspace-id'] = workspaceId`.
- **Session Check**: On restart, the renderer invokes `auth:session`. Electron Main forwards this to Hono API `/auth/session`. Better Auth checks the Bearer header and yields the corresponding MongoDB session detail.

### 3.2 Authentication Pipeline (Sign-in / Sign-up)

```
[UI Screen] LoginScreen.tsx
     │  (Clicks Sign In)
     ▼
[Hook] useAuth().login(email, password)
     │
     ▼
[Service] AuthService.login({ email, password })
     │
     ▼
[Preload] window.ipc.invoke('auth:login', payload)
     │
     ▼
[Main Process] ipcMain.handle('auth:login') → sdk.auth.login(payload)
     │
     ▼
[SDK Client] HttpClient.post('/auth/login', payload)
     │  (POST Request)
     ▼
[Hono API] /api/v1/auth/login Route
     │
     ▼
[Better Auth] betterAuth instance credentials provider checks database
     │  (Database check)
     ▼
[Mongoose] Mongoose queries MongoDB Atlas UserModel
     │  (Yields user session)
     ▼
[Hono API] Generates token and responds with User DTO & Token
     │
     ▼
[Main Process] Receives token, calls setToken() & setWorkspaceHeader()
     │
     ▼
[Hook] setAuthenticated(user, token) updates Zustand stores
     │
     ▼
[Workspace] WorkspaceService.listWorkspaces() fetches user workspaces
     │
     ▼
[Zustand] workspaceStore.setWorkspaces() populates UI select list
     │
     ▼
[Router] ProtectedRoute detects state.status === 'authenticated' → renders Outlet (Dashboard)
```

---

## 4. Workspace Flow

Workspaces are the primary boundary for data isolation in LeadForge OS.

### 4.1 Workspace Creation and Selection

1. **Creation**: When a user creates a workspace (e.g., from workspace settings page), the UI triggers `WorkspaceService.createWorkspace(name)`. This sends the request through `workspaces:create` IPC to the SDK, which posts to `/api/v1/workspaces/` in the Hono API.
2. **Selection**: Upon selection, the workspace ID is saved in local desktop configuration store (`config.json` inside the Electron `userData` path).
3. **Restoration**: On boot, Electron Main reads `activeWorkspaceId` from `config.json` via `getPersistedActiveWorkspace()`. It then runs `setWorkspaceHeader(workspaceId)`, which injects `x-workspace-id` into all subsequent SDK HTTP requests.

### 4.2 Workspace Isolation & Access Validation

- **Backend Isolation**: Every CRUD query for CRM entities requires workspace scope. When a request hits Hono API, `workspaceMiddleware` extracts `x-workspace-id`. It validates that the authenticated user is indeed a member of that workspace:
  ```typescript
  // apps/api/src/middleware/auth.ts
  const user = c.get('user');
  const workspaceId = c.req.header('x-workspace-id');
  // verify user has access to workspaceId in database
  ```
- **Frontend Isolation**: SQLite tables enforce workspace isolation using the `workspaceId` column. Query handlers like `db:find` explicitly throw an error if `workspaceId` is not provided:
  ```typescript
  if (!workspaceId) throw new Error('workspaceId is required for SQLite queries.');
  ```

### 4.3 Workspace Switching and Cache Invalidation

When the active workspace is changed:

1. `useWorkspace().switchWorkspace(id)` is triggered.
2. The new workspace ID is sent to `WorkspaceService.syncActiveWorkspace(id)`, writing to `config.json` on the disk via `electron:setActiveWorkspace`.
3. The renderer triggers a full cache invalidation on the TanStack Query client: `queryClient.invalidateQueries()`. This clears the query cache and forces a reload from the newly scoped SQLite database cache.
