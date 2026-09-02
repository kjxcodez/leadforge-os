# LeadForge OS — Local SQLite Cache Implementation Plan

## 1. The Absolute Cache Invariant

In the target MongoDB-First architecture:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          THE ABSOLUTE CACHE INVARIANT                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                  DELETE SQLite FILE (`leadforge_<workspaceId>.db`)          │
│                                  ║                                          │
│                                  ▼                                          │
│                  ZERO AUTHORITATIVE BUSINESS DATA IS LOST                   │
│                                  ║                                          │
│                                  ▼                                          │
│                  Desktop App Reconnects & Rehydrates in < 2s                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

SQLite ceases to be an authoritative database. It is strictly demoted to a **disposable, materialized read-cache** whose sole purpose is to provide sub-5ms synchronous SQL queries for desktop React UI components.

---

## 2. Table-by-Table Definitive Classification Matrix

Every single table in the current desktop runtime is categorized into one of four classifications:

```text
┌─────────────────────────┬───────────────────────────┬──────────────────────────────────────────────────────────┐
│ Existing SQLite Table   │ Target Classification     │ Disposition Rationale & Storage Destination              │
├─────────────────────────┼───────────────────────────┼──────────────────────────────────────────────────────────┤
│ `companies`             │ **KEEP AS CACHE**         │ Projected from Mongo `companies`. UI CRM list view.      │
│ `contacts`              │ **KEEP AS CACHE**         │ Projected from Mongo `contacts`. UI CRM list view.       │
│ `campaigns`             │ **KEEP AS CACHE**         │ Projected from Mongo `campaigns`. Campaign dashboard.    │
│ `email_accounts`        │ **KEEP AS CACHE**         │ Projected from Mongo `emailaccounts` (non-secret fields).│
│ `templates`             │ **KEEP AS CACHE**         │ Projected from Mongo `emailtemplates` (incl. Drive URLs).│
│ `sequences`             │ **KEEP AS CACHE**         │ Projected from Mongo `sequences`. Visual workflow editor.│
│ `sequence_executions`   │ **KEEP AS CACHE**         │ Projected recent active runs (limit 500 per workspace).  │
│ `audiences`             │ **KEEP AS CACHE**         │ Projected from Mongo `audiences`. Segment lists.         │
│ `discovery_runs`        │ **KEEP AS CACHE**         │ Projected recent runs from Mongo `discoveryruns`.        │
│ `company_discovery_runs`│ **KEEP AS CACHE**         │ Projected links from Mongo `companydiscoveryruns`.       │
│ `users`                 │ **KEEP AS CACHE**         │ Projected active user profile from Mongo `users`.        │
│ `workspaces`            │ **KEEP AS CACHE**         │ Projected workspace metadata from Mongo `workspaces`.    │
├─────────────────────────┼───────────────────────────┼──────────────────────────────────────────────────────────┤
│ `jobs`                  │ **DO NOT CACHE / API**    │ Authoritative state in Mongo `jobs`. UI polls API.       │
│ `system_logs`           │ **DO NOT CACHE / API**    │ High volume. Retained in Mongo `systemlogs` with TTL.    │
│ `automation_locks`      │ **DO NOT CACHE / API**    │ Ephemeral. Managed atomically in Mongo `automationlocks`.│
│ `company_intelligence`  │ **DO NOT CACHE / API**    │ Fetched on-demand via API when opening company drawer.   │
│ `website_intelligence`  │ **DO NOT CACHE / API**    │ Fetched on-demand via API when viewing website tab.      │
│ `contact_intelligence`  │ **DO NOT CACHE / API**    │ Fetched on-demand via API when inspecting contact.       │
│ `opportunity_scores`    │ **DO NOT CACHE / API**    │ Synced as score column on cached `companies` table.      │
│ `audit_logs`            │ **DO NOT CACHE / API**    │ Historical audit log. Queried via API `/audit-logs`.     │
│ `workspace_memory`      │ **DO NOT CACHE / API**    │ Agent memory. Loaded into agent memory context via API.  │
│ `page_crawls`           │ **DO NOT CACHE / API**    │ Raw crawl archives. Not needed in UI read cache.         │
│ `intelligence_sources`  │ **DO NOT CACHE / API**    │ Provenance store. API backed.                            │
│ `intelligence_evidence` │ **DO NOT CACHE / API**    │ Fact ledger. API backed.                                 │
│ `intelligence_claims`   │ **DO NOT CACHE / API**    │ Fact ledger. API backed.                                 │
│ `intelligence_inferences`│**DO NOT CACHE / API**    │ Rule inferences. API backed.                             │
│ `email_deliveries`      │ **DO NOT CACHE / API**    │ Immutable send ledger. Queried via API when auditing.    │
├─────────────────────────┼───────────────────────────┼──────────────────────────────────────────────────────────┤
│ `sync_queue`            │ **DELETE (OBSOLETE)**     │ Completely eliminated. No local-first mutation queue.    │
│ `sync_metadata`         │ **DELETE (OBSOLETE)**     │ Completely eliminated. No sync checkpoint tracking.      │
│ `sync_dead_letter`      │ **DELETE (OBSOLETE)**     │ Completely eliminated. No sync failure staging.          │
│ `activities`            │ **DELETE / MERGE**        │ Merged into `outreach` or queried via API.               │
└─────────────────────────┴───────────────────────────┴──────────────────────────────────────────────────────────┘
```

