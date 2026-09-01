# SQLite Cache Contract Audit

This document audits every SQLite table, column, reader, writer, and UI dependency in the **LeadForge OS** disposable local cache.

---

## Architectural Rules of the Disposable Cache
1. **MongoDB is the Sole Source of Truth**: SQLite is strictly a fast, offline-resilient local read projection.
2. **Zero Sync Infrastructure**: No `sync_queue`, `sync_metadata`, `syncStatus`, `version`, or `pending` flags.
3. **Identical String IDs**: Every SQLite primary key matches the canonical MongoDB string `_id`.
4. **Disposable & Droppable**: Deleting `leadforge_<wsId>.db` causes zero data loss; the cache rebuilds cleanly from MongoDB via `CacheHydrator`.

---

## Table & Column Matrix

| Table | Columns | API / Mongo Source | Readers / IPC | Writers / Hydrator |
|---|---|---|---|---|
| `workspaces` | `id`, `name`, `slug`, `ownerId`, `plan`, `settings`, `createdAt`, `updatedAt` | `WorkspaceModel` (`/api/v1/workspaces`) | `workspaces:list`, `workspaces:get`, `LocalWorkspaceRepository` | `LocalWorkspaceRepository.save/saveMany`, `CacheHydrator` |
| `companies` | `id`, `workspaceId`, `name`, `domain`, `industry`, `status`, `website`, `address`, `phone`, `email`, `employeeCount`, `size`, `revenue`, `city`, `state`, `country`, `location`, `linkedin`, `linkedinUrl`, `notes`, `opportunityScore`, `tags`, `customFields`, `metrics`, `createdAt`, `updatedAt`, `deletedAt` | `CompanyModel` (`/api/v1/companies`) | `companies:list`, `companies:distinct-values`, `companies:get`, `dashboard:stats` | `LocalCRMRepository.saveFromServer/saveManyFromServer`, `CacheHydrator` |
| `contacts` | `id`, `workspaceId`, `companyId`, `firstName`, `lastName`, `email`, `phone`, `title`, `linkedin`, `linkedinUrl`, `source`, `priority`, `status`, `notes`, `tags`, `lastContactedAt`, `customFields`, `createdAt`, `updatedAt`, `deletedAt` | `ContactModel` (`/api/v1/contacts`) | `contacts:list`, `contacts:distinct-values`, `contacts:get`, `dashboard:stats` | `LocalCRMRepository.saveFromServer/saveManyFromServer`, `CacheHydrator` |
| `campaigns` | `id`, `workspaceId`, `sequenceId`, `sendingAccountId`, `name`, `description`, `dailyLimit`, `timezone`, `status`, `settings`, `stats`, `createdAt`, `updatedAt`, `deletedAt` | `CampaignModel` (`/api/v1/campaigns`) | `campaigns:list`, `campaigns:get`, `dashboard:stats` | `LocalCRMRepository.saveFromServer`, `CacheHydrator` |
| `sequences` | `id`, `workspaceId`, `name`, `description`, `steps`, `status`, `settings`, `createdAt`, `updatedAt`, `deletedAt` | `SequenceModel` (`/api/v1/sequences`) | `sequences:list`, `sequences:get`, `AutomationTriggerEvaluator` | `LocalCRMRepository.saveFromServer`, `CacheHydrator` |
| `sequence_executions` | `id`, `workspaceId`, `sequenceId`, `campaignId`, `contactId`, `companyId`, `status`, `currentStepIndex`, `nextExecutionAt`, `contextData`, `startedAt`, `completedAt`, `failedAt`, `stoppedAt`, `error`, `createdAt`, `updatedAt`, `deletedAt` | `SequenceExecutionModel` (`/api/v1/automation/executions`) | `automation:executions:list`, `dashboard:stats`, `dashboard:chart-data` | `LocalCRMRepository.saveFromServer`, `CacheHydrator` |
| `templates` | `id`, `workspaceId`, `name`, `subject`, `bodyHtml`, `bodyText`, `variables`, `attachments`, `tags`, `category`, `createdAt`, `updatedAt`, `deletedAt` | `EmailTemplateModel` (`/api/v1/templates`) | `templates:list`, `templates:get` | `LocalCRMRepository.saveFromServer`, `CacheHydrator` |
| `email_accounts` | `id`, `workspaceId`, `email`, `displayName`, `provider`, `status`, `dailySendLimit`, `sentToday`, `settings`, `createdAt`, `updatedAt`, `deletedAt` | `GoogleConnectionModel` (`/api/v1/google-connections`) | `email:accounts:list`, `dashboard:stats` | `LocalCRMRepository.saveFromServer`, `CacheHydrator` |
| `audiences` | `id`, `workspaceId`, `name`, `description`, `filterRules`, `memberCount`, `isDynamic`, `createdAt`, `updatedAt`, `deletedAt` | `AudienceModel` (`/api/v1/audiences`) | `audiences:list`, `audiences:get` | `LocalCRMRepository.saveFromServer`, `CacheHydrator` |
| `discovery_runs` | `id`, `workspaceId`, `name`, `query`, `targetCount`, `foundCount`, `status`, `settings`, `createdAt`, `updatedAt`, `deletedAt` | `DiscoveryRunModel` (`/api/v1/discovery/runs`) | `discovery:run:list`, `discovery:run:get` | `LocalCRMRepository.saveFromServer`, `CacheHydrator` |
| `company_discovery_runs` | `id`, `workspaceId`, `companyId`, `discoveryRunId`, `createdAt` | `CompanyDiscoveryRunModel` (`/api/v1/discovery/runs/:id/companies`) | `discovery:run:companies` | `LocalCRMRepository.saveFromServer`, `CacheHydrator` |
| `cache_metadata` | `key`, `value`, `updatedAt` | Local SQLite Metadata | `detectCacheState`, `ensureCleanCache` | `initCacheSchema`, `CacheHydrator` |

---

## Operational Datasets Intentionally Excluded from SQLite Cache
The following datasets are high-throughput, operational, or append-only telemetry and are **queried directly from API / MongoDB**:
1. `jobs`: Atomic worker queues managed directly in MongoDB via `JobRepository`.
2. `email_deliveries`: Delivery ledgers and idempotency tracking managed via `EmailDeliveryRepository`.
3. `system_logs`: Operational diagnostics managed via `SystemLogRepository`.
4. `audit_logs`: Regulatory audit trails managed via `AuditRepository`.
5. `automation_locks`: Distributed execution locks with TTL managed via `AutomationLockRepository`.
