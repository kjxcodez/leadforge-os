# Phase 1 Forensic Document 04 — API Route Reality & Endpoint Inventory

**Document Type:** Forensic Route Inventory  
**Audited Against:** `apps/api/src/routes/`  
**Date:** September 2026  
**Status:** Authoritative Baseline  

---

## 1. Complete API Route Matrix

| HTTP Method | Route Path | Sub-Router | Auth / Workspace Guard | Backing Repository / Service | Backing Mongoose Model | Primary Consumers |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | `healthRouter` | Public | Inline status check | None | Health checks / Monitoring |
| `ALL` | `/auth/*` | `authRouter` | Public / BetterAuth | Better Auth Engine | `User`, `Session`, `Account` | Electron Auth IPC, Web login |
| `POST` | `/beta-apply` | `apiRouter` | Public (Rate Limited) | Direct Model Create | `BetaApplicantModel` | Marketing landing page |
| `GET` | `/companies` | `companiesRouter` | `authMiddleware`, `workspaceMiddleware` | `CompanyRepository` | `CompanyModel` | Hydrator, SDK |
| `GET` | `/companies/:id` | `companiesRouter` | `authMiddleware`, `workspaceMiddleware` | `CompanyRepository` | `CompanyModel` | SDK, Workers |
| `POST` | `/companies` | `companiesRouter` | `authMiddleware`, `workspaceMiddleware` | `CompanyRepository` | `CompanyModel` | Desktop IPC, Scraper Worker |
| `POST` | `/companies/bulk` | `companiesRouter` | `authMiddleware`, `workspaceMiddleware` | `CompanyRepository` | `CompanyModel` | Desktop bulk import IPC |
| `PATCH` | `/companies/:id` | `companiesRouter` | `authMiddleware`, `workspaceMiddleware` | `CompanyRepository` | `CompanyModel` | Desktop IPC edit |
| `DELETE` | `/companies/:id` | `companiesRouter` | `authMiddleware`, `workspaceMiddleware` | `CompanyRepository` | `CompanyModel` | Desktop IPC delete |
| `GET` | `/contacts` | `contactsRouter` | `authMiddleware`, `workspaceMiddleware` | `ContactRepository` | `ContactModel` | Hydrator, Scraper Worker, Outreach |
| `GET` | `/contacts/:id` | `contactsRouter` | `authMiddleware`, `workspaceMiddleware` | `ContactRepository` | `ContactModel` | SDK, Workers |
| `POST` | `/contacts` | `contactsRouter` | `authMiddleware`, `workspaceMiddleware` | `ContactRepository` | `ContactModel` | Desktop IPC, Scraper Worker |
| `POST` | `/contacts/bulk` | `contactsRouter` | `authMiddleware`, `workspaceMiddleware` | `ContactRepository` | `ContactModel` | Desktop bulk import IPC |
| `PATCH` | `/contacts/:id` | `contactsRouter` | `authMiddleware`, `workspaceMiddleware` | `ContactRepository` | `ContactModel` | Desktop IPC edit |
| `DELETE` | `/contacts/:id` | `contactsRouter` | `authMiddleware`, `workspaceMiddleware` | `ContactRepository` | `ContactModel` | Desktop IPC delete |
| `GET` | `/campaigns` | `campaignsRouter` | `authMiddleware`, `workspaceMiddleware` | `CampaignRepository` | `CampaignModel` | Hydrator, SDK |
| `GET` | `/campaigns/:id` | `campaignsRouter` | `authMiddleware`, `workspaceMiddleware` | `CampaignRepository` | `CampaignModel` | Outreach Worker, SDK |
| `POST` | `/campaigns` | `campaignsRouter` | `authMiddleware`, `workspaceMiddleware` | `CampaignRepository` | `CampaignModel` | Desktop IPC create |
| `PATCH` | `/campaigns/:id` | `campaignsRouter` | `authMiddleware`, `workspaceMiddleware` | `CampaignRepository` | `CampaignModel` | Desktop IPC update |
| `DELETE` | `/campaigns/:id` | `campaignsRouter` | `authMiddleware`, `workspaceMiddleware` | `CampaignRepository` | `CampaignModel` | Desktop IPC delete |
| `GET` | `/workspaces` | `workspacesRouter` | `authMiddleware` | `WorkspaceRepository` | `WorkspaceModel` | Desktop workspace switcher |
| `GET` | `/workspaces/:id` | `workspacesRouter` | `authMiddleware` | `WorkspaceRepository` | `WorkspaceModel` | Desktop workspace loader |
| `POST` | `/workspaces` | `workspacesRouter` | `authMiddleware` | `WorkspaceRepository` | `WorkspaceModel` | Desktop create workspace |
| `PATCH` | `/workspaces/:id` | `workspacesRouter` | `authMiddleware`, `workspaceMiddleware` | `WorkspaceRepository` | `WorkspaceModel` | Desktop update settings |
| `GET` | `/discovery-runs` | `discoveryRunsRouter` | `authMiddleware`, `workspaceMiddleware` | `DiscoveryRunRepository` | `DiscoveryRunModel` | Hydrator, Discovery IPC |
| `GET` | `/discovery-runs/:id` | `discoveryRunsRouter` | `authMiddleware`, `workspaceMiddleware` | `DiscoveryRunRepository` | `DiscoveryRunModel` | Discovery IPC |
| `POST` | `/discovery-runs` | `discoveryRunsRouter` | `authMiddleware`, `workspaceMiddleware` | `DiscoveryRunRepository` | `DiscoveryRunModel` | Discovery IPC create |
| `PATCH` | `/discovery-runs/:id` | `discoveryRunsRouter` | `authMiddleware`, `workspaceMiddleware` | `DiscoveryRunRepository` | `DiscoveryRunModel` | Scraper Worker (status update) |
| `GET` | `/discovery-runs/:id/companies` | `discoveryRunsRouter` | `authMiddleware`, `workspaceMiddleware` | `CompanyDiscoveryRunRepo` | `CompanyModel` | Discovery IPC fallback |
| `GET` | `/company-discovery-runs` | `companyDiscoveryRunsRouter` | `authMiddleware`, `workspaceMiddleware` | `CompanyDiscoveryRunRepo` | `CompanyDiscoveryRunModel` | Hydrator, Discovery IPC |
| `POST` | `/company-discovery-runs` | `companyDiscoveryRunsRouter` | `authMiddleware`, `workspaceMiddleware` | `CompanyDiscoveryRunRepo` | `CompanyDiscoveryRunModel` | Scraper Worker (linking) |
| `GET` | `/audiences` | `audiencesRouter` | `authMiddleware`, `workspaceMiddleware` | `AudienceRepository` | `AudienceModel` | Hydrator, Audiences IPC |
| `POST` | `/audiences` | `audiencesRouter` | `authMiddleware`, `workspaceMiddleware` | `AudienceRepository` | `AudienceModel` | Audiences IPC create |
| `PATCH` | `/audiences/:id` | `audiencesRouter` | `authMiddleware`, `workspaceMiddleware` | `AudienceRepository` | `AudienceModel` | Audiences IPC update |
| `DELETE` | `/audiences/:id` | `audiencesRouter` | `authMiddleware`, `workspaceMiddleware` | `AudienceRepository` | `AudienceModel` | Audiences IPC delete |
| `GET` | `/jobs` | `jobsRouter` | `authMiddleware`, `workspaceMiddleware` | `JobRepository` | `JobModel` | Scheduler IPC, Diagnostics |
| `POST` | `/jobs/claim` | `jobsRouter` | `authMiddleware`, `workspaceMiddleware` | `JobRepository.claimJob()` | `JobModel` | **JobScheduler Polling (3s)** |
| `POST` | `/jobs/bulk` | `jobsRouter` | `authMiddleware`, `workspaceMiddleware` | `JobRepository.bulkInsert()` | `JobModel` | Bulk job queueing |
| `POST` | `/jobs` | `jobsRouter` | `authMiddleware`, `workspaceMiddleware` | `JobRepository.create()` | `JobModel` | Scraper, Crawler, Automation |
| `POST` | `/jobs/recover` | `jobsRouter` | `authMiddleware`, `workspaceMiddleware` | `JobRepository.recoverInterruptedJobs()` | `JobModel` | WorkspaceRuntime start |
| `GET` | `/jobs/:id` | `jobsRouter` | `authMiddleware`, `workspaceMiddleware` | `JobRepository.findById()` | `JobModel` | Worker Host |
| `POST` | `/jobs/:id/checkpoint` | `jobsRouter` | `authMiddleware`, `workspaceMiddleware` | `JobRepository.checkpoint()` | `JobModel` | Worker Host checkpoint |
| `POST` | `/jobs/:id/heartbeat` | `jobsRouter` | `authMiddleware`, `workspaceMiddleware` | `JobRepository.heartbeat()` | `JobModel` | Scheduler Heartbeat watchdog |
| `POST` | `/jobs/:id/status` | `jobsRouter` | `authMiddleware`, `workspaceMiddleware` | `JobRepository.transitionStatus()` | `JobModel` | Scheduler / Worker |
| `POST` | `/jobs/:id/complete` | `jobsRouter` | `authMiddleware`, `workspaceMiddleware` | `JobRepository.transitionStatus()` | `JobModel` | Scheduler job completion |
| `POST` | `/jobs/:id/fail` | `jobsRouter` | `authMiddleware`, `workspaceMiddleware` | `JobRepository.transitionStatus()` | `JobModel` | Scheduler job failure |
| `POST` | `/jobs/:id/cancel` | `jobsRouter` | `authMiddleware`, `workspaceMiddleware` | `JobRepository.transitionStatus()` | `JobModel` | Scheduler cancellation |
| `GET` | `/email/accounts` | `emailRouter` | `authMiddleware`, `workspaceMiddleware` | `EmailAccountService` | `EmailAccountModel` | Hydrator, Outreach IPC |
| `POST` | `/email/accounts/gmail/oauth/initiate` | `emailRouter` | `authMiddleware`, `workspaceMiddleware` | `EmailAccountService` | `OAuthTransactionModel` | Outreach IPC Gmail connect |
| `GET` | `/email/accounts/gmail/oauth/callback` | `emailRouter` | Public (OAuth redirect) | `EmailAccountService` | `GoogleConnectionModel`, `EmailAccountModel` | Google OAuth redirect in Chrome |
| `GET` | `/email/accounts/gmail/oauth/status/:txId` | `emailRouter` | `authMiddleware`, `workspaceMiddleware` | `EmailAccountService` | `OAuthTransactionModel` | Outreach IPC poll OAuth status |
| `POST` | `/email/accounts/:id/reconnect` | `emailRouter` | `authMiddleware`, `workspaceMiddleware` | `EmailAccountService` | `OAuthTransactionModel` | Outreach IPC reconnect |
| `DELETE` | `/email/accounts/:id` | `emailRouter` | `authMiddleware`, `workspaceMiddleware` | `EmailAccountService` | `EmailAccountModel` | Outreach IPC disconnect |
| `POST` | `/email/accounts/:id/test` | `emailRouter` | `authMiddleware`, `workspaceMiddleware` | `EmailService.send()` | `EmailAccountModel`, `EmailDeliveryModel` | Outreach IPC Send Test |
| `POST` | `/email/send` | `emailRouter` | `authMiddleware`, `workspaceMiddleware` | `EmailService.send()` | `EmailDeliveryModel` | Outreach Worker, Automation Worker |
| `GET` | `/email/templates` | `outreachRouter` | `authMiddleware`, `workspaceMiddleware` | `EmailTemplateRepository` | `EmailTemplateModel` | Hydrator, Outreach IPC |
| `POST` | `/email/templates` | `outreachRouter` | `authMiddleware`, `workspaceMiddleware` | `EmailTemplateRepository` | `EmailTemplateModel` | Outreach IPC create template |
| `PATCH` | `/email/templates/:id` | `outreachRouter` | `authMiddleware`, `workspaceMiddleware` | `EmailTemplateRepository` | `EmailTemplateModel` | Outreach IPC update template |
| `DELETE` | `/email/templates/:id` | `outreachRouter` | `authMiddleware`, `workspaceMiddleware` | `EmailTemplateRepository` | `EmailTemplateModel` | Outreach IPC delete template |
| `GET` | `/email/templates/:id/preview` | `outreachRouter` | `authMiddleware`, `workspaceMiddleware` | `OutreachService.previewTemplate()` | `EmailTemplateModel`, `ContactModel` | Outreach IPC template preview |
| `GET` | `/email-deliveries` | `deliveriesRouter` | `authMiddleware`, `workspaceMiddleware` | `EmailDeliveryRepository` | `EmailDeliveryModel` | Outreach IPC deliveries list |
| `GET` | `/email-deliveries/ambiguous` | `deliveriesRouter` | `authMiddleware`, `workspaceMiddleware` | `EmailDeliveryRepository` | `EmailDeliveryModel` | Diagnostic scripts |
| `GET` | `/email-deliveries/by-idempotency/:key` | `deliveriesRouter` | `authMiddleware`, `workspaceMiddleware` | `EmailDeliveryRepository` | `EmailDeliveryModel` | Send verification |
| `POST` | `/email-deliveries/reserve` | `deliveriesRouter` | `authMiddleware`, `workspaceMiddleware` | `EmailDeliveryRepository.reserveDelivery()` | `EmailDeliveryModel` | Pre-send ledger lock |
| `POST` | `/email-deliveries/bulk` | `deliveriesRouter` | `authMiddleware`, `workspaceMiddleware` | `EmailDeliveryRepository.bulkUpsert()` | `EmailDeliveryModel` | Batch delivery sync |
| `POST` | `/email-deliveries` | `deliveriesRouter` | `authMiddleware`, `workspaceMiddleware` | `EmailDeliveryRepository.create()` | `EmailDeliveryModel` | Direct delivery creation |
| `GET` | `/email-deliveries/:id` | `deliveriesRouter` | `authMiddleware`, `workspaceMiddleware` | `EmailDeliveryRepository.findById()` | `EmailDeliveryModel` | Delivery query |
| `POST` | `/email-deliveries/:id/finalize` | `deliveriesRouter` | `authMiddleware`, `workspaceMiddleware` | `EmailDeliveryRepository.finalizeDelivery()` | `EmailDeliveryModel` | Post-send ledger status update |
| `POST` | `/email-deliveries/reconcile` | `deliveriesRouter` | `authMiddleware`, `workspaceMiddleware` | `EmailDeliveryRepository.reconcileStaleDeliveries()` | `EmailDeliveryModel` | Ambiguous delivery reconciliation |
| `PATCH` | `/email-deliveries/:id/status` | `deliveriesRouter` | `authMiddleware`, `workspaceMiddleware` | `EmailDeliveryRepository.updateDeliveryStatus()` | `EmailDeliveryModel` | Delivery status update |
| `GET` | `/attachments` | `attachmentsRouter` | `authMiddleware`, `workspaceMiddleware` | `AttachmentService.list()` | `AttachmentModel` | Attachments IPC |
| `GET` | `/attachments/:id` | `attachmentsRouter` | `authMiddleware`, `workspaceMiddleware` | `AttachmentService.get()` | `AttachmentModel` | Attachments IPC |
| `POST` | `/attachments/upload` | `attachmentsRouter` | `authMiddleware`, `workspaceMiddleware` | `AttachmentService.upload()` | `AttachmentModel`, Google Drive API | Desktop IPC `attachments:save` |
| `GET` | `/attachments/:id/download` | `attachmentsRouter` | `authMiddleware`, `workspaceMiddleware` | `AttachmentService.download()` | `AttachmentModel`, Google Drive API | API attachment download |
| `DELETE` | `/attachments/:id` | `attachmentsRouter` | `authMiddleware`, `workspaceMiddleware` | `AttachmentService.delete()` | `AttachmentModel`, Google Drive API | Attachments IPC delete |
| `GET` | `/automation/sequences` | `automationRouter` | `authMiddleware`, `workspaceMiddleware` | `SequenceRepository` | `SequenceModel` | Hydrator, Automation IPC |
| `GET` | `/automation/sequences/:id` | `automationRouter` | `authMiddleware`, `workspaceMiddleware` | `SequenceRepository` | `SequenceModel` | Automation IPC |
| `POST` | `/automation/sequences` | `automationRouter` | `authMiddleware`, `workspaceMiddleware` | `SequenceRepository` | `SequenceModel` | Automation IPC create |
| `PATCH` | `/automation/sequences/:id` | `automationRouter` | `authMiddleware`, `workspaceMiddleware` | `SequenceRepository` | `SequenceModel` | Automation IPC update |
| `DELETE` | `/automation/sequences/:id` | `automationRouter` | `authMiddleware`, `workspaceMiddleware` | `SequenceRepository` | `SequenceModel` | Automation IPC delete |
| `GET` | `/automation/executions` | `automationRouter` | `authMiddleware`, `workspaceMiddleware` | `SequenceExecutionRepository` | `SequenceExecutionModel` | Hydrator, Campaigns IPC |
| `POST` | `/automation/executions/start` | `automationRouter` | `authMiddleware`, `workspaceMiddleware` | `AutomationService.start()` | `SequenceExecutionModel`, `JobModel` | Automation IPC start |
| `POST` | `/automation/executions/:id/pause` | `automationRouter` | `authMiddleware`, `workspaceMiddleware` | `AutomationService.pause()` | `SequenceExecutionModel` | Automation IPC pause |
| `POST` | `/automation/executions/:id/resume` | `automationRouter` | `authMiddleware`, `workspaceMiddleware` | `AutomationService.resume()` | `SequenceExecutionModel` | Automation IPC resume |
| `POST` | `/automation/executions/:id/cancel` | `automationRouter` | `authMiddleware`, `workspaceMiddleware` | `AutomationService.cancel()` | `SequenceExecutionModel` | Automation IPC cancel |
| `GET` | `/google-connections` | `googleConnectionsRouter` | `authMiddleware`, `workspaceMiddleware` | `GoogleConnectionModel` | `GoogleConnectionModel` | Attachments IPC connection resolver |
| `GET` | `/google-connections/oauth/initiate` | `googleConnectionsRouter` | `authMiddleware`, `workspaceMiddleware` | `GoogleAuthService` | `OAuthTransactionModel` | Outreach IPC |
| `GET` | `/google-connections/oauth/callback` | `googleConnectionsRouter` | Public (OAuth redirect) | `GoogleAuthService` | `GoogleConnectionModel` | Google OAuth callback in Chrome |
| `DELETE` | `/google-connections/:id` | `googleConnectionsRouter` | `authMiddleware`, `workspaceMiddleware` | `GoogleConnectionModel` | `GoogleConnectionModel` | Google connection disconnect |
| `POST` | `/intelligence/company/:id` | `intelligenceRouter` | `authMiddleware`, `workspaceMiddleware` | `IntelligenceService` | `CompanyIntelligenceModel`, etc. | Intelligence Worker |
| `GET` | `/intelligence/company/:id` | `intelligenceRouter` | `authMiddleware`, `workspaceMiddleware` | `IntelligenceService` | `CompanyIntelligenceModel`, etc. | CRM IPC fallback |
| `POST` | `/automation-locks/acquire` | `locksRouter` | `authMiddleware`, `workspaceMiddleware` | `AutomationLockModel` | `AutomationLockModel` | Automation trigger lock |
| `POST` | `/automation-locks/release` | `locksRouter` | `authMiddleware`, `workspaceMiddleware` | `AutomationLockModel` | `AutomationLockModel` | Automation trigger unlock |
| `GET` | `/workspace-memory` | `memoryRouter` | `authMiddleware`, `workspaceMiddleware` | `WorkspaceMemoryModel` | `WorkspaceMemoryModel` | AI agent context memory |
| `POST` | `/workspace-memory` | `memoryRouter` | `authMiddleware`, `workspaceMiddleware` | `WorkspaceMemoryModel` | `WorkspaceMemoryModel` | AI agent memory save |
| `GET` | `/audit-logs` | `auditRouter` | `authMiddleware`, `workspaceMiddleware` | `AuditLogModel` | `AuditLogModel` | Operations Center audit tab |
| `GET` | `/system-logs` | `systemLogsRouter` | `authMiddleware`, `workspaceMiddleware` | `SystemLogModel` | `SystemLogModel` | Operations Center system tab |

---

## 2. API Router Findings & Contract Issues

1. **`deliveriesRouter` Undefined Query Parameter Sensitivity:**  
   `GET /api/v1/email-deliveries` checks `if (campaignId) filter.campaignId = campaignId`. When the SDK passes `?campaignId=undefined`, Hono receives the string `"undefined"`, sets `filter.campaignId = "undefined"`, and MongoDB returns 0 matches.
2. **Missing UI Consumers for Direct Routes:**  
   Several intelligence endpoints (`/intelligence/*`) and audit endpoints (`/audit-logs/*`) are implemented in API but rarely or never called directly by the renderer because the renderer queries local SQLite tables (`company_intelligence`, etc.) populated via CacheHydrator.
