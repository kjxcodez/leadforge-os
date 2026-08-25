# Desktop `process.env` Hardening Implementation Plan

**Author**: Antigravity  
**Target Release**: v1.1.1-beta.1  
**Subject**: Implementation Plan for Clean `process.env` Boundary Enforcement and Worker Context Simplification  
**Date**: August 2026  

---

## 1. Findings & Severity Assessment

| Finding | Component | Severity | Description |
| :--- | :--- | :--- | :--- |
| **F-01** | `automation.ts`, `outreach.ts` | **Low** | Dead `process.env.SESSION_TOKEN` fallback present in worker plugins even though `scheduler.ts` does not whitelist it in `fork()`. |
| **F-02** | `linkedin.ts` | **Low** | Dead `process.env.LINKEDIN_COOKIE` fallback present in worker plugin even though `scheduler.ts` does not whitelist it in `fork()`. |
| **F-03** | 7 Worker Plugins | **Low / Refactoring** | Redundant manual re-construction of `dbPath` from `process.env.WORKSPACES_DB_DIR` instead of using `ctx.dbPath` already provided on `JobContext`. |

---

## 2. Recommended Architecture

1. **Direct Secret Resolution from Payload**:
   - `const authToken = ctx.payload._secrets?.sessionToken || '';`
   - `let cookie = ctx.payload._secrets?.['linkedin_li_at'] || '';`
2. **Context-Driven Database Connection**:
   - Worker plugins should initialize SQLite using `ctx.dbPath` provided by `worker-host.ts`:
     `const dbPath = ctx.dbPath || (process.env.WORKSPACES_DB_DIR ? join(process.env.WORKSPACES_DB_DIR, `leadforge_${ctx.workspaceId}.db`) : '');`
3. **No Unnecessary `process.env` in Sandboxed Worker Logic**:
   - Keep `process.env` strictly for system-level third-party contracts (`PLAYWRIGHT_BROWSERS_PATH`, `NODE_ENV`).

---

## 3. Exact Files to Modify

1. **`apps/desktop/src/main/workers/plugins/automation.ts`**:
   - Clean up auth token resolution to use `ctx.payload._secrets?.sessionToken`.
2. **`apps/desktop/src/main/workers/plugins/outreach.ts`**:
   - Clean up auth token resolution to use `ctx.payload._secrets?.sessionToken`.
   - Use `ctx.dbPath` for DB connection.
3. **`apps/desktop/src/main/workers/plugins/linkedin.ts`**:
   - Clean up cookie resolution to use `ctx.payload._secrets?.['linkedin_li_at']`.
   - Use `ctx.dbPath` for DB connection.
4. **`apps/desktop/src/main/workers/plugins/scraper.ts`**:
   - Use `ctx.dbPath` for DB connection.
5. **`apps/desktop/src/main/workers/plugins/crawler.ts`**:
   - Use `ctx.dbPath` for DB connection.
6. **`apps/desktop/src/main/workers/plugins/enricher.ts`**:
   - Use `ctx.dbPath` for DB connection.
7. **`apps/desktop/src/main/workers/plugins/imap-poller.ts`**:
   - Use `ctx.dbPath` for DB connection.
8. **`apps/desktop/src/main/workers/plugins/intelligence-worker.ts`**:
   - Use `ctx.dbPath` for DB connection.
9. **`apps/desktop/src/main/services/desktop-runtime-config.test.ts`**:
   - Add test case verifying `JobContext.dbPath` and secret contract.

---

## 4. Verification Plan

1. Run `pnpm check-types` across all monorepo workspaces.
2. Run `node apps/desktop/scripts/run-tests.js` test suite.
3. Run `pnpm --filter @leadforge/desktop run build:dir` and inspect packaged bundle.
4. Verify 0 occurrences of dead fallbacks in compiled `out/main/worker.js`.
