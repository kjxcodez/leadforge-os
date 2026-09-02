# LeadForge OS — Comprehensive File Change Manifest

## 1. Executive Summary

This manifest catalogs every single source file, schema, route, worker plugin, service, repository, and script across the LeadForge OS monorepo affected by the migration from Local-First SQLite + SyncEngine to MongoDB-First Architecture.

### Action Classifications:
* **`CREATE`**: New file to be added to the repository.
* **`MODIFY`**: Existing file requiring surgical updates while retaining core implementation.
* **`REWRITE`**: Existing file whose architectural purpose remains but whose implementation must be completely rewritten.
* **`DELETE`**: Obsolete file to be permanently purged from the repository.
* **`KEEP`**: Existing file remaining intact with zero or purely cosmetic adjustments.

---

## 2. Master File Change Manifest Table

| Path | Action | Phase | Reason for Change | Dependencies | Risk |
| :--- | :---: | :---: | :--- | :--- | :---: |
| **`packages/schema/src/common/identity.ts`** | `CREATE` | 1 | Canonical ID generator (`crypto.randomUUID()`). | None | Low |
| **`packages/schema/src/fields/common.ts`** | `MODIFY` | 1 | Export `entityIdField`, deprecate `objectIdField`. | None | Low |
| **`packages/schema/src/entities/*.ts`** | `MODIFY` | 1 | Enforce `id: entityIdField` across all Zod domain models. | `fields/common.ts` | Medium |
| **`packages/schema/src/entities/job.ts`** | `CREATE` | 1 | Zod schema for distributed jobs & checkpoints. | `entityIdField` | Low |
| **`packages/schema/src/entities/intelligence.ts`** | `CREATE` | 1 | Zod schemas for 5 intelligence models. | `entityIdField` | Low |
| **`packages/schema/src/entities/delivery.ts`** | `CREATE` | 1 | Zod schema for outbound email delivery ledger. | `entityIdField` | Low |
| **`packages/schema/src/entities/lock.ts`** | `CREATE` | 1 | Zod schema for distributed automation locks. | `entityIdField` | Low |
| **`apps/api/src/db/models/job.model.ts`** | `CREATE` | 2 | Mongoose model for `jobs` collection. | `packages/schema` | Low |
| **`apps/api/src/db/models/system-log.model.ts`** | `CREATE` | 2 | Mongoose model for `systemlogs` with TTL. | `packages/schema` | Low |
| **`apps/api/src/db/models/automation-lock.model.ts`**| `CREATE` | 2 | Mongoose model for `automationlocks` with TTL. | `packages/schema` | Low |
| **`apps/api/src/db/models/company-intelligence.model.ts`**| `CREATE` | 2 | Mongoose model for `companyintelligences`. | `packages/schema` | Low |
| **`apps/api/src/db/models/website-intelligence.model.ts`**| `CREATE` | 2 | Mongoose model for `websiteintelligences`. | `packages/schema` | Low |
| **`apps/api/src/db/models/contact-intelligence.model.ts`**| `CREATE` | 2 | Mongoose model for `contactintelligences`. | `packages/schema` | Low |
| **`apps/api/src/db/models/opportunity-score.model.ts`** | `CREATE` | 2 | Mongoose model for `opportunityscores`. | `packages/schema` | Low |
| **`apps/api/src/db/models/audit-log.model.ts`** | `CREATE` | 2 | Mongoose model for `auditlogs`. | `packages/schema` | Low |
| **`apps/api/src/db/models/workspace-memory.model.ts`**| `CREATE` | 2 | Mongoose model for `workspacememories`. | `packages/schema` | Low |
| **`apps/api/src/db/models/page-crawl.model.ts`** | `CREATE` | 2 | Mongoose model for `pagecrawls`. | `packages/schema` | Low |
| **`apps/api/src/db/models/intelligence-source.model.ts`**| `CREATE` | 2 | Mongoose model for `intelligencesources`. | `packages/schema` | Low |
| **`apps/api/src/db/models/intelligence-evidence.model.ts`**|`CREATE`| 2 | Mongoose model for `intelligenceevidences`. | `packages/schema` | Low |
| **`apps/api/src/db/models/intelligence-claim.model.ts`** | `CREATE` | 2 | Mongoose model for `intelligenceclaims`. | `packages/schema` | Low |
| **`apps/api/src/db/models/intelligence-inference.model.ts`**|`CREATE`| 2 | Mongoose model for `intelligenceinferences`. | `packages/schema` | Low |
| **`apps/api/src/db/models/email-delivery.model.ts`** | `CREATE` | 2 | Mongoose model for `emaildeliveries`. | `packages/schema` | Low |
| **`apps/api/src/db/models/company.model.ts`** | `MODIFY` | 2 | Enforce `_id: String`, `{ _id: false }`. | `packages/schema` | Medium |
| **`apps/api/src/db/models/contact.model.ts`** | `MODIFY` | 2 | Enforce `_id: String`, `{ _id: false }`. | `packages/schema` | Medium |
| **`apps/api/src/db/models/campaign.model.ts`** | `MODIFY` | 2 | Enforce `_id: String`, `{ _id: false }`. | `packages/schema` | Medium |
| **`apps/api/src/db/models/sequence.model.ts`** | `MODIFY` | 2 | Enforce `_id: String`, `{ _id: false }`. | `packages/schema` | Medium |
| **`apps/api/src/db/models/email-template.model.ts`** | `MODIFY` | 2 | Enforce `_id: String`, add Drive attachment subdoc. | `packages/schema` | Medium |
| **`apps/api/src/repositories/base/base.repository.ts`** | `MODIFY` | 2 | Enforce `_id = payload.id`, prevent auto ObjectId. | Mongoose models | High |
| **`apps/api/src/repositories/job.repository.ts`** | `CREATE` | 3 | Atomic claimNextJob & progress checkpointing. | `job.model.ts` | Medium |
| **`apps/api/src/services/lock.service.ts`** | `CREATE` | 3 | Distributed lock findOneAndUpdate with lease. | `automation-lock.model` | High |
| **`apps/api/src/routes/jobs.ts`** | `CREATE` | 3 | REST endpoints for `/jobs` and `/checkpoint`. | `job.repository.ts` | Medium |
| **`apps/api/src/routes/intelligence.ts`** | `CREATE` | 3 | REST endpoints for intelligence models. | Mongoose models | Low |
| **`apps/api/src/routes/locks.ts`** | `CREATE` | 3 | REST endpoints for `/locks/acquire`, `/release`.| `lock.service.ts` | High |
| **`apps/api/src/routes/deliveries.ts`** | `CREATE` | 3 | Outbound email delivery ledger endpoint. | `email-delivery.model` | High |
| **`apps/api/src/routes/batch.ts`** | `CREATE` | 3 | High-throughput `POST /bulk` endpoints. | Repositories | High |
| **`packages/sdk/src/modules/jobs.ts`** | `CREATE` | 3 | SdkClient module for jobs & checkpoints. | API routes | Low |
| **`packages/sdk/src/modules/intelligence.ts`** | `CREATE` | 3 | SdkClient module for intelligence models. | API routes | Low |
| **`packages/sdk/src/modules/locks.ts`** | `CREATE` | 3 | SdkClient module for distributed locks. | API routes | Low |
| **`packages/sdk/src/modules/deliveries.ts`** | `CREATE` | 3 | SdkClient module for delivery ledger. | API routes | Low |
| **`packages/sdk/src/modules/companies.ts`** | `MODIFY` | 3 | Add `createBulk()` batch API method. | `batch.ts` route | Low |
| **`packages/sdk/src/modules/contacts.ts`** | `MODIFY` | 3 | Add `createBulk()` batch API method. | `batch.ts` route | Low |
| **`scripts/migrate-mongo-objectids-to-strings.ts`** | `CREATE` | 2.5 | Converts existing MongoDB ObjectId docs to string. | API Mongoose | High |
| **`scripts/migrate-sqlite-to-mongo.ts`** | `CREATE` | 4 | Reconciles & migrates SQLite records to Mongo. | SdkClient / DB | High |
| **`apps/desktop/src/main/ipc/crm.ts`** | `REWRITE`| 5 | Writes via SdkClient -> API; updates SQLite cache.| `packages/sdk` | High |
| **`apps/desktop/src/main/ipc/campaigns-ipc.ts`** | `REWRITE`| 5 | Writes via SdkClient -> API; updates SQLite cache.| `packages/sdk` | Medium |
| **`apps/desktop/src/main/ipc/audiences-ipc.ts`** | `REWRITE`| 5 | Writes via SdkClient -> API; updates SQLite cache.| `packages/sdk` | Medium |
| **`apps/desktop/src/main/ipc/automation.ts`** | `REWRITE`| 5 | Writes via SdkClient -> API; updates SQLite cache.| `packages/sdk` | Medium |
| **`apps/desktop/src/main/services/cache-hydrator.ts`** | `REWRITE`| 6 | Complete hydration of disposable SQLite cache. | `packages/sdk` | High |
| **`apps/desktop/src/main/database/initCacheSchema.ts`**| `CREATE` | 6 | Clean SQLite cache schema initializer. | `better-sqlite3` | Medium |
| **`apps/desktop/src/main/database/repositories/local-crm.ts`**|`REWRITE`| 6 | Cache-only projection save; removes sync_queue. | `initCacheSchema` | High |
| **`apps/desktop/src/main/workers/plugins/scraper.ts`** | `REWRITE`| 7 | Persists via `sdk.companies.createBulk()`. | `packages/sdk` | High |
| **`apps/desktop/src/main/workers/plugins/crawler.ts`** | `REWRITE`| 7 | Persists metadata via `sdk.pageCrawls.create()`.| `packages/sdk` | Medium |
| **`apps/desktop/src/main/workers/plugins/enricher.ts`**| `REWRITE`| 7 | Persists via `sdk.contacts.createBulk()`. | `packages/sdk` | Medium |
| **`apps/desktop/src/main/workers/plugins/outreach.ts`**| `REWRITE`| 7 | Records ledger via `sdk.emailDeliveries`. | `packages/sdk` | High |
| **`apps/desktop/src/main/workers/plugins/linkedin.ts`**| `REWRITE`| 7 | Persists via `sdk.contacts.update()`. | `packages/sdk` | Medium |
| **`apps/desktop/src/main/workers/plugins/intelligence-worker.ts`**|`REWRITE`| 7 | Persists via `sdk.companyIntelligence`. | `packages/sdk` | Medium |
| **`apps/desktop/src/main/workers/plugins/automation.ts`**|`REWRITE`| 8 | Uses distributed locks via `sdk.locks`. | `packages/sdk` | High |
| **`apps/desktop/src/main/services/scheduler.ts`** | `REWRITE`| 8 | Polls jobs & checkpoints via `sdk.jobs`. | `packages/sdk` | High |
| **`apps/api/src/services/google/auth.service.ts`** | `CREATE` | 9 | Shared Google OAuth token manager. | Google API | High |
| **`apps/api/src/services/google/drive.provider.ts`** | `CREATE` | 9 | Google Drive binary upload/download provider. | `auth.service.ts` | High |
| **`apps/api/src/services/email/providers/gmail-provider.ts`**|`MODIFY`| 10 | Decouple Drive; send raw RFC 2822 MIME. | `auth.service.ts` | Medium |
| **`apps/desktop/src/main/services/sync-engine.ts`** | `DELETE` | 11 | Obsolete local-first sync engine. | All write paths migrated | High |
| **`apps/desktop/src/main/database/runner.ts`** | `DELETE` | 12 | Obsolete 33-step SQLite migration runner. | `initCacheSchema` | High |
| **`apps/desktop/src/main/lib/workspace-runtime.ts`** | `MODIFY` | 11 | Unbinds SyncEngine; manages cache lifecycle. | `cache-hydrator` | Medium |
| **`tests/integration/identity-invariant.test.ts`** | `CREATE` | 13 | Test suite asserting `_id === id === cache.id`.| Test harness | Low |
| **`tests/integration/cache-destruction.test.ts`** | `CREATE` | 13 | Test suite asserting zero data loss on .db delete.| Test harness | Low |
| **`tests/integration/worker-persistence.test.ts`** | `CREATE` | 13 | Test suite asserting worker SdkClient writes. | Test harness | Low |