---

## 3. Cache Hydration Engine (`CacheHydrator`)

The rewritten `CacheHydrator` runs on workspace activation and handles initial population and background refresh:

```text
  Workspace Boot / Switch (WorkspaceRuntime.ts)
         │
         ├─► 1. Run `initCacheSchema(db)` (Creates clean empty tables if fresh .db)
         │
         ▼
  CacheHydrator.hydrateWorkspaceCache(workspaceId, sdk)
         │
         ├─► Step 1: Fetch Workspace Profile & Settings (sdk.workspaces.get)
         ├─► Step 2: Fetch Email Accounts (sdk.outreach.listAccounts)
         ├─► Step 3: Fetch Templates (sdk.outreach.listTemplates)
         ├─► Step 4: Fetch Campaigns & Sequences (sdk.campaigns.list, sdk.sequences.list)
         ├─► Step 5: Fetch Active Companies & Contacts (Paged, 500/page)
         │
         ▼
  Execute Atomic SQLite Batch:
  db.transaction(() => {
    for (const comp of companies) {
      insertCompanyStmt.run(comp.id, comp.name, comp.domain, ...);
    }
    for (const cont of contacts) {
      insertContactStmt.run(cont.id, cont.companyId, cont.email, ...);
    }
  })();
         │
         ▼
  Emit IPC Event: `cache:ready` -> Desktop UI switches to instant SQLite reads
```

### Hydration Constraints:
1. **Preserves Canonical ID:** The MongoDB `_id` string is saved as `id` in SQLite. Zero ID translation.
2. **Chunked Streaming:** Large collections are retrieved in chunks of 200 items using pagination cursors (`limit=200`).
3. **Fault Tolerance:** If a network failure occurs during hydration, already-hydrated tables remain valid and accessible; the hydration process resumes on the next connection tick.
4. **Never Writes to MongoDB:** `CacheHydrator` is 100% read-only with respect to the API.

---

## 4. Cache Update Strategy (Write-Through Confirmation)

When a user mutates data in the UI (e.g. creating a contact or updating a campaign):

```text
  React UI (User clicks "Save Contact")
        │
        ▼ (IPC)
  Electron Main (`contacts:create` IPC handler)
        │
        ▼ (NO SQLite write here!)
  SdkClient: await sdk.contacts.create(contactDto)
        │
        ▼
  apps/api ──► MongoDB Server (Authoritative write commits)
        │
        ▼ (Authoritative Response: HTTP 201 { success: true, data: savedContact })
  Electron Main receives confirmed document
        │
        ▼
  LocalCRMRepository.saveCache('contacts', savedContact)
  --> Executes: `INSERT OR REPLACE INTO contacts (id, workspaceId, ...) VALUES (...)`
        │
        ▼ (IPC Reply)
  React UI updates instantly with authoritative data
```

### Why Write-Through Confirmation is Critical:
- Completely eliminates dirty states and `syncStatus = 'pending'`.
- Guarantees that if the API rejects a write (e.g. unique email conflict, invalid payload, permission error), the local cache is **never corrupted** with an invalid local record.
- Offline behavior: If offline, the API call throws a `NetworkError`, and the UI displays a clear notification ("Unable to save contact — network connection unavailable"). No orphan local mutations are created!

---

## 5. Cache Invalidation & Recovery Scenarios

```text
┌─────────────────────────────────────┬────────────────────────────────────────────────────────────┐
│ Scenario                            │ Resolution Procedure                                       │
├─────────────────────────────────────┼────────────────────────────────────────────────────────────┤
│ **Local SQLite Corruption**         │ Delete `leadforge_<ws>.db`. `initCacheSchema(db)` creates  │
│                                     │ a fresh schema; `CacheHydrator` repopulates all tables.    │
├─────────────────────────────────────┼────────────────────────────────────────────────────────────┤
│ **Workspace Switching**             │ Close current `.db` connection pool. Open target           │
│                                     │ `leadforge_<newWs>.db`. Run incremental hydration.         │
├─────────────────────────────────────┼────────────────────────────────────────────────────────────┤
│ **Concurrent Mutation by Colleague**│ SdkClient receives webhook / SSE / polling update. Cache   │
│                                     │ row updated with `INSERT OR REPLACE`.                      │
├─────────────────────────────────────┼────────────────────────────────────────────────────────────┤
│ **Manual User Cache Reset**         │ UI Button "Rebuild Local Cache" wipes SQLite and triggers  │
│                                     │ full re-hydration from MongoDB in the background.          │
└─────────────────────────────────────┴────────────────────────────────────────────────────────────┘
```
