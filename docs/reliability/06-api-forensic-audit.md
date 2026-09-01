# API Forensic Audit

This document records the full inventory of Hono API routes, authentication models, workspace scoping enforcement, DTO schemas, underlying MongoDB collections, consumer patterns, and polling characteristics across **LeadForge OS**.

---

## API Route Matrix

| Route | HTTP Method | Auth Required | Workspace Scoped | Request DTO | Mongo Model / Collection | Polling / Consumer Pattern |
|---|---|---|---|---|---|---|
| `/api/v1/auth/login` | `POST` | No | No | `loginDtoSchema` | `UserModel` (`users`) | Auth flow |
| `/api/v1/auth/google/callback` | `POST` | No | No | `googleAuthDtoSchema` | `UserModel` (`users`) | OAuth flow |
| `/api/v1/workspaces` | `GET` | Yes | Global (User-scoped) | None | `WorkspaceModel` (`workspaces`) | App boot & workspace list |
| `/api/v1/workspaces` | `POST` | Yes | Global | `createWorkspaceDtoSchema` | `WorkspaceModel` (`workspaces`) | User workspace creation |
| `/api/v1/workspaces/:id` | `GET` | Yes | Workspace-scoped | None | `WorkspaceModel` (`workspaces`) | Workspace detail fetch |
| `/api/v1/workspaces/:id` | `PATCH`| Yes | Workspace-scoped | `updateWorkspaceDtoSchema` | `WorkspaceModel` (`workspaces`) | Settings updates |
| `/api/v1/companies` | `GET` | Yes | `x-workspace-id` | `queryCompanyDtoSchema` | `CompanyModel` (`companies`) | Cache hydration / search |
| `/api/v1/companies` | `POST` | Yes | `x-workspace-id` | `createCompanyDtoSchema` | `CompanyModel` (`companies`) | Scraper & CRM create |
| `/api/v1/companies/bulk` | `POST` | Yes | `x-workspace-id` | `bulkCompanyDtoSchema` | `CompanyModel` (`companies`) | Bulk import (Max 500) |
| `/api/v1/contacts` | `GET` | Yes | `x-workspace-id` | `queryContactDtoSchema` | `ContactModel` (`contacts`) | Cache hydration / CRM |
| `/api/v1/contacts` | `POST` | Yes | `x-workspace-id` | `createContactDtoSchema` | `ContactModel` (`contacts`) | Scraper & CRM create |
| `/api/v1/contacts/bulk` | `POST` | Yes | `x-workspace-id` | `bulkContactDtoSchema` | `ContactModel` (`contacts`) | Bulk import (Max 500) |
| `/api/v1/campaigns` | `GET` | Yes | `x-workspace-id` | `queryCampaignDtoSchema` | `CampaignModel` (`campaigns`) | Cache hydration / UI list |
| `/api/v1/campaigns` | `POST` | Yes | `x-workspace-id` | `createCampaignDtoSchema` | `CampaignModel` (`campaigns`) | Campaign creator |
| `/api/v1/campaigns/:id` | `PATCH`| Yes | `x-workspace-id` | `updateCampaignDtoSchema` | `CampaignModel` (`campaigns`) | Campaign status transitions |
| `/api/v1/sequences` | `GET` | Yes | `x-workspace-id` | None | `SequenceModel` (`sequences`) | Cache hydration / UI |
| `/api/v1/sequences` | `POST` | Yes | `x-workspace-id` | `createSequenceDtoSchema` | `SequenceModel` (`sequences`) | Sequence builder |
| `/api/v1/jobs` | `GET` | Yes | `x-workspace-id` | `queryJobDtoSchema` | `JobModel` (`jobs`) | UI monitor (5s refetch) |
| `/api/v1/jobs/claim` | `POST` | Yes | `x-workspace-id` | `claimJobDtoSchema` | `JobModel` (`jobs`) | Scheduler tick (2s tick) |
| `/api/v1/jobs/:id/heartbeat` | `POST` | Yes | `x-workspace-id` | `jobHeartbeatDtoSchema` | `JobModel` (`jobs`) | Active worker heartbeat (30s) |
| `/api/v1/jobs/:id/checkpoint` | `POST` | Yes | `x-workspace-id` | `jobCheckpointDtoSchema`| `JobModel` (`jobs`) | Worker progress checkpoint |
| `/api/v1/jobs/:id/status` | `POST` | Yes | `x-workspace-id` | `jobStatusTransitionDtoSchema`| `JobModel` (`jobs`) | Completion / Failure |
| `/api/v1/deliveries` | `GET` | Yes | `x-workspace-id` | None | `EmailDeliveryModel` (`email_deliveries`) | Dashboard / Ledger queries |
| `/api/v1/deliveries/reserve` | `POST` | Yes | `x-workspace-id` | `reserveEmailDeliveryDtoSchema`| `EmailDeliveryModel` (`email_deliveries`) | Pre-send reservation |
| `/api/v1/system-logs` | `GET` | Yes | `x-workspace-id` | None | `SystemLogModel` (`system_logs`) | Dashboard activity feed |
| `/api/v1/system-logs` | `POST` | Yes | `x-workspace-id` | `createSystemLogDtoSchema` | `SystemLogModel` (`system_logs`) | Worker & API logging |
| `/api/v1/google-connections` | `GET` | Yes | `x-workspace-id` | None | `GoogleConnectionModel` (`google_connections`) | Sender profile list |
| `/api/v1/locks/acquire` | `POST` | Yes | `x-workspace-id` | `acquireLockDtoSchema` | `AutomationLockModel` (`automation_locks`) | Distributed workflow lock |

---

## Multi-Tenant Workspace Isolation Guarantees
1. **Header Validation**: Every tenant-scoped request must provide `x-workspace-id`.
2. **Repository Scoping**: `BaseRepository` automatically applies `{ workspaceId }` filter on all queries, updates, and deletes.
3. **Cross-Tenant Mutation Prevention**: All update/claim endpoints enforce workspace ownership before applying state mutations.
