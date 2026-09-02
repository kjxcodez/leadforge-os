# LeadForge OS — MongoDB Schema Implementation Plan

## 1. Executive Summary & Design Principles

This plan specifies the full document structures, types, indexes, and Mongoose schemas for the **15 new collections** required to establish MongoDB as the sole authoritative persistence layer, as well as the schema adjustments required across the **existing 18 collections**.

### Key Architectural Tenets:
1. **String-Only Primary Keys:** Every schema explicitly defines `_id: { type: String, required: true }` with `{ _id: false }` to prevent Mongoose auto-generating `ObjectId`.
2. **Strict Multi-Tenant Isolation:** Every tenant collection attaches `workspacePlugin` enforcing `{ workspaceId: 1, ... }` compound indexes.
3. **MongoDB Free-Tier Optimization:**
   - TTL indexes are applied to operational logs (`systemlogs`) and ephemeral locks (`automationlocks`) to prevent unbounded disk growth on Atlas M0 (512MB limit).
   - Large raw payloads (such as HTML crawl trees in `pagecrawls`) store metadata and compressed/truncated text signals rather than bloated multi-megabyte DOM dumps.
4. **Native Document Modeling:**
   - Replaces flat relational constructs with nested subdocuments where reads/writes naturally co-occur (e.g. `checkpointData` in `jobs`, `evidenceIds` arrays in `intelligenceclaims`, `steps` and `variables` in `sequences`).

---

## 2. Detailed Specifications for 15 New Mongoose Models

### 2.1 `JobModel` (`jobs`)
* **File:** `apps/api/src/db/models/job.model.ts`
* **Purpose:** Authoritative distributed task queue, worker assignment, and execution checkpoint store.
* **Write Pattern:** Inserted by scheduler/user, updated frequently by worker threads during checkpointing (every 5-10s).
* **Query Pattern:** Polled by Scheduler `findMany({ workspaceId, status: { $in: ['queued', 'retrying'] } }).sort({ priority: -1, createdAt: 1 })`.
* **Document Schema:**
  ```typescript
  export interface JobDocument extends mongoose.Document, WorkspaceScopedDocument, TimestampDocument {
    _id: string; // UUID v4
    workspaceId: string;
    type: string; // 'scraper:maps' | 'crawler:website' | 'enrich:website' | 'outreach:campaign' | etc.
    status: 'pending' | 'queued' | 'starting' | 'running' | 'waiting' | 'retrying' | 'paused' | 'cancelled' | 'completed' | 'failed' | 'interrupted';
    priority: number; // default 1 (higher executes first)
    payload: Record<string, any>; // JSON structured job parameters
    progress: number; // 0 to 100
    retryCount: number; // default 0
    maxRetries: number; // default 3
    workerId: string | null; // Worker host / process PID identifier
    error: string | null;
    startedAt: Date | null;
    finishedAt: Date | null;
    scheduledAt: Date | null;
    checkpointData: Record<string, any> | null; // Resume state
    checkpointAt: Date | null;
    idempotencyKey: string | null;
    durationMs: number | null;
    createdAt: Date;
    updatedAt: Date;
  }
  ```
* **Indexes:**
  1. `{ workspaceId: 1, status: 1, priority: -1, createdAt: 1 }` (Scheduler queue polling)
  2. `{ workspaceId: 1, idempotencyKey: 1 }` (Unique when idempotencyKey is not null; sparse: true)
  3. `{ workerId: 1, status: 1 }` (Worker heartbeat & crash recovery)

---

### 2.2 `SystemLogModel` (`systemlogs`)
* **File:** `apps/api/src/db/models/system-log.model.ts`
* **Purpose:** Operational worker execution telemetry, scraper diagnostic logs, and error traces.
* **Write Pattern:** Batched append-only writes from workers.
* **Query Pattern:** Dashboard log viewer `findMany({ workspaceId, task }).sort({ createdAt: -1 }).limit(100)`.
* **Free-Tier Retention:** 14-day automatic TTL expiration.
* **Document Schema:**
  ```typescript
  export interface SystemLogDocument extends mongoose.Document, WorkspaceScopedDocument {
    _id: string;
    workspaceId: string;
    workerId: string | null;
    severity: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
    task: string; // e.g. 'scraper:maps', 'scheduler'
    message: string;
    durationMs: number | null;
    metadata: Record<string, any> | null;
    createdAt: Date;
  }
  ```
* **Indexes:**
  1. `{ workspaceId: 1, createdAt: -1 }` (Workspace log streams)
  2. `{ workspaceId: 1, task: 1, createdAt: -1 }` (Task-specific telemetry)
  3. `{ createdAt: 1 }` (TTL: `expireAfterSeconds: 1209600` — 14 days)

