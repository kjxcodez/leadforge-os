# LeadForge OS — Persistence Inventory

## 1. Overview & Data Storage Distribution

Data in LeadForge OS is currently stored across four distinct persistence mechanisms:
1. **SQLite (`better-sqlite3`)**: Local desktop application database files (`leadforge_<workspaceId>.db`).
2. **MongoDB**: Remote database managed by `apps/api` via Mongoose.
3. **Filesystem**: Local application data directory (`userData`), containing logs, pre-migration database backups (`.migration.bak`), crash dumps, and temporary crawl outputs.
4. **In-Memory Repositories**: Ephemeral memory maps used in testing and transient state (`MemoryRepository`).

---

## 2. Complete Entity Location Inventory

| Entity / System | SQLite Table(s) | Mongo Collection(s) | Other Storage | Authoritative Storage Today | Target Authoritative Storage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **User** | `users` | `users` | Memory session | Mixed / Sync | **MongoDB** |
| **Workspace** | `workspaces` | `workspaces` | Config file | Mixed / Sync | **MongoDB** |
| **Company** | `companies` | `companies` | None | SQLite (Writes local first) | **MongoDB** |
| **Contact** | `contacts` | `contacts` | None | SQLite (Writes local first) | **MongoDB** |
| **Campaign** | `campaigns` | `campaigns` | None | SQLite (Writes local first) | **MongoDB** |
| **Activity / Outreach** | `activities`, `outreach` | `outreaches` | None | SQLite | **MongoDB** |
| **Settings** | `settings` | None (Embedded in `Workspace`) | None | SQLite | **MongoDB** |
| **Sync Queue** | `sync_queue` | None | None | SQLite (Sync system) | **Obsolete (Delete)** |
| **Sync Metadata** | `sync_metadata` | None | None | SQLite (Sync system) | **Obsolete (Delete)** |
| **Sync Dead Letter** | `sync_dead_letter` | None | None | SQLite (Sync system) | **Obsolete (Delete)** |
| **Email Accounts** | `email_accounts` | `emailaccounts` | None | Mixed / Sync | **MongoDB** |
| **Templates** | `templates` | `emailtemplates` | Filesystem | Mixed / Sync | **MongoDB** |
| **Sequences / Workflows** | `sequences` | `sequences` | Presets in code | SQLite (Writes local first) | **MongoDB** |
| **Sequence Executions** | `sequence_executions` | `sequenceexecutions` | None | SQLite | **MongoDB** |
| **Sequence Logs** | `sequence_logs` | `sequencelogs` | None | SQLite | **MongoDB** |
| **Jobs (Scheduler)** | `jobs` | **None** | None | SQLite | **MongoDB (New Collection)** |
| **System Logs** | `system_logs` | **None** | Filesystem | SQLite | **MongoDB (New Collection)** |
| **Automation Locks** | `automation_locks` | **None** | Memory | SQLite | **MongoDB / Redis / API Lock** |
| **Company Intelligence**| `company_intelligence` | **None** | None | SQLite | **MongoDB (New Collection)** |
| **Website Intelligence**| `website_intelligence` | **None** | None | SQLite | **MongoDB (New Collection)** |
| **Contact Intelligence**| `contact_intelligence` | **None** | None | SQLite | **MongoDB (New Collection)** |
| **Opportunity Scores** | `opportunity_scores` | **None** | None | SQLite | **MongoDB (New Collection)** |
| **Audit Logs** | `audit_logs` | **None** | None | SQLite | **MongoDB (New Collection)** |
| **Workspace Memory** | `workspace_memory` | **None** | None | SQLite | **MongoDB (New Collection)** |
| **Discovery Runs** | `discovery_runs` | `discoveryruns` | None | Mixed / Sync | **MongoDB** |
| **Company Discovery Runs**|`company_discovery_runs`|`companydiscoveryruns`| None | Mixed / Sync | **MongoDB** |
| **Audiences** | `audiences` | `audiences` | None | Mixed / Sync | **MongoDB** |
| **Page Crawls** | `page_crawls` | **None** | Filesystem HTML | SQLite | **MongoDB (Metadata) + File Store** |
| **Intelligence Sources**| `intelligence_sources` | **None** | None | SQLite | **MongoDB (New Collection)** |
| **Intelligence Evidence**|`intelligence_evidence`| **None** | None | SQLite | **MongoDB (New Collection)** |
| **Intelligence Claims** | `intelligence_claims` | **None** | None | SQLite | **MongoDB (New Collection)** |
| **Intelligence Inferences**|`intelligence_inferences`|**None** | None | SQLite | **MongoDB (New Collection)** |
| **Email Deliveries** | `email_deliveries` | **None** | None | SQLite | **MongoDB (New Collection)** |
| **Beta Applicants** | None | `betaapplicants` | None | MongoDB | **MongoDB** |
| **OAuth Transactions** | None | `oauthtransactions` | None | MongoDB | **MongoDB** |
| **Test Recipients** | None | `usertestrecipients` | None | MongoDB | **MongoDB** |

---

## 3. Major Findings & Gaps

> [!IMPORTANT]
> 1. **15 SQLite Tables Missing from MongoDB:** 15 distinct operational, intelligence, logging, and execution ledger tables exist exclusively in SQLite with NO corresponding Mongo model in `apps/api`.
> 2. **Authoritative Write Split:** Currently, business entities like `companies`, `contacts`, `campaigns`, and `sequences` write to SQLite first. MongoDB is updated asynchronously by `SyncEngine`.
> 3. **Target MongoDB-First Alignment:** In the target architecture, MongoDB must host models for ALL 15 missing operational/intelligence entities, and ALL writes must flow directly through the API to MongoDB.
