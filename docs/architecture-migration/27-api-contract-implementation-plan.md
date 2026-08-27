# LeadForge OS — API Contract Implementation Plan

## 1. Persistence Boundary Architecture

In the target MongoDB-First architecture, the API server (`apps/api`, built with Hono and `@hono/zod-openapi`) is the **sole canonical persistence boundary**. 
No external actor (desktop UI, renderer, worker thread, or scheduled task) writes directly to MongoDB or uses local SQLite as authoritative storage.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API PERSISTENCE ARCHITECTURE                      │
└─────────────────────────────────────────────────────────────────────────────┘
  Electron Main / Worker Threads
               │
               ▼ (HTTPS with Bearer Token + X-Workspace-ID)
  Hono API Gateway (Vercel Serverless Function)
       │
       ├─► 1. Rate Limiting Middleware (IP / Token bucket)
       ├─► 2. Auth Middleware (Better-Auth Session Verification)
       ├─► 3. Workspace Middleware (Tenant Scoping & Membership Validation)
       ├─► 4. Zod OpenAPI Validation (Strict Contract & ID Verification)
       │
       ▼
  Domain Repositories (BaseRepository<T>)
       │
       ▼
  MongoDB Server (Atlas)
```

---

## 2. Serverless & Deployment Constraints (Vercel)

The API is deployed as serverless functions on Vercel. All endpoint designs adhere strictly to the following constraints:
1. **Stateless Execution:** No in-memory queues, global process state, or persistent background timer loops exist on the API server.
2. **Execution Timeout Budgets:** All endpoints must complete execution in `< 1,500ms` (well below Vercel's standard function timeout).
3. **Payload Size Budgets:** HTTP request bodies must not exceed `4.5MB`. Crawl payloads and batch requests are calibrated to stay comfortably under this threshold.
4. **Connection Pool Management:** Mongoose database connections are cached across serverless invocations using the established `cachedConnection` pattern in `apps/api/src/db/connection/mongoose.ts`.

---

## 3. Comprehensive Endpoint Specifications

### 3.1 Job System Endpoints (`/jobs`)

#### `POST /jobs` (Create Job)
* **Method:** `POST`
* **Path:** `/api/v1/jobs`
* **Auth:** Bearer Token (`authMiddleware`), Workspace Scoped (`workspaceMiddleware`).
* **Worker / Desktop Usage:** Dispatched by Desktop Scheduler, Campaign Engine, or Scraper Trigger.
* **Request Schema (Zod):**
  ```typescript
  export const createJobSchema = z.object({
    id: entityIdField.optional(), // If omitted, assigned via generateEntityId()
    type: z.string().min(1),
    priority: z.number().int().min(1).max(10).default(1),
    payload: z.record(z.any()).default({}),
    maxRetries: z.number().int().min(0).max(10).default(3),
    scheduledAt: z.string().datetime().optional().nullable(),
    idempotencyKey: z.string().max(128).optional().nullable()
  });
  ```
* **Response Schema:** HTTP 201 `{ success: true, data: JobDto }`
* **Idempotency Semantics:** If `idempotencyKey` matches an existing job in the workspace, the API returns the existing job without creating a duplicate.
* **Cache Interaction:** Main process caches job in local SQLite `jobs` projection upon receipt.

#### `GET /jobs` (List / Poll Jobs)
* **Method:** `GET`
* **Path:** `/api/v1/jobs`
* **Query Parameters:** `status` (string/array), `type` (string), `limit` (default 50), `cursor` (pagination).
* **Usage:** Polled by Desktop `JobScheduler` to claim pending/queued workloads.
* **Response Schema:** HTTP 200 `{ success: true, data: JobDto[], nextCursor: string | null }`

#### `PUT /jobs/:id/checkpoint` (Save Worker Progress)
* **Method:** `PUT`
* **Path:** `/api/v1/jobs/:id/checkpoint`
* **Auth:** Bearer Token, Workspace Scoped.
* **Worker Usage:** High-frequency checkpoint call emitted by worker threads (`ctx.saveCheckpoint()`).
* **Request Schema:**
  ```typescript
  export const jobCheckpointSchema = z.object({
    progress: z.number().min(0).max(100),
    checkpointData: z.record(z.any()),
    workerId: z.string().min(1)
  });
  ```
* **Semantics:** Atomic single-document update (`$set: { progress, checkpointData, checkpointAt: new Date() }`).
* **Response:** HTTP 200 `{ success: true, data: { id, progress, checkpointAt } }`

#### `PUT /jobs/:id/status` (Transition Job Status)
* **Method:** `PUT`
* **Path:** `/api/v1/jobs/:id/status`
* **Request Schema:**
  ```typescript
  export const jobStatusTransitionSchema = z.object({
    status: z.enum(['running', 'completed', 'failed', 'cancelled', 'paused', 'retrying']),
    workerId: z.string().optional(),
    error: z.string().optional().nullable(),
    durationMs: z.number().int().optional()
  });
  ```

---

### 3.2 Lead Intelligence Endpoints

#### `POST /company-intelligence` (Upsert Company Intelligence)
* **Method:** `POST`
* **Path:** `/api/v1/company-intelligence`
* **Usage:** Persisted by `intelligence-worker.ts` upon completing enrichment.
* **Request Schema:**
  ```typescript
  export const upsertCompanyIntelligenceSchema = z.object({
    id: entityIdField.optional(),
    companyId: entityIdField,
    summary: z.string().nullable().optional(),
    openingLine: z.string().nullable().optional(),
    techStack: z.array(z.string()).default([]),
    businessModel: z.string().nullable().optional(),
    estimatedRevenue: z.string().nullable().optional(),
    growthSignals: z.array(z.string()).default([]),
    hiringSignals: z.array(z.string()).default([]),
    decisionMakerLikelihood: z.number().min(0).max(1).nullable().optional(),
    leadConfidence: z.enum(['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']).nullable().optional(),
    missingInformation: z.array(z.string()).default([])
  });
  ```
* **Update Semantics:** Upserts document matching `{ workspaceId, companyId }`.
* **Response:** HTTP 200/201 `{ success: true, data: CompanyIntelligenceDto }`

#### `GET /company-intelligence/:companyId`
* **Method:** `GET`
* **Path:** `/api/v1/company-intelligence/:companyId`
* **Response:** HTTP 200 `{ success: true, data: CompanyIntelligenceDto }` or 404.

---

### 3.3 Outbound Email Deliveries Ledger (`/email-deliveries`)

#### `POST /email-deliveries` (Record Delivery Attempt)
* **Method:** `POST`
* **Path:** `/api/v1/email-deliveries`
* **Usage:** Invoked by Outreach Worker before & after sending an email to ensure strict idempotency and audit trail.
* **Request Schema:**
  ```typescript
  export const createEmailDeliverySchema = z.object({
    id: entityIdField.optional(),
    campaignId: entityIdField.nullable().optional(),
    sequenceId: entityIdField,
    executionId: entityIdField,
    stepIndex: z.number().int().min(0),
    contactId: entityIdField,
    companyId: entityIdField.nullable().optional(),
    accountId: entityIdField,
    senderEmail: z.string().email(),
    recipientEmail: z.string().email(),
    subject: z.string().min(1),
    status: z.enum(['QUEUED', 'SENDING', 'SENT', 'FAILED', 'RETRYING', 'CANCELLED', 'SUPPRESSED']),
    idempotencyKey: z.string().min(1).max(128)
  });
  ```
* **Duplicate Prevention:** If `idempotencyKey` already exists, MongoDB throws a code 11000 conflict error. The API intercepts this and returns HTTP 409 Conflict with the existing delivery record, preventing duplicate email dispatches.

#### `PUT /email-deliveries/:id` (Update Delivery Status)
* **Method:** `PUT`
* **Path:** `/api/v1/email-deliveries/:id`
* **Request Schema:**
  ```typescript
  export const updateEmailDeliverySchema = z.object({
    status: z.enum(['SENT', 'FAILED', 'CANCELLED']),
    providerMessageId: z.string().optional().nullable(),
    error: z.string().optional().nullable(),
    sentAt: z.string().datetime().optional()
  });
  ```

---

### 3.4 Concurrency Locking Endpoints (`/locks`)

#### `POST /locks/acquire` (Atomic Distributed Lock)
* **Method:** `POST`
* **Path:** `/api/v1/locks/acquire`
* **Usage:** Replaces local `automation_locks` SQLite table. Used by automation execution worker to guard contact enrollments.
* **Request Schema:**
  ```typescript
  export const acquireLockSchema = z.object({
    sequenceId: entityIdField,
    entityId: entityIdField,
    ownerId: z.string().min(1),
    leaseDurationMs: z.number().int().min(1000).max(300000).default(60000)
  });
  ```
* **Atomic MongoDB Semantics:**
  ```typescript
  const now = new Date();
  const expiresAt = new Date(now.getTime() + leaseDurationMs);
  const lockKey = `${workspaceId}:${sequenceId}:${entityId}`;

  const lock = await AutomationLockModel.findOneAndUpdate(
    {
      _id: lockKey,
      $or: [
        { expiresAt: { $lt: now } }, // Lock expired
        { ownerId: ownerId }        // Same owner re-acquiring
      ]
    },
    {
      $set: {
        workspaceId,
        sequenceId,
        entityId,
        ownerId,
        lockedAt: now,
        expiresAt
      }
    },
    { upsert: true, new: true }
  );
  ```
* **Response:** HTTP 200 `{ success: true, acquired: true, expiresAt }` or HTTP 423 Locked `{ success: false, acquired: false, message: 'Resource locked' }`.

#### `POST /locks/release`
* **Method:** `POST`
* **Path:** `/api/v1/locks/release`
* **Request Schema:**
  ```typescript
  export const releaseLockSchema = z.object({
    sequenceId: entityIdField,
    entityId: entityIdField,
    ownerId: z.string().min(1)
  });
  ```
* **Semantics:** `deleteOne({ _id: lockKey, ownerId })`.

---

### 3.5 System Logs & Telemetry (`/system-logs`)

#### `POST /system-logs`
* **Method:** `POST`
* **Path:** `/api/v1/system-logs`
* **Request Schema:**
  ```typescript
  export const createSystemLogSchema = z.object({
    id: entityIdField.optional(),
    workerId: z.string().optional().nullable(),
    severity: z.enum(['debug', 'info', 'warn', 'error', 'fatal']),
    task: z.string().min(1),
    message: z.string().min(1),
    durationMs: z.number().int().optional().nullable(),
    metadata: z.record(z.any()).optional().nullable()
  });
  ```

---

### 3.6 Agent Memory & Audit Logs

#### `POST /workspace-memory`
* **Path:** `/api/v1/workspace-memory`
* **Request Schema:** `{ scope: string, key: string, value: any }`
* **Semantics:** Upsert on `{ workspaceId, scope, key }`.

#### `POST /audit-logs`
* **Path:** `/api/v1/audit-logs`
* **Semantics:** Append-only immutable document creation.

---

## 4. API Error Handling & Status Codes

All endpoints standardize error handling via `apps/api/src/errors/index.ts`:

| HTTP Status | Error Type | Trigger Scenario |
| :--- | :--- | :--- |
| **400 Bad Request** | `ValidationError` | Zod schema validation failure (missing required fields, bad types). |
| **401 Unauthorized** | `AuthenticationError`| Missing or invalid bearer session token. |
| **403 Forbidden** | `ForbiddenError` | User is not an active member of the requested `workspaceId`. |
| **404 Not Found** | `NotFoundError` | Entity does not exist within the scoped workspace. |
| **409 Conflict** | `ConflictError` | Unique constraint violation (e.g. duplicate idempotencyKey, unique domain). |
| **423 Locked** | `LockConflictError` | Distributed lock acquisition failed (resource held by another worker). |
| **500 Internal Error**| `DatabaseError` | Transient MongoDB Atlas network failure or unhandled exception. |
