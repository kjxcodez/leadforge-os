# LeadForge OS — Local SQLite Cache Analysis

## 1. Absolute Cache Invariant
In the target MongoDB-first architecture:

> **If SQLite is completely deleted, NO authoritative business data is lost.**

SQLite ceases to be a source of persistent truth. It is converted into a **disposable materialized read-cache** whose sole purpose is to provide ultra-fast, local synchronous queries for the desktop application UI.

---

## 2. Table-by-Table SQLite Classification

Every table currently present in SQLite is classified into exactly one of four categories:

1. **AUTHORITATIVE DATA — MUST MOVE TO MONGODB**: Tables currently acting as primary data storage that must be migrated to MongoDB models in `apps/api`.
2. **CACHE CANDIDATE — MAY EXIST LOCALLY**: Tables that may remain in local SQLite strictly as materialized projections of MongoDB data.
3. **LOCAL RUNTIME STATE — MAY EXIST LOCALLY**: Ephemeral runtime data (e.g. browser profile paths, temp files).
4. **OBSOLETE — SHOULD BE REMOVED**: Tables created exclusively for local-first sync engines and dirty tracking.

---

## 3. Comprehensive Table Classification Matrix

| SQLite Table | Current Role | Target Classification | Can Table Be Wiped & Rebuilt from Mongo? |
| :--- | :--- | :--- | :--- |
| `users` | Mixed | **CACHE CANDIDATE** | YES — Rehydrate from Mongo `users` |
| `workspaces` | Mixed | **CACHE CANDIDATE** | YES — Rehydrate from Mongo `workspaces` |
| `companies` | Local-First Authority | **CACHE CANDIDATE** | YES — Rehydrate from Mongo `companies` |
| `contacts` | Local-First Authority | **CACHE CANDIDATE** | YES — Rehydrate from Mongo `contacts` |
| `campaigns` | Local-First Authority | **CACHE CANDIDATE** | YES — Rehydrate from Mongo `campaigns` |
| `activities` | Local-First Authority | **CACHE CANDIDATE** | YES — Rehydrate from Mongo `outreaches` |
| `outreach` | Local-First Authority | **CACHE CANDIDATE** | YES — Rehydrate from Mongo `outreaches` |
| `settings` | Local-First Authority | **CACHE CANDIDATE** | YES — Rehydrate from Mongo workspace settings |
| `sync_queue` | Sync Engine Queue | **OBSOLETE** | YES — Delete table |
| `sync_metadata` | Sync Engine Metadata | **OBSOLETE** | YES — Delete table |
| `sync_dead_letter`| Sync Dead Letter | **OBSOLETE** | YES — Delete table |
| `email_accounts` | Mixed | **CACHE CANDIDATE** | YES — Rehydrate from Mongo `emailaccounts` |
| `templates` | Local-First Authority | **CACHE CANDIDATE** | YES — Rehydrate from Mongo `emailtemplates` |
| `sequences` | Local-First Authority | **CACHE CANDIDATE** | YES — Rehydrate from Mongo `sequences` |
| `sequence_executions`| Local-First Authority| **CACHE CANDIDATE** | YES — Rehydrate from Mongo `sequenceexecutions` |
| `sequence_logs` | Local-First Authority | **CACHE CANDIDATE** | YES — Rehydrate from Mongo `sequencelogs` |
| `jobs` | Local-First Authority | **AUTHORITATIVE -> MONGODB** | NO today (Must move to Mongo first) |
| `system_logs` | Local-First Authority | **AUTHORITATIVE -> MONGODB** | NO today (Must move to Mongo first) |
| `automation_locks`| Local-First Authority| **AUTHORITATIVE -> MONGODB** | NO today (Must move to Mongo first) |
| `company_intelligence`| Local-First Authority| **AUTHORITATIVE -> MONGODB** | NO today (Must move to Mongo first) |
| `website_intelligence`| Local-First Authority| **AUTHORITATIVE -> MONGODB** | NO today (Must move to Mongo first) |
| `contact_intelligence`| Local-First Authority| **AUTHORITATIVE -> MONGODB** | NO today (Must move to Mongo first) |
| `opportunity_scores`| Local-First Authority | **AUTHORITATIVE -> MONGODB** | NO today (Must move to Mongo first) |
| `audit_logs` | Local-First Authority | **AUTHORITATIVE -> MONGODB** | NO today (Must move to Mongo first) |
| `workspace_memory`| Local-First Authority | **AUTHORITATIVE -> MONGODB** | NO today (Must move to Mongo first) |
| `discovery_runs` | Mixed | **CACHE CANDIDATE** | YES — Rehydrate from Mongo `discoveryruns` |
| `company_discovery_runs`| Mixed | **CACHE CANDIDATE** | YES — Rehydrate from Mongo `companydiscoveryruns` |
| `audiences` | Mixed | **CACHE CANDIDATE** | YES — Rehydrate from Mongo `audiences` |
| `page_crawls` | Local-First Authority | **AUTHORITATIVE -> MONGODB** | NO today (Must move to Mongo first) |
| `intelligence_sources`| Local-First Authority| **AUTHORITATIVE -> MONGODB** | NO today (Must move to Mongo first) |
| `intelligence_evidence`|Local-First Authority| **AUTHORITATIVE -> MONGODB** | NO today (Must move to Mongo first) |
| `intelligence_claims` | Local-First Authority | **AUTHORITATIVE -> MONGODB** | NO today (Must move to Mongo first) |
| `intelligence_inferences`|Local-First Authority| **AUTHORITATIVE -> MONGODB** | NO today (Must move to Mongo first) |
| `email_deliveries`| Local-First Authority | **AUTHORITATIVE -> MONGODB** | NO today (Must move to Mongo first) |

---

## 4. Cache Hydration & Invalidation Model

```text
Application Startup
        ↓
Connect to API via SdkClient
        ↓
Execute CacheHydrator.hydrateWorkspaceCache()
        ↓
Fetch canonical records from MongoDB endpoints
        ↓
Execute `INSERT OR REPLACE` into local SQLite cache tables
        ↓
Application reads fast local SQLite cache
```

### Write Path Cache Mutation
When a user updates an entity in the UI:
1. UI sends API call `POST/PUT /companies`.
2. API writes authoritative document to MongoDB and returns saved record.
3. Desktop main process receives API response and updates local SQLite cache row (`INSERT OR REPLACE`).
4. If local SQLite file is corrupted or deleted, calling `CacheHydrator.hydrateWorkspaceCache()` completely restores the local cache state from MongoDB.
