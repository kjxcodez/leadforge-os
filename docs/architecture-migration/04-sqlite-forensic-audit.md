# LeadForge OS — SQLite Forensic Audit

## 1. File Location & Database Connection Management
* **Database File Naming:** `leadforge_<workspaceId>.db` stored inside user application data directory.
* **Connection Provider:** [`apps/desktop/src/main/database/connection.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/connection.ts#L1-L80).
* **Driver:** `better-sqlite3` native C++ bindings for Node.js.
* **PRAGMA Configurations Applied:**
  * `PRAGMA journal_mode = WAL;` (Write-Ahead Logging for concurrency).
  * `PRAGMA synchronous = NORMAL;`
  * `PRAGMA foreign_keys = ON;`
  * `PRAGMA busy_timeout = 5000;`

---

## 2. SQLite Migration Registry Audit

Migrations are defined sequentially in [`apps/desktop/src/main/database/runner.ts:10-880`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/runner.ts#L10-L880).
Migration version tracking is stored in internal table `_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, runAt DATETIME)`.

### 2.1 Complete List of Migrations (001 – 033)

| Migration Name | Description & Affected Tables |
| :--- | :--- |
| `001_initial_schema` | Creates `users`, `workspaces`, `companies`, `contacts`, `campaigns`, `activities`, `outreach`, `settings`, `sync_queue`, `sync_metadata`. |
| `002_discovery_schema` | Creates legacy `discovery_jobs`, `discovery_results`. |
| `003_outreach_schema` | Creates `email_accounts`, `templates`. |
| `004_automation_schema` | Creates `sequences`, `sequence_executions`, `sequence_logs`. |
| `005_local_first_foundation` | Creates `jobs`, `system_logs`, replaces `sync_queue` with v2 schema (`version`, `retryCount`, `lastError`). |
| `006_local_schema_enrichment` | Alters `contacts` & `companies` (adds `companyId`, `title`, `linkedinUrl`, `size`, `employeeCount`, `tags`, `notes`). |
| `007_add_company_website_location` | Alters `companies` (adds `website`, `location`). |
| `008_job_lifecycle_hardening` | Recreates `jobs` table (`jobs_new`) with extended status enum, `scheduledAt`, `checkpointData`, `idempotencyKey`, `durationMs`. Creates pre-008 file backup `.pre008.bak`. |
| `009_scraping_pipeline_schema` | Alters `companies` (`crawlStatus`, `crawledAt`, `contactCount`, `score`) & `contacts` (`confidence`, `verificationStatus`, `sourceUrl`). |
| `010_sequence_execution_tracking` | Alters `sequence_executions` (`cancelledAt`, `cancelReason`, `parentJobId`). |
| `011_indexing_optimizations` | Adds indexes: `idx_contacts_companyId`, `idx_activities_workspaceId`, `idx_sequence_exec_contactId`, `idx_sequence_exec_companyId`. |
| `012_automation_reliability` | Creates `automation_locks` (`sequenceId`, `entityId`, `expiresAt`). Alters `sequence_executions` (`retryCount`, `workerPid`, `recoveryCount`). |
| `013_execution_context` | Alters `sequence_executions` (`executionContext`). |
| `014_drop_legacy_discovery` | **DROPS** legacy tables `discovery_jobs` & `discovery_results`. |
| `015_sync_dead_letter` | Creates `sync_dead_letter` for archived permanently failed queue items. |
| `016_discovery_columns` | Alters `companies` (`website`, `location`, `phone`, `rating`) & `contacts` (`companyId`). |
| `017_linkedin_enrichment` | Alters `contacts` (`title`, `linkedinUrl`, `headline`, `profilePictureUrl`, `type`, `sourcePlatform`). |
| `018_campaigns_and_enrollments` | Alters `campaigns` (`sequenceId`, `sendingAccountId`, `schedule`, `dailyLimit`) & `sequence_executions` (`campaignId`, `emailsSent`, `replies`, `failures`). |
| `019_email_accounts_credentials` | Alters `email_accounts` (`smtpHost`, `smtpPort`, `smtpSecure`, `smtpUsername`, `smtpPassword`, `imapHost`, `imapPort`, `imapUsername`, `imapPassword`). |
| `020_sent_message_ids` | Alters `sequence_executions` (`sentMessageIds`). |
| `021_lead_intelligence_engine` | Creates `company_intelligence`, `website_intelligence`, `contact_intelligence`, `opportunity_scores`. |
| `023_audit_trail_and_observability` | Creates `audit_logs` (`actor`, `action`, `entityId`, `beforeValue`, `afterValue`). |
| `024_agent_memory` | Creates `workspace_memory` (`scope`, `key`, `value`). |
| `025_add_contacts_tags` | Alters `contacts` (`tags`). |
| `026_email_accounts_gmail_oauth` | Alters `email_accounts` (`refreshToken`, `accessToken`, `tokenExpiresAt`, `googleAccountId`). |
| `027_discovery_provenance` | Creates `discovery_runs`, `company_discovery_runs`, `audiences`. Alters `companies` (`requiresReview`). |
| `028_static_audiences` | Alters `audiences` (`mode`, `staticMemberIds`). |
| `029_intelligence_trust_foundation` | Creates `page_crawls`, `intelligence_sources`, `intelligence_evidence`, `intelligence_claims`, `intelligence_inferences`. |
| `030_structured_location_and_sync_hardening` | Alters `companies` (`city`, `state`, `country`). |
| `031_template_attachments` | Alters `templates` (`attachments` DEFAULT '[]'). |
| `032_email_deliveries_ledger` | Creates `email_deliveries` (`executionId`, `accountId`, `senderEmail`, `recipientEmail`, `status`, `idempotencyKey`). |
| `033_contact_last_contacted_at` | Alters `contacts` (`lastContactedAt`). |

---

## 3. SQLite Tables Forensic Classification

There are currently **30 active SQLite tables** in total:

### 3.1 Business Entities (Candidates for Disposable Cache)
1. `companies`
2. `contacts`
3. `campaigns`
4. `activities`
5. `outreach`
6. `email_accounts`
7. `templates`
8. `sequences`
9. `sequence_executions`
10. `sequence_logs`
11. `discovery_runs`
12. `company_discovery_runs`
13. `audiences`

### 3.2 Operational, Intelligence & History Storage (Must Move Authoritative Ownership to Mongo)
14. `jobs`
15. `system_logs`
16. `automation_locks`
17. `company_intelligence`
18. `website_intelligence`
19. `contact_intelligence`
20. `opportunity_scores`
21. `audit_logs`
22. `workspace_memory`
23. `page_crawls`
24. `intelligence_sources`
25. `intelligence_evidence`
26. `intelligence_claims`
27. `intelligence_inferences`
28. `email_deliveries`
29. `settings`

### 3.3 Synchronization Infrastructure (Obsolete in MongoDB-First Target)
30. `sync_queue`
31. `sync_metadata`
32. `sync_dead_letter`

---

## 4. Special Serialization & Column Behaviors
In [`apps/desktop/src/main/database/repositories/local-crm.ts:8-21`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/repositories/local-crm.ts#L8-L21), specific columns are automatically parsed from JSON strings upon read:
* `tags`, `notes`, `steps`, `variables`, `attachments`, `logs`, `contactsJson`, `statisticsJson`, `executionContext`, `metadata`, `filterDefinition`, `staticMemberIds`.
