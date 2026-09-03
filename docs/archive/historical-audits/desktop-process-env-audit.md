# Final Desktop Environment Audit — `process.env` Forensic Review

**Author**: Antigravity  
**Target Release**: v1.1.1-beta.1  
**Subject**: Exhaustive Inventory, Process Visibility, Security Classification, and Hardening Plan for all `process.env` Usage in LeadForge OS Desktop  
**Date**: August 2026  

---

## 1. Executive Summary

A comprehensive forensic audit of all `process.env` usage across the LeadForge OS Desktop codebase (`apps/desktop/**`, `packages/sdk/**`, `packages/schema/**`, `.github/workflows/**`) was conducted.

### Key Conclusions:
1. **Renderer Process Isolation**: Preload and Renderer contain **0** references to `process.env`. Neither secrets nor environment variables are exposed across the context bridge.
2. **Authoritative Main Configuration**: Electron Main (`apps/desktop/src/main/lib/config.ts`) acts as the single source of truth for runtime configuration. In packaged production, it uses checked-in constants and persisted `userData/config.json` without depending on `.env`.
3. **Strict Worker Process Whitelist**: `scheduler.ts` spawns workers via `fork()` with a strict 4-variable whitelist (`WORKSPACES_DB_DIR`, `PLAYWRIGHT_BROWSERS_PATH`, `API_URL`, `NODE_ENV`). Workers do not inherit parent environment arbitrarily.
4. **Dead Fallback Cleanup Identified**:
   - `SESSION_TOKEN` in `automation.ts` and `outreach.ts` is never passed in worker `fork()` `env` (tokens are securely passed via `ctx.payload._secrets`).
   - `LINKEDIN_COOKIE` in `linkedin.ts` is never passed in worker `fork()` `env` (cookies are securely passed via `ctx.payload._secrets` or read from workspace SQLite).
   - 7 worker plugins redundantly re-derived `dbPath` from `process.env.WORKSPACES_DB_DIR` instead of using `ctx.dbPath` already provided on `JobContext`.

---

## 2. Complete Inventory Table (Part 1 & Part 2)

