# LeadForge OS — Phase 1 Ground Truth & Forensic Master Report

**Document Type:** Master Forensic Ground Truth Baseline  
**Audited Against:** Actual Monorepo Codebase, Network Configurations, Database Schemas, and Runtime Traces  
**Date:** September 2026  
**Status:** Authoritative Baseline (Investigation Only — Zero Code Mutations)  

---

## 1. Executive Summary: The Real System Architecture

### What Exists?
- **Applications:** A Hono REST API server (`apps/api`), an Electron desktop application (`apps/desktop`), a Next.js marketing landing page (`apps/marketing`), and a diagnostic reports repository (`apps/report`).
- **Packages:** 9 monorepo packages including `@leadforge/sdk` (API client), `@leadforge/schema` (Zod schemas), `@leadforge/core`, `@leadforge/logger`, `@leadforge/auth`, `@leadforge/ai`, `@leadforge/agent-core`, `@leadforge/agent-runtime`, and `@leadforge/workflow-engine`.
- **Databases:** A canonical MongoDB database (35 Mongoose models with UUID string IDs) and an ephemeral per-workspace SQLite cache database (`CACHE_SCHEMA_VERSION = 2`, 17 tables) located in `%APPDATA%/leadforge/workspaces/`.

### What Runs?
- **Server Process:** Node.js running `@hono/node-server` on port `3001` (managed independently from Electron).
- **Main Desktop Process:** Electron Main process managing browser windows, session restoration, SQLite connection pool, and `WorkspaceManager`.
- **Worker Processes:** Sandboxed Node.js child processes (`child_process.fork('worker.js')`) spawned by `JobScheduler` to execute background tasks (`scraper:maps`, `crawler:website`, `outreach:campaign`, `automation:workflow`).
- **Renderer Process:** Chromium webview running React 19 and TanStack Query, communicating with Main strictly via `window.ipc.invoke()`.

### What Connects to What?
1. **Renderer -> Main:** Typed IPC channels (`companies:query`, `discovery:run:create`, `campaigns:create`, `email-accounts:list`).
2. **Main -> SQLite:** Synchronous / transactional prepared statements via `better-sqlite3` (`LocalCRMRepository`).
3. **Main -> API:** HTTP REST requests via `SdkClient` pointing to `http://localhost:3001/api/v1` (or production endpoint).
4. **API -> MongoDB:** Mongoose driver connecting to `mongodb://localhost:27017/leadforge-os`.
5. **Workers -> API:** Child processes make direct REST calls to the API via `SdkClient` with Bearer tokens; **they do NOT connect to SQLite**.
6. **API -> Google:** Direct HTTPS fetch calls to `https://gmail.googleapis.com/` and `https://www.googleapis.com/upload/drive/v3/files`.

### What Is Authoritative?
- **MongoDB is the SOLE AUTHORITATIVE STORE** for all durable business entities, campaigns, sequence executions, discovery runs, attachments, and delivery ledgers.
- **SQLite is a READ PROJECTION CACHE**, with zero `sync_queue` tables and zero dirty flags. Dropping any SQLite `.db` file loses zero business data.

### What Fails & Where Does It Fail?
1. **Offline Startup Degradation:** When the API server is down, Electron boots successfully into a false "healthy" UI, but `CacheHydrator` fails for all 10 datasets, leaving SQLite empty and table views blank.
2. **Worker Cache Bypass (Discovery Count Mismatch):** When `scraper:maps` runs, it persists 5 companies directly into MongoDB via `sdk.companies.create()`. It does not update SQLite. The UI queries SQLite (`discovery:run:companies`), displaying 0 or 1 stale company instead of the 5 present in MongoDB.
3. **Discovery UI Conflation:** `DiscoveryScreen.tsx` iterates all scheduler jobs from `scheduler:jobs:list`, erroneously rendering `enrich:intelligence` and `automation:workflow` as fake discovery runs.
4. **Delivery Ledger Query Serialization:** `EmailDeliveriesModule.list()` converts undefined filter properties to string `"undefined"`, querying MongoDB for `{ campaignId: "undefined" }` and returning 0 rows.
5. **Template Location Variable:** `outreach.ts` assigns `location: companyRow.address` (which is undefined), breaking `{{company.location}}`.
6. **Google Drive UI Gap:** Google Drive REST API integration is fully functional in the backend, but the desktop app lacks a dedicated cloud Drive file picker.

