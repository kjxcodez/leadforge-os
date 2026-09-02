# Phase 1 Forensic Document 01 — Repository Inventory

**Document Type:** Forensic Baseline  
**Audited Against:** Actual Workspace Source Files  
**Date:** September 2026  
**Status:** Authoritative Baseline  

---

## 1. Monorepo Architecture Overview

LeadForge OS is organized as a pnpm workspace with Turborepo (`turbo.json`) containing 4 applications and 9 internal packages.

```
leadforge-os/
├── apps/
│   ├── api/                    # Hono REST API server (Node.js runtime, MongoDB authority)
│   ├── desktop/                # Electron + React desktop client (Main, Preload, Renderer)
│   ├── marketing/              # Next.js marketing and download site
│   └── report/                 # Test reporting and diagnostic output storage
├── packages/
│   ├── agent-core/             # Agent execution primitives and abstractions
│   ├── agent-runtime/          # Runtime coordinator for autonomous agents
│   ├── ai/                     # AI provider clients (Ollama, OpenRouter, Mock) and prompt templates
│   ├── auth/                   # Authentication types, hashing, and Better Auth configuration
│   ├── core/                   # Shared validation utilities, date helpers, pagination, and env schema
│   ├── logger/                 # Pino logger configuration
│   ├── schema/                 # Canonical Zod schemas and TypeScript domain types
│   ├── sdk/                    # Typed REST API client for Hono backend
│   └── workflow-engine/        # Graph workflow execution and DAG abstractions
├── scripts/                    # Release gates, doctor, migration utilities, and test suites
└── docs/                       # Architecture specifications, migration notes, and forensics
```

---

## 2. Comprehensive Subsystem Inventory

