# LeadForge OS — API Persistence Audit

## 1. Overview & Endpoint Inventory

The API server (`apps/api`) is implemented using Hono framework (`@hono/zod-openapi`).
All business and workspace endpoints are mounted in [`apps/api/src/routes/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/index.ts#L21-L100):

```typescript
apiRouter.use('/companies/*', authMiddleware, workspaceMiddleware);
apiRouter.use('/contacts/*', authMiddleware, workspaceMiddleware);
apiRouter.use('/campaigns/*', authMiddleware, workspaceMiddleware);
apiRouter.use('/outreach/*', authMiddleware, workspaceMiddleware);
apiRouter.use('/workspaces/*', authMiddleware, workspaceMiddleware);
apiRouter.use('/automation/*', authMiddleware, workspaceMiddleware);
apiRouter.use('/discovery-runs/*', authMiddleware, workspaceMiddleware);
apiRouter.use('/company-discovery-runs/*', authMiddleware, workspaceMiddleware);
apiRouter.use('/audiences/*', authMiddleware, workspaceMiddleware);
apiRouter.use('/email/*', emailAuthMiddleware);
```

---

## 2. API Endpoint Forensic Analysis

| Endpoint Group | Path Prefix | Handled By | Middleware | Direct Mongo Model / Repo Used | Writes Mongo Directly? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Health** | `/` | [`routes/health`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/health) | None | Ping MongoDB | No |
| **Auth** | `/auth` | [`routes/auth`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/auth) | Rate limiter | `Better-Auth`, `UserModel` | Yes |
| **Beta Apply** | `/beta-apply` | [`routes/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/index.ts#L39) | Rate limiter (5/15m) | `BetaApplicantModel` | Yes |
| **Companies** | `/companies` | [`routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts) | Auth, Workspace | `CompanyRepository`, `CompanyModel` | Yes |
| **Contacts** | `/contacts` | [`routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts) | Auth, Workspace | `ContactRepository`, `ContactModel` | Yes |
| **Campaigns** | `/campaigns` | [`routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts) | Auth, Workspace | `CampaignRepository`, `CampaignModel` | Yes |
| **Outreach** | `/outreach` | [`routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts) | Auth, Workspace | `OutreachService`, `OutreachModel` | Yes |
| **Workspaces** | `/workspaces` | [`routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts) | Auth | `WorkspaceModel` | Yes |
| **Automation** | `/automation` | [`routes/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/automation.ts) | Auth, Workspace | `SequenceModel`, `SequenceExecutionModel` | Yes |
| **Email** | `/email` | [`routes/email`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/email) | Auth, Workspace | `EmailAccountModel`, `EmailTemplateModel` | Yes |
| **Discovery Runs**| `/discovery-runs` | [`routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts) | Auth, Workspace | `DiscoveryRunModel` | Yes |
| **Audiences** | `/audiences` | [`routes/business.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/business.ts) | Auth, Workspace | `AudienceModel` | Yes |

---

## 3. Transaction Support in API
Transactions are supported via MongoDB Sessions in [`apps/api/src/db/connection/transaction.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/db/connection/transaction.ts):
```typescript
export async function withTransaction<T>(
  fn: (session: ClientSession) => Promise<T>
): Promise<T> {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
```

---

## 4. Missing Endpoints Required for MongoDB-First Migration

The API currently lacks REST endpoints for the 15 operational/intelligence entities:
1. `GET /POST /PUT /jobs` (Scheduler queue state)
2. `POST /system-logs` (Telemetry logs)
3. `POST /GET /company-intelligence` (AI intelligence)
4. `POST /GET /website-intelligence`
5. `POST /GET /contact-intelligence`
6. `POST /GET /opportunity-scores`
7. `GET /POST /audit-logs`
8. `GET /POST /workspace-memory`
9. `POST /GET /page-crawls`
10. `POST /GET /intelligence-sources`
11. `POST /GET /intelligence-evidence`
12. `POST /GET /intelligence-claims`
13. `POST /GET /intelligence-inferences`
14. `POST /GET /email-deliveries`
15. `POST /lock /unlock` (Automation concurrency lock endpoint)
