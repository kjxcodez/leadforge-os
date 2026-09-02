# LeadForge OS — Canonical Identity Specification

## 1. The Strict Identity Invariant

Under the target MongoDB-First architecture, the identity principle is universal across all tiers:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          THE UNIFIED IDENTITY INVARIANT                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│      MongoDB Document `_id` (String)                                        │
│                 ║                                                           │
│                 ▼ (Identical String)                                        │
│      API DTO `id` (String)                                                  │
│                 ║                                                           │
│                 ▼ (Identical String)                                        │
│      SQLite Materialized Cache `id` (String)                                │
│                 ║                                                           │
│                 ▼ (Identical String)                                        │
│      Foreign-Key References (`companyId`, `sequenceId`, etc.)               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **ZERO TRANSLATION LAYER IS PERMITTED.**
> There must be NO conversion between UUIDs and ObjectIds, NO local auto-increment numeric identifiers, NO surrogate key mapping tables (`localId` ↔ `remoteId`), and NO transformation during cache serialization.

---

## 2. Invariant Rules for MongoDB `_id`

1. **Type Constraint:** In MongoDB, every document's `_id` field MUST be stored as BSON `String` (BSON type 2).
2. **Prohibition of ObjectId:** BSON `ObjectId` (BSON type 7) is strictly banned for LeadForge domain, operational, and intelligence entities.
3. **Mongoose Schema Definition:** Every Mongoose schema in `apps/api/src/db/models/` must explicitly declare:
   ```typescript
   _id: {
     type: String,
     required: true
   }
   ```
   and disable Mongoose's default ObjectId generation:
   ```typescript
   const entitySchema = new Schema<EntityDocument>(
     {
       _id: { type: String, required: true },
       workspaceId: { type: String, required: true, index: true },
       // ... fields
     },
     {
       _id: false, // Prevents Mongoose from attaching default ObjectId
       strict: true,
       timestamps: true
     }
   );
   ```
4. **BaseRepository Standardization:** `BaseRepository.create` and `BaseRepository.createMany` enforce that `doc._id = payload.id || payload._id`. If neither is provided, a runtime validation error is thrown immediately.

---

## 3. Canonical ID Generator & Responsibility Matrix

### 3.1 The Canonical ID Generator Function
The repository adopts native Node.js / Web Crypto UUID v4 via `crypto.randomUUID()`.
This is encapsulated in a central shared package:

```typescript
// packages/schema/src/common/identity.ts
export function generateEntityId(): string {
  return crypto.randomUUID();
}
```

### 3.2 ID Generation Responsibility: Who Generates and Why?

```text
┌─────────────────────────┬──────────────────────┬──────────────────────────────────────────────────────────┐
│ Originating Layer       │ Generates ID?        │ Rationale & Architectural Rule                           │
├─────────────────────────┼──────────────────────┼──────────────────────────────────────────────────────────┤
│ **Worker Thread**       │ **YES (Primary)**    │ High-throughput workers (e.g. scraper discovering        │
│ (Playwright / Scraper)  │                      │ companies + contacts) must establish child foreign keys  │
│                         │                      │ (`contact.companyId = company.id`) locally before sending│
│                         │                      │ bulk payload to API in a single HTTP request.            │
├─────────────────────────┼──────────────────────┼──────────────────────────────────────────────────────────┤
│ **Electron Main (UI)**  │ **YES (Primary)**    │ Main process generates ID for UI mutations prior to      │
│ (IPC Handlers)          │                      │ issuing API call so that optimistic tracking or          │
│                         │                      │ correlation IDs are instantly available.                 │
├─────────────────────────┼──────────────────────┼──────────────────────────────────────────────────────────┤
│ **SdkClient**           │ **YES (Fallback)**   │ If an SDK caller provides a DTO without an `id`, the     │
│ (packages/sdk)          │                      │ SDK assigns `payload.id = generateEntityId()` before     │
│                         │                      │ network serialization.                                   │
├─────────────────────────┼──────────────────────┼──────────────────────────────────────────────────────────┤
│ **API Persistence**     │ **YES (Guardrail)**  │ If an external REST consumer bypasses the SDK and posts  │
│ (apps/api routes)       │                      │ without an `id`, Hono Zod middleware assigns             │
│                         │                      │ `c.req.valid('json').id = generateEntityId()`.           │
├─────────────────────────┼──────────────────────┼──────────────────────────────────────────────────────────┤
│ **MongoDB Engine**      │ **NEVER**            │ MongoDB must NEVER generate an ID. It receives an        │
│                         │                      │ explicit `_id: string` in every single `insert`/`save`.  │
└─────────────────────────┴──────────────────────┴──────────────────────────────────────────────────────────┘
```

