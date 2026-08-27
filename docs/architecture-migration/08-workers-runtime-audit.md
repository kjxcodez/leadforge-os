# LeadForge OS — Workers & Runtime Forensic Audit

## 1. Overview & Worker Inventory
LeadForge OS uses background workers orchestrated by the desktop main process to execute CPU-intensive, long-running processing (web scraping, crawler, lead intelligence, outreach execution, and email polling).

All worker plugins are located in [`apps/desktop/src/main/workers/plugins/`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins):

| Worker Plugin | File | Size | Purpose & Technologies | Current Persistence Methods |
| :--- | :--- | :--- | :--- | :--- |
| **`automation.ts`** | [`plugins/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/automation.ts) | 104.6 KB | Workflow DAG step executor & sequence engine | Reads/writes `sequence_executions`, `sequence_logs`, `jobs` in SQLite directly |
| **`scraper.ts`** | [`plugins/scraper.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/scraper.ts) | 24.0 KB | Playwright web scraper for Google Maps / Search | Reads/writes `discovery_results`, `companies`, `contacts` in SQLite directly |
| **`crawler.ts`** | [`plugins/crawler.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/crawler.ts) | 19.4 KB | Website HTML crawler and extract signals | Writes HTML to `page_crawls` in SQLite directly |
| **`enricher.ts`** | [`plugins/enricher.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/enricher.ts) | 14.1 KB | Lead enrichment & social profile resolution | Writes `contacts`, `companies` in SQLite directly |
| **`outreach.ts`** | [`plugins/outreach.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/outreach.ts) | 15.8 KB | Outbound email sender (SMTP/Gmail API) | Writes `email_deliveries`, `sequence_executions` in SQLite directly |
| **`linkedin.ts`** | [`plugins/linkedin.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/linkedin.ts) | 10.4 KB | Playwright browser automation for LinkedIn | Writes `contacts`, `companies` in SQLite directly |
| **`intelligence-worker.ts`**|[`plugins/intelligence-worker.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/intelligence-worker.ts)| 10.7 KB | AI scoring & lead intelligence evaluation | Writes `company_intelligence`, `opportunity_scores` in SQLite |
| **`imap-poller.ts`** | [`plugins/imap-poller.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/imap-poller.ts) | 12.0 KB | IMAP reply detector & sentiment analysis | Writes `outreach`, `sequence_executions` in SQLite |

---

## 2. Job Scheduler Analysis (`JobScheduler`)
Located in [`apps/desktop/src/main/services/scheduler.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/scheduler.ts#L50-L500):
* **State Storage:** SQLite `jobs` table (`status: 'queued' | 'running' | 'completed' | 'failed'`).
* **Concurrency Control:** Limits concurrent job execution per workspace.
* **Checkpointing:** Saves progress checkpoints (`checkpointData` JSON) into `jobs` table.

---

## 3. Persistent Business Storage vs Local Runtime Artifacts

To prevent local worker state from re-introducing local-first persistence, we explicitly classify worker data:

### 3.1 MUST BE PERSISTED IN MONGODB (via API)
* Discovery runs & discovery results (`discovery_runs`, `company_discovery_runs`)
* Crawled company & contact records (`companies`, `contacts`)
* AI intelligence summaries & opportunity scores (`company_intelligence`, `opportunity_scores`)
* Provenance evidence & claims (`intelligence_evidence`, `intelligence_claims`)
* Execution logs & email delivery ledgers (`sequence_logs`, `email_deliveries`)
* Job queue status & progress (`jobs`)

### 3.2 LEGITIMATELY REMAINS LOCAL RUNTIME STATE
* Playwright browser profiles / user data dir (`userData/playwright-profiles/`)
* Temporary downloaded page screenshots / PDFs (`userData/temp-captures/`)
* In-memory worker thread message queues (`worker_threads` IPC)
* Playwright Chromium executable binaries

---

## 4. Target Worker Architecture Shift

```text
CURRENT (INCORRECT)
Worker ──> SQLite ──> SyncEngine ──> API ──> MongoDB

TARGET (CORRECT)
Worker ──> SdkClient ──> API ──> MongoDB ──> SQLite Cache Hydration
```

Workers will make HTTP requests via `SdkClient` directly to the API, persisting all business data directly in MongoDB.