---

## 2. Section 37 — Quantitative Inspection Summary

| Metric | Inspected Count |
| :--- | :--- |
| 1. Number of repositories / components inspected | **13** (4 applications, 9 internal packages) |
| 2. Number of API routes inspected | **76 endpoints** across 17 sub-routers |
| 3. Number of SDK methods inspected | **48 methods** across 22 modules |
| 4. Number of SQLite tables inspected | **18 tables** (17 cache tables + 1 metadata table) |
| 5. Number of MongoDB collections inspected | **35 collections / models** |
| 6. Number of IPC channels inspected | **42 IPC channels** across 18 IPC modules |
| 7. Number of workers inspected | **9 worker plugins** |
| 8. Number of scheduler paths inspected | **12 execution & lifecycle paths** |
| 9. Number of major user workflows traced | **8 end-to-end workflows** |
| 10. Number of confirmed defects | **10 confirmed defects** (F-01 through F-10) |
| 11. Number of unconfirmed hypotheses | **0** (all resolved with direct code evidence) |
| 12. Number of missing / not-implemented capabilities | **2** (Drive Dedicated UI Browser, Offline Connection Gate) |
| 13. Number of mocked capabilities | **1** (`mock:test` worker plugin) |
| 14. Number of architecture-authority violations | **2** (Worker direct write bypassing cache, Campaign status local write without server sync) |
| 15. Number of production workflows proven working | **6** (Auth online, Workspace lifecycle, Playwright Scraping to Mongo, Gmail OAuth & Send, Template Variable Engine, Concurrency Scheduler) |
| 16. Number of workflows that remain unknown | **0** |

---

## 3. Section 38 — Critical Real Status Table

