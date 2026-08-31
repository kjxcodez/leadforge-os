# LeadForge OS — Atomic Refactor Execution Plan

**Document:** `56-atomic-refactor-plan.md`  
**Branch:** `architecture-refactor`  
**Date:** 2026-08-31  

---

## 1. Commit Sequence Map

| # | Type | Scope | Title / Purpose | Key Files | Validation |
|---|---|---|---|---|---|
| **1** | `chore` | `baseline` | Establish architecture refactor baseline & inventory | `docs/architecture-migration/54-*`, `55-*`, `56-*` | Git status |
| **2** | `feat` | `schema` | Implement canonical string identity & domain schemas | `packages/schema/src/*` | `turbo run check-types` |
| **3** | `feat` | `api` | Implement Mongoose domain models with string `_id`s & indexes | `apps/api/src/db/models/*` | `verify-mongo-string-ids.ts` |
| **4** | `feat` | `api` | Implement authoritative persistence repositories & routes | `apps/api/src/repositories/*`, `apps/api/src/routes/*` | `pnpm --filter api build` |
| **5** | `feat` | `api` | Implement Multi-Gmail OAuth & Google Drive attachment engine | `apps/api/src/services/google/*`, `attachment/*`, `outreach/*` | `verify-phase9.ts`, `verify-phase10.ts` |
| **6** | `feat` | `desktop` | Implement disposable SQLite cache schema & CacheHydrator | `apps/desktop/src/main/database/cache-schema.ts`, `cache-hydrator.ts` | `verify-phase6.ts` |
| **7** | `feat` | `sdk` | Provide canonical domain modules & API client methods | `packages/sdk/src/*` | `turbo run check-types` |
| **8** | `refactor` | `desktop` | Bind desktop IPC handlers to authoritative API & local cache | `apps/desktop/src/main/ipc/*`, `apps/desktop/src/main/services/*` | `npx electron-vite build` |
| **9** | `refactor` | `workers` | Migrate worker host & runtime to Mongo-backed execution | `apps/desktop/src/main/workers/*` | `verify-phase7.ts`, `verify-phase8.ts` |
| **10** | `test` | `ci` | Introduce permanent architecture guards & migration suites | `scripts/verify-architecture-invariants.ts`, `scripts/verify-phase*.ts` | All 15 verifiers |
| **11** | `docs` | `architecture` | Add current architecture documentation & migration reports | `docs/architecture/current-architecture.md`, `docs/architecture-migration/*` | Markdown validation |
| **12** | `chore` | `release` | Finalize architecture refactor & release qualification report | `docs/architecture-migration/57-final-architecture-refactor-report.md` | Full regression pass |
