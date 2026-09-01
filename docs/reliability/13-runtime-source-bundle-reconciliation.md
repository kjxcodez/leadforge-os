# 13 - Runtime Source & Bundle Reconciliation Forensic Report

## 1. Executive Summary

This document establishes the precise chain of custody and compilation trace from TypeScript source files (`apps/desktop/src`), through bundling pipelines (`electron-vite`, `vite`, `esbuild`), into generated bundle artifacts (`apps/desktop/out/main/index.js`, `apps/desktop/out/main/worker.js`, `apps/desktop/out/renderer/`), through the Electron runtime process, IPC dispatchers, SQLite local cache instances, and authoritative MongoDB / HTTP API endpoints.

---

## 2. Compilation & Runtime Execution Chain

```
TypeScript Source Files (apps/desktop/src)
       │
       ▼ (vite / electron-vite build & packaging)
Generated Main Artifacts (apps/desktop/out/main/index.js, worker.js)
       │
       ▼ (electron main process bootstrap)
Electron Main Supervisor & IPC Handlers
       │
       ├──► SQLite Workspace Cache (AppData/.../workspaces/leadforge_<wsId>.db)
       └──► SdkClient (HTTP / REST) ──► Hono API (apps/api) ──► MongoDB Atlas
```

---

## 3. String & Token Forensic Audit (Source vs. Output Bundles)

A comprehensive forensic scan was conducted across `apps/desktop/src` and `apps/desktop/out` for prohibited, obsolete, and critical domain strings.

| Target Token / Pattern | Found in `apps/desktop/src`? | Found in `apps/desktop/out`? | File & Line Occurrence in Source | File & Line Occurrence in Build Output | Forensic Analysis & Verdict |
|---|---|---|---|---|---|
| `sequence_logs` | Yes (React Query keys only) | Yes (Renderer bundles only) | `AutomationScreen.tsx:97`, `use-automation.ts:64` | `AutomationScreen-BzyALxe8.js:126` | **SAFE / HARMLESS QUERY KEY**: No raw SQL queries against `sequence_logs` table exist in `src/main` or `out/main`. The React Query key is used solely for client-side execution logs caching from `sdk.executions.getLogs(id)`. |
| `system_logs` | Yes (Comments & Query Keys) | Yes (Renderer bundle & logger comment) | `OperationsCenterScreen.tsx:774`, `index.ts:637` | `OperationsCenterScreen-DHCyg1sn.js:774`, `out/main/index.js:637` | **SAFE**: Queried authoritatively from API via `sdk.systemLogs.listRecent()` in `dashboard.ts:129`. No local SQLite table queried. |
| `sourcePlatform` | **NO (0 occurrences)** | **NO (0 occurrences)** | None | None | **CONFIRMED ELIMINATED**: All queries in `crm.ts`, `ContactsScreen.tsx`, and `DiscoveryScreen.tsx` use canonical `source` column. |
| `"Active"` / `'Active'` | Yes (Legacy test mocks) | Yes (Compiled mock plugins) | `automation.ts:2468`, `test-automation.ts:163` | `out/main/worker.js:1894` | **PARTIALLY PRESENT IN WORKER PLUGIN**: While `CampaignsScreen.tsx` was fixed to send `CampaignStatus.ACTIVE`, `automation.ts` still checked `campaign.status === 'Active'` instead of `'ACTIVE'`. |
| `FROM companies` | Yes | Yes | `dashboard.ts:17`, `crm.ts:22`, `crm.ts:167` | `out/main/index.js` (Compiled dashboard & crm IPC) | **ACTIVE CACHE QUERY**: Executed against local SQLite cache database. Fails on clean boot due to uninitialized schema. |
| `FROM contacts` | Yes | Yes | `dashboard.ts:24`, `dashboard.ts:184`, `crm.ts:116`, `crm.ts:184` | `out/main/index.js` (Compiled dashboard & crm IPC) | **ACTIVE CACHE QUERY**: Executed against local SQLite cache database. Fails on clean boot due to uninitialized schema. |
| `FROM campaigns` | Yes | Yes | `dashboard.ts:31`, `crm.ts:241` | `out/main/index.js` (Compiled dashboard & crm IPC) | **ACTIVE CACHE QUERY**: Executed against local SQLite cache database. Fails on clean boot due to uninitialized schema. |
| `FROM discovery_runs` | Yes | Yes | `local-crm.ts:77` (via `findMany`), `cache-hydrator.ts:232` | `out/main/index.js` (Compiled discovery IPC) | **ACTIVE CACHE QUERY**: Executed against local SQLite cache database. Fails on clean boot due to uninitialized schema. |

---

## 4. Source → Compiled → Runtime Trace Matrix for Active Failure Paths

