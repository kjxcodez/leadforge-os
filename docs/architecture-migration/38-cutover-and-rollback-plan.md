# LeadForge OS — Cutover & Rollback Execution Plan

## 1. Executive Summary & Release Gates

The transition from Local-First SQLite + SyncEngine to MongoDB-First Architecture concludes with an orderly, multi-stage production cutover. This document specifies the pre-flight checks, cutover sequence, validation gates, and rollback playbooks.

---

## 2. Phase Cutover Sequence

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PRODUCTION CUTOVER SEQUENCE                       │
└─────────────────────────────────────────────────────────────────────────────┘

  Gate 1: Pre-Cutover Audit & Code Freeze
  - API and Desktop code tagged: `v1.2.0-migration-ready`.
  - Staging test suite passes 100% (Suites T1–T11).
        │
        ▼
  Gate 2: Database Freeze & Snapshot Backups
  - Electron clients instructed to disconnect / stop workers.
  - Complete snapshot backup of SQLite `.db` files: `leadforge_*.db.cutover.bak`.
  - MongoDB Atlas point-in-time snapshot backup triggered.
        │
        ▼
  Gate 3: Execute Data Migration CLI (`scripts/migrate-sqlite-to-mongo.ts`)
  - Runs in `--execute` mode.
  - Upserts all un-synced and SQLite-only records into MongoDB with string `_id`.
  - Generates `migration-diagnostics-<timestamp>.json`.
        │
        ▼
  Gate 4: Automated Post-Migration Verification (`scripts/verify-cutover.ts`)
  - Asserts count(Mongo._id) >= count(SQLite.id).
  - Asserts 0 documents with BSON `ObjectId` remain.
  - Asserts 0 broken foreign keys.
        │
        ▼
  Gate 5: Deploy MongoDB-First Production Code
  - Deploy `apps/api` (Hono) to Vercel production.
  - Release desktop app build (`v1.2.0-mongo-first`).
        │
        ▼
  Gate 6: Fresh Cache Initialization
  - Desktop boots, runs `initCacheSchema(db)`, runs `CacheHydrator`.
  - UI confirms instant CRM availability from verified MongoDB authority.
```

---

## 3. Rollback Playbooks Per Phase

```text
┌─────────────────────────┬──────────────────────┬──────────────────────────────────────────────────────────┐
│ Migration Phase         │ Failure Scenario     │ Step-by-Step Rollback Playbook                           │
├─────────────────────────┼──────────────────────┼──────────────────────────────────────────────────────────┤
│ **Phase 2: Models**     │ Mongoose schema error│ Revert model commits. MongoDB schemas drop to baseline.  │
│                         │ or index collision.  │ Zero impact on running SQLite desktop clients.           │
├─────────────────────────┼──────────────────────┼──────────────────────────────────────────────────────────┤
│ **Phase 4: Data Migr.** │ Migration script     │ 1. Abort migration script immediately.                   │
│                         │ crashes or corrupts. │ 2. Restore MongoDB to pre-migration Atlas snapshot.      │
│                         │                      │ 3. Existing SQLite databases remain 100% untouched.     │
├─────────────────────────┼──────────────────────┼──────────────────────────────────────────────────────────┤
│ **Phase 5: Desktop UI** │ API write fails on   │ Revert desktop build to previous release.                │
│                         │ edge network.        │ Legacy `SyncEngine` continues staging local writes.      │
├─────────────────────────┼──────────────────────┼──────────────────────────────────────────────────────────┤
│ **Phase 7: Workers**    │ Worker SdkClient     │ Revert worker plugin refactor. Workers resume writing    │
│                         │ throws rate limit.   │ to SQLite temporarily while API batching is tuned.       │
├─────────────────────────┼──────────────────────┼──────────────────────────────────────────────────────────┤
│ **Phase 11: Sync Rem.** │ Unforeseen sync gap. │ Restore `sync-engine.ts` from git branch                 │
│                         │                      │ `release/v1.1-legacy-sync`.                              │
└─────────────────────────┴──────────────────────┴──────────────────────────────────────────────────────────┘
```

---

## 4. Emergency Abort & Restoration Procedure

If a critical flaw is detected during the Gate 4 or Gate 5 cutover window:

```bash
# 1. Stop all desktop processes immediately
killall leadforge-os

# 2. Restore original SQLite database from verified backup
cp leadforge_workspace.db.cutover.bak leadforge_workspace.db

# 3. Restore MongoDB database from pre-cutover snapshot
# (Executed via Atlas Web Console or Atlas CLI)
atlas backups restores start --clusterName LeadForgeCluster --snapshotId <preCutoverSnapshotId>

# 4. Re-launch desktop application on legacy branch
git checkout release/v1.1-legacy-baseline
pnpm build
```

---

## 5. Exit Criteria for Cutover Sign-Off

The cutover is deemed **100% SUCCESSFUL** only when:
1. All 33 MongoDB collections are populated and validated.
2. Every document across all domain collections uses BSON `String` `_id`.
3. 0 documents exist with BSON `ObjectId`.
4. Deleting `leadforge_<ws>.db` locally and restarting the app fully rehydrates the desktop UI in under 2 seconds without missing records.
5. Workers execute background tasks and persist results directly into MongoDB via `SdkClient`.
6. Zero sync queues, zero sync tables, and zero background sync polling loops remain active.
