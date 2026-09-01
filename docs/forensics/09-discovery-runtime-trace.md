# Phase 1 Forensic Document 09 — Discovery Runtime Trace

**Document Type:** Forensic Subsystem Runtime Trace  
**Audited Against:** `DiscoveryScreen.tsx`, `discovery-ipc.ts`, `scraper.ts`, `business.ts`, `JobScheduler`  
**Date:** September 2026  
**Status:** Authoritative Baseline  

---

## 1. End-to-End Discovery Pipeline Sequence

```mermaid
sequenceDiagram
    autonumber
    participant UI as DiscoveryScreen (Renderer)
    participant IPC as Main IPC (discovery-ipc.ts)
    participant API as Hono REST API
    participant Mongo as MongoDB
    participant SQLite as Local SQLite DB
    participant Sched as JobScheduler
    participant Worker as Scraper Worker (scraper.ts)
    participant Playwright as Playwright Chromium

    UI->>IPC: window.ipc.invoke('discovery:run:create', { query, country, state, city, maxResults })
    IPC->>API: sdk.discovery.createRun(...)
    API->>Mongo: DiscoveryRunModel.create({ status: 'running', ... })
    Mongo-->>API: Created DiscoveryRun doc
    API-->>IPC: Return created DiscoveryRun
    IPC->>SQLite: LocalCRMRepository.saveFromServer('discovery_runs', created)
    IPC->>API: sdk.jobs.create({ type: 'scraper:maps', payload: { discoveryRunId, ... } })
    API->>Mongo: JobModel.create({ status: 'queued', ... })
    IPC-->>UI: Return created DiscoveryRun

    Note over Sched,API: Scheduler Tick (every 3000ms)
    Sched->>API: sdk.jobs.claim(['scraper:maps', ...])
    API->>Mongo: atomicFindOneAndUpdate({ status: 'queued' -> 'starting' })
    Mongo-->>API: Claimed Job doc
    API-->>Sched: Claimed Job
    Sched->>Worker: fork(worker.js) -> send({ command: 'start', payload })

    Worker->>Playwright: chromium.launch() -> page.goto(maps.google.com)
    Playwright-->>Worker: Stream extracted place URLs & business details
    loop For each extracted business
        Worker->>API: sdk.companies.create({ id, name, domain, location, status: 'LEAD' })
        API->>Mongo: CompanyModel.create()
        Worker->>API: sdk.companyDiscoveryRuns.create({ discoveryRunId, companyId })
        API->>Mongo: CompanyDiscoveryRunModel.create()
        Worker->>API: sdk.jobs.create({ type: 'crawler:website', payload: { companyId, website } })
        API->>Mongo: JobModel.create({ type: 'crawler:website' })
    end
    Worker->>API: sdk.discovery.updateRun(discoveryRunId, { status: 'completed', resultCount: N })
    Worker-->>Sched: send({ type: 'success' })
    Sched->>API: sdk.jobs.complete(jobId)

    Note over UI,SQLite: UI Polls Results (every 2500ms)
    UI->>IPC: window.ipc.invoke('discovery:run:companies', { runId })
    IPC->>SQLite: SELECT FROM companies JOIN company_discovery_runs WHERE runId = ?
    alt SQLite Has 0 Rows
        IPC->>API: sdk.discovery.listCompaniesForRun(runId)
        API->>Mongo: CompanyDiscoveryRunModel.find() + CompanyModel.find()
        Mongo-->>API: Return all N companies
        API-->>IPC: Return N companies
        IPC->>SQLite: saveManyFromServer('companies'), saveManyFromServer('company_discovery_runs')
        IPC-->>UI: Return N companies (Correct)
    else SQLite Has 1 Stale Row
        SQLite-->>IPC: Returns 1 row
        IPC-->>UI: Returns 1 row (API call skipped -> STALE / INCOMPLETE)
    end
```

---

## 2. Forensic Trace Breakdown

### 1. Run Creation
- **Trigger:** User fills form on `DiscoveryScreen.tsx` and clicks "New Discovery Run".
- **Handler:** [`apps/desktop/src/main/ipc/discovery-ipc.ts:7-58`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/discovery-ipc.ts#L7-L58).
- **API Persistence:** Creates `DiscoveryRunModel` in MongoDB (`status: 'running'`).
- **Cache Persistence:** Calls `LocalCRMRepository.saveFromServer('discovery_runs', created)` in SQLite.
- **Job Creation:** Enqueues `scraper:maps` job via `sdk.jobs.create()`.

### 2. Job Scheduling & Worker Execution
- **Polling:** `JobScheduler` claims the job via `POST /api/v1/jobs/claim`.
- **Worker Fork:** Spawns `worker.js` with `type: 'scraper:maps'`.
- **Plugin:** [`apps/desktop/src/main/workers/plugins/scraper.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/scraper.ts).
- **Extraction:** Playwright navigates to Google Maps, scrolls result feed, extracts details (name, domain, phone, address).

### 3. Business Lead Persistence
- **Company Save:** Calls `sdk.companies.create()` (persisted in MongoDB `companies` collection).
- **Run Junction Save:** Calls `sdk.companyDiscoveryRuns.create()` (persisted in MongoDB `company_discovery_runs` collection).
- **Crawler Chaining:** If website/domain present, enqueues `crawler:website` job in MongoDB.
- **Status Finalization:** Calls `sdk.discovery.updateRun(runId, { status: 'completed', resultCount: storedCount })`.

### 4. UI Query & Count Discrepancy Cause
- **Query Channel:** `discovery:run:companies` in [`discovery-ipc.ts:83-122`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/discovery-ipc.ts#L83-L122).
- **Mechanism:** Executes SQLite query `SELECT DISTINCT c.* FROM companies c INNER JOIN company_discovery_runs cdr ON c.id = cdr.companyId WHERE cdr.discoveryRunId = ?`.
- **Root Cause of Count Mismatch:** If SQLite only contains 1 cached row (e.g. from an initial partial write), `rows.length` is 1, so the `if (!rows || rows.length === 0)` fallback check does NOT trigger. The IPC returns only that 1 row, hiding the remaining 4 companies stored in MongoDB.
