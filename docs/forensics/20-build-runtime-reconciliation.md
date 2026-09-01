# Phase 1 Forensic Document 20 — Build & Runtime Reconciliation

**Document Type:** Forensic Build Pipeline & Artifact Audit  
**Audited Against:** `electron.vite.config.js`, `apps/desktop/package.json`, `apps/api/package.json`, `turbo.json`  
**Date:** September 2026  
**Status:** Authoritative Baseline  

---

## 1. Build Pipeline Architecture

```
apps/api/
  src/index.ts ──(tsx watch / tsc)──► Node.js Runtime / dist/index.js

apps/desktop/
  src/main/index.ts ──────(electron-vite / rollup)────► out/main/index.js
  src/preload/index.ts ───(electron-vite / rollup)────► out/preload/index.js
  src/renderer/index.html ─(electron-vite / vite)──────► out/renderer/index.html / HMR Dev Server
```

---

## 2. Command Execution Reconciliation

| Command | Working Directory | Target Processes Spawned | Actual Executed Code |
| :--- | :--- | :--- | :--- |
| `pnpm dev` | Monorepo Root | Turborepo (`apps/api` + `apps/desktop`) | `apps/api/src/index.ts` (tsx) + `apps/desktop/src/main/index.ts` (electron-vite) |
| `pnpm --filter api dev` | `apps/api` | API Server Only (Port 3001) | `apps/api/src/index.ts` |
| `pnpm --filter @leadforge/desktop dev` | `apps/desktop` | Electron Client Only | `apps/desktop/src/main/index.ts` (connects to external API) |
| `pnpm build` | Monorepo Root | Turborepo Package & App Bundler | Generates `dist/` and `out/` bundles |
| `pnpm release:check` | Monorepo Root | Diagnostic test scripts | Runs standalone test suites |

---

## 3. Discrepancies & Build Invariants

1. **Source Synchronization:** When running `pnpm dev` at root, `electron-vite` and `tsx` compile and execute the exact source files in `src/`. There is no hidden legacy bundle drift during standard development.
2. **Worker Fork Path:** In `apps/desktop/src/main/services/scheduler.ts:232`, the worker is forked via `join(__dirname, 'worker.js')`. In development with `electron-vite`, `electron-vite` compiles `src/main/workers/worker-host.ts` into `out/main/worker.js`.
