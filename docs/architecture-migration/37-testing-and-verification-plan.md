# LeadForge OS — Testing & Verification Plan

## 1. Executive Summary

This testing plan provides concrete, executable automated test specifications to validate each architectural invariant of the MongoDB-First architecture. Every phase of implementation requires passing test suites before advancing to the next phase.

---

## 2. Definitive Verification Test Suites

```text
┌────┬──────────────────────────────────┬──────────────────────┬──────────────────────────────────────────┐
│ ID │ Test Suite Name                  │ Target Artifact      │ Invariant Tested                         │
├────┼──────────────────────────────────┼──────────────────────┼──────────────────────────────────────────┤
│ T1 │ **Identity Invariant Suite**     │ API / SDK / Desktop  │ `Mongo._id === API.id === SQLite.id`.    │
│ T2 │ **Disposable Cache Destruction** │ Desktop / Cache      │ Delete `.db` -> 100% UI data restored.   │
│ T3 │ **API Persistence Durability**   │ API / MongoDB        │ Authoritative commit in MongoDB.         │
│ T4 │ **Worker Persistence Suite**     │ Workers / SdkClient  │ Zero `better-sqlite3` in workers.        │
│ T5 │ **Worker Crash & Resume**        │ Scheduler / Workers  │ Jobs survive worker PID crash.           │
│ T6 │ **Batch API Throughput**         │ API / Repositories   │ 100-item bulkWrite deduplication.        │
│ T7 │ **Offline Write Protection**     │ IPC / UI / Network   │ Clear network error; zero dirty state.   │
│ T8 │ **Sync Subsystem Eradication**   │ Desktop Runtime      │ Zero sync queues, zero dirty flags.      │
│ T9 │ **Google Attachment Lifecycle**  │ Drive / Gmail / API  │ Drive binary upload + send-time MIME.    │
│ T10│ **Data Migration Verification**  │ Migration Scripts    │ Zero data loss; foreign keys intact.     │
│ T11│ **Mongo ObjectId Conversion**    │ API DB               │ 0 ObjectId documents remain in Mongo.    │
└────┴──────────────────────────────────┴──────────────────────┴──────────────────────────────────────────┘
```

---

## 3. Test Specifications & Assertions

### 3.1 Suite T1: Canonical Identity Invariant Test
* **Test File:** `tests/integration/identity-invariant.test.ts`
* **Execution Flow:**
  1. Generate client UUID: `const id = generateEntityId();`.
  2. Send DTO: `await sdk.companies.create({ id, name: "Identity Test Corp" });`.
  3. Query MongoDB raw driver: `const mongoDoc = await rawDb.collection('companies').findOne({ _id: id });`.
  4. Assert: `typeof mongoDoc._id === 'string'`.
  5. Assert: `mongoDoc._id === id`.
  6. Trigger desktop cache hydration: `await cacheHydrator.hydrateWorkspaceCache(wsId, sdk)`.
  7. Query local SQLite: `const sqliteRow = db.prepare('SELECT id FROM companies WHERE id = ?').get(id)`.
  8. Assert: `sqliteRow.id === id`.

---

### 3.2 Suite T2: Disposable Cache Destruction Test
* **Test File:** `tests/integration/cache-destruction.test.ts`
* **Execution Flow:**
  1. Seed MongoDB via API with: 100 companies, 300 contacts, 5 campaigns, 10 sequences.
  2. Run initial hydration. Assert SQLite contains all records.
  3. Close database connection.
  4. Physically delete file: `fs.unlinkSync(workspaceDbPath)`.
  5. Assert: `fs.existsSync(workspaceDbPath) === false`.
  6. Reboot workspace: `await workspaceRuntime.initialize(workspaceId)`.
  7. Assert: `initCacheSchema` creates fresh schema.
  8. Assert: `cacheHydrator` fetches data from MongoDB.
  9. Assert SQLite counts match MongoDB counts 100%.

---

### 3.3 Suite T3: API Persistence Durability Test
* **Test File:** `tests/integration/api-persistence-durability.test.ts`
* **Execution Flow:**
  1. Post company to API: `res = await client.post('/companies', payload)`.
  2. Terminate API process immediately (simulating serverless freeze).
  3. Query MongoDB directly: assert document exists, matches payload, has correct timestamps and workspace isolation.

---

### 3.4 Suite T4: Worker Persistence & Batch Throughput Test
* **Test File:** `tests/integration/worker-persistence.test.ts`
* **Execution Flow:**
  1. Launch `scraper.ts` inside sandboxed worker thread without local DB path.
  2. Scraper extracts 100 Google Maps business listings.
  3. Scraper issues `POST /api/v1/companies/bulk`.
  4. Assert MongoDB received 100 documents.
  5. Assert zero `better-sqlite3` connections were opened by the worker process.

---

### 3.5 Suite T5: Worker Crash & State Recovery Test
* **Test File:** `tests/integration/worker-crash-recovery.test.ts`
* **Execution Flow:**
  1. Enqueue long-running mock job in MongoDB (`jobs`).
  2. Worker begins execution, reaches step 5 (50%), saves checkpoint.
  3. Force kill worker process via `process.kill(workerPid, 'SIGKILL')`.
  4. Scheduler heartbeat watchdog detects worker death.
  5. Status transitions: `running` -> `retrying`.
  6. New worker spawned by scheduler claims job.
  7. Worker reads `checkpointData`, resumes from step 6, completes job.

---

### 3.6 Suite T6: Offline Write Protection Test
* **Test File:** `tests/integration/offline-write-protection.test.ts`
* **Execution Flow:**
  1. Mock network offline state in desktop runtime (`navigator.onLine = false` or reject fetch).
  2. User invokes `companies:create` IPC handler.
  3. Assert IPC handler returns error: `{ success: false, error: 'NetworkUnavailable' }`.
  4. Assert local SQLite cache remains unmutated.
  5. Assert zero records created in `sync_queue`.

---

### 3.7 Suite T7: Google Drive Attachment Lifecycle Test
* **Test File:** `tests/integration/attachment-lifecycle.test.ts`
* **Execution Flow:**
  1. Upload 500KB test PDF via `POST /templates/attachments`.
  2. Assert Google Drive returns `fileId`.
  3. Assert MongoDB template stores `attachments[0].fileId`.
  4. Delete local SQLite cache and wipe local temp directory.
  5. Trigger email send: assert API successfully downloads binary stream from Google Drive using `fileId`, attaches PDF to MIME, and delivers email.

---

## 4. Performance & Scalability Benchmarks

| Operation | Workload Dataset | Maximum Target Latency | Pass / Fail Metric |
| :--- | :--- | :--- | :--- |
| **API Single Insert** | 1 Company DTO | `< 150ms` | HTTP 201 |
| **API Batch Upsert** | 100 Companies DTO | `< 800ms` | HTTP 200 (100 upserted) |
| **Mongo Compound Query** | 10,000 Contacts in Workspace | `< 40ms` | Uses `{ workspaceId: 1, email: 1 }` index |
| **Cache Startup Hydration**| 1,000 CRM Records | `< 1,800ms` | Complete SQLite cache population |
| **Synchronous UI Read** | 50 Companies from SQLite Cache| `< 5ms` | Instant React table render |
| **Lock Concurrency** | 20 Concurrent Workers on 1 Lock| 1 winner, 19 locked | Zero deadlocks / zero race leaks |
