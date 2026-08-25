# Desktop Runtime Configuration Forensic Audit Report (Phase 10F-R)

**Author**: Antigravity  
**Target Release**: v1.1.1-beta.1  
**Subject**: Desktop API Runtime Configuration, Environment Flow, Worker IPC Contract, and Packaged Release Validation  
**Date**: August 2026  

---

## 1. Executive Summary

A forensic audit of the LeadForge OS desktop runtime configuration was conducted to verify how the Desktop Electron application, Main process SDK client, and forked background worker processes obtain and resolve the API endpoint (`apiUrl`) across development, production packaging, and GitHub Actions CI/CD environments.

### Key Forensic Findings:
1. **Repository `.env` is NOT available in packaged production**: `.env` is omitted from `electron-builder.yml` and is `.gitignore`d. In packaged production, `fs.existsSync('../../.env')` evaluates to `false`, and `process.env.API_URL` is `undefined`.
2. **GitHub Actions does not inject `API_URL`**: `.github/workflows/release.yml` runs `pnpm --filter=@leadforge/desktop run build --publish never` without specifying an `API_URL` environment variable.
3. **Electron Main acts as the authoritative config resolver**: `apps/desktop/src/main/lib/config.ts` (`loadConfig()`) resolves `apiUrl` with the precedence: `process.env.API_URL` > `userData/config.json (localData.apiUrl)` > `DEFAULT_PRODUCTION_API_URL` (`https://api.leadforge.kapiljangid.pro/api/v1`).
4. **Worker Processes Receive Configuration via Two Channels**:
   - **Environment**: `scheduler.ts` passes `API_URL: config.apiUrl` in `fork()` options.
   - **IPC Payload**: `scheduler.ts` injects `_config: { apiUrl: config.apiUrl }` into the `start` command payload.
5. **Architectural Vulnerability (Independent Hardcoded Fallbacks in Worker Plugins)**:
   - `apps/desktop/src/main/workers/plugins/automation.ts` (line 1858) and `apps/desktop/src/main/workers/plugins/outreach.ts` (line 66) contained independent duplicate fallback strings: `ctx.payload._config?.apiUrl || process.env.API_URL || 'https://api.leadforge.kapiljangid.pro/api/v1'`.
   - These independent fallbacks violate the single-source-of-truth principle and conceal potential configuration propagation failures instead of failing loudly.

---

## 2. Answers to Specific Audit Questions (Part 2)

### A. How does `loadConfig()` obtain runtime configuration?
- **API URL (`apiUrl`)**:
  - Code: `apps/desktop/src/main/lib/config.ts` (lines 56–60)
  ```typescript
  let rawApiUrl = process.env.API_URL || localData.apiUrl || 'https://api.leadforge.kapiljangid.pro/api/v1';
  rawApiUrl = rawApiUrl.replace(/\/+$/, '');
  const apiUrl = rawApiUrl.endsWith('/api/v1') ? rawApiUrl : `${rawApiUrl}/api/v1`;
  ```
  In development, `process.env.API_URL` is populated by `index.ts` from `apps/desktop/.env` (`http://localhost:3001/api/v1`). In packaged production, `process.env.API_URL` is undefined, and it resolves to `'https://api.leadforge.kapiljangid.pro/api/v1'`.
- **`NODE_ENV`**:
  - `loadConfig()` does not set or modify `NODE_ENV`. It reads whatever `process.env.NODE_ENV` is set by the OS/Node runtime (`development` in `electron-vite dev`, `production` in packaged builds).
- **Workspace Directory (`WORKSPACES_DB_DIR`)**:
  - `loadConfig()` does not obtain this. It is computed in `scheduler.ts` (line 506) as `join(app.getPath('userData'), 'workspaces')` and passed to worker processes via `fork(..., { env: { WORKSPACES_DB_DIR } })`.
- **Playwright Path (`PLAYWRIGHT_BROWSERS_PATH`)**:
  - Computed in `scheduler.ts` (lines 511–513) as `process.env.PLAYWRIGHT_BROWSERS_PATH || join(app.getPath('userData'), 'playwright-browsers')` and passed into worker `fork()` `env`.
- **Other Runtime Config**:
  - `openRouterKey`: `process.env.OPENROUTER_API_KEY || localData.openRouterKey`
  - `aiProvider`: `process.env.AI_PROVIDER || localData.aiProvider || 'mock'`
  - `settings`: read from `userData/config.json` (`modelSelection`, `providerSelection`, `loggingLevel`, `telemetryEnabled`, `updateChannel`).

