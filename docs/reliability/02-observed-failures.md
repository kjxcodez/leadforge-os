# Observed Real-World Runtime Failures

This document catalogs the exact failures observed in runtime logs, their root causes, layers affected, and structural fixes.

---

## Failure Inventory

### FAILURE A: Workspace Cache `plan` Schema Mismatch
* **ID**: `FAIL-001`
* **Feature**: Workspace Caching & Multi-Tenancy
* **Severity**: `P0 / P1`
* **Log Signature**: `SqliteError: table workspaces has no column named plan`
* **Steps to Reproduce**: Launch Electron app with an existing `leadforge.db` from an earlier version and invoke `workspaces:list` or `workspaces:create`.
* **Root Cause**: `cache-schema.ts` defined `plan TEXT DEFAULT 'free'` inside `CREATE TABLE IF NOT EXISTS workspaces`, but existing databases were neither migrated with `ALTER TABLE` nor recreated because `detectCacheState` did not inspect column-level schemas or version numbers.
* **Fix**:
  1. Bump `CACHE_SCHEMA_VERSION` in `cache-schema.ts`.
  2. Implement column check in `detectCacheState` and safe `ALTER TABLE` additions in `initCacheSchema`.
  3. Ensure `LocalWorkspaceRepository` safely falls back to `'free'`.

---

### FAILURE B: Dashboard Queries Removed SQLite Tables
* **ID**: `FAIL-002`
* **Feature**: Dashboard & Analytics
* **Severity**: `P0 / P1`
* **Log Signature**:
  ```text
  dashboard:stats -> SqliteError: no such table: sequence_logs
  dashboard:chart-data -> SqliteError: no such table: sequence_logs
  dashboard:activity-feed -> SqliteError: no such table: system_logs
  ```
* **Steps to Reproduce**: Open Dashboard Screen or Reports Screen in desktop renderer.
* **Root Cause**: IPC handlers in `dashboard.ts` executed direct SQL queries against `sequence_logs`, `system_logs`, `activities`, and `jobs`. These operational/telemetry tables were intentionally removed from the disposable SQLite cache during Phase 6-15.
* **Fix**:
  1. `dashboard:stats`: Query company/contact/campaign counts from local cache; fetch today's email deliveries via SDK `/api/v1/deliveries`; query active sequence executions from cache/API; fetch scheduler/worker health from `WorkspaceRuntime` in-memory state.
  2. `dashboard:activity-feed`: Fetch authoritative system logs from API `/api/v1/system-logs` via SDK.
  3. `dashboard:chart-data`: Aggregate delivery history via API `/api/v1/deliveries` combined with cached contact creation timestamps.

---

### FAILURE C: Contact `sourcePlatform` Schema Mismatch
* **ID**: `FAIL-003`
* **Feature**: CRM Contacts & Filtering
* **Severity**: `P1`
* **Log Signature**: `contacts:distinct-values -> SqliteError: no such column: sourcePlatform`
* **Steps to Reproduce**: Navigate to Contacts Screen or open CRM filter dropdowns.
* **Root Cause**: IPC handler in `crm.ts` executed `SELECT DISTINCT sourcePlatform FROM contacts` and `c.sourcePlatform LIKE ?`, but the canonical Contact schema and SQLite cache schema use the standard column `source`.
* **Fix**:
  1. Update `contacts:distinct-values` and `contacts:list` in `crm.ts` to query canonical column `source`.
  2. Update `ContactsScreen.tsx` and `DiscoveryScreen.tsx` to filter on `contact.source`.

---

### FAILURE D: Workspace Switching Race Condition
* **ID**: `FAIL-004`
* **Feature**: Workspace Runtime Lifecycle
* **Severity**: `P1`
* **Log Signature**: `Workspace runtime for "..." is not currently active.`
* **Steps to Reproduce**: Switch between Workspace A and Workspace B while UI components are polling or in-flight queries are executing.
* **Root Cause**: Stale IPC requests for workspace A arrived after runtime A was stopped. `scheduler.ts` and related IPC handlers threw hard unhandled exceptions when `runtime.workspaceId !== workspaceId`.
* **Fix**:
  1. Implement transition serialization lock in `WorkspaceManager`.
  2. In IPC handlers, gracefully handle switching state by using `WorkspaceManager.getSdk()` or returning safe empty payloads rather than throwing unhandled errors.
  3. In renderer, cancel and invalidate React Query queries upon workspace ID change.

