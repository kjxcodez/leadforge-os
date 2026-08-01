# LeadForge OS Forensic Architecture Audit — Part 5: Client & Desktop Architectures

This document details the React renderer, the Electron shell integration, background worker engines, and package dependencies.

---

## 1. Renderer Architecture (React)

The React renderer process runs inside a sandboxed Chromium browser window and manages state and rendering of the GTM dashboard views.

### 1.1 Providers

- **`AppProviders` (`AppProviders.tsx`)**: Wraps the React tree with global provider components:
  - `HashRouter` (via React Router v7)
  - `QueryClientProvider` (TanStack React Query v5 query client)
  - `ThemeProvider` (administers light/dark mode css classes)
  - `Toaster` (from `sonner` to display transient system warnings and sync notifications)
  - `TooltipProvider`

### 1.2 State Stores (Zustand Context)

Instead of a single global store, state is divided into context-level stores under `renderer/stores/`:

1. **`auth-store.tsx`**: Maps session details (`user`, `token`, `status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated'`).
2. **`workspace-store.tsx`**: Tracks the array of user workspaces and the currently selected `activeWorkspace`.
3. **`ui-store.tsx`**: Manages modal states (invitations, workspace creations) and sidebar expands.
4. **`settings-store.tsx`**: Tracks local user settings (language preferences, theme class states).

### 1.3 Routing and Guards

- **Routing**: Setup via `react-router-dom` `createHashRouter`. The root path `/` redirects to `/dashboard` nested inside `AppLayout`.
- **`GuestRoute`**: Restricts auth paths `/auth/login` and `/auth/register` to unauthenticated sessions. Redirects to `/` if authenticated.
- **`ProtectedRoute`**: Restricts dashboard and CRM screens to authenticated sessions. Redirects to `/auth/login` if unauthenticated.
- **Layouts**:
  - `AppLayout`: Side navigation layout showing `AppSidebar` and `AppHeader`, mounting sub-routes via `<Outlet />`.
  - `AuthLayout`: Centered modal container for login/register credentials forms.
  - `BlankLayout`: Clean viewport for Splash screen.

### 1.4 Hooks & UI Primitives

- **`useEntity.ts`**: Reusable generic CRUD hook wrapping queries and mutations for companies, contacts, and campaigns.
- **`useWorkspace.ts`**: High-level hook managing active workspace switches, sync states, and invites lists.
- **`useWorkspaceQuery.ts`**: Generates workspace-scoped hooks dynamically.
- **UI Primitives**: Located under `components/ui/` (custom shadcn bindings for `Button`, `Dialog`, `Input`, `Table`, etc.).

---

## 2. Desktop Architecture (Electron Main)

The Electron Main process runs in a Node.js runtime and manages application lifecycles and OS level operations.

### 2.1 Bootstrapping and Security Settings

- **Sandbox**: Chromium renderer processes are strictly sandboxed: `sandbox: true`, `contextIsolation: true`, and `nodeIntegration: false` are set.
- **Link Controls**: The `setWindowOpenHandler` event checks URL protocols. If it matches `http://` or `https://`, it intercepts the click and invokes `shell.openExternal(url)` to spawn the page in the host computer's default browser, preventing target URLs from hijacking the Electron shell.
- **App Menu**: Destroys the default Electron menu bar (`Menu.setApplicationMenu(null)`) for clean B2B SaaS window appearance.

### 2.2 IPC Bridge & Preload Allowlist

- The Preload script (`preload/index.ts`) exposes safe channels under the `window.ipc` namespace.
- **Allowlist Enforcements**: The preload bridge checks requests against a hardcoded array of `validChannels`. Any attempt to trigger an unlisted channel throws an error before reaching Electron Main.
- **Hot-Reload Crash Recovery (`safeRegister`)**: Main process channels are registered using `safeRegister(channel, handler)`. This utility automatically invokes `ipcMain.removeHandler(channel)` before adding the new handle, preventing fatal handler duplicate register crashes when Vite Hot Module Replacement (HMR) reloads main files during development.

---

## 3. Feature Documentation

### 3.1 Authentication

- **Entry Points**: `LoginScreen.tsx` / `RegisterScreen.tsx`.
- **Underlying Flow**: UI triggers hook -> AuthService -> `auth:login` IPC -> SDK Client -> Hono API -> Better Auth -> MongoDB. The returned Bearer token is saved in Main process memory.

### 3.2 Workspace Management

