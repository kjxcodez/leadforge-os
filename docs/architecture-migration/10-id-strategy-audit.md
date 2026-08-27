# LeadForge OS — Identity Strategy Audit & Invariant Rules

## 1. The Strict Identity Invariant
In the target MongoDB-first architecture, the identity rule is non-negotiable:

```text
MongoDB document `_id`
        ↓
Same exact string identifier
        ↓
API response
        ↓
SQLite cache `id`
        ↓
Application UI & Workers
```

> [!IMPORTANT]
> **NO ID TRANSLATION LAYER IS PERMITTED.**
> There must be NO conversion of `_id` into local numeric auto-increment keys, UUIDs, or surrogate mapping tables (`localId` ↔ `remoteId`).

---

## 2. Forensic Audit of Existing ID Mechanisms

### 2.1 Code Search Results
A repository-wide search for ID generators and identity mapping logic revealed:

1. **`crypto.randomUUID()` / `randomUUID()`**:
   * Usage: Used extensively across `LocalCRMRepository` ([`local-crm.ts:110`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/repositories/local-crm.ts#L110)), `scheduler.ts`, worker plugins (`scraper.ts`, `crawler.ts`), and workflow execution engines.
   * Reason: Desktop UI and workers generate local UUID strings before writing to SQLite.

2. **MongoDB `ObjectId`**:
   * Usage: Default primary key generation in Mongoose models when documents are created on the server without an explicit `_id`.

3. **`_id` to `id` Normalization in `LocalCRMRepository`**:
   * In [`apps/desktop/src/main/database/repositories/local-crm.ts:103-106`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/repositories/local-crm.ts#L103-L106):
   ```typescript
   if (record._id && !record.id) {
     record.id = typeof record._id === 'object' ? record._id.toString() : record._id;
   }
   delete record._id;
   ```
   * And in `saveMany` ([`local-crm.ts:224-228`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/repositories/local-crm.ts#L224-L228)).

4. **`BaseRepository` ID Mapping in API**:
   * In [`apps/api/src/repositories/base/base.repository.ts:91-93`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/repositories/base/base.repository.ts#L91-L93):
   ```typescript
   if (payload.id && !payload._id) {
     payload._id = payload.id;
   }
   ```
   * When a client sends an `id` string (e.g., UUID created by desktop), `BaseRepository` stores it as `_id` in MongoDB.

---

## 3. ID Strategy Comparison & Forensic Verdict

| Entity | Current SQLite ID Type | Current Mongo ID Type | Identical Today? | Current Mapping Behavior | Target Standard ID |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **User** | String (UUID) | String / ObjectId | Partial | Sync engine maps `_id` ↔ `id` | Mongo `_id` string |
| **Workspace** | String (UUID) | String / ObjectId | Partial | Sync engine maps `_id` ↔ `id` | Mongo `_id` string |
| **Company** | String (UUID) | String / ObjectId | Mismatched if generated locally first | Local generates UUID; remote generates ObjectId | Mongo `_id` string |
| **Contact** | String (UUID) | String / ObjectId | Mismatched if generated locally first | Local generates UUID; remote generates ObjectId | Mongo `_id` string |
| **Campaign** | String (UUID) | String / ObjectId | Mismatched if generated locally first | Local generates UUID; remote generates ObjectId | Mongo `_id` string |
| **Email Account** | String (UUID) | String / ObjectId | Partial | Sync engine maps `_id` ↔ `id` | Mongo `_id` string |
| **Template** | String (UUID) | String / ObjectId | Partial | Sync engine maps `_id` ↔ `id` | Mongo `_id` string |
| **Sequence** | String (UUID) | String / ObjectId | Mismatched if generated locally first | Local generates UUID; remote generates ObjectId | Mongo `_id` string |
| **Sequence Execution**| String (UUID) | String / ObjectId | Mismatched if generated locally first | Local generates UUID; remote generates ObjectId | Mongo `_id` string |
| **Sequence Log** | String (UUID) | String / ObjectId | Mismatched if generated locally first | Local generates UUID; remote generates ObjectId | Mongo `_id` string |
| **Job** | String (UUID) | **None (SQLite only)** | N/A | Exists only in SQLite | Mongo `_id` string |
| **System Log** | String (UUID) | **None (SQLite only)** | N/A | Exists only in SQLite | Mongo `_id` string |
| **Discovery Run** | String (UUID) | String / ObjectId | Partial | Sync engine maps `_id` ↔ `id` | Mongo `_id` string |
| **Company Discovery Run**| String (UUID) | String / ObjectId | Partial | Sync engine maps `_id` ↔ `id` | Mongo `_id` string |
| **Audience** | String (UUID) | String / ObjectId | Partial | Sync engine maps `_id` ↔ `id` | Mongo `_id` string |
| **Email Delivery**| String (UUID) | **None (SQLite only)** | N/A | Exists only in SQLite | Mongo `_id` string |

---

## 4. Preservation & Migration Strategy for Entity Identifiers
1. **Creation Flow:** All entity creations MUST issue an API request first. MongoDB creates the document and generates `_id` (or receives string `_id` if specified by API DTO).
2. **Cache Storage:** When the API returns the created document to the application or workers, the document's `_id` string is saved as `id` in SQLite cache.
3. **Foreign Key Integrity:** All foreign key references (e.g. `contacts.companyId`, `sequence_executions.sequenceId`, `company_discovery_runs.discoveryRunId`) store the exact target MongoDB `_id` string.
4. **Data Migration:** During data migration from SQLite to MongoDB, existing SQLite UUID strings MUST be preserved as `_id` in MongoDB so existing foreign key linkages remain intact!