---

### FAILURE E: Duplicate Workspace Runtime Startup
* **ID**: `FAIL-005`
* **Feature**: Workspace Runtime Supervisor
* **Severity**: `P1`
* **Log Signature**: Repeated logs of `Workspace runtime started`, `JobScheduler started`, `CacheHydrator started`, `AutomationTriggerEvaluator started` for the same workspace ID on boot.
* **Steps to Reproduce**: Boot application and restore session.
* **Root Cause**: `useAuth.ts` and `workspace-store.tsx` both invoked `WorkspaceService.syncActiveWorkspace(active.id)` in parallel without synchronization, causing two concurrent runtime instantiations.
* **Fix**:
  1. Deduplicate IPC invocations across `useAuth.ts` and `workspace-store.tsx`.
  2. Enforce atomic single-instance runtime transition locks in `WorkspaceManager`.

---

### FAILURE F & G: Google Maps Discovery Reliability & False Success
* **ID**: `FAIL-006`
* **Feature**: Lead Discovery & Scraping
* **Severity**: `P1`
* **Log Signature**: `No Google Maps search feed or listing found -> Stored: 0 -> Job COMPLETED`
* **Steps to Reproduce**: Run Google Maps discovery for queries like "Medical clinics in Jaipur, Rajasthan, India" or "HVAC Contractors in Texas, United States".
* **Root Cause**: Playwright scraper only checked a single feed selector `div[role="feed"]`. If Google Maps presented localized variations, alternate feed classes, or consent dialogs, the scraper failed to locate the feed and finished with 0 results, marking the job as successfully completed.
* **Fix**:
  1. Implement multi-selector feed resolution (`div[role="feed"]`, `div.m6QErb`, `div[aria-label*="Results"]`).
  2. Handle consent banners and detect CAPTCHA/blocking.
  3. Distinguish outcome states (`SUCCESS_WITH_RESULTS`, `SUCCESS_ZERO_RESULTS`, `BLOCKED`, `CAPTCHA`, `RATE_LIMITED`, `PROVIDER_FAILURE`, `EXTRACTION_FAILURE`).
  4. Throw structured errors on extraction failure so the job fails/retries with complete diagnostic logs.

---

### FAILURE H: Campaign Status Contract Mismatch
* **ID**: `FAIL-007`
* **Feature**: Campaigns & Outreach
* **Severity**: `P1`
* **Log Signature**: `API validation error: received "Active"`
* **Steps to Reproduce**: Click Resume or Pause Campaign in Campaigns Screen.
* **Root Cause**: `CampaignsScreen.tsx` sent title-cased strings (`'Active'`, `'Paused'`), whereas the API schema strictly validates uppercase `CampaignStatus` enums (`'ACTIVE'`, `'PAUSED'`, `'DRAFT'`, `'COMPLETED'`).
* **Fix**:
  1. Standardize `CampaignsScreen.tsx` mutations to send `CampaignStatus` uppercase enums.
  2. Display human-readable presentation labels in the UI.

---

### FAILURE I: Job Polling Loop & Mongoose Deprecation
* **ID**: `FAIL-008`
* **Feature**: Scheduler & API Communication
* **Severity**: `P1 / P2`
* **Log Signature**: Continuous `GET /api/v1/jobs?limit=100` and `POST /api/v1/jobs/claim` cycles every 1-2s; Mongoose warning `the 'new' option for findOneAndUpdate() is deprecated. Use returnDocument: 'after' instead`.
* **Root Cause**:
  1. `DiscoveryScreen.tsx` had an aggressive `refetchInterval: 1500` calling `scheduler:jobs:list`, in addition to the desktop `JobScheduler` ticking claims every 2000ms.
  2. Mongoose 9.x deprecates `new: true` across `findOneAndUpdate` and `findOneAndReplace`.
* **Fix**:
  1. Relax renderer polling interval in `DiscoveryScreen.tsx` to 5000ms.
  2. Replace all `{ new: true }` with `{ returnDocument: 'after' }` across all repositories and services in `apps/api`.