---

### 2.3 `AutomationLockModel` (`automationlocks`)
* **File:** `apps/api/src/db/models/automation-lock.model.ts`
* **Purpose:** Distributed concurrency control and mutual exclusion for workflow sequences without Redis.
* **Write Pattern:** High-frequency atomic `findOneAndUpdate` with lease expiration.
* **Query Pattern:** Exact match by `{ key: 1 }`.
* **Document Schema:**
  ```typescript
  export interface AutomationLockDocument extends mongoose.Document, WorkspaceScopedDocument {
    _id: string; // Composite key: `${workspaceId}:${sequenceId}:${entityId}`
    workspaceId: string;
    sequenceId: string;
    entityId: string; // Contact or Company ID being guarded
    ownerId: string; // Worker process ID / instance ID
    lockedAt: Date;
    expiresAt: Date; // Lease expiration timestamp
  }
  ```
* **Indexes:**
  1. `{ _id: 1 }` (Primary composite key)
  2. `{ workspaceId: 1, sequenceId: 1, entityId: 1 }` (Unique constraint)
  3. `{ expiresAt: 1 }` (TTL: `expireAfterSeconds: 0` — auto-cleanup expired stale locks)

---

### 2.4 `CompanyIntelligenceModel` (`companyintelligences`)
* **File:** `apps/api/src/db/models/company-intelligence.model.ts`
* **Purpose:** AI-analyzed business insights, tech stack detection, hiring signals, and summary.
* **Write Pattern:** Written on completion of intelligence worker jobs.
* **Query Pattern:** Single lookup by `companyId` on CRM detail view.
* **Document Schema:**
  ```typescript
  export interface CompanyIntelligenceDocument extends mongoose.Document, WorkspaceScopedDocument, TimestampDocument {
    _id: string; // UUID v4 (Identical to companyId or dedicated UUID)
    workspaceId: string;
    companyId: string; // Foreign key -> companies._id
    summary: string | null;
    openingLine: string | null;
    techStack: string[]; // Native array of strings (e.g. ['React', 'HubSpot'])
    businessModel: string | null; // e.g. 'B2B SaaS'
    estimatedRevenue: string | null;
    growthSignals: string[];
    hiringSignals: string[];
    decisionMakerLikelihood: number | null; // 0.0 - 1.0
    leadConfidence: 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' | null;
    missingInformation: string[];
    createdAt: Date;
    updatedAt: Date;
  }
  ```
* **Indexes:**
  1. `{ workspaceId: 1, companyId: 1 }` (Unique constraint)
  2. `{ workspaceId: 1, leadConfidence: 1 }` (Filter by qualification grade)

---

### 2.5 `WebsiteIntelligenceModel` (`websiteintelligences`)
* **File:** `apps/api/src/db/models/website-intelligence.model.ts`
* **Purpose:** Website crawl analysis, brand voice, SEO signals, and products/services summary.
* **Document Schema:**
  ```typescript
  export interface WebsiteIntelligenceDocument extends mongoose.Document, WorkspaceScopedDocument, TimestampDocument {
    _id: string;
    workspaceId: string;
    companyId: string;
    brandVoice: string | null;
    contentQuality: string | null;
    buyingSignals: string[];
    seoSignals: Record<string, any> | null;
    technicalIssues: string[];
    productsServices: string[];
    testimonialsCaseStudies: string[];
    createdAt: Date;
    updatedAt: Date;
  }
  ```
* **Indexes:**
  1. `{ workspaceId: 1, companyId: 1 }` (Unique constraint)

---

### 2.6 `ContactIntelligenceModel` (`contactintelligences`)
* **File:** `apps/api/src/db/models/contact-intelligence.model.ts`
* **Purpose:** Decision maker scoring, seniority assessment, and personalization opportunities for outreach.
* **Document Schema:**
  ```typescript
  export interface ContactIntelligenceDocument extends mongoose.Document, WorkspaceScopedDocument, TimestampDocument {
    _id: string;
    workspaceId: string;
    contactId: string; // Foreign key -> contacts._id
    decisionMakerScore: number | null; // 0.0 - 1.0
    seniority: 'C_LEVEL' | 'VP' | 'DIRECTOR' | 'MANAGER' | 'INDIVIDUAL_CONTRIBUTOR' | 'UNKNOWN';
    buyingInfluence: string | null;
    personalizationOpportunities: string[];
    relationshipStrength: number | null;
    createdAt: Date;
    updatedAt: Date;
  }
  ```
