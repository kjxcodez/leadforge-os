# LeadForge OS — Repository & Monorepo Forensic Inventory

## 1. Overview & Monorepo Taxonomy
LeadForge OS is structured as a TypeScript monorepo managed via `pnpm` workspaces (`pnpm-workspace.yaml`) and orchestrated by Turbo (`turbo.json`).

```text
leadforge-os/
├── apps/
│   ├── api/            # Hono-based Node.js API server (MongoDB persistence)
│   ├── desktop/        # Electron main/renderer app & local SQLite workspace runtimes
│   ├── marketing/      # Public Next.js marketing website & static search index
│   └── report/         # Internal release verification and audit runner
├── packages/
│   ├── agent-core/     # Core AI agent definitions & prompts
│   ├── agent-runtime/  # Agent execution environment & tool orchestration
│   ├── ai/             # Shared AI/LLM client utilities
│   ├── auth/           # Shared authentication configuration (Better-Auth)
│   ├── core/           # Core domain interfaces and shared constants
│   ├── logger/         # Structured pino-based logger package
│   ├── schema/         # Shared Zod schemas, entity types, & IPC channel contracts
│   ├── sdk/            # SdkClient HTTP library used by desktop app/workers to call API
│   └── workflow-engine/# Workflow DAG parser and step execution runner
├── scripts/            # Build, migration verification, release check, & smoke test scripts
└── docs/               # System architecture & forensic documentation
```

---

## 2. Detailed Application & Package Inventory

### 2.1 Apps (`apps/`)