| Failure ID | Source File & Line | Compiled File & Approx Line | IPC Channel / Method | Function Name | Database Connection & Target Path | Root Cause |
|---|---|---|---|---|---|---|
| **RCON-01** | `apps/desktop/src/main/ipc/dashboard.ts:10-35` | `apps/desktop/out/main/index.js:7120-7160` | `dashboard:stats` | `anonymous handler` | `getDatabase(workspaceId)` → `workspaces/leadforge_<wsId>.db` | Database file opened without calling `initCacheSchema(db)`. IPC handler queries empty database file before `WorkspaceRuntime.start()` finishes. |
| **RCON-02** | `apps/desktop/src/main/ipc/crm.ts:164-198` | `apps/desktop/out/main/index.js:6850-6890` | `contacts:distinct-values`, `companies:distinct-values` | `anonymous handler` | `getDatabase(workspaceId)` → `workspaces/leadforge_<wsId>.db` | Queries `SELECT DISTINCT ... FROM contacts` / `companies` on freshly opened, uninitialized database file. |
| **RCON-03** | `apps/desktop/src/main/database/repositories/local-crm.ts:73-108` | `apps/desktop/out/main/index.js:5200-5240` | `companies:list`, `contacts:list`, `discovery:run:list` | `LocalCRMRepository.findMany` | `getDatabase(workspaceId)` → `workspaces/leadforge_<wsId>.db` | `tableInfo` check returns empty column list on new DB; fallback logs warning and returns `[]`. |
| **RCON-04** | `apps/desktop/src/main/ipc/outreach.ts:258-289` | `apps/desktop/out/main/index.js:8100-8140` | `email-deliveries:list` | `anonymous handler` | `getDatabase(targetWsId)` → `workspaces/leadforge_<wsId>.db` | Queries local SQLite `email_deliveries` table, but all outbound sends persist exclusively to MongoDB via `EmailDeliveryModel`. Local table is never hydrated or written to. |
| **RCON-05** | `apps/desktop/src/main/ipc/outreach.ts:107-141` | `apps/desktop/out/main/index.js:7950-7990` | `attachments:save` | `anonymous handler` | Local disk: `app.getPath('userData')/attachments/...` | Local mock file copy instead of invoking backend Google Drive integration (`POST /attachments/upload`). |
| **RCON-06** | `apps/desktop/src/main/workers/plugins/crawler.ts:415-428` | `apps/desktop/out/main/worker.js:4100-4130` | N/A (Worker task) | `crawlWebsite` | `sdk.contacts.create` → `POST /contacts` | Extracts unformatted phone strings (e.g. `(555) 123-4567`) that fail E.164 schema validation regex `/^\+?[1-9]\d{1,14}$/`. Error is caught, logged as warning, and ignored. |
| **RCON-07** | `apps/desktop/src/main/workers/plugins/intelligence-worker.ts:171-184` | `apps/desktop/out/main/worker.js:5200-5230` | N/A (Worker task) | `runIntelligenceEnrichment` | `sdk.intelligence.createContactIntel` → `POST /intelligence/contact` | API repository performs `INSERT` on collection with unique compound index `{ workspaceId: 1, contactId: 1 }`. Throws 409 CONFLICT on re-enrichment instead of UPSERT. |
| **RCON-08** | `apps/desktop/src/main/workers/plugins/automation.ts:734-756` | `apps/desktop/out/main/worker.js:1450-1475` | N/A (Worker task) | `loadEntityData` | `sdk.contacts.get` → `GET /contacts/:id` | Fetches contact record, but never fetches the associated company (`contact.companyId`). Leaves `execCtx.company` as `{}` causing all `{{company.*}}` tokens to resolve to empty strings. |
| **RCON-09** | `apps/desktop/src/renderer/screens/DiscoveryScreen.tsx:311-332` | `apps/desktop/out/renderer/assets/DiscoveryScreen-*.js` | `scheduler:jobs:list` | `DiscoveryScreen` component | In-memory React state | Unconditionally treats all non-crawler jobs (`enrich:intelligence`, `automation:workflow`) as discovery runs. |
| **RCON-10** | `apps/desktop/src/renderer/screens/WorkspaceSettingsScreen.tsx:852-857` | `apps/desktop/out/renderer/assets/WorkspaceSettingsScreen-*.js` | `email-accounts:gmail:status` | `pollTransaction` | React local component state | On OAuth success, only updates local `accounts` state; fails to invalidate React Query `['email_accounts', workspaceId]`, leaving `CampaignsScreen` sender dropdown stale. |

---

## 5. Verification Conclusion

The forensic analysis proves that runtime errors in clean environments are **not caused by phantom old bundles or stale build artifacts**, but by:
1. **Structural ordering bugs in database connection initialization** (`getDatabase()` opens files without ensuring schema).
2. **Contract architectural mismatches** (local queries against non-hydrated SQLite tables vs. authoritative MongoDB endpoints).
3. **Data preparation gaps** (missing company joins during context loading; unnormalized phone strings failing DTO validation; INSERT instead of UPSERT in intelligence routes).