* **Indexes:**
  1. `{ workspaceId: 1, contactId: 1 }` (Unique constraint)
  2. `{ workspaceId: 1, decisionMakerScore: -1 }` (Lead prioritization sorting)

---

### 2.7 `OpportunityScoreModel` (`opportunityscores`)
* **File:** `apps/api/src/db/models/opportunity-score.model.ts`
* **Purpose:** Multi-dimensional opportunity scoring matrix for account prioritization.
* **Document Schema:**
  ```typescript
  export interface OpportunityScoreDocument extends mongoose.Document, WorkspaceScopedDocument, TimestampDocument {
    _id: string;
    workspaceId: string;
    companyId: string;
    overallScore: number; // 0 - 100
    fitScore: number; // 0 - 100
    sizeScore: number; // 0 - 100
    intentScore: number; // 0 - 100
    urgencyScore: number; // 0 - 100
    explanation: string | null;
    provenance: Record<string, any> | null; // Explanation factors
    createdAt: Date;
    updatedAt: Date;
  }
  ```
* **Indexes:**
  1. `{ workspaceId: 1, companyId: 1 }` (Unique constraint)
  2. `{ workspaceId: 1, overallScore: -1 }` (High-score lead sort)

---

### 2.8 `AuditLogModel` (`auditlogs`)
* **File:** `apps/api/src/db/models/audit-log.model.ts`
* **Purpose:** Immutable compliance and audit trail of user and system mutations.
* **Document Schema:**
  ```typescript
  export interface AuditLogDocument extends mongoose.Document, WorkspaceScopedDocument {
    _id: string;
    workspaceId: string;
    actor: {
      userId: string | null;
      type: 'user' | 'system' | 'worker';
      ip?: string | null;
    };
    action: string; // 'create', 'update', 'delete', 'export', 'send'
    entityType: string; // 'company', 'contact', 'campaign', 'email_account'
    entityId: string;
    beforeValue: Record<string, any> | null;
    afterValue: Record<string, any> | null;
    timestamp: Date;
  }
  ```
* **Indexes:**
  1. `{ workspaceId: 1, entityType: 1, entityId: 1, timestamp: -1 }` (Entity history)
  2. `{ workspaceId: 1, timestamp: -1 }` (Workspace audit stream)

---

### 2.9 `WorkspaceMemoryModel` (`workspacememories`)
* **File:** `apps/api/src/db/models/workspace-memory.model.ts`
* **Purpose:** Agentic AI long-term semantic key-value memory store per workspace.
* **Document Schema:**
  ```typescript
  export interface WorkspaceMemoryDocument extends mongoose.Document, WorkspaceScopedDocument, TimestampDocument {
    _id: string;
    workspaceId: string;
    scope: string; // 'global' | 'agent:enrichment' | 'user:preferences'
    key: string;
    value: any; // Mixed JSON value
    createdAt: Date;
    updatedAt: Date;
  }
  ```
* **Indexes:**
  1. `{ workspaceId: 1, scope: 1, key: 1 }` (Unique constraint)

---

### 2.10 `PageCrawlModel` (`pagecrawls`)
* **File:** `apps/api/src/db/models/page-crawl.model.ts`
* **Purpose:** Storage for crawl metadata and extracted text.
* **Atlas Free-Tier Storage Decision:**
  > [!CAUTION]
  > Storing multi-megabyte raw HTML dumps directly in MongoDB Atlas free tier will immediately exhaust the 512MB quota.
  > **Target Decision:** MongoDB stores URL, metadata, response headers, extracted text signals, and an MD5 content hash. Raw bloated HTML is stored in local scratch cache or external storage, NOT uncompressed in MongoDB!
* **Document Schema:**
  ```typescript
  export interface PageCrawlDocument extends mongoose.Document, WorkspaceScopedDocument {
    _id: string;
    workspaceId: string;
    companyId: string;
    url: string;
    status: number; // HTTP status code (200, 404, etc.)
    contentHash: string; // SHA-256 / MD5
    extractedText: string | null; // Cleaned visible text (truncated to 50KB)
    rawHtmlLength: number;
    crawledAt: Date;
  }
  ```
* **Indexes:**
  1. `{ workspaceId: 1, companyId: 1, crawledAt: -1 }`
  2. `{ workspaceId: 1, url: 1 }`

---

