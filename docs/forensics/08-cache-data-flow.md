# Phase 1 Forensic Document 08 — Cache Read/Write Graph & Data Flow

**Document Type:** Forensic Data Flow Architecture  
**Audited Against:** Runtime Code Paths (`CacheHydrator`, `LocalCRMRepository`, IPC Handlers, Worker Plugins)  
**Date:** September 2026  
**Status:** Authoritative Baseline  

---

## 1. System Data Flow Diagram

```mermaid
flowchart TD
    subgraph Server [Authoritative Server / Cloud]
        Mongo[(MongoDB Authority)]
        HonoAPI[Hono REST API /api/v1]
        Mongo <--> HonoAPI
    end

    subgraph ElectronMain [Electron Main Process]
        Hydrator[CacheHydrator]
        SQLite[(SQLite Cache DB)]
        IPCHandlers[IPC Handlers]
        Scheduler[JobScheduler]
    end

    subgraph WorkerProcess [Worker Child Process]
        Worker[Worker Plugins (Scraper/Crawler/Outreach)]
    end

    subgraph RendererUI [Renderer UI]
        ReactUI[React 19 Screens]
    end

    %% Read Path 1: Startup Hydration
    HonoAPI -- "1. HTTP GET /companies (Batch 100)" --> Hydrator
    Hydrator -- "2. saveManyFromServer()" --> SQLite

    %% Read Path 2: UI Query
    ReactUI -- "3. window.ipc.invoke('companies:query')" --> IPCHandlers
    IPCHandlers -- "4. SELECT * FROM companies" --> SQLite
    SQLite -- "5. Return cached rows" --> ReactUI

    %% Write Path 1: User UI Action (e.g. Create Company)
    ReactUI -- "6. window.ipc.invoke('companies:create')" --> IPCHandlers
    IPCHandlers -- "7. sdk.companies.create()" --> HonoAPI
    HonoAPI -- "8. Mongoose create()" --> Mongo
    IPCHandlers -- "9. saveFromServer() on success" --> SQLite

    %% Write Path 2: Worker Execution (THE DISCONNECT)
    Scheduler -- "10. /jobs/claim" --> HonoAPI
    Scheduler -- "11. fork(worker.js)" --> Worker
    Worker -- "12. sdk.companies.create()" --> HonoAPI
    HonoAPI -- "13. Mongoose create()" --> Mongo
    Worker -. "❌ Bypasses SQLite Cache" .-> SQLite
```

---

## 2. Detailed Data Flow Paths

### Path A: Startup Cache Hydration Flow
1. `WorkspaceRuntime.start()` initiates `CacheHydrator.hydrateWorkspaceCache(workspaceId, sdk)`.
2. `CacheHydrator` queries 10 entity endpoints in batches of 100 via `SdkClient`.
3. Server returns canonical JSON documents with string `_id` identity.
4. `LocalCRMRepository.saveManyFromServer(table, records)` executes atomic SQLite batch transaction `INSERT OR REPLACE INTO table`.
5. Upon completion, broadcasts `sync:completed` to active browser windows.

### Path B: Renderer UI Direct Mutation Flow
1. User clicks "Create Company" or "Update Campaign" in UI.
2. Renderer calls `window.ipc.invoke('companies:create', payload)`.
3. Main IPC handler calls `sdk.companies.create(payload)`.
4. API persists document in MongoDB and returns created document.
5. IPC handler updates local SQLite cache: `await LocalCRMRepository.saveFromServer('companies', created)`.
6. IPC returns created record to Renderer; TanStack Query invalidates queries.

### Path C: Background Worker Mutation Flow (The Disconnect)
1. `JobScheduler` claims job from API and forks child worker process.
2. Worker plugin (e.g. `scraper:maps`, `crawler:website`) discovers leads.
3. Worker calls `sdk.companies.create(...)` and `sdk.companyDiscoveryRuns.create(...)`.
4. API persists companies into MongoDB.
5. **The Disconnect:** The worker does NOT have access to Main's `LocalCRMRepository` or SQLite database handle. It writes **strictly to the API/MongoDB**.
6. **Result:** SQLite cache remains un-updated until the next full cache hydration cycle or manual page refresh with fallback triggers.

---

## 3. Cache Staleness & Invalidation Vulnerabilities

1. **Worker-to-Cache Lag:** When a scraper job runs and creates 5 companies in MongoDB, SQLite contains 0 of these companies until a hydration event occurs.
2. **IPC Query Stagnation:** In `discovery-ipc.ts:83` (`discovery:run:companies`), SQLite is queried first. If SQLite has even 1 stale record, the fallback fetch from API is skipped, causing the UI to display 1 company instead of the 5 present in MongoDB.