| Variable | File(s) | Process | Usage Description | Value Source | Required? | Production Safe? | Classification | Decision |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`API_URL`** | `apps/desktop/src/main/lib/config.ts` | Main | Optional override for API server endpoint | `apps/desktop/.env` in dev; user override in prod | Optional | ✅ Safe (defaults to prod constant if undefined) | **C. VALID DEV-ONLY ENV** | **KEEP** |
| **`API_URL`** | `apps/desktop/src/main/workers/worker-host.ts` | Worker | Backup resolution in `resolveWorkerApiUrl()` | Injected by `scheduler.ts` at `fork()` | Backup | ✅ Safe (primary channel is `_config.apiUrl`) | **F. WORKER PAYLOAD CONFIG** | **KEEP** |
| **`NODE_ENV`** | `apps/desktop/src/main/lib/config.ts` | Main | Dev environment detection fallback in Node test runners | Set by Vite/Node runtime | Yes | ✅ Safe (Electron uses `app.isPackaged`) | **A. VALID RUNTIME ENV** | **KEEP** |
| **`NODE_ENV`** | `apps/desktop/src/main/services/scheduler.ts` | Main → Worker | Forwards runtime mode to worker child process | Host Node runtime | Yes | ✅ Safe | **A. VALID RUNTIME ENV** | **KEEP** |
| **`WORKSPACES_DB_DIR`** | `apps/desktop/src/main/services/scheduler.ts` | Main → Worker | Injects SQLite database directory into worker environment | `join(app.getPath('userData'), 'workspaces')` | Yes | ✅ Safe (deterministic Main path) | **E. MAIN CONFIGURATION** | **KEEP** |
| **`WORKSPACES_DB_DIR`** | `apps/desktop/src/main/workers/worker-host.ts` | Worker Host | Derives `ctx.dbPath` for `JobContext` | Injected by `scheduler.ts` at `fork()` | Yes | ✅ Safe | **E. MAIN CONFIGURATION** | **KEEP** |
| **`WORKSPACES_DB_DIR`** | `scraper.ts`, `crawler.ts`, `enricher.ts`, `outreach.ts`, `linkedin.ts`, `imap-poller.ts`, `intelligence-worker.ts` | Worker Plugins | Redundant re-computation of `dbPath` | Injected by `scheduler.ts` at `fork()` | No | ✅ Safe (but redundant with `ctx.dbPath`) | **G. UNNECESSARY** | **REPLACE** (with `ctx.dbPath`) |
| **`PLAYWRIGHT_BROWSERS_PATH`** | `apps/desktop/src/main/lib/playwright-setup.ts` | Main | Directs `playwright-core` to use app's `userData/playwright-browsers` | Main programmatic setup | Yes | ✅ Safe (third-party library contract) | **A. VALID RUNTIME ENV** | **KEEP** |
| **`PLAYWRIGHT_BROWSERS_PATH`** | `apps/desktop/src/main/services/scheduler.ts` | Main → Worker | Forwards Playwright browser directory to worker child process | Injected by `scheduler.ts` at `fork()` | Yes | ✅ Safe | **A. VALID RUNTIME ENV** | **KEEP** |
| **`OPENROUTER_API_KEY`** | `apps/desktop/src/main/lib/config.ts` | Main | Dev fallback for OpenRouter key | `apps/desktop/.env` in dev | Optional | ✅ Safe (prod uses encrypted SQLite) | **C. VALID DEV-ONLY ENV** | **KEEP** |
| **`AI_PROVIDER`** | `apps/desktop/src/main/lib/config.ts` | Main | Dev override for AI provider selection | `apps/desktop/.env` in dev | Optional | ✅ Safe (defaults to mock/settings) | **C. VALID DEV-ONLY ENV** | **KEEP** |
| **`ELECTRON_RENDERER_URL`** | `apps/desktop/src/main/index.ts` | Main | Loads Vite dev server URL during `electron-vite dev` | Injected by `electron-vite` CLI | Dev-only | ✅ Safe (gated behind `is.dev`) | **C. VALID DEV-ONLY ENV** | **KEEP** |
| **`LOCALAPPDATA`** | `apps/desktop/src/main/lib/chrome-detect.ts` | Main | Windows path detection for Google Chrome | Windows OS | Yes | ✅ Safe (Standard OS variable) | **A. VALID RUNTIME ENV** | **KEEP** |
| **`PROGRAMFILES`** | `apps/desktop/src/main/lib/chrome-detect.ts` | Main | Windows 64-bit program files path for Chrome | Windows OS | Yes | ✅ Safe (Standard OS variable) | **A. VALID RUNTIME ENV** | **KEEP** |
| **`PROGRAMFILES(X86)`** | `apps/desktop/src/main/lib/chrome-detect.ts` | Main | Windows 32-bit program files path for Chrome | Windows OS | Yes | ✅ Safe (Standard OS variable) | **A. VALID RUNTIME ENV** | **KEEP** |
| **`SESSION_TOKEN`** | `automation.ts`, `outreach.ts` | Worker Plugins | Dead fallback for auth token | Never passed in `fork()` env | No | ⚠️ Dead fallback (always undefined) | **G. UNNECESSARY** | **REMOVE** |
| **`LINKEDIN_COOKIE`** | `linkedin.ts` | Worker Plugin | Dead fallback for LinkedIn session cookie | Never passed in `fork()` env | No | ⚠️ Dead fallback (always undefined) | **G. UNNECESSARY** | **REMOVE** |
| **Dynamic `.env` Parser** | `apps/desktop/src/main/index.ts` | Main | Populates `process.env` from `apps/desktop/.env` | `apps/desktop/.env` | Dev-only | ✅ Safe (no-op in packaged app) | **C. VALID DEV-ONLY ENV** | **KEEP** |

---

## 3. Process-Level Environment Analysis (Part 3)