### 2.11 `IntelligenceSourceModel` (`intelligencesources`)
* **File:** `apps/api/src/db/models/intelligence-source.model.ts`
* **Purpose:** Origin verification and provenance tracking for intelligence evidence.
* **Document Schema:**
  ```typescript
  export interface IntelligenceSourceDocument extends mongoose.Document, WorkspaceScopedDocument, TimestampDocument {
    _id: string;
    workspaceId: string;
    companyId: string | null;
    sourceType: 'WEBSITE' | 'GOOGLE_MAPS' | 'LINKEDIN' | 'REGISTRY' | 'MANUAL';
    url: string | null;
    retrievedAt: Date;
    status: 'SUCCESS' | 'FAILED' | 'STALE';
    contentHash: string | null;
    retrievalMethod: string | null;
    createdAt: Date;
    updatedAt: Date;
  }
  ```
* **Indexes:**
  1. `{ workspaceId: 1, companyId: 1, sourceType: 1 }`

---

### 2.12 `IntelligenceEvidenceModel` (`intelligenceevidences`)
* **File:** `apps/api/src/db/models/intelligence-evidence.model.ts`
* **Purpose:** Granular factual snippets extracted from verified sources.
* **Document Schema:**
  ```typescript
  export interface IntelligenceEvidenceDocument extends mongoose.Document, WorkspaceScopedDocument {
    _id: string;
    workspaceId: string;
    companyId: string;
    sourceId: string; // FK -> intelligencesources._id
    evidenceType: string; // 'TECH_STACK', 'EMPLOYEE_COUNT', 'LOCATION', 'REVENUE'
    key: string;
    value: string;
    rawExcerpt: string | null;
    extractionMethod: 'REGEX' | 'DOM_SELECTOR' | 'LLM' | 'HEURISTIC';
    observedAt: Date;
    createdAt: Date;
  }
  ```
* **Indexes:**
  1. `{ workspaceId: 1, companyId: 1, evidenceType: 1 }`
  2. `{ workspaceId: 1, sourceId: 1 }`

---

### 2.13 `IntelligenceClaimModel` (`intelligenceclaims`)
* **File:** `apps/api/src/db/models/intelligence-claim.model.ts`
* **Purpose:** Claims synthesized from multiple pieces of evidence with verification status.
* **Document Schema:**
  ```typescript
  export interface IntelligenceClaimDocument extends mongoose.Document, WorkspaceScopedDocument {
    _id: string;
    workspaceId: string;
    companyId: string;
    evidenceIds: string[]; // Native array of evidence string IDs
    subject: string;
    predicate: string;
    objectValue: string;
    verificationStatus: 'UNVERIFIED' | 'VERIFIED' | 'DISPUTED' | 'REFUTED';
    createdAt: Date;
  }
  ```
* **Indexes:**
  1. `{ workspaceId: 1, companyId: 1, verificationStatus: 1 }`

---

### 2.14 `IntelligenceInferenceModel` (`intelligenceinferences`)
* **File:** `apps/api/src/db/models/intelligence-inference.model.ts`
* **Purpose:** Higher-order business rules and AI inferences derived from claims.
* **Document Schema:**
  ```typescript
  export interface IntelligenceInferenceDocument extends mongoose.Document, WorkspaceScopedDocument {
    _id: string;
    workspaceId: string;
    companyId: string;
    supportingClaimIds: string[]; // Foreign keys -> intelligenceclaims._id
    field: string;
    value: string;
    inferenceMethod: 'RULE_HEURISTIC' | 'LLM_INFERENCE' | 'REGRESSION';
    confidence: number; // 0.0 - 1.0
    reason: string;
    createdAt: Date;
  }
  ```
* **Indexes:**
  1. `{ workspaceId: 1, companyId: 1 }`

---

### 2.15 `EmailDeliveryModel` (`emaildeliveries`)
* **File:** `apps/api/src/db/models/email-delivery.model.ts`
* **Purpose:** Authoritative outbound delivery ledger preventing duplicate email transmissions.
* **Document Schema:**
  ```typescript
  export interface EmailDeliveryDocument extends mongoose.Document, WorkspaceScopedDocument, TimestampDocument {
    _id: string;
    workspaceId: string;
    campaignId: string | null;
    sequenceId: string;
    executionId: string; // Sequence execution ID
    stepIndex: number;
    contactId: string;
    companyId: string | null;
    accountId: string; // Sending email account ID
    senderEmail: string;
    recipientEmail: string;
    subject: string;
    providerMessageId: string | null; // Gmail message ID or SMTP message ID
    status: 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED' | 'RETRYING' | 'CANCELLED' | 'SUPPRESSED';
    attempt: number;
    error: string | null;
    idempotencyKey: string; // Strict unique key
    sentAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }
  ```
