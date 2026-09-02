# Phase 1 Forensic Document 07 — SQLite Authority & Mutation Audit

**Document Type:** Forensic Storage Authority Audit  
**Audited Against:** Entire Repository (`apps/desktop/src/main/`)  
**Date:** September 2026  
**Status:** Authoritative Baseline  

---

## 1. Classification Categories

- **A — Disposable UI Cache:** Data cached purely to accelerate local reads and UI rendering. Dropping the database loses no business data.
- **B — Ephemeral Runtime State:** Local runtime state (e.g. process locks, in-memory caches, UI window geometry).
- **C — Business-State Persistence:** Authoritative storage of business domain records without server mirror.
- **D — Offline Queue:** Staged mutations awaiting background synchronization.
- **E — Legacy Code:** Dead or deprecated SQL queries/tables.
- **F — Unknown:** Unclassified.

---

## 2. Table-by-Table Authority & Operation Audit

| Table | Operation | Code Location | Classification | Authority Assessment / Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **`companies`** | `SELECT` | `crm.ts:18` (`companies:query`) | **A — Disposable UI Cache** | Read by renderer for search/filtering. |
| **`companies`** | `INSERT OR REPLACE` | `local-crm.ts:167` (`saveFromServer`) | **A — Disposable UI Cache** | Populated by `CacheHydrator` and post-API mutations. |
| **`companies`** | `UPDATE deletedAt` | `local-crm.ts:253` (`softDeleteFromServer`) | **A — Disposable UI Cache** | Updated only after successful API deletion. |
| **`contacts`** | `SELECT` | `crm.ts:112` (`contacts:query`) | **A — Disposable UI Cache** | Read by renderer contacts screen. |
| **`contacts`** | `INSERT OR REPLACE` | `local-crm.ts:167` (`saveFromServer`) | **A — Disposable UI Cache** | Populated by `CacheHydrator` and post-API mutations. |
| **`campaigns`** | `SELECT` | `crm.ts:234` (`campaigns:list`) | **A — Disposable UI Cache** | Read by renderer campaigns screen. |
| **`campaigns`** | `UPDATE status` | `crm.ts:293` | **A / B — Local Calculated State** | Auto-calculated status persisted locally to cache. |
| **`sequences`** | `SELECT` | `automation.ts` | **A — Disposable UI Cache** | Read by `AutomationTriggerEvaluator`. |
| **`sequences`** | `INSERT OR REPLACE` | `local-crm.ts:167` (`saveFromServer`) | **A — Disposable UI Cache** | Populated by `CacheHydrator`. |
| **`sequence_executions`** | `SELECT` | `crm.ts:243` (stats aggregation) | **A — Disposable UI Cache** | Aggregates stats for campaign overview. |
| **`sequence_executions`** | `INSERT OR REPLACE` | `local-crm.ts:167` (`saveFromServer`) | **A — Disposable UI Cache** | Populated by `CacheHydrator`. |
| **`templates`** | `SELECT` | `outreach.ts:170` (`templates:list`) | **A — Disposable UI Cache** | Merged with remote API response. |
| **`templates`** | `INSERT OR REPLACE` | `outreach.ts:174` | **A — Disposable UI Cache** | Populated by `CacheHydrator` and post-API mutations. |
| **`email_accounts`** | `SELECT` | `outreach.ts:24` (`email-accounts:list`)| **A — Disposable UI Cache** | Merged with remote API response. |
| **`email_deliveries`** | `SELECT` | `outreach.ts:298` (`email-deliveries:list`)| **A — Disposable UI Cache** | Fallback query when API call fails. |
| **`audiences`** | `SELECT` | `audiences-ipc.ts` | **A — Disposable UI Cache** | Read by audience management screen. |
| **`discovery_runs`** | `SELECT` | `discovery-ipc.ts:74` | **A — Disposable UI Cache** | Read by discovery screen. |
| **`discovery_runs`** | `INSERT OR REPLACE` | `discovery-ipc.ts:31` | **A — Disposable UI Cache** | Written immediately after API creation. |
| **`company_discovery_runs`** | `SELECT` | `discovery-ipc.ts:90` | **A — Disposable UI Cache** | Filter query to show companies in a run. |
| **`company_discovery_runs`** | `INSERT OR REPLACE` | `discovery-ipc.ts:113` | **A — Disposable UI Cache** | Fallback hydration from server. |
| **`settings`** | `SELECT / INSERT` | `index.ts:261-287` | **B — Ephemeral Runtime State** | Theme, sidebar state stored in SQLite / `config.json`. |
| **`cache_metadata`** | `SELECT / INSERT` | `cache-schema.ts:443` | **B — Ephemeral Runtime State** | Stores `schema_version = 2`. |

---

## 3. Authority Verdict

1. **Zero Category C (Authoritative Business Persistence):** SQLite holds NO data that does not originate from or get submitted to MongoDB.
2. **Zero Category D (Offline Mutation Queue):** All mutations execute against the API (`SdkClient`) first before updating SQLite.
3. **Pure Category A Projection:** SQLite operates strictly as a read projection cache.
4. **Authority Defect:** While architecturally designed as a cache, the UI relies on SQLite as its **sole primary read source** for queries (`companies:query`, `contacts:query`). Therefore, when the cache is not hydrated, the application fails to display server data.