### B. Does `config.ts` call `dotenv`?
- **NO**. `config.ts` does not import or call `dotenv`.
- In `apps/desktop/src/main/index.ts` (lines 19–36), there is a custom `.env` parser that manually reads `resolve(__dirname, '../../.env')` and populates `process.env`.
- **Availability in Packaged Production**: **NO**. The file `../../.env` does not exist inside the packaged application or within `app.asar`. The `fs.existsSync(envPath)` check safely returns `false`, causing `process.env.API_URL` to remain `undefined`.

### C. Does Electron Main have access to `process.env.API_URL`?
- **Development**: YES, loaded by `index.ts` from `apps/desktop/.env`.
- **Packaged Production**: NO, unless explicitly passed by the user via OS environment before starting the binary. In standard production desktop launches, `process.env.API_URL` is `undefined`.

### D. Does `electron-vite` inject any variables into Main?
- **NO**. `apps/desktop/electron.vite.config.js` does not define `define: { ... }` for the Main process. Rollup bundles `src/main/index.ts` and `src/main/workers/worker-host.ts` without replacing `process.env.API_URL`.

### E. Does `electron-builder` inject any variables?
- **NO**. `apps/desktop/electron-builder.yml` packages the directory `out/**` into `app.asar`. It does not inject environment variables or create `.env` files.

### F. Does GitHub Actions inject `API_URL` during the release build?
- **NO**. In `.github/workflows/release.yml` (lines 60–64), the build steps run `pnpm --filter=@leadforge/desktop run build --publish never` without specifying `API_URL` in `env`.

### G. Does a packaged application have access to the repository `.env` file?
- **NO**. `.gitignore` ignores all `.env` files, and `electron-builder.yml` `files` whitelist only includes `out/**` and `package.json`.

### H. What does the worker actually receive when `fork()` is called?
- In `apps/desktop/src/main/services/scheduler.ts` (lines 504–517):
  ```typescript
  const config = loadConfig();
  const worker = fork(workerHostPath, [], {
    env: {
      WORKSPACES_DB_DIR: join(app.getPath('userData'), 'workspaces'),
      PLAYWRIGHT_BROWSERS_PATH:
        process.env.PLAYWRIGHT_BROWSERS_PATH ||
        join(app.getPath('userData'), 'playwright-browsers'),
      API_URL: config.apiUrl,
      NODE_ENV: process.env.NODE_ENV
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    execArgv: is.dev ? ['--inspect=0'] : []
  });
  ```
  The worker receives 4 environment variables: `WORKSPACES_DB_DIR`, `PLAYWRIGHT_BROWSERS_PATH`, `API_URL`, and `NODE_ENV`.

### I. What does the worker receive through the `start` IPC payload?
- In `apps/desktop/src/main/services/scheduler.ts` (lines 966–984):
  `payload._config = { apiUrl: config.apiUrl }` is serialized into the message sent via `worker.send({ command: 'start', payload })`.

### J. Which source currently wins if these disagree? (Precedence Table)

| Layer | Source Resolution Order | Result in Development | Result in Packaged Production | Audit Assessment |
| :--- | :--- | :--- | :--- | :--- |
| **Electron Main (`config.ts`)** | 1. `process.env.API_URL`<br>2. `userData/config.json (localData.apiUrl)`<br>3. `DEFAULT_PRODUCTION_API_URL` | `http://localhost:3001/api/v1` (from `.env`) | `https://api.leadforge.kapiljangid.pro/api/v1` | ✅ Deterministic |
| **Scheduler Worker Fork** | `API_URL: config.apiUrl` | `http://localhost:3001/api/v1` | `https://api.leadforge.kapiljangid.pro/api/v1` | ✅ Forwards Main config |
| **Scheduler Start Message** | `payload._config = { apiUrl: config.apiUrl }` | `http://localhost:3001/api/v1` | `https://api.leadforge.kapiljangid.pro/api/v1` | ✅ Injects Main config |
| **Worker Plugin (`automation.ts`, `outreach.ts`)** | 1. `ctx.payload._config?.apiUrl`<br>2. `process.env.API_URL`<br>3. Hardcoded fallback string | `http://localhost:3001/api/v1` | `https://api.leadforge.kapiljangid.pro/api/v1` | ⚠️ Redundant hardcoded fallback in plugin files |

---

## 3. Runtime Environment Flow Trace (Part 3)