* **Indexes:**
  1. `{ idempotencyKey: 1 }` (Unique constraint across MongoDB)
  2. `{ workspaceId: 1, executionId: 1, stepIndex: 1 }` (Step deduplication)
  3. `{ workspaceId: 1, status: 1, createdAt: -1 }` (Delivery monitoring)
  4. `{ workspaceId: 1, recipientEmail: 1 }` (Suppression & frequency guard)

---

## 3. Schema Adjustments to Existing 18 Models

The existing 18 Mongoose models in `apps/api/src/db/models/` must be audited and adjusted to enforce the string-only ID standard:

1. **`CompanyModel` (`companies`):**
   - Add explicit `_id: { type: String, required: true }`.
   - Set `{ _id: false }` in schema options.
   - Verify index: `{ workspaceId: 1, domain: 1 }`.
2. **`ContactModel` (`contacts`):**
   - Add explicit `_id: { type: String, required: true }`.
   - Add field `lastContactedAt: { type: Date, default: null }`.
   - Verify index: `{ workspaceId: 1, email: 1 }`, `{ workspaceId: 1, companyId: 1 }`.
3. **`CampaignModel` (`campaigns`):**
   - Add explicit `_id: { type: String, required: true }`.
   - Verify index: `{ workspaceId: 1, name: 1 }`.
4. **`SequenceModel` & `SequenceExecutionModel`:**
   - Enforce `_id: { type: String, required: true }`.
   - In `sequenceexecutions`, add field `parentJobId: { type: String, default: null }` indexed with `{ parentJobId: 1 }`.
5. **`EmailTemplateModel` (`emailtemplates`):**
   - Enforce `_id: { type: String, required: true }`.
   - Standardize `attachments` subdocument array:
     ```typescript
     attachments: [
       {
         id: { type: String, required: true },
         provider: { type: String, enum: ['google-drive'], default: 'google-drive' },
         fileId: { type: String, required: true },
         filename: { type: String, required: true },
         mimeType: { type: String, required: true },
         size: { type: Number, required: true },
         driveUrl: { type: String, default: null }
       }
     ]
     ```

---

## 4. Master Index & Workspace Isolation Matrix

| Model | Collection | Primary Key | Key Compound / Unique Indexes | TTL Index |
| :--- | :--- | :--- | :--- | :--- |
| **Job** | `jobs` | `_id: String` | `{ workspaceId: 1, status: 1, priority: -1 }`<br>`{ workspaceId: 1, idempotencyKey: 1 }` (unique) | None |
| **SystemLog** | `systemlogs` | `_id: String` | `{ workspaceId: 1, createdAt: -1 }` | `createdAt` (14 days) |
| **AutomationLock** | `automationlocks` | `_id: String` | `{ workspaceId: 1, sequenceId: 1, entityId: 1 }` (unique) | `expiresAt` (0s) |
| **CompanyIntel** | `companyintelligences` | `_id: String` | `{ workspaceId: 1, companyId: 1 }` (unique) | None |
| **WebsiteIntel** | `websiteintelligences` | `_id: String` | `{ workspaceId: 1, companyId: 1 }` (unique) | None |
| **ContactIntel** | `contactintelligences` | `_id: String` | `{ workspaceId: 1, contactId: 1 }` (unique) | None |
| **OpportunityScore**| `opportunityscores`| `_id: String` | `{ workspaceId: 1, companyId: 1 }` (unique) | None |
| **AuditLog** | `auditlogs` | `_id: String` | `{ workspaceId: 1, entityType: 1, entityId: 1, timestamp: -1 }` | None |
| **WorkspaceMemory**| `workspacememories` | `_id: String` | `{ workspaceId: 1, scope: 1, key: 1 }` (unique) | None |
| **PageCrawl** | `pagecrawls` | `_id: String` | `{ workspaceId: 1, companyId: 1, crawledAt: -1 }` | None |
| **IntelSource** | `intelligencesources` | `_id: String` | `{ workspaceId: 1, companyId: 1, sourceType: 1 }` | None |
| **IntelEvidence** | `intelligenceevidences`| `_id: String` | `{ workspaceId: 1, companyId: 1, evidenceType: 1 }` | None |
| **IntelClaim** | `intelligenceclaims` | `_id: String` | `{ workspaceId: 1, companyId: 1, verificationStatus: 1 }` | None |
| **IntelInference** | `intelligenceinferences`| `_id: String` | `{ workspaceId: 1, companyId: 1 }` | None |
| **EmailDelivery** | `emaildeliveries` | `_id: String` | `{ idempotencyKey: 1 }` (unique)<br>`{ workspaceId: 1, executionId: 1, stepIndex: 1 }` | None |
