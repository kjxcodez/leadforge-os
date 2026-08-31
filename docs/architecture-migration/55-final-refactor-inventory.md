# LeadForge OS — Final Refactor Inventory & Forensic Classification

**Document:** `55-final-refactor-inventory.md`  
**Branch:** `architecture-refactor`  
**Date:** 2026-08-31  

---

## 1. Forensic Classification Matrix

| Component / Subsystem | Artifacts | Classification | Action / Justification |
|---|---|---|---|
| **Identity & Schemas** | `packages/schema/src/common/identity.ts`, `packages/schema/src/entities/*`, `packages/schema/src/dto/*` | **KEEP (CANONICAL)** | Canonical string UUID identity generator (`generateEntityId`) and shared Zod/TypeScript schemas. |
| **MongoDB Models** | `apps/api/src/db/models/*.ts` (35 models) | **KEEP (CANONICAL)** | Authoritative MongoDB schemas, compound indexes, TTL indexes, and Mongoose plugins. |
| **API Persistence Routes** | `apps/api/src/routes/*.ts` | **KEEP (CANONICAL)** | Hono OpenAPI endpoints providing tenant-scoped persistence, batch APIs, jobs, locks, and OAuth. |
| **API Repositories** | `apps/api/src/repositories/*` | **KEEP (CANONICAL)** | Clean Mongoose query layer enforcing workspace scoping and string IDs. |
| **Outreach & Gmail Provider** | `apps/api/src/services/google/*`, `apps/api/src/services/outreach/*` | **KEEP (CANONICAL)** | Canonical Gmail OAuth sender management, token refresh, and Google Drive attachment storage. |
| **Desktop Cache Engine** | `apps/desktop/src/main/database/cache-schema.ts` | **KEEP (CANONICAL)** | Disposable SQLite schema generator (`initCacheSchema`), state detection, and safe archiving. |
| **Cache Hydrator** | `apps/desktop/src/main/services/cache-hydrator.ts` | **KEEP (CANONICAL)** | Reconstructs local SQLite read-cache from MongoDB via Hono API. |
| **Desktop Repositories** | `apps/desktop/src/main/database/repositories/local-crm.ts`, `local-workspace.ts`, `memory-repository.ts` | **KEEP (CANONICAL)** | Fast local SQLite query layer for UI read acceleration. |
| **Historical Migration Tooling** | `scripts/migrate-sqlite-to-mongo.ts`, `scripts/sqlite-discovery.ts` | **KEEP (TOOLING)** | Non-runtime offline tooling retained for disaster recovery and operational audits. |
| **Architecture Guardrails** | `scripts/verify-architecture-invariants.ts`, `scripts/verify-mongo-string-ids.ts`, `verify-no-sync-dependencies.ts`, `verify-no-legacy-runner-dependencies.ts` | **KEEP (CI GUARDS)** | Permanent CI guardrails protecting architecture invariants against regressions. |
| **Verification Suites** | `scripts/verify-phase1.ts` through `scripts/verify-phase15.ts` | **KEEP (TESTS)** | Comprehensive regression verification suites validating all 15 migration phases. |
| **Obsolete Migration Runner** | `apps/desktop/src/main/database/runner.ts`, `_migrations` tables | **DELETED** | Historical 33-step incremental SQLite runner permanently deleted in Phase 12. |
| **Obsolete Sync Engine** | `apps/desktop/src/main/services/sync-engine.ts`, `sync_queue`, `sync_metadata` | **DELETED** | Local-first synchronization loop permanently deleted in Phase 11. |
| **Obsolete SMTP Transport** | `nodemailer`, SMTP configurations | **DELETED** | SMTP dependencies and code permanently removed in Phases 9/10/14. |