```
DEVELOPMENT RUNTIME FLOW
========================================================================================
[ apps/desktop/.env ]
        │
        ▼ (read by index.ts via fs.readFileSync at boot)
[ process.env.API_URL = "http://localhost:3001/api/v1" ]
        │
        ▼
[ loadConfig() in config.ts ] ──► returns { apiUrl: "http://localhost:3001/api/v1" }
        │
        ├─────────────────────────────────────────┐
        ▼                                         ▼
[ Main SdkClient(baseUrl) ]             [ scheduler.ts (tick) ]
(communicates with local API)                     │
                                                  ├─► fork() with env: { API_URL: config.apiUrl }
                                                  └─► worker.send("start", { payload: { _config: { apiUrl: config.apiUrl } } })
                                                          │
                                                          ▼
                                                [ Worker Child Process ]
                                                          │
                                                          ▼
                                                [ Worker SdkClient(baseUrl: "http://localhost:3001/api/v1") ]
                                                (communicates with local API)
========================================================================================

PACKAGED PRODUCTION RUNTIME FLOW
========================================================================================
[ GitHub Actions / Packaged ASAR ]
(no .env bundled, process.env.API_URL is undefined)
        │
        ▼
[ loadConfig() in config.ts ]
(process.env.API_URL is undefined -> fallback to DEFAULT_PRODUCTION_API_URL)
        │
        ▼ returns { apiUrl: "https://api.leadforge.kapiljangid.pro/api/v1" }
        │
        ├─────────────────────────────────────────┐
        ▼                                         ▼
[ Main SdkClient(baseUrl) ]             [ scheduler.ts (tick) ]
(communicates with production API)                │
                                                  ├─► fork() with env: { API_URL: config.apiUrl }
                                                  └─► worker.send("start", { payload: { _config: { apiUrl: config.apiUrl } } })
                                                          │
                                                          ▼
                                                [ Worker Child Process ]
                                                          │
                                                          ▼
                                                [ Worker SdkClient(baseUrl: "https://api.leadforge.kapiljangid.pro/api/v1") ]
                                                (communicates with production API)
========================================================================================
```

---

## 4. Evaluation of Options for Providing Production API URL (Part 5)

| Option | Description | Evaluation Against Architecture | Verdict |
| :--- | :--- | :--- | :--- |
| **Option A** | Compile-time build variable via GitHub Actions (`VITE_API_URL` or `API_URL`) | Fragile: Local production packaging (`pnpm build:dir`) would break if the dev forgot to set the shell variable. Release workflow becomes tightly coupled to build-time env injection. | ❌ Rejected |
| **Option B** | Checked-in product/release configuration constant (`DEFAULT_PRODUCTION_API_URL`) | Deterministic: Defined in `apps/desktop/src/main/lib/config.ts`. Works identically in CI/CD and local packaged builds. The API URL is not a secret. | ✅ **Selected** |
| **Option C** | User runtime config file (`userData/config.json`) | Essential for flexibility: Users or enterprise deployments can configure custom/self-hosted API URLs via `userData/config.json`. Supported as an override layer in `loadConfig()`. | ✅ **Supported as Override** |
| **Option D** | Electron Main embedded production default | Single owner: Electron Main owns resolution, and passes it deterministically to Main SDK and Worker processes via payload/env. | ✅ **Selected** |
| **Option E** | Remote configuration service | Over-engineered for beta desktop app. Adds a network dependency before any API call can be made. | ❌ Rejected |

---

## 5. Architectural Improvements Required

1. **Remove Duplicate Hardcoded URLs from Worker Plugins**:
   - Remove `'https://api.leadforge.kapiljangid.pro/api/v1'` from `apps/desktop/src/main/workers/plugins/automation.ts` and `outreach.ts`.
   - Resolve `apiUrl` strictly from `ctx.payload._config?.apiUrl || process.env.API_URL`.
   - If missing, throw a descriptive, loud error:
     `"LeadForge could not determine the API server URL for this environment."`
2. **Explicit Development vs. Production Resolution in `config.ts`**:
   - Define `DEFAULT_PRODUCTION_API_URL = 'https://api.leadforge.kapiljangid.pro/api/v1'` as an exported constant in `config.ts`.
   - In development (`is.dev` or `process.env.NODE_ENV === 'development'`), default to `process.env.API_URL || 'http://localhost:3001/api/v1'`.
   - In production, default to `localData.apiUrl || DEFAULT_PRODUCTION_API_URL`.
   - Validate that the resolved `apiUrl` is a non-empty, valid URL.
3. **Formalize Worker Configuration Contract**:
   - Ensure all worker plugins that need API communication resolve the endpoint via a unified helper, guaranteeing zero silent fallbacks to `localhost`.
