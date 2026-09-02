# Phase 1 Forensic Document 03 — API Runtime Reality & Availability Audit

**Document Type:** Forensic Process & Network Architecture Audit  
**Audited Against:** `package.json`, `apps/api/package.json`, `apps/desktop/package.json`, `apps/desktop/src/main/lib/config.ts`  
**Date:** September 2026  
**Status:** Authoritative Baseline  

---

## 1. Process Ownership & Execution Model

### The Core Architectural Reality:
The Hono REST API (`apps/api`) is a **completely standalone Node.js process**.

- **Does Electron spawn the API?** **NO.** Electron main process contains zero child process spawning logic or process management for `apps/api`.
- **Who starts the API in Development?** Turborepo (`pnpm dev` at root) starts both `api` and `desktop` concurrently via `turbo.json`.
- **What happens if only Electron is launched?** (e.g. running `pnpm --filter @leadforge/desktop dev` or launching packaged desktop app): Electron launches alone, expects the API to already be listening on `http://localhost:3001/api/v1` (or production endpoint), and immediately encounters `ECONNREFUSED` / `fetch failed`.

---

## 2. Environment & Network Configuration

| Property | Development Default | Production Default | Environment Variable Control | File Location |
| :--- | :--- | :--- | :--- | :--- |
| **API Server Port** | `3001` | Cloud / Reverse Proxy | `PORT` | [`apps/api/.env:2`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/.env#L2) |
| **API Base URL (Desktop Config)** | `http://localhost:3001/api/v1` | `https://api.leadforge.kapiljangid.pro/api/v1` | `API_URL` | [`apps/desktop/src/main/lib/config.ts:4-5`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/lib/config.ts#L4-L5) |
| **Better Auth URL** | `http://localhost:3001/api/v1/auth` | `https://api.leadforge.kapiljangid.pro/api/v1/auth` | `BETTER_AUTH_URL` | [`apps/api/.env:5`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/.env#L5) |
| **MongoDB Connection URI** | `mongodb://localhost:27017/leadforge-os` | Remote MongoDB Atlas URI | `MONGODB_URI` | [`apps/api/.env:3`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/.env#L3) |

---

## 3. What Happens When API Is Unavailable (ECONNREFUSED / Network Down)

When the API server is offline or unreachable:

1. **Session Restoration Passes Silently:**
   - `loadSession()` reads `%APPDATA%/leadforge/config.json`.
   - If an active workspace and access token exist in `config.json`, the app considers the user "Logged In" without performing any online validation or health check.

2. **Workspace Runtime Boots Successfully:**
   - `WorkspaceManager.setActiveWorkspace(wsId)` completes and sets `activeRuntime`.
   - Splash screen shows green checkmarks (`✓ Ready`).

3. **Cache Hydration Fails Repeatedly:**
   - `CacheHydrator.hydrateWorkspaceCache()` invokes 10 SDK list endpoints:
     - `sdk.companies.list()` -> `TypeError: fetch failed (ECONNREFUSED)`
     - `sdk.contacts.list()` -> `TypeError: fetch failed (ECONNREFUSED)`
     - `sdk.campaigns.list()` -> `TypeError: fetch failed (ECONNREFUSED)`
     - `sdk.sequences.list()` -> `TypeError: fetch failed (ECONNREFUSED)`
     - `sdk.executions.list()` -> `TypeError: fetch failed (ECONNREFUSED)`
     - `sdk.outreach.listAccounts()` -> `TypeError: fetch failed (ECONNREFUSED)`
     - `sdk.outreach.listTemplates()` -> `TypeError: fetch failed (ECONNREFUSED)`
     - `sdk.audiences.list()` -> `TypeError: fetch failed (ECONNREFUSED)`
     - `sdk.discovery.listRuns()` -> `TypeError: fetch failed (ECONNREFUSED)`
     - `sdk.companyDiscoveryRuns.list()` -> `TypeError: fetch failed (ECONNREFUSED)`
   - All errors are caught and logged as warnings: `[CacheHydrator] Failed to hydrate cache table "<table_name>": TypeError: fetch failed`.

4. **Continuous Background Scheduler Polling:**
   - `JobScheduler` ticks every 3000ms:
     - Calls `POST http://localhost:3001/api/v1/jobs/claim`
     - Catches network failure silently and retries in 3 seconds.

5. **False Healthy State in UI:**
   - The UI displays the main dashboard and navigation tabs normally.
   - There is NO global banner or status indicator informing the user that the API is unreachable.
   - All table views query local SQLite (`companies:query`, `contacts:query`) which return 0 records because hydration failed.
   - The user perceives this as "data vanished" or "empty database".

6. **Mutations Fail with Uncaught Errors or Toasts:**
   - If user attempts to create a company, campaign, or discovery run, IPC handler calls `sdk.companies.create(...)` which throws `fetch failed`.
   - The UI shows an error toast or gets stuck in a loading state.

---

## 4. Key Forensic Finding & Classification

> [!CAUTION]
> **Finding ID: F-API-01 — Silent Degraded Operation & Lack of Health Gate**  
> The desktop application has no connectivity gate or API health check prior to activating workspace runtimes. When the API is unreachable, the application presents a false "Healthy / Logged In" UI while background hydration and scheduler polling continuously fail, leaving the UI showing empty tables.