- **Entry Points**: `WorkspaceSettingsScreen.tsx` / `WorkspaceInvitesScreen.tsx`.
- **Underlying Flow**: Workspace lists are cached in SQLite. Member roles, invitations, and creations sync to Atlas and invalidate queries to force UI refreshes.

### 3.3 CRM (Companies, Contacts, Campaigns)

- **Entry Points**: `CompaniesScreen.tsx`, `ContactsScreen.tsx`, `CampaignsScreen.tsx`.
- **Underlying Flow**: Reads hit SQLite first (`db:find`), then trigger background pulls from MongoDB Atlas. Writes write to SQLite immediately and queue mutations in `sync_queue` if offline.

### 3.4 Discovery Engine

- **Entry Points**: `DiscoveryScreen.tsx`.
- **Underlying Flow**: Users queue scraping tasks. Hono API runs `runJobSimulation` simulating lead extraction and writing results to `DiscoveryResultModel`. Users skip or import results into the CRM, which fires `CONTACT_CREATED` sequences.

### 3.5 Outreach & Automation

- **Entry Points**: `AutomationScreen.tsx`, `SettingsScreen.tsx`.
- **Underlying Flow**: Users configure email accounts, email templates, and automated workflows. Sequencer models track delays and trigger outbound SMTP emails when conditions match.

---

## 4. Background Workers & Lifecycles

LeadForge OS runs multiple workers on the desktop client and backend API.

### 4.1 Client-Side Workers

#### 1. `SyncWorker` (React Renderer)

- **Lifecycle**: Initiated on `AppLayout` mount when a workspace ID is loaded. Stopped on unmount or active workspace change.
- **Interval Loop**: Polls every 60 seconds (or immediately when the window fires an `online` event).
- **Duties**: Invokes `QueueProcessor.processQueue()` to push offline changes, runs `listAndSync()` on CRM repositories, and invalidates TanStack Query client.

#### 2. `QueueProcessor` (React Renderer helper)

- **Lifecycle**: Invoked by the `SyncWorker`.
- **Duties**: Pulls pending items from SQLite `sync_queue`, calls remote API equivalents via `window.ipc.invoke()`, saves successful results to SQLite as `synced`, and deletes the queue entry.

### 4.2 Backend-Side Workers

#### 1. `SequenceWorker` (apps/api)

- **Lifecycle**: Started on API Node server bootstrap (`index.ts`).
- **Interval Loop**: Polls the database every 10 seconds.
- **Duties**: Resolves `WAITING` sequence executions whose target delays have passed and stale `RUNNING` executions. Sets execution state to `RUNNING` and executes the next automation sequence step.

---

## 5. Monorepo Dependency Graph

The Turborepo package dependency boundaries are strictly mapped to prevent circular dependency imports:

```text
       +--------------------+      +--------------------+
       |  apps/desktop (UI) |      |   apps/api (Svr)   |
       +---------+----------+      +---------+----------+
                 |                           |
                 ├──► @leadforge/sdk         ├──► @leadforge/auth
                 |                           |
                 ├──► @leadforge/core        ├──► @leadforge/core
                 |                           |
                 ├──► @leadforge/schema      ├──► @leadforge/schema
                 |                           |
                 |                           ├──► @leadforge/logger
                 |                           |
                 |                           ├──► @leadforge/workflows
                 |                           |
                 |                           ├──► @leadforge/prompts
                 |                           |
                 |                           └──► @leadforge/integrations
                 |
                 v
        +-------------------------------------------------+
        |                 Shared Packages                 |
        |                                                 |
        |  @leadforge/sdk  ───────► @leadforge/schema     |
        |  @leadforge/sdk  ───────► @leadforge/core       |
        |  @leadforge/auth ───────► @leadforge/schema     |
        |  @leadforge/auth ───────► @leadforge/core       |
        |  @leadforge/core ───────► @leadforge/schema     |
        |                                                 |
        +-------------------------------------------------+
```

### 5.1 Permitted Layer Mappings

- `apps/desktop` is allowed to depend on `@leadforge/sdk`, `@leadforge/core`, and `@leadforge/schema`. It **must never** depend on `@leadforge/auth` (to avoid bundling direct MongoDB drivers into the client build) or `@leadforge/workflows`/`@leadforge/integrations`.
- `apps/api` can depend on all core packages.
- Shared packages can only depend on `@leadforge/schema` and `@leadforge/core`. No shared package is allowed to depend on `apps/*`.