### Why Client-Side Pre-Generation is Required
In relational graph workloads (e.g., scraper scraping a company, 3 contacts, and 2 intelligence sources):
- If the database generated IDs, the worker would have to execute serial requests: `POST /companies` → wait for Mongo response → extract `companyId` → `POST /contacts` with `companyId`. This would cause network chattiness, high latency, and transaction failures on serverless Vercel.
- By generating UUIDs application-side beforehand:
  1. The worker creates `companyId = generateEntityId()`.
  2. The worker creates contacts referencing `contact.companyId = companyId`.
  3. The worker sends the entire graph to `POST /bulk` in a single atomic/batched HTTP call.
  4. MongoDB persists both using the exact provided string `_id` values.

---

## 4. End-to-End Identity Flow

```text
1. Entity Initialization (Worker or Desktop Main)
   const companyId = generateEntityId(); // e.g. "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
   const companyDto = { id: companyId, name: "Acme Corp", domain: "acme.com" };

2. HTTP Transmission via SdkClient
   await sdk.companies.create(companyDto);
   --> POST /api/v1/companies
       Body: { id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d", name: "Acme Corp", ... }

3. API Route & Validation (apps/api)
   Validated by Zod schema: companySchema (requires id as string UUID).
   Passed to CompanyRepository.create(dto).

4. MongoDB Persistence (BaseRepository -> Mongoose)
   const doc = new CompanyModel({ _id: dto.id, ...dto });
   await doc.save();
   --> Stored in MongoDB collection `companies`:
       { _id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d", name: "Acme Corp", ... }

5. API Response Return
   HTTP 201 Created:
   { success: true, data: { id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d", ... } }

6. SQLite Cache Projection (Desktop Main)
   db.prepare(`
     INSERT OR REPLACE INTO companies (id, workspaceId, name, domain, ...)
     VALUES (?, ?, ?, ?, ...)
   `).run(res.data.id, res.data.workspaceId, res.data.name, ...);
```

---

## 5. Foreign Key Integrity Rules

All relational associations across LeadForge OS MUST store the exact string `_id` of the target entity:

| Source Entity | Foreign Key Field | Target Entity & Primary Key | Valid Format Example |
| :--- | :--- | :--- | :--- |
| `contacts` | `companyId` | `companies._id` | `uuid-string` |
| `campaigns` | `sequenceId` | `sequences._id` | `uuid-string` |
| `campaigns` | `sendingAccountId` | `emailaccounts._id` | `uuid-string` |
| `sequence_executions` | `sequenceId` | `sequences._id` | `uuid-string` |
| `sequence_executions` | `contactId` | `contacts._id` | `uuid-string` |
| `sequence_executions` | `parentJobId` | `jobs._id` | `uuid-string` |
| `sequence_logs` | `executionId` | `sequenceexecutions._id`| `uuid-string` |
| `company_discovery_runs`| `companyId` | `companies._id` | `uuid-string` |
| `company_discovery_runs`| `discoveryRunId` | `discoveryruns._id` | `uuid-string` |
| `company_intelligence` | `companyId` | `companies._id` | `uuid-string` |
| `website_intelligence` | `companyId` | `companies._id` | `uuid-string` |
| `opportunity_scores` | `companyId` | `companies._id` | `uuid-string` |
| `intelligence_sources` | `companyId` | `companies._id` | `uuid-string` |
| `intelligence_evidence`| `sourceId` | `intelligencesources._id`| `uuid-string` |
| `intelligence_evidence`| `companyId` | `companies._id` | `uuid-string` |
| `email_deliveries` | `executionId` | `sequenceexecutions._id`| `uuid-string` |
| `email_deliveries` | `contactId` | `contacts._id` | `uuid-string` |
| `email_deliveries` | `accountId` | `emailaccounts._id` | `uuid-string` |

---

## 6. Shared Schema Type Specifications

In `packages/schema/src/common/types.ts` and `fields/common.ts`:

```typescript
// Replacement for legacy objectIdField
export const entityIdField = z
  .string()
  .min(1, 'Entity ID is required')
  .max(128, 'Entity ID exceeds max length');

export const entityIdFieldNullable = z
  .string()
  .max(128)
  .nullable()
  .optional();

export type EntityId = z.infer<typeof entityIdField>;
```

All entity schemas (`companySchema`, `contactSchema`, `campaignSchema`, `jobSchema`, etc.) must reference `id: entityIdField` and eliminate legacy references to `objectIdField`.
