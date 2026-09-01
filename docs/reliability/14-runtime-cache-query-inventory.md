# 14 - Runtime Cache Query Inventory & Classification

## 1. Executive Summary

This inventory catalogs every production SQLite query executed across the LeadForge Electron Main process (`apps/desktop/src/main/`). Each query is mapped to its IPC entry point, target SQLite table, authoritative source of truth, and architectural category:
- **`CACHE-BACKED`**: Fast read-acceleration from the disposable SQLite cache, backed by authoritative MongoDB records hydrated via `CacheHydrator`.
- **`API-BACKED`**: Queries that must hit the API / MongoDB directly for real-time or transactional consistency.
- **`DERIVED`**: Computed/aggregated in-memory from valid cache rows or API responses.
- **`SHOULD-NOT-EXIST`**: Broken queries targeting unpopulated local tables or obsolete legacy schemas.

---

## 2. Comprehensive SQLite Production Query Inventory

| Query ID | IPC Channel / Origin | Source File & Line | Exact SQL Query | Target Table & Columns | Purpose | UI Consumer | Authoritative Source | Cache Required? | Category |
|---|---|---|---|---|---|---|---|---|---|
| **QRY-01** | `dashboard:stats` | `main/ipc/dashboard.ts:17` | `SELECT COUNT(*) as count FROM companies WHERE workspaceId = ? AND deletedAt IS NULL` | `companies` (`workspaceId`, `deletedAt`) | Total companies count | `DashboardScreen.tsx:30` | MongoDB `CompanyModel` | Yes (Fast count) | **CACHE-BACKED** |
| **QRY-02** | `dashboard:stats` | `main/ipc/dashboard.ts:24` | `SELECT COUNT(*) as count FROM contacts WHERE workspaceId = ? AND deletedAt IS NULL` | `contacts` (`workspaceId`, `deletedAt`) | Total contacts count | `DashboardScreen.tsx:30` | MongoDB `ContactModel` | Yes (Fast count) | **CACHE-BACKED** |
| **QRY-03** | `dashboard:stats` | `main/ipc/dashboard.ts:31` | `SELECT COUNT(*) as count FROM campaigns WHERE workspaceId = ? AND deletedAt IS NULL` | `campaigns` (`workspaceId`, `deletedAt`) | Total campaigns count | `DashboardScreen.tsx:30` | MongoDB `CampaignModel` | Yes (Fast count) | **CACHE-BACKED** |
| **QRY-04** | `dashboard:stats` | `main/ipc/dashboard.ts:48-59` | `SELECT SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) as waiting, SUM(CASE WHEN status IN ('running', 'queued', 'starting') THEN 1 ELSE 0 END) as running, SUM(CASE WHEN status IN ('replied', 'REPLIED') THEN 1 ELSE 0 END) as replied, SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed, SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) as paused, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed FROM sequence_executions WHERE workspaceId = ? AND deletedAt IS NULL` | `sequence_executions` (`status`, `workspaceId`, `deletedAt`) | Automation execution metric breakdown | `DashboardScreen.tsx:30` | MongoDB `SequenceExecutionModel` | Yes (Fast aggregate) | **CACHE-BACKED** |
| **QRY-05** | `dashboard:stats` | `main/ipc/dashboard.ts:93-99` | `SELECT status FROM email_accounts WHERE workspaceId = ? AND deletedAt IS NULL ORDER BY createdAt ASC LIMIT 1` | `email_accounts` (`status`, `workspaceId`, `deletedAt`, `createdAt`) | Primary email account status | `DashboardScreen.tsx:30` | MongoDB `EmailAccountModel` | Yes | **CACHE-BACKED** |
| **QRY-06** | `dashboard:chart-data` | `main/ipc/dashboard.ts:183-189` | `SELECT date(createdAt) as day, COUNT(*) as count FROM contacts WHERE workspaceId = ? AND deletedAt IS NULL AND createdAt >= ? GROUP BY day` | `contacts` (`createdAt`, `workspaceId`, `deletedAt`) | Daily contacts creation chart | `DashboardScreen.tsx:37` | MongoDB `ContactModel` | Yes (Time-series aggregate) | **CACHE-BACKED** |
| **QRY-07** | `dashboard:chart-data` | `main/ipc/dashboard.ts:201-207` | `SELECT date(startedAt) as day, COUNT(*) as count FROM sequence_executions WHERE workspaceId = ? AND startedAt >= ? GROUP BY day` | `sequence_executions` (`startedAt`, `workspaceId`) | Daily execution volume chart | `DashboardScreen.tsx:37` | MongoDB `SequenceExecutionModel` | Yes (Time-series aggregate) | **CACHE-BACKED** |
| **QRY-08** | `companies:query` | `main/ipc/crm.ts:22-71` | `SELECT DISTINCT c.* FROM companies c [INNER JOIN company_discovery_runs cdr ON c.id = cdr.companyId] WHERE c.workspaceId = ? AND c.deletedAt IS NULL ... ORDER BY c.createdAt DESC` | `companies`, `company_discovery_runs` | Filtered, searchable company table view | `CompaniesScreen.tsx` | MongoDB `CompanyModel` | Yes (Indexed search) | **CACHE-BACKED** |
| **QRY-09** | `companies:distinct-values` | `main/ipc/crm.ts:167-171` | `SELECT DISTINCT industry / location / city / state / country FROM companies WHERE workspaceId = ? AND deletedAt IS NULL ...` | `companies` | Filter dropdown facet options | `CompaniesScreen.tsx` | MongoDB `CompanyModel` | Yes (Distinct scanning) | **CACHE-BACKED** |
| **QRY-10** | `contacts:query` | `main/ipc/crm.ts:116-155` | `SELECT DISTINCT c.* FROM contacts c [INNER JOIN company_discovery_runs cdr ON c.companyId = cdr.companyId] WHERE c.workspaceId = ? AND c.deletedAt IS NULL ... ORDER BY c.createdAt DESC` | `contacts`, `company_discovery_runs` | Filtered contact CRM view | `ContactsScreen.tsx` | MongoDB `ContactModel` | Yes (Indexed search) | **CACHE-BACKED** |
| **QRY-11** | `contacts:distinct-values` | `main/ipc/crm.ts:184-185` | `SELECT DISTINCT title / source FROM contacts WHERE workspaceId = ? AND deletedAt IS NULL ...` | `contacts` (`title`, `source`) | Contact filter facets | `ContactsScreen.tsx` | MongoDB `ContactModel` | Yes | **CACHE-BACKED** |
| **QRY-12** | `campaigns:list` | `main/ipc/crm.ts:241-255` | `SELECT COUNT(id) as total, SUM(...) FROM sequence_executions WHERE campaignId = ? AND deletedAt IS NULL` | `sequence_executions` | Per-campaign enrollment progress & live stats | `CampaignsScreen.tsx:203` | MongoDB `SequenceExecutionModel` | Yes | **CACHE-BACKED** |
| **QRY-13** | `campaigns:list` | `main/ipc/crm.ts:293-296` | `UPDATE campaigns SET status = ?, updatedAt = datetime('now') WHERE id = ?` | `campaigns` (`status`, `updatedAt`, `id`) | Local status synchronization cache update | `CampaignsScreen.tsx:203` | MongoDB `CampaignModel` | No (Server should update status) | **DERIVED** |
| **QRY-14** | `discovery:run:companies` | `main/ipc/discovery-ipc.ts:89-95` | `SELECT DISTINCT c.* FROM companies c INNER JOIN company_discovery_runs cdr ON c.id = cdr.companyId WHERE cdr.workspaceId = ? AND cdr.discoveryRunId = ? AND c.deletedAt IS NULL ORDER BY c.createdAt DESC` | `companies`, `company_discovery_runs` | Companies discovered during a specific run | `DiscoveryScreen.tsx:266` | MongoDB `CompanyDiscoveryRunModel` + `CompanyModel` | Yes | **CACHE-BACKED** |
| **QRY-15** | `email-deliveries:list` | `main/ipc/outreach.ts:262-285` | `SELECT ed.*, c.firstName, c.lastName, comp.name as companyName, camp.name as campaignName FROM email_deliveries ed LEFT JOIN contacts c ON ed.contactId = c.id ... WHERE ed.workspaceId = ?` | `email_deliveries`, `contacts`, `companies`, `campaigns` | Outbound delivery audit ledger table | `CampaignsScreen.tsx:170` | MongoDB `EmailDeliveryModel` (`/api/v1/deliveries`) | **NO (API-BACKED)** | **SHOULD-NOT-EXIST** |

---

## 3. Forensic Classification & Recommendations

### A. Broken Query: `email-deliveries:list` (QRY-15)
- **Problem**: Queries local SQLite `email_deliveries` table. All actual email sends are executed by `EmailService.send()` on the API server and recorded in MongoDB `EmailDeliveryModel`. Local SQLite table is never hydrated, resulting in an empty delivery ledger (0 rows) in the UI.
- **Action**: Replace local SQLite query with direct API fetch via `sdk.emailDeliveries.list({ workspaceId, campaignId, status, page, limit })`.

### B. Premature Query Execution on Clean Database
- **Problem**: QRY-01 through QRY-12 execute immediately on page load before `initCacheSchema(db)` has been invoked on newly opened workspace database connections.
- **Action**: Call `initCacheSchema(db)` inside `getDatabase(workspaceId)` immediately upon connection instantiation.