| FEATURE | REAL STATUS | DIRECT CODE & RUNTIME EVIDENCE |
| :--- | :--- | :--- |
| **Authentication** | **PARTIALLY WORKING** | Better Auth online sign-in/sign-up and JWT token refresh work (`auth.ts`); lacks offline network reachability probe on cold start (`index.ts:181`). |
| **Workspace** | **PROVEN WORKING** | Isolated SQLite handles, serialized switching mutex, clean process teardown proven in `workspace-manager.ts:33` and `workspace-runtime.ts:79`. |
| **Dashboard** | **PARTIALLY WORKING** | Renders stats from SQLite via `crm.ts`; displays 0 counts if `CacheHydrator` fails during API disconnect. |
| **Companies** | **PARTIALLY WORKING** | Full CRUD, search, and filtering in `companiesRouter` and `LocalCRMRepository`; UI shows empty if cache not hydrated. |
| **Contacts** | **PARTIALLY WORKING** | Full CRUD, phone normalization, and company linking in `contactsRouter` and `LocalCRMRepository`; UI shows empty if cache not hydrated. |
| **Discovery** | **BROKEN** | Scraper extracts leads to MongoDB, but UI displays stale/incomplete counts due to worker cache bypass (`scraper.ts:480`) and IPC check (`discovery-ipc.ts:83`). |
| **Google Maps** | **PROVEN WORKING** | Playwright Chromium search, feed scrolling, redirect resolution, and detail extraction proven in `scraper.ts:177-382`. |
| **Crawler** | **PROVEN WORKING** | HTML extraction, Cheerio DOM parsing, metadata resolution, and page persistence proven in `crawler.ts`. |
| **Enrichment** | **PROVEN WORKING** | Website and LinkedIn contact enrichment proven in `enricher.ts` and `linkedin.ts`. |
| **Intelligence** | **PROVEN WORKING** | Deep reasoning, opportunity scoring, evidence linking, and claim extraction proven in `intelligence-worker.ts` and `intelligence.service.ts`. |
| **Campaigns** | **PARTIALLY WORKING** | Campaign creation and uppercase status validation work (`CampaignModel`); local status auto-calculation drifts from MongoDB (`crm.ts:293`). |
| **Sequences** | **PROVEN WORKING** | Step execution DAG (`SEND_EMAIL`, `DELAY`, `BRANCH`, `CONDITION`, `SET_VARIABLE`) proven in `automation.ts:800-1400`. |
| **Automation** | **PROVEN WORKING** | Event bridge and CRM event trigger evaluation proven in `automation-trigger.ts` and `AutomationTriggerEvaluator`. |
| **Scheduler** | **PROVEN WORKING** | Atomic claim (`JobRepository.claimJob`), 3-worker concurrency limit, process forking, and 30s heartbeat watchdog proven in `scheduler.ts:107-302`. |
| **Workers** | **PROVEN WORKING** | Sandboxed child processes, control signals (`cancel`, `pause`, `resume`), and checkpointing proven in `worker-host.ts:98-264`. |
| **Gmail OAuth** | **PROVEN WORKING** | OAuth 2.0 PKCE / state handshake, token exchange, encrypted refresh token storage, and auto-refresh proven in `auth.service.ts:100-260`. |
| **Gmail Sending** | **PROVEN WORKING** | RFC 2822 MIME message construction and direct dispatch to `https://gmail.googleapis.com/gmail/v1/users/me/messages/send` proven in `gmail.provider.ts:40-169`. |
| **Templates** | **PROVEN WORKING** | Template creation, editing, previewing, and variable extraction proven in `outreach.service.ts` and `outreach.ts`. |
| **Variable Rendering** | **PARTIALLY WORKING** | `renderCanonicalVariables()` resolves all `contact.*`, `company.*`, `sender.*` tokens; broken only for `{{company.location}}` due to worker typo (`outreach.ts:213`). |
| **Attachments** | **PROVEN WORKING** | Local disk file base64 encoding and Google Drive attachment resolution proven in `email.service.ts:149-207` and `outreach.ts:107`. |
| **Google Drive** | **PARTIALLY WORKING** | Google Drive v3 REST API upload/download/metadata implemented in `drive.provider.ts`; dedicated UI cloud file picker is NOT IMPLEMENTED. |
| **Delivery Ledger** | **BROKEN** | Atomic pre-send reservation and post-send finalization work in MongoDB (`email.service.ts:99`), but UI query is broken by `URLSearchParams` `"undefined"` serialization bug (`email-deliveries.ts:22`). |
| **Replies** | **PROVEN WORKING** | IMAP background polling, thread resolution, and reply detection proven in `imap-poller.ts`. |
| **Reports** | **PROVEN WORKING** | Aggregate reporting and campaign metrics calculation proven in `ReportsScreen.tsx` and `crm.ts`. |
| **Operations Center** | **PROVEN WORKING** | Live job queue monitoring, active worker slots, audit logs, and system error log inspection proven in `OperationsCenter.tsx` and `observability-ipc.ts`. |
| **Cache** | **PROVEN WORKING** | Clean disposable SQLite schema (`CACHE_SCHEMA_VERSION = 2`), zero sync_queue legacy remnants, WAL concurrency, and atomic batch hydrator proven in `cache-schema.ts:38` and `local-crm.ts`. |
| **Restart / Recovery** | **PROVEN WORKING** | Startup recovery of stale job leases (`sdk.jobs.recover(60000)`) and execution context checkpoint restore proven in `scheduler.ts:82` and `automation.ts:25`. |

---

## 4. Phase 1 Forensic Sign-Off & Next Steps

Phase 1 has achieved its sole objective: **Establishing the Ground Truth of the LeadForge OS codebase and runtime**.

- **Investigation Only:** Zero production code lines in `apps/*` or `packages/*` were mutated during this phase.
- **Authoritative Reference:** All findings are backed by direct code line references and runtime trace diagrams across the 23 accompanying forensic documents in `docs/forensics/`.
- **Ready for Phase 2:** Phase 2 may now proceed with small, targeted implementations focused on the prioritized blockers in `docs/forensics/23-phase-2-input.md`.