```
========================================================================================
PROCESS ENVIRONMENT TOPOLOGY & BOUNDARIES
========================================================================================

 [ OS Environment ] (Windows LOCALAPPDATA, PROGRAMFILES, etc.)
        │
        ▼
 ┌──────────────────────────────────────────────────────────────────────────────────┐
 │ ELECTRON MAIN PROCESS                                                            │
 │ - Loads apps/desktop/.env if present (dev only)                                  │
 │ - Sets process.env.PLAYWRIGHT_BROWSERS_PATH = userData/playwright-browsers       │
 │ - Evaluates loadConfig() -> Authoritative API URL & AI config                    │
 └────────┬─────────────────────────────────────────────────┬───────────────────────┘
          │                                                 │
          │ contextBridge (Preload)                         │ fork() with env whitelist
          │                                                 │
          ▼                                                 ▼
 ┌──────────────────────────────┐         ┌─────────────────────────────────────────┐
 │ PRELOAD / RENDERER PROCESS   │         │ WORKER HOST CHILD PROCESS               │
 │ - contextIsolation: true     │         │ Whitelisted env:                        │
 │ - nodeIntegration: false     │         │   1. WORKSPACES_DB_DIR                  │
 │ - sandbox: true              │         │   2. PLAYWRIGHT_BROWSERS_PATH           │
 │ - process.env: UNDEFINED     │         │   3. API_URL                            │
 │ - 0 access to backend env    │         │   4. NODE_ENV                           │
 └──────────────────────────────┘         └────────┬────────────────────────────────┘
                                                   │
                                                   │ context: JobContext
                                                   │ (jobId, workspaceId, dbPath, payload)
                                                   │
                                                   ▼
                                          ┌─────────────────────────────────────────┐
                                          │ WORKER PLUGINS                          │
                                          │ - Receives config via ctx.payload._config│
                                          │ - Receives secrets via ctx.payload._secrets
                                          │ - Receives DB path via ctx.dbPath       │
                                          └─────────────────────────────────────────┘
========================================================================================
```

---

## 4. Architectural Findings & Hardening Recommendations

### Finding 1: Dead Environment Fallbacks in Worker Plugins
- **Evidence**: `apps/desktop/src/main/workers/plugins/automation.ts` (line 1860) and `outreach.ts` (line 68) have `process.env.SESSION_TOKEN`. `linkedin.ts` (line 82) has `process.env.LINKEDIN_COOKIE`.
- **Root Cause**: `scheduler.ts` does not pass `SESSION_TOKEN` or `LINKEDIN_COOKIE` in `fork()` `env`. These variables are always `undefined` in worker processes.
- **Remedy**: Clean up plugin code to read from `ctx.payload._secrets` directly without misleading `process.env` fallbacks.

### Finding 2: Redundant `dbPath` Derivation in 7 Worker Plugins
- **Evidence**: 7 plugins (`scraper.ts`, `crawler.ts`, `enricher.ts`, `outreach.ts`, `linkedin.ts`, `imap-poller.ts`, `intelligence-worker.ts`) manually re-construct `dbPath` from `process.env.WORKSPACES_DB_DIR`.
- **Root Cause**: `worker-host.ts` already constructs and supplies `ctx.dbPath` in `JobContext`.
- **Remedy**: Update plugins to use `ctx.dbPath` directly with a fallback to `process.env.WORKSPACES_DB_DIR` for backward compatibility.

### Finding 3: Complete Validation of API_URL Flow
- **Audit Answers**:
  1. `config.ts` is truly the only authoritative API URL resolver: **YES**.
  2. Does any worker still resolve URL independently: **NO**.
  3. Does any worker depend on missing `.env`: **NO**.
  4. Does any worker contain hardcoded API URL: **NO**.
  5. Can worker accidentally connect to localhost in production: **NO**.
  6. Can stale env var override production configuration: **NO** (in production, `process.env.API_URL` is undefined, defaulting to production constant).
  7. Can missing API URL break silently: **NO** (`resolveWorkerApiUrl` throws loud descriptive error).

---

## 5. Security & GitHub Actions Release Audit (Part 8 & Part 9)

1. **Secrets Exposure Audit**:
   - No tokens or credentials (`OPENROUTER_API_KEY`, `SESSION_TOKEN`, `LINKEDIN_COOKIE`) are exposed to the Renderer or bundled in `app.asar`.
   - In production, credentials are stored encrypted using Electron's OS-backed `safeStorage` in SQLite `settings` table and decrypted strictly in Electron Main before IPC dispatch.
2. **GitHub Actions Workflow Audit**:
   - `.github/workflows/release.yml` only sets CI-internal variables (`STORE_PATH`, `GITHUB_TOKEN`).
   - Packaged desktop build does not depend on any CI environment variables.
