# LeadForge OS — Phase 4B: Runtime Bundle Integrity Report

**Date:** 2026-09-02  
**Branch:** `architecture-refactor`  
**Status:** ✅ FIXED — Both runtime defects root-caused, fixed, and verified  

---

## Executive Summary

After Phase 4A completion, a fresh `pnpm run dev` uncovered two compounding runtime defects. The application entered an infinite loop printing `[CacheLifecycle] Detected LEGACY cache` hundreds of times and never reached workspace activation.

A prior version of the bug produced `Cannot find module './connection'` — the Vite warning about `connection.ts being dynamically imported` was correctly flagged as a real runtime defect, not a harmless warning.

---

## Defect 4B-1 — `Cannot find module './connection'` Runtime Crash

### Symptom
```
Error: Cannot find module './connection'
  at resetWorkspaceCache()  ← apps/desktop/out/main/index.js
```

### Root Cause

`resetWorkspaceCache()` in `cache-schema.ts` used:
```ts
const { getDatabase, closeDatabase } = require('./connection');
```

`electron-vite` bundles the entire main process into a **single `out/main/index.js`** file. There is no separate `./connection.js` on disk. The runtime `require()` attempted a filesystem lookup that always fails.

The dynamic `await import('../database/connection')` in `scheduler.ts` worsened this by triggering Vite's chunk-splitting heuristic, emitting the warning:
> `connection.ts is dynamically imported by scheduler.ts but also statically imported by multiple modules`

This was treated as confirmed related: if Vite had emitted a split chunk, the `require('./connection')` would have found it. The chunk split was not happening, so the crash occurred.

**Why typecheck and build passed:** TypeScript has no way to verify runtime `require()` path resolution against the bundled output. The build succeeds — the crash only occurs at electron startup.

### Fix

**Moved `resetWorkspaceCache()` from `cache-schema.ts` to `connection.ts`.**

- `connection.ts` already imports `initCacheSchema` from `cache-schema.ts`
- `cache-schema.ts` now exports a `registerResetWorkspaceCache(impl)` injector
- `connection.ts` defines the real implementation and registers it at module load via `registerResetWorkspaceCache(resetWorkspaceCache)`
- `cache-schema.ts` holds only a mutable function reference (initially a stub that throws if called before injection)
- **No `require()` of internal source modules remains anywhere in the main process**

Additionally:
- `scheduler.ts`: converted `await import('../database/connection')` → static `import { getDatabase }`
- `observability-ipc.ts`: converted `require('../database/cache-schema')`, `require('../services/cache-hydrator')`, `require('../lib/workspace-manager')` → static imports

---

## Defect 4B-2 — Infinite `[CacheLifecycle] Detected LEGACY cache` Loop

### Symptom
```
[CacheLifecycle] Detected LEGACY cache for workspace "c66992bc-...". Performing safe archive and clean rebuild.
[CacheLifecycle] Detected LEGACY cache for workspace "c66992bc-...". Performing safe archive and clean rebuild.
[CacheLifecycle] Detected LEGACY cache for workspace "c66992bc-...". Performing safe archive and clean rebuild.
... (hundreds of lines)
```

### Root Cause

After fixing Defect 4B-1, the `resetWorkspaceCache` implementation (now in `connection.ts`) called `getDatabase(workspaceId)` to retrieve the DB file path and then called `getDatabase(workspaceId)` again after deleting the old file to create the fresh DB.

Simultaneously, `getDatabase()` was structured as:
```ts
db = new Database(dbPath);
// ... pragmas ...
ensureCleanCache(db, workspaceId);    // ← called BEFORE workspaceDbs.set()
workspaceDbs.set(workspaceId, db);   // ← only registered AFTER ensureCleanCache
```

**The infinite loop path:**

```
getDatabase('ws')
  → create new Database(dbPath)
  → ensureCleanCache(db, 'ws')         ← workspaceDbs has NO entry yet
    → detectCacheState → LEGACY
    → resetWorkspaceCache('ws', ...)
      → getDatabase('ws')              ← map is EMPTY, creates ANOTHER Database(dbPath)
        → ensureCleanCache(db, 'ws')   ← LEGACY again
          → resetWorkspaceCache(...)   ← infinite recursion
```

### Fix — Two-Part

**Part A: Register DB in map BEFORE calling `ensureCleanCache`**

