# LeadForge OS — Testing & Verification Strategy

## 1. Overview & Quality Gates
To guarantee that the MongoDB-first migration introduces zero regression, data loss, or state inconsistency, a comprehensive verification suite must be executed before approving production release.

---

## 2. Verification Suite Breakdown

### 2.1 Identity Invariant Tests
* **Test:** Verify `MongoDB _id === API Entity ID === SQLite Cache ID`.
* **Execution:** Create entities via API; assert that `doc._id` returned by API matches the `id` populated in local SQLite cache. Assert zero translation or ID mutation occurs.

### 2.2 Disposable Cache Destruction & Rebuild Tests
* **Test:** Delete local SQLite database file (`leadforge_test.db`) while desktop app is running.
* **Execution:** Trigger `CacheHydrator.hydrateWorkspaceCache()`. Assert that 100% of business entities, templates, sequences, intelligence records, and jobs are completely restored from MongoDB with identical IDs.

### 2.3 API Persistence Durability Tests
* **Test:** Create a company, contact, campaign, and workflow sequence via API endpoints (`POST /companies`, etc.).
* **Execution:** Inspect MongoDB directly via Mongoose connection. Assert that authoritative state is immediately written to MongoDB before HTTP response resolves.

### 2.4 Worker Durability & Failure Recovery Tests
* **Test:** Kill a running Playwright scraper or crawler worker mid-execution (`process.kill()`).
* **Execution:** Restart desktop application. Verify that job state and progress checkpoints stored in MongoDB `jobs` collection allow the worker to resume seamlessly without losing scrape results.

### 2.5 Offline Network Handling Tests
* **Test:** Disconnect network adapter while performing UI mutations.
* **Execution:** Verify UI displays a clear network error notification rather than creating local un-synced dirty rows or orphan UUIDs in SQLite.

### 2.6 Email Attachment & MIME Generation Tests
* **Test:** Create email template with attachment stored in Google Drive.
* **Execution:** Wipe SQLite cache. Trigger `POST /email/send`. Verify API fetches binary stream from Google Drive via `fileId`, constructs correct MIME body, and sends email successfully via Gmail API.

---

## 3. Automated Test Script Plan
Create automated test runner `scripts/test-mongodb-migration.ts` covering:
1. Mongo schema validation & index creation.
2. API CRUD endpoint verification.
3. Cache hydration speed (< 2 seconds for 10,000 records).
4. Disposable SQLite deletion & recovery.
