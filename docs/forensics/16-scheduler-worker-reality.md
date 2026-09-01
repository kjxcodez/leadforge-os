# Phase 1 Forensic Document 16 — Scheduler & Worker Reality Audit

**Document Type:** Forensic Concurrency & Polling Audit  
**Audited Against:** `apps/desktop/src/main/services/scheduler.ts`, `apps/api/src/routes/jobs.ts`, `apps/desktop/src/main/workers/worker-host.ts`  
**Date:** September 2026  
**Status:** Authoritative Baseline  

---

## 1. Polling Metrics & Measurement

| Metric | Measurement / Observed Value | Code Evidence |
| :--- | :--- | :--- |
| **Polling Interval** | Exactly `3000 ms` (3 seconds) | [`scheduler.ts:107-111`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/scheduler.ts#L107-L111) |
| **Idle Request Rate** | **20 HTTP requests / minute** per active workspace runtime | Computed: `60s / 3s = 20 req/min` |
| **Target Endpoint** | `POST /api/v1/jobs/claim` | `sdk.jobs.claim()` |
| **Payload Size** | ~350 bytes (`{ supportedTypes: [...], workerId: "desktop-..." }`) | `scheduler.ts:187-188` |
| **Empty Response Percentage (Idle)** | **100%** (returns `{ success: true, data: null }`) | `jobs.ts:49` |
| **Max Global Concurrency** | **3 active child workers** | [`scheduler.ts:207`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/scheduler.ts#L207) |
| **Per-Type Concurrency Limit** | `scraper:maps` = 1, `crawler:website` = 2, `enrich:intelligence` = 2, `outreach:campaign` = 2, `automation:workflow` = 2 | `scheduler.ts:208-215` |
| **Heartbeat Interval / Timeout** | Heartbeat check every 10s / Hard kill after 30s timeout | [`scheduler.ts:56-58`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/scheduler.ts#L56-L58) |

---

## 2. Worker Lifecycle & Process Isolation

```mermaid
flowchart TD
    Main[Electron Main Process / Scheduler]
    API[Hono REST API / MongoDB]
    Worker[Child Process: worker.js]

    Main -- "1. POST /jobs/claim (every 3s)" --> API
    API -- "2. Atomic Claim (status -> 'starting')" --> Main
    Main -- "3. child_process.fork(worker.js)" --> Worker
    Worker -- "4. IPC: { type: 'ready' }" --> Main
    Main -- "5. POST /jobs/:id/status (status -> 'running')" --> API
    Main -- "6. IPC: { command: 'start', payload }" --> Worker
    
    loop Heartbeat Watchdog
        Main -- "7. IPC: { command: 'ping' }" --> Worker
        Worker -- "8. IPC: { type: 'pong' }" --> Main
        Main -- "9. POST /jobs/:id/heartbeat" --> API
    end

    alt Success
        Worker -- "10a. IPC: { type: 'success', result }" --> Main
        Main -- "11a. POST /jobs/:id/complete" --> API
    else Crash / Error
        Worker -- "10b. IPC: { type: 'error', error }" --> Main
        Main -- "11b. POST /jobs/:id/fail (or retry)" --> API
    end
```

---

## 3. Concurrency & Safety Guarantees

1. **Atomic Claiming:** `JobRepository.claimJob()` uses MongoDB's `findOneAndUpdate` with query conditions on `status: { $in: ['queued', 'retrying'] }`. Two desktop clients or schedulers cannot claim the same job.
2. **Crash Recovery on Startup:** When `WorkspaceRuntime` starts, `JobScheduler` calls `sdk.jobs.recover(60000)` to reset jobs whose leases expired due to previous unclean shutdowns.
3. **Heartbeat Protection:** If a Playwright scraper or crawler worker stalls (e.g. frozen browser or CPU deadlock), the scheduler's 30s watchdog sends `SIGKILL` and marks the job failed or scheduled for retry.

---

## 4. Assessment

The scheduler mechanism is **FUNCTIONAL AND ATOMICALLY CORRECT**, but **INEFFICIENT UNDER IDLE CONDITIONS** due to the fixed 3-second polling interval creating 20 requests/minute per desktop client when no work is queued.