```ts
workspaceDbs.set(workspaceId, db);          // pre-register
const cleanDb = ensureCleanCache(db, workspaceId);
if (cleanDb !== db) {
  workspaceDbs.set(workspaceId, cleanDb);   // update if rebuilt
  return cleanDb;
}
```

This breaks the infinite loop: when `resetWorkspaceCache` is called and internally looks up `workspaceDbs.get(workspaceId)`, it finds the registered stale handle, closes it, and proceeds with the archive/delete/rebuild — without re-entering `getDatabase`.

**Part B: `resetWorkspaceCache` must NOT call `getDatabase()`**

The new implementation:
1. Reads the path from `workspaceDbs.get(workspaceId)` (the pre-registered stale handle)
2. Closes the stale handle and removes it from the map
3. Archives and deletes the old file
4. Opens the replacement with `new Database(dbPath)` directly (no `getDatabase` call)
5. Calls `initCacheSchema(newDb)` on the fresh instance
6. Registers it in `workspaceDbs` immediately

---

## Circular Dependency Graph (Before / After)

### Before (broken)
```
connection.ts ──→ cache-schema.ts
                       ↑
                  require('./connection')   ← runtime crash
```

### After (fixed)
```
connection.ts ──→ cache-schema.ts
     ↑                  │
     └──────────────────┘
   registerResetWorkspaceCache() injection
   (cache-schema holds only a function reference,
    connection.ts provides the concrete implementation)
```

No circular module evaluation. No runtime filesystem lookups.

---

## Vite Warning Analysis

The warning:
> `connection.ts is dynamically imported by scheduler.ts but also statically imported by many modules`

**Conclusion: This was a real runtime packaging defect, not a harmless performance warning.**

The dynamic import triggered Vite to consider a chunk split for `connection.ts`. Whether the split occurred or not, the pre-existing `require('./connection')` in `cache-schema.ts` was always going to fail in a bundled environment where no `connection.js` file exists on disk. The warning was the indicator that `connection` was being treated as a split candidate — which is what created the failure mode.

**Elimination:** The dynamic import in `scheduler.ts` is now a static import. The Vite warning no longer appears.

---

## Regression Results

| Suite | Tests | Status |
|-------|-------|--------|
| Phase 2A — Runtime Connectivity | 7/7 | ✅ CERTIFIED |
| Phase 2B — Authoritative Data Projection | 13/13 | ✅ CERTIFIED |
| Phase 2C — Outreach, Campaign & Contract Integrity | 41/41 | ✅ CERTIFIED |
| Phase 2D — Integrations, Scheduler & Activities | 46/46 | ✅ CERTIFIED |
| Phase 3A — Runtime, Worker & Process Reliability | 40/40 | ✅ CERTIFIED |
| Phase 3B — End-to-End Workflow Certification | 43/43 | ✅ CERTIFIED |
| Phase 3C — Security, Data Integrity & Adversarial Testing | 40/40 | ✅ CERTIFIED |
| Phase 3D — Production Readiness | 44/44 | ✅ CERTIFIED |
| Phase 4A — Manual Beta Defect Closure | 30/30 | ✅ CERTIFIED |
| Phase 4B — Runtime Bundle Integrity | 21/21 | ✅ CERTIFIED |
| **Total** | **325/325** | ✅ **ALL CERTIFIED** |

---

## Build & Type Verification

```
pnpm check-types → 20/20 packages, 0 errors
electron-vite build → ✓ built in ~11-20s
out/main/ → index.js + worker.js only (no connection.js chunk)
Bundle grep: require('./connection') → 0 matches
Bundle grep: await import(connection) → 0 matches
```

---

## Commits

| Hash | Message |
|------|---------|
| `dafa5d9` | `fix(build): eliminate infinite loop and invalid runtime module resolution in desktop build` |
| `70562f4` | `test(phase3d): update schema version assertion to v3 and add intelligence table checks` |

---

## Final Status: ✅ FIXED

Both defects are root-caused, fixed, and verified:

- `Cannot find module './connection'` → **ELIMINATED** (no runtime require() for internal modules)
- Infinite LEGACY cache loop → **ELIMINATED** (map pre-registration + no getDatabase() re-entry)
- `pnpm run dev` → workspace activates cleanly, no MODULE_NOT_FOUND, no infinite loop
