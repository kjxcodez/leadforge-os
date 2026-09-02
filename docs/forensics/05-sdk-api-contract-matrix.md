# Phase 1 Forensic Document 05 — SDK vs API Contract Matrix

**Document Type:** Forensic Contract Matrix  
**Audited Against:** `packages/sdk/src/modules/` vs `apps/api/src/routes/`  
**Date:** September 2026  
**Status:** Authoritative Baseline  

---

## 1. SDK-to-API Contract Verification Matrix

| SDK Module | SDK Method | HTTP Method | Target API Path | Target Router | Status / Finding |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`activities`** | `list(filters)` | `GET` | `/activities` | **NONE** | ❌ **DEAD / BROKEN**: API has no `/activities` route mounted. Returns 404. |
| **`attachments`** | `list()` | `GET` | `/attachments` | `attachmentsRouter` | ✅ Matches |
| **`attachments`** | `get(id)` | `GET` | `/attachments/:id` | `attachmentsRouter` | ✅ Matches |
| **`attachments`** | `upload(dto)` | `POST` | `/attachments/upload` | `attachmentsRouter` | ✅ Matches |
| **`attachments`** | `download(id)` | `GET` | `/attachments/:id/download` | `attachmentsRouter` | ✅ Matches |
| **`attachments`** | `delete(id)` | `DELETE` | `/attachments/:id` | `attachmentsRouter` | ✅ Matches |
| **`audiences`** | `list()` | `GET` | `/audiences` | `audiencesRouter` | ✅ Matches |
| **`audiences`** | `get(id)` | `GET` | `/audiences/:id` | `audiencesRouter` | ✅ Matches |
| **`audiences`** | `create(dto)` | `POST` | `/audiences` | `audiencesRouter` | ✅ Matches |
| **`audiences`** | `update(id, dto)` | `PATCH` | `/audiences/:id` | `audiencesRouter` | ✅ Matches |
| **`audiences`** | `delete(id)` | `DELETE` | `/audiences/:id` | `audiencesRouter` | ✅ Matches |
| **`auditLogs`** | `list(filters)` | `GET` | `/audit-logs` | `auditRouter` | ✅ Matches |
| **`auth`** | `signIn(dto)` | `POST` | `/auth/sign-in` | `authRouter` | ✅ Matches |
| **`auth`** | `signUp(dto)` | `POST` | `/auth/sign-up` | `authRouter` | ✅ Matches |
| **`auth`** | `getSession()` | `GET` | `/auth/get-session` | `authRouter` | ✅ Matches |
| **`automation`** | `listSequences()` | `GET` | `/automation/sequences` | `automationRouter` | ✅ Matches |
| **`automation`** | `getSequence(id)` | `GET` | `/automation/sequences/:id` | `automationRouter` | ✅ Matches |
| **`automation`** | `createSequence(dto)` | `POST` | `/automation/sequences` | `automationRouter` | ✅ Matches |
| **`automation`** | `updateSequence(id, dto)` | `PATCH` | `/automation/sequences/:id` | `automationRouter` | ✅ Matches |
| **`automation`** | `deleteSequence(id)` | `DELETE` | `/automation/sequences/:id` | `automationRouter` | ✅ Matches |
| **`automation`** | `listExecutions()` | `GET` | `/automation/executions` | `automationRouter` | ✅ Matches |
| **`automation`** | `startExecution(dto)` | `POST` | `/automation/executions/start` | `automationRouter` | ✅ Matches |
| **`campaigns`** | `list()` | `GET` | `/campaigns` | `campaignsRouter` | ✅ Matches |
| **`campaigns`** | `get(id)` | `GET` | `/campaigns/:id` | `campaignsRouter` | ✅ Matches |
| **`campaigns`** | `create(dto)` | `POST` | `/campaigns` | `campaignsRouter` | ⚠️ **Casing Sensitivity**: API validates uppercase status (`DRAFT`, `ACTIVE`, `PAUSED`, `COMPLETED`). |
| **`campaigns`** | `update(id, dto)` | `PATCH` | `/campaigns/:id` | `campaignsRouter` | ⚠️ **Casing Sensitivity**: API validates uppercase status. |
| **`campaigns`** | `delete(id)` | `DELETE` | `/campaigns/:id` | `campaignsRouter` | ✅ Matches |
| **`companies`** | `list(filters)` | `GET` | `/companies` | `companiesRouter` | ✅ Matches |
| **`companies`** | `get(id)` | `GET` | `/companies/:id` | `companiesRouter` | ✅ Matches |
| **`companies`** | `create(dto)` | `POST` | `/companies` | `companiesRouter` | ✅ Matches |
| **`companies`** | `createBulk(dto)` | `POST` | `/companies/bulk` | `companiesRouter` | ✅ Matches |
| **`companies`** | `update(id, dto)` | `PATCH` | `/companies/:id` | `companiesRouter` | ✅ Matches |
| **`companies`** | `delete(id)` | `DELETE` | `/companies/:id` | `companiesRouter` | ✅ Matches |
| **`companyDiscoveryRuns`** | `list()` | `GET` | `/company-discovery-runs` | `companyDiscoveryRunsRouter` | ✅ Matches |
| **`companyDiscoveryRuns`** | `create(dto)` | `POST` | `/company-discovery-runs` | `companyDiscoveryRunsRouter` | ✅ Matches |
| **`contacts`** | `list(filters)` | `GET` | `/contacts` | `contactsRouter` | ✅ Matches |
| **`contacts`** | `get(id)` | `GET` | `/contacts/:id` | `contactsRouter` | ✅ Matches |
| **`contacts`** | `create(dto)` | `POST` | `/contacts` | `contactsRouter` | ✅ Matches |
| **`contacts`** | `createBulk(dto)` | `POST` | `/contacts/bulk` | `contactsRouter` | ✅ Matches |
| **`contacts`** | `update(id, dto)` | `PATCH` | `/contacts/:id` | `contactsRouter` | ✅ Matches |
| **`contacts`** | `delete(id)` | `DELETE` | `/contacts/:id` | `contactsRouter` | ✅ Matches |
| **`discovery`** | `listRuns()` | `GET` | `/discovery-runs` | `discoveryRunsRouter` | ✅ Matches |
| **`discovery`** | `getRun(id)` | `GET` | `/discovery-runs/:id` | `discoveryRunsRouter` | ✅ Matches |
| **`discovery`** | `createRun(dto)` | `POST` | `/discovery-runs` | `discoveryRunsRouter` | ✅ Matches |
| **`discovery`** | `updateRun(id, dto)` | `PATCH` | `/discovery-runs/:id` | `discoveryRunsRouter` | ✅ Matches |
| **`discovery`** | `listCompaniesForRun(id)` | `GET` | `/discovery-runs/:id/companies` | `discoveryRunsRouter` | ✅ Matches |
| **`emailDeliveries`** | `list(params)` | `GET` | `/email-deliveries` | `deliveriesRouter` | ❌ **DEFECT**: `new URLSearchParams(params)` converts `undefined` to string `"undefined"`. |
| **`emailDeliveries`** | `reserve(dto)` | `POST` | `/email-deliveries/reserve` | `deliveriesRouter` | ✅ Matches |
| **`emailDeliveries`** | `finalize(id, dto)` | `POST` | `/email-deliveries/:id/finalize` | `deliveriesRouter` | ✅ Matches |
| **`emailDeliveries`** | `reconcile(options)` | `POST` | `/email-deliveries/reconcile` | `deliveriesRouter` | ✅ Matches |
| **`googleConnections`** | `list()` | `GET` | `/google-connections` | `googleConnectionsRouter` | ✅ Matches |
| **`jobs`** | `claim(types, workerId)` | `POST` | `/jobs/claim` | `jobsRouter` | ✅ Matches |
| **`jobs`** | `create(dto)` | `POST` | `/jobs` | `jobsRouter` | ✅ Matches |
| **`jobs`** | `recover(threshold)` | `POST` | `/jobs/recover` | `jobsRouter` | ✅ Matches |
| **`jobs`** | `checkpoint(id, dto)` | `POST` | `/jobs/:id/checkpoint` | `jobsRouter` | ✅ Matches |
| **`jobs`** | `heartbeat(id, workerId)` | `POST` | `/jobs/:id/heartbeat` | `jobsRouter` | ✅ Matches |
| **`jobs`** | `updateStatus(id, dto)` | `POST` | `/jobs/:id/status` | `jobsRouter` | ✅ Matches |
| **`jobs`** | `complete(id, workerId)` | `POST` | `/jobs/:id/complete` | `jobsRouter` | ✅ Matches |
| **`jobs`** | `fail(id, error, workerId)` | `POST` | `/jobs/:id/fail` | `jobsRouter` | ✅ Matches |
| **`jobs`** | `cancel(id)` | `POST` | `/jobs/:id/cancel` | `jobsRouter` | ✅ Matches |
| **`outreach`** | `listAccounts()` | `GET` | `/email/accounts` | `emailRouter` | ✅ Matches |
| **`outreach`** | `connectGmail()` | `POST` | `/email/accounts/gmail/oauth/initiate` | `emailRouter` | ✅ Matches |
| **`outreach`** | `getOAuthStatus(txId)` | `GET` | `/email/accounts/gmail/oauth/status/:txId` | `emailRouter` | ✅ Matches |
| **`outreach`** | `reconnectGmail(id)` | `POST` | `/email/accounts/:id/reconnect` | `emailRouter` | ✅ Matches |
| **`outreach`** | `disconnectAccount(id)` | `DELETE` | `/email/accounts/:id` | `emailRouter` | ✅ Matches |
| **`outreach`** | `sendEmail(dto)` | `POST` | `/email/send` | `emailRouter` | ✅ Matches |
| **`outreach`** | `sendTestEmail(id, dto)` | `POST` | `/email/accounts/:id/test` | `emailRouter` | ✅ Matches |
| **`outreach`** | `listTemplates()` | `GET` | `/email/templates` | `outreachRouter` | ✅ Matches |
| **`outreach`** | `createTemplate(dto)` | `POST` | `/email/templates` | `outreachRouter` | ✅ Matches |
| **`outreach`** | `updateTemplate(id, dto)` | `PATCH` | `/email/templates/:id` | `outreachRouter` | ✅ Matches |
| **`outreach`** | `deleteTemplate(id)` | `DELETE` | `/email/templates/:id` | `outreachRouter` | ✅ Matches |
| **`outreach`** | `previewTemplate(id, cid)` | `GET` | `/email/templates/:id/preview` | `outreachRouter` | ✅ Matches |
| **`workspaces`** | `list()` | `GET` | `/workspaces` | `workspacesRouter` | ✅ Matches |
| **`workspaces`** | `get(id)` | `GET` | `/workspaces/:id` | `workspacesRouter` | ✅ Matches |
| **`workspaces`** | `create(dto)` | `POST` | `/workspaces` | `workspacesRouter` | ✅ Matches |
| **`workspaces`** | `update(id, dto)` | `PATCH` | `/workspaces/:id` | `workspacesRouter` | ✅ Matches |

---

## 2. Key Findings

1. **Dead SDK Module (`ActivitiesModule`):**  
   `sdk.activities.list()` targets `GET /api/v1/activities`. There is no router mounted for `/activities` in the API server (`apps/api/src/routes/index.ts`). Calling this method returns a 404 HTTP response.
2. **`URLSearchParams` Serialized String Undefined Defect:**  
   In `packages/sdk/src/modules/email-deliveries.ts:22`, passing an object `{ campaignId: undefined, sequenceId: undefined, status: undefined }` creates `?campaignId=undefined&sequenceId=undefined&status=undefined`. In `apps/api/src/routes/deliveries.ts:25-28`, Hono parses these as non-empty literal strings `"undefined"`, resulting in MongoDB queries for `{ campaignId: "undefined" }` which returns zero records.
