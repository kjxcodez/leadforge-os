# Phase 1 Forensic Document 23 — Prioritized Phase 2 Action Input

**Document Type:** Phase 2 Input Specification  
**Audited Against:** Verified Forensic Findings (F-01 through F-10)  
**Date:** September 2026  
**Status:** Authoritative Baseline  

---

## 1. P0 — Foundation Blockers

### Action 1.1: API Connection Guard & Degraded UI State (F-01)
- **Problem:** When API is down, app boots into a pseudo-healthy state, fails all hydration, and leaves UI empty.
- **Direction:** Implement pre-flight health check (`GET /api/v1/health`) during Electron startup. If unreachable, display a global "Offline / API Server Unreachable" banner and prevent active background polling.

### Action 1.2: Worker-to-Cache Real-Time Synchronization (F-02)
- **Problem:** Scraper and crawler workers write directly to MongoDB via SdkClient, leaving the desktop SQLite cache un-hydrated and UI blank.
- **Direction:** When worker operations complete or save new entities, emit an event or trigger targeted cache table hydration (`CacheHydrator.hydrateEntityTable('companies')`) to guarantee SQLite parity with MongoDB.

---

## 2. P1 — Core Product Blockers

### Action 2.1: Discovery Run Company Listing Reconciliation (F-03)
- **Problem:** `discovery:run:companies` IPC handler only falls back to API when SQLite row count is exactly 0. Stale cache prevents viewing new server leads.
- **Direction:** Reconcile `discovery:run:companies` to always query authoritative API or perform incremental synchronization rather than relying on stale SQLite cache.

### Action 2.2: Discovery UI Job Separation (F-04)
- **Problem:** Discovery UI iterates all background jobs and displays `enrich:intelligence`, `automation:workflow` as discovery runs.
- **Direction:** Scope Discovery UI list strictly to records from the canonical `discovery_runs` table / API endpoint.

### Action 2.3: Template Engine Location Variable Fix (F-05)
- **Problem:** `outreach.ts` assigns `companyRow.address`, which is undefined, breaking `{{company.location}}`.
- **Direction:** Update variable context mapping in `outreach.ts` to use `companyRow.location`.

### Action 2.4: SDK `URLSearchParams` Undefined Parameter Fix (F-06)
- **Problem:** `EmailDeliveriesModule` passes undefined parameters into `URLSearchParams`, serializing literal string `"undefined"` to API and returning 0 deliveries.
- **Direction:** Filter out `undefined` and `null` keys before constructing query strings across all SDK modules.

---

## 3. P2 — Important Defects & Efficiency

### Action 3.1: Adaptive Polling Backoff in JobScheduler (F-08)
- **Problem:** Fixed 3-second polling generates 20 requests/minute while idle.
- **Direction:** Implement adaptive polling: start at 3s, back off exponentially to 10s–15s when queue is empty, and reset to 1s–2s on job submission.

### Action 3.2: Campaign Status Auto-Sync to MongoDB (F-10)
- **Problem:** `crm.ts` auto-calculates campaign status and writes only to SQLite, causing status drift from MongoDB.
- **Direction:** Synchronize auto-calculated campaign status changes back to MongoDB via `sdk.campaigns.update()`.

### Action 3.3: Google Drive Dedicated UI Integration (F-07)
- **Problem:** Backend Drive v3 API is implemented, but UI lacks a dedicated Drive file picker/browser.
- **Direction:** Build a Drive file selector component in the Campaigns/Templates UI.

---

## 4. P3 — Polish & Cleanup

### Action 4.1: Clean Dead SDK Modules (F-09)
- **Problem:** `sdk.activities.list()` targets nonexistent `GET /api/v1/activities` endpoint.
- **Direction:** Mount activities route in API or remove unused SDK method.
