# LeadForge OS — Worker Persistence Migration Plan

## 1. Executive Summary & Worker Architectural Role

LeadForge OS background workers execute CPU-intensive, long-running browser automation, network crawling, AI evaluation, and email dispatch tasks.

### Core Architectural Principle:
> [!IMPORTANT]
> **Workers are execution engines, not databases.**
> In the target architecture:
> 1. Workers **MUST NOT** import or instantiate `better-sqlite3` for persistent business state.
> 2. Workers interact with persistent storage exclusively via `SdkClient` calling `apps/api`.
> 3. SQLite updates occur downstream strictly as cache projections.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WORKER PERSISTENCE FLOW                           │
└─────────────────────────────────────────────────────────────────────────────┘
  Worker Process (Child process / Worker thread)
         │
         ├─► Executes Playwright / Cheerio / IMAP task
         ├─► Accumulates output records in memory buffer (e.g. 50 companies)
         │
         ▼
  SdkClient (HTTP REST over loopback / network)
         │
         ▼
  Hono API (apps/api) ──► MongoDB Server (Atlas Authoritative Store)
         │
         ▼ (Authoritative Response containing MongoDB _id)
  Worker / Desktop Main
         │
         ▼ (Optional)
  Update Local SQLite Materialized Read-Cache
```

---

## 2. Worker Performance & Buffering Strategy

To prevent overwhelming the Vercel serverless API or Atlas free-tier with thousands of tiny HTTP requests:

```text
┌─────────────────────────┬──────────────────────┬──────────────────────────────────────────────────────────┐
│ Write Classification    │ Flush Trigger        │ Implementation Pattern                                   │
├─────────────────────────┼──────────────────────┼──────────────────────────────────────────────────────────┤
│ **Batched Business**    │ 50 items OR 10 sec   │ Buffer records in memory; flush via Batch API             │
│ (Companies, Contacts)   │                      │ `sdk.companies.createBulk(buffer)`.                      │
├─────────────────────────┼──────────────────────┼──────────────────────────────────────────────────────────┤
│ **Job Checkpointing**   │ Every 10% progress   │ Periodic single PUT `/jobs/:id/checkpoint`. Maximum one  │
│ (Progress, resume data) │ OR every 10 seconds  │ call per 5 seconds to stay well below rate limits.       │
├─────────────────────────┼──────────────────────┼──────────────────────────────────────────────────────────┤
│ **Immediate Critical**  │ Immediate (Inline)   │ Outbound email ledger (`email_deliveries`), automation   │
│ (Ledgers, Locks)        │                      │ locks (`/locks/acquire`), failure transitions.           │
├─────────────────────────┼──────────────────────┼──────────────────────────────────────────────────────────┤
│ **Best-Effort Logs**    │ Buffer 20 items      │ Batch flush via `sdk.systemLogs.createBulk(logBuffer)`.  │
│ (Worker telemetry)      │ OR process exit      │ Non-blocking fire-and-forget.                            │
└─────────────────────────┴──────────────────────┴──────────────────────────────────────────────────────────┘
```

---

## 3. Worker-by-Worker Refactoring Plan

### 3.1 `scraper.ts` (`scraper:maps`)
* **File:** `apps/desktop/src/main/workers/plugins/scraper.ts`
* **Current State:** Direct `better-sqlite3` queries inserting into `companies`, `contacts`, `discovery_runs`, and staging into `sync_queue`.
* **Refactoring Actions:**
  1. Remove `import Database from 'better-sqlite3'`.
  2. Instantiate `SdkClient` using `resolveWorkerApiUrl(ctx)` and worker authorization token.
  3. Pre-generate UUIDs for discovered companies (`companyId = generateEntityId()`) and contacts (`contactId = generateEntityId()`).
  4. Link contacts with `contact.companyId = companyId` locally.
  5. Accumulate discovered records in memory buffer (`const buffer: CompanyDto[] = []`).
  6. When buffer reaches 50 items (or on scraping page end):
     ```typescript
     await sdk.companies.createBulk(buffer);
     buffer.length = 0;
     ```
  7. On run finish:
     ```typescript
     await sdk.discovery.updateRun(discoveryRunId, {
       status: 'completed',
       resultCount: totalCount,
       finishedAt: new Date()
     });
     ```

---

### 3.2 `crawler.ts` (`crawler:website`)
* **File:** `apps/desktop/src/main/workers/plugins/crawler.ts`
* **Current State:** Writes raw HTML dumps into local SQLite `page_crawls` table and `sync_queue`.
* **Refactoring Actions:**
  1. Remove `better-sqlite3` dependency.
  2. Extract visible text signals and meta tags locally in the worker.
  3. Send metadata + extracted text to `sdk.pageCrawls.create(...)`.
  4. Raw HTML is retained in temporary local scratch files (`userData/temp-crawls/`) for the duration of the job, then discarded.

---

### 3.3 `enricher.ts` (`enrich:website`)
* **File:** `apps/desktop/src/main/workers/plugins/enricher.ts`
* **Current State:** Reads companies from SQLite; writes enriched emails, phones, and social links to SQLite `contacts` and `sync_queue`.
* **Refactoring Actions:**
  1. Remove `better-sqlite3`.
  2. Fetch target company data via `sdk.companies.get(companyId)`.
  3. Flush enriched contacts via `sdk.contacts.createBulk(enrichedContacts)`.

---

### 3.4 `outreach.ts` (`outreach:campaign`)
* **File:** `apps/desktop/src/main/workers/plugins/outreach.ts`
* **Current State:** Directly updates SQLite `email_deliveries`, `sequence_executions`, and `sequence_logs`.
* **Refactoring Actions:**
  1. Record pre-send ledger entry:
     ```typescript
     const delivery = await sdk.emailDeliveries.create({
       id: generateEntityId(),
       sequenceId,
       executionId,
       stepIndex,
       contactId,
       accountId,
       senderEmail,
       recipientEmail,
       subject,
       status: 'SENDING',
       idempotencyKey
     });
     ```
  2. Execute send via Google/SMTP.
  3. Immediately update delivery status:
     ```typescript
     await sdk.emailDeliveries.update(delivery.id, {
       status: 'SENT',
       providerMessageId: res.messageId,
       sentAt: new Date()
     });
     ```

---

### 3.5 `intelligence-worker.ts` (`enrich:intelligence`)
* **File:** `apps/desktop/src/main/workers/plugins/intelligence-worker.ts`
* **Current State:** Opens local SQLite DB, reads `companies`, `contacts`, `page_crawls`, and writes to `company_intelligence` and `opportunity_scores`.
* **Refactoring Actions:**
  1. Remove `better-sqlite3`.
  2. Fetch company and contacts via `sdk.companies.getWithContacts(companyId)`.
  3. Persist AI intelligence result:
     ```typescript
     await sdk.companyIntelligence.upsert(companyIntelligenceDto);
     await sdk.opportunityScores.upsert(opportunityScoreDto);
     ```

---

### 3.6 `automation.ts` (`automation:workflow`)
* **File:** `apps/desktop/src/main/workers/plugins/automation.ts`
* **Current State:** Directly queries `automation_locks`, `sequence_executions`, and `sequence_logs` in SQLite.
* **Refactoring Actions:**
  1. Distributed lock acquisition:
     ```typescript
     const lock = await sdk.locks.acquire({
       sequenceId,
       entityId,
       ownerId: `worker-${process.pid}`,
       leaseDurationMs: 60000
     });
     if (!lock.acquired) throw new Error('Lock busy');
     ```
  2. Update execution step status via `sdk.executions.update(executionId, { ... })`.
  3. Release lock on step completion or error:
     ```typescript
     await sdk.locks.release({ sequenceId, entityId, ownerId: `worker-${process.pid}` });
     ```

---

### 3.7 `linkedin.ts` (`enrich:linkedin`)
* **File:** `apps/desktop/src/main/workers/plugins/linkedin.ts`
* **Refactoring Actions:** Replace direct SQLite inserts with `sdk.contacts.update(contactId, linkedinData)`.

---

### 3.8 `imap-poller.ts` (`outreach:imap-poll`)
* **File:** `apps/desktop/src/main/workers/plugins/imap-poller.ts`
* **Refactoring Actions:** Replace SQLite updates with `sdk.outreach.recordReply(...)` and `sdk.executions.update(...)`.

---

## 4. Local Runtime State vs Persistent State

```text
┌───────────────────────────────────────────────┬───────────────────────────────────────────────┐
│ PERSISTENT BUSINESS DATA                      │ LOCAL RUNTIME ARTIFACTS                       │
│ (Must Go To MongoDB via API)                  │ (Legitimately Remains in Local Filesystem)     │
├───────────────────────────────────────────────┼───────────────────────────────────────────────┤
│ • Discovered Companies & Contacts             │ • Playwright Browser Profiles (Cookies, Auth) │
│ • Email Delivery Ledgers & Message IDs        │ • Chromium Executable Binaries                │
│ • Intelligence Scores & Facts                 │ • Temporary Screenshot / HTML Captures        │
│ • Job Progress & Checkpoints                  │ • Inter-Process Worker IPC Message Pipes      │
│ • Operational Telemetry & System Logs         │ • Local Crash Dumps & Diagnostic Traces       │
└───────────────────────────────────────────────┴───────────────────────────────────────────────┘
```

---

## 5. Worker Authentication & Security

1. Workers receive an ephemeral scoped JWT session token passed in `JobContext.payload._auth`.
2. All SdkClient requests initiated by the worker include:
   - Header: `Authorization: Bearer <workerJwt>`
   - Header: `X-Workspace-ID: <workspaceId>`
3. The API validates that the worker token possesses the `worker:execute` claim scoped to the target workspace.
