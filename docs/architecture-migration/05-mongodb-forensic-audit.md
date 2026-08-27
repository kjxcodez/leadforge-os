# LeadForge OS — MongoDB Forensic Audit

## 1. Mongoose Connection & Infrastructure
* **Connection Provider:** [`apps/api/src/db/connection/mongoose.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/db/connection/mongoose.ts#L1-L35).
* **URI Environment Variable:** `MONGODB_URI` (defaults to `mongodb://localhost:27017/leadforge`).
* **Plugins Attached:**
  * **`workspacePlugin`** ([`plugins/workspace.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/db/plugins/workspace.ts)): Automatically attaches `workspaceId: { type: String, required: true, index: true }`.
  * **`softDeletePlugin`** ([`plugins/soft-delete.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/db/plugins/soft-delete.ts)): Adds `isDeleted: Boolean` and `deletedAt: Date` with soft deletion methods.
  * **`auditPlugin`** ([`plugins/audit.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/db/plugins/audit.ts)): Tracks `createdBy` and `updatedBy`.
  * **`timestampPlugin`** ([`plugins/timestamp.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/db/plugins/timestamp.ts)): Manages `createdAt` and `updatedAt`.

---

## 2. Complete Inventory of Existing MongoDB Collections & Models

There are currently **18 Mongoose models** defined in [`apps/api/src/db/models/`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/db/models):

| Collection Name | Model Name | Entity Purpose | Primary Key Type | Unique Indexes / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `users` | `UserModel` | User accounts, auth role, active workspace | String / ObjectId `_id` | `email` (unique) |
| `workspaces` | `WorkspaceModel` | Tenant workspace container & settings | String / ObjectId `_id` | `slug` (unique) |
| `companies` | `CompanyModel` | Target organization/account record | String / ObjectId `_id` | `{ workspaceId: 1, domain: 1 }` |
| `contacts` | `ContactModel` | Prospect/lead contact record | String / ObjectId `_id` | `{ workspaceId: 1, email: 1 }` |
| `campaigns` | `CampaignModel` | Outreach campaign campaign definition | String / ObjectId `_id` | `{ workspaceId: 1, name: 1 }` |
| `outreaches` | `OutreachModel` | Multi-channel communication events | String / ObjectId `_id` | `{ workspaceId: 1, contactId: 1 }` |
| `emailaccounts` | `EmailAccountModel` | SMTP/IMAP/Gmail OAuth credentials | String / ObjectId `_id` | `{ workspaceId: 1, email: 1 }` |
| `emailtemplates` | `EmailTemplateModel` | Reusable email message templates | String / ObjectId `_id` | Workspace scoped |
| `sequences` | `SequenceModel` | Automation workflow DAG definition | String / ObjectId `_id` | `{ workspaceId: 1, name: 1 }` |
| `sequenceexecutions` | `SequenceExecutionModel` | Workflow run state / contact enrollment | String / ObjectId `_id` | `{ sequenceId: 1, contactId: 1 }` |
| `sequencelogs` | `SequenceLogModel` | Execution step log entries | String / ObjectId `_id` | `{ executionId: 1, timestamp: -1 }` |
| `discoveryruns` | `DiscoveryRunModel` | Lead discovery run specification | String / ObjectId `_id` | Workspace scoped |
| `companydiscoveryruns`|`CompanyDiscoveryRunModel`| Company-to-DiscoveryRun bridge | String / ObjectId `_id` | `{ companyId: 1, discoveryRunId: 1 }` |
| `audiences` | `AudienceModel` | Dynamic & static lead segmentation lists| String / ObjectId `_id` | `{ workspaceId: 1, name: 1 }` |
| `betaapplicants` | `BetaApplicantModel` | Public desktop app beta registrations | String / ObjectId `_id` | `email` (unique) |
| `oauthtransactions`|`OAuthTransactionModel` | OAuth state challenge tokens | String / ObjectId `_id` | `state` (unique) |
| `usertestrecipients`|`UserTestRecipientModel`| Test recipients for outreach emails | String / ObjectId `_id` | `{ workspaceId: 1, email: 1 }` |

---

## 3. Forensic Analysis of Missing MongoDB Collections

The following **15 entities** exist in SQLite but have NO corresponding Mongoose schema in MongoDB today:

1. `jobs` (Scheduler queue & worker job checkpoints)
2. `system_logs` (Worker & task execution telemetry)
3. `automation_locks` (Concurrency locks)
4. `company_intelligence` (AI summary & technical signals)
5. `website_intelligence` (Website crawl analysis)
6. `contact_intelligence` (Decision maker score)
7. `opportunity_scores` (Scoring matrix)
8. `audit_logs` (Workspace audit trail)
9. `workspace_memory` (Agent memory storage)
10. `page_crawls` (HTML crawl archive metadata)
11. `intelligence_sources` (Provenance URLs and hashes)
12. `intelligence_evidence` (Extracted evidence excerpts)
13. `intelligence_claims` (Verified claims)
14. `intelligence_inferences` (Rule inferences)
15. `email_deliveries` (Outbound delivery ledger & idempotency keys)

---

## 4. BaseRepository ID Handling in MongoDB

In [`apps/api/src/repositories/base/base.repository.ts:91-93`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/repositories/base/base.repository.ts#L91-L93):
```typescript
if (payload.id && !payload._id) {
  payload._id = payload.id;
}
```
* If `id` (e.g. string UUID from desktop) is passed, `BaseRepository` assigns `_id = payload.id`.
* If no `id` is passed, Mongoose automatically generates a default hex 24-character `ObjectId`.
* In MongoDB-first architecture, `_id` MUST be returned to callers as the single entity ID.