| Subsystem | Primary Path | Runtime Process | Authoritative Source | Current Implementation Status | Evidence / Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **API Server Entrypoint** | [`apps/api/src/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/index.ts) | Node.js (Port 3001) | MongoDB | Implemented | Uses `@hono/node-server`, binds to `env.PORT` (3001). Connects to MongoDB via Mongoose. |
| **API Routers & Endpoints** | [`apps/api/src/routes/`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/) | Node.js | MongoDB | Implemented | 17 sub-routers: `companies`, `contacts`, `campaigns`, `outreach`, `workspaces`, `automation`, `email`, `google-connections`, `attachments`, `discovery-runs`, `company-discovery-runs`, `audiences`, `jobs`, `automation-locks`, `email-deliveries`, `intelligence`, `workspace-memory`. |
| **Electron Main Entrypoint** | [`apps/desktop/src/main/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/index.ts) | Electron Main Process | N/A (Process Orchestrator) | Implemented | Initializes session, SQLite schema, SdkClient, Playwright browsers, IPC coordinator, and boots active workspace. |
| **Workspace Runtime Supervisor** | [`apps/desktop/src/main/lib/workspace-manager.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/lib/workspace-manager.ts) | Electron Main Process | In-Memory / Config | Implemented | Serializes workspace transitions, enforces single active `WorkspaceRuntime`. |
| **Workspace Runtime Instance** | [`apps/desktop/src/main/lib/workspace-runtime.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/lib/workspace-runtime.ts) | Electron Main Process | MongoDB via SDK | Implemented | Connects to isolated SQLite DB, runs `initCacheSchema`, spawns `JobScheduler`, fires `CacheHydrator.hydrateWorkspaceCache()`, starts `EventBridge` and `AutomationTriggerEvaluator`. |
| **Cache Hydrator** | [`apps/desktop/src/main/services/cache-hydrator.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/cache-hydrator.ts) | Electron Main Process | MongoDB (Source) -> SQLite (Target) | Implemented (Degrades on API Down) | Asynchronously pulls 10 entity datasets from Hono API into SQLite in batches of 100. Catches fetch errors and logs warning without blocking startup. |
| **SQLite Cache Repository** | [`apps/desktop/src/main/database/repositories/local-crm.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/repositories/local-crm.ts) | Electron Main Process | SQLite | Implemented | `LocalCRMRepository` executes prepared statements with JSON deserialization (`JSON_COLUMNS`). Writes are direct `INSERT OR REPLACE`. |
| **Job Scheduler** | [`apps/desktop/src/main/services/scheduler.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/scheduler.ts) | Electron Main Process | MongoDB (`/jobs/claim`) | Implemented | Polls every 3000ms via `this.sdk.jobs.claim()`. Dispatches claimed jobs into child processes with concurrency limit (3 global). Heartbeat watchdog (10s interval / 30s timeout). |
| **Worker Host** | [`apps/desktop/src/main/workers/worker-host.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/worker-host.ts) | Node.js Child Process (`child_process.fork`) | MongoDB via SDK | Implemented | Runs registered job plugins (`scraper:maps`, `crawler:website`, `enrich:website`, `enrich:linkedin`, `enrich:intelligence`, `outreach:campaign`, `automation:workflow`, `outreach:imap-poll`, `mock:test`). Communicates with Main via IPC. |
| **Scraper Plugin** | [`apps/desktop/src/main/workers/plugins/scraper.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/scraper.ts) | Worker Process | API/MongoDB | Implemented | Uses Playwright Chromium to search Google Maps, extract business listings, resolve websites, and save directly to MongoDB via `sdk.companies.create` and `sdk.companyDiscoveryRuns.create`. |
| **Outreach Dispatcher Plugin** | [`apps/desktop/src/main/workers/plugins/outreach.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/outreach.ts) | Worker Process | API/MongoDB | Implemented | Iterates contacts, builds `CanonicalVariableContext`, calls `renderCanonicalVariables()`, and dispatches via `sdk.outreach.sendEmail()`. |
| **Automation Workflow Plugin** | [`apps/desktop/src/main/workers/plugins/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/automation.ts) | Worker Process | API/MongoDB | Implemented | Interprets sequence DAG steps (`SEND_EMAIL`, `DELAY`, `BRANCH`, `CONDITION`, `SET_VARIABLE`), evaluates expressions, and updates execution state. |
| **Gmail OAuth & Sending** | [`apps/api/src/services/google/`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/services/google/) | Node.js (API) | MongoDB & Google REST APIs | Implemented | `auth.service.ts` handles Google OAuth token exchange and refresh. `gmail.provider.ts` constructs raw MIME messages via `mime-builder.ts` and calls `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`. |
| **Google Drive Provider** | [`apps/api/src/services/google/drive.provider.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/services/google/drive.provider.ts) | Node.js (API) | Google Drive v3 REST API | Implemented (Backend Only) | `uploadFile` (multipart), `downloadFile`, `getFileMetadata`, `verifyAccess`. Note: UI lacks a Drive file picker. |
| **Template Variable Engine** | [`packages/sdk/src/utils/variable-resolver.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/utils/variable-resolver.ts) | Main / Worker / API | N/A (Pure Function) | Implemented | Resolves tokens (`contact.*`, `company.*`, `sender.*`, `sequence.*`, `workspace.*`, `execution.*`, `variables.*`, legacy aliases) and converts plain text to safe HTML via `formatEmailBody()`. |
| **Delivery Ledger** | [`apps/api/src/repositories/email-delivery/`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/repositories/email-delivery/) | Node.js (API) | MongoDB (`email_deliveries`) | Implemented | Pre-send atomic reservation via `reserveDelivery()`, status finalization via `finalizeDelivery()`, ambiguous state handling, and retry tracking. |
| **Desktop IPC Registry** | [`apps/desktop/src/main/ipc/`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/) | Electron Main Process | SQLite & SdkClient | Implemented | 18 IPC modules registering handlers for CRM, discovery, campaigns, outreach, scheduler, automation, auth, and database operations. |
| **Renderer Application** | [`apps/desktop/src/renderer/`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/) | Chromium Renderer | React 19 + TanStack Query | Implemented | Screens: `DashboardScreen`, `CompaniesScreen`, `ContactsScreen`, `DiscoveryScreen`, `CampaignsScreen`, `ReportsScreen`, `OperationsCenter`, `SettingsScreen`. Communicates via `window.ipc.invoke()`. |
| **SDK Client** | [`packages/sdk/src/`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/) | Universal (Node / Browser) | Hono REST API | Implemented | 22 API client modules wrapping `HttpClient` with token injection and workspace headers. |
| **Canonical Schemas** | [`packages/schema/src/`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/schema/src/) | Universal | N/A | Implemented | Zod schemas and entity definitions for Companies, Contacts, Campaigns, Sequences, Executions, Deliveries, Templates, Accounts, Jobs, and Workspaces. |
| **MongoDB Models** | [`apps/api/src/db/models/`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/db/models/) | Node.js (API) | MongoDB | Implemented | 35 Mongoose models matching canonical domain schemas with string `_id` identity. |
| **Diagnostic Scripts** | [`scripts/`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/scripts/) | Node.js CLI | Local / Hybrid | Historical / Diagnostic | 46 scripts including phase verification tests, MongoDB probe, SQLite migration, and health diagnostics. |

---

## 3. Findings & Inventory Discrepancies

1. **API Process Independence**: The Electron desktop application does not manage the lifecycle of `apps/api`. In local development, running `pnpm dev` at repository root starts both processes via Turborepo. Running `@leadforge/desktop` alone causes network failures if the API server is not running on port 3001.
2. **Drive UI Missing**: While `GoogleDriveProvider` and API attachment routes exist in `apps/api`, the desktop UI has no Google Drive file browser or picker interface. Attachments are uploaded from local disk paths via `attachments:save` IPC.
3. **Dual Data Paths**: Renderer queries read primarily from local SQLite via IPC (`companies:query`, `contacts:query`, `campaigns:list`), whereas worker writes commit directly to MongoDB via SdkClient without synchronously notifying SQLite.