#### `apps/api`
* **Location:** [`apps/api`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api)
* **Purpose:** Primary API server delivering REST endpoints, authentication middleware, business logic controllers, and MongoDB object persistence.
* **Entrypoint:** [`apps/api/src/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/index.ts#L1-L30) (mounts Hono app via `@hono/node-server`).
* **Dependencies:** `mongoose`, `@hono/zod-openapi`, `@leadforge/schema`, `@leadforge/auth`, `@leadforge/logger`.
* **Consumers:** Desktop app renderer/main processes, worker tasks, external client requests.
* **Persistence:** MongoDB via Mongoose [`apps/api/src/db/connection/mongoose.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/db/connection/mongoose.ts#L1-L35).
* **Runtime:** Node.js standalone service.

#### `apps/desktop`
* **Location:** [`apps/desktop`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop)
* **Purpose:** Local desktop application container managing user interface (React/Renderer), main process supervisors (`WorkspaceManager`), background job schedulers, sync engine, and local worker worker processes.
* **Entrypoint:**
  * Main Process: [`apps/desktop/src/main/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/index.ts#L1-L150)
  * Preload: [`apps/desktop/src/preload/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/preload/index.ts#L1-L80)
  * Renderer: [`apps/desktop/src/renderer/index.html`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/index.html)
* **Dependencies:** `electron`, `better-sqlite3`, `@leadforge/sdk`, `@leadforge/schema`, `playwright`.
* **Consumers:** End-user sales team / operators.
* **Persistence:** SQLite (`better-sqlite3`) per workspace file (`leadforge_<workspaceId>.db`).
* **Runtime:** Electron (Node.js Main + Chromium Renderer + Background Worker Threads).

#### `apps/marketing`
* **Location:** [`apps/marketing`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/marketing)
* **Purpose:** Static public website for product marketing and public search index.
* **Entrypoint:** Next.js pages.
* **Persistence:** None (Static site).

---

### 2.2 Shared Packages (`packages/`)

#### `packages/schema`
* **Location:** [`packages/schema`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/schema)
* **Purpose:** Canonical Zod domain validation schemas, TypeScript entity definitions, IPC message contracts, and DTO types shared between API, Desktop, and Workers.
* **Entrypoint:** [`packages/schema/src/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/schema/src/index.ts)

#### `packages/sdk`
* **Location:** [`packages/sdk`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk)
* **Purpose:** Strongly-typed API client library (`SdkClient`) wrapping HTTP fetch calls to `apps/api`.
* **Entrypoint:** [`packages/sdk/src/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/index.ts)
* **Modules:** `companies`, `contacts`, `campaigns`, `sequences`, `executions`, `outreach`, `discovery`, `audiences`, `companyDiscoveryRuns`.

#### `packages/workflow-engine`
* **Location:** [`packages/workflow-engine`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/workflow-engine)
* **Purpose:** Parses workflow sequence steps, constructs execution DAGs, evaluates step conditions, and manages step state transitions.
* **Entrypoint:** [`packages/workflow-engine/src/workflow-runner.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/workflow-engine/src/workflow-runner.ts)

---

## 3. Runtime Boundaries & Execution Topology

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                  ELECTRON DESKTOP                                │
│                                                                                  │
│   ┌───────────────────────────┐                ┌─────────────────────────────┐   │
│   │     Renderer (React UI)   │ ── IPC ──────> │      Electron Main Process  │   │
│   └───────────────────────────┘                │                             │   │
│                                                │ - WorkspaceManager          │   │
│                                                │ - WorkspaceRuntime          │   │
│                                                │ - JobScheduler              │   │
│                                                │ - SyncEngine                │   │
│                                                │ - LocalCRMRepository        │   │
│                                                └──────────────┬──────────────┘   │
│                                                               │                  │
│                                                               │ worker_threads   │
│                                                               ▼                  │
│                                                ┌─────────────────────────────┐   │
│                                                │    Worker Host & Plugins    │   │
│                                                │ (Scraper, Crawler, Outreach)│   │
│                                                └──────────────┬──────────────┘   │
│                                                               │                  │
└───────────────────────────────────────────────────────────────┼──────────────────┘
                                                                │
                                                        HTTP (SdkClient)
                                                                │
                                                                ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                     API SERVER                                   │
│                                                                                  │
│   ┌───────────────────────────┐                ┌─────────────────────────────┐   │
│   │       Hono API App        │ ─────────────> │       Mongoose Models       │   │
│   │ (Auth, Business Routes)   │                │ (Company, Contact, etc.)    │   │
│   └───────────────────────────┘                └──────────────┬──────────────┘   │
│                                                               │                  │
└───────────────────────────────────────────────────────────────┼──────────────────┘
                                                                │
                                                             Mongoose
                                                                │
                                                                ▼
                                                 ┌─────────────────────────────┐
                                                 │       MongoDB Instance      │
                                                 │   (Authoritative Persistence│
                                                 └─────────────────────────────┘
```

## 4. Subsystem Inventory Table

| Subsystem | Location | Purpose | Entrypoint | Dependencies | Persistence |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **API Web Server** | [`apps/api`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api) | HTTP endpoints & Mongo persistence boundary | [`src/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/index.ts) | `@hono/node-server`, `mongoose` | MongoDB |
| **Desktop Main** | [`apps/desktop/src/main`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main) | Electron supervisor, IPC, database & sync engine | [`src/main/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/index.ts) | `electron`, `better-sqlite3` | SQLite |
| **Desktop Renderer** | [`apps/desktop/src/renderer`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer) | User interface | `index.html` | React, IPC bridge | None (Reads SQLite via IPC) |
| **Worker Host** | [`apps/desktop/src/main/workers`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers) | Background execution of scrapers & workflows | [`worker-host.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/worker-host.ts) | `playwright`, worker plugins | SQLite (Direct local access) |
| **Sync Engine** | [`apps/desktop/src/main/services/sync-engine.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/sync-engine.ts) | Pushes SQLite mutations to API & pulls Mongo state | [`sync-engine.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/sync-engine.ts#L47) | `@leadforge/sdk`, `better-sqlite3` | SQLite `sync_queue` |
| **Job Scheduler** | [`apps/desktop/src/main/services/scheduler.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/scheduler.ts) | Concurrency manager for queued jobs | [`scheduler.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/scheduler.ts#L50) | `better-sqlite3`, `worker-host` | SQLite `jobs` |
