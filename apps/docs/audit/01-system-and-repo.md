# LeadForge OS Forensic Architecture Audit — Part 1: System & Package Overview

This document provides the high-level architecture blueprint of LeadForge OS, auditing the monorepo workspace and shared library packages.

---

## 1. Executive Architecture Overview

### 1.1 What is LeadForge OS?
**LeadForge OS** is an offline-first, B2B outbound campaign management platform and CRM designed for Growth-to-Market (GTM) teams. It allows users to automate cold outbound scraping, lead enrichment, and campaign execution directly from their local machine, while keeping centralized team settings, workspace directories, and permanent campaign history synced to a secure cloud database.

### 1.2 Core Problems Solved
1. **Local-First Performance & Reliability**: Cold outbound prospecting involves high-frequency data filtering, contact updates, and queueing. Traditional SaaS CRMs introduce latency on every click and fail entirely when offline. LeadForge OS caches CRM entities in a local SQLite cache so UI operations are instant (0ms latency) and handles slow/intermittent connections gracefully.
2. **Automated Scraped-Lead Enrichment**: Instead of manual lead importing, the platform integrates direct Playwright scraping and scraping queue monitors so new leads are injected from headless processes directly into the CRM.
3. **Workspace Isolation & Safe Collaboration**: GTM teams work across multiple client projects or company brands. LeadForge OS implements multi-tenant workspace isolation at both the database level (MongoDB Atlas queries) and the local client level (workspace-isolated SQLite tables).
4. **Offline Resilient Outbound Queuing**: Outbound campaigns can be configured while offline. The actions (e.g. creating contacts, starting sequences) are stored in a local SQLite-backed `sync_queue` and drained by a background worker the moment the network recovers.

### 1.3 System Component Architecture
LeadForge OS is built as a split-architecture system:
- **Electron Desktop Client (`apps/desktop`)**: Run locally on the user's computer. It runs a React renderer process (handling UI, forms, and TanStack query caches) communicating over Electron IPC with an Electron Main process (handling native window controls, child worker processes, secure credentials storage, and local SQLite cache).
- **Central API Server (`apps/api`)**: A serverless-compatible API server built on Hono, deployed to Vercel, which acts as the gateway to the primary persistent database.
- **MongoDB Atlas Cluster**: The single permanent source of truth for all synchronized tenants.
- **Local SQLite Cache**: A file-based database running in WAL mode on the desktop app userData path, acting as a read cache and a pending write mutation queue.

#### Architectural Layer Diagram
```
                     +---------------------------------------+
                     |            Electron Desktop           |
                     |                                       |
                     |   +-------------------------------+   |
                     |   |        Renderer (React)       |   |
                     |   +---------------+---------------+   |
                     |                   |                   |
                     |           window.ipc.invoke()         |
                     |                   |                   |
                     |   +---------------+---------------+   |
                     |   |         Preload Bridge        |   |
                     |   +---------------+---------------+   |
                     |                   |                   |
                     |              Electron IPC             |
                     |                   |                   |
                     |   +---------------+---------------+   |
                     |   |         Electron Main         |   |
                     |   |  +------------+------------+  |   |
                     |   |  |   SQLite   |  Supervisor|  |   |
                     |   |  +------------+------------+  |   |
                     |   +---------------+---------------+   |
                     +-------------------|-------------------+
                                         |
                                  api-client (SDK)
                                         |
                                     HTTPS+JWT
                                         |
                     +-------------------|-------------------+
                     |                   v                   |
                     |         Hono API (apps/api)           |
                     |                   |                   |
                     |             Services Layer            |
                     |                   |                   |
                     |          Repositories Layer           |
                     |                   |                   |
                     +-------------------|-------------------+
                                         |
                                      Mongoose
                                         |
                                         v
                                  [ MongoDB Atlas ]
```

---

## 2. Repository Structure

LeadForge OS is organized as a monorepo workspace managed via `pnpm` and `Turborepo` (`turbo.json`). 

### 2.1 Workspace Folders
```text
leadforge-os/
├── apps/                               # Executable applications
│   ├── api/                            # Hono API backend server
│   ├── desktop/                        # Electron desktop client
│   ├── docs/                           # Documentation workspace
│   ├── web/                            # [Placeholder] Web client
│   └── worker/                         # [Placeholder] Worker process
├── packages/                           # Shared monorepo libraries
│   ├── auth/                           # Better Auth wrappers & Hono middleware
│   ├── core/                           # Constants, response schema helpers, dates, IDs
│   ├── integrations/                   # Email, Playwright scraper, & verification adapters
│   ├── logger/                         # Pin logger factory
│   ├── prompts/                        # AI Prompt registry & interpolation
│   ├── schema/                         # Zod schemas, TypeScript types, IPC channel contracts
│   ├── sdk/                            # HTTP Api client wrapped around core endpoints
│   └── workflows/                      # Sequencer execution engine & builders
├── package.json                        # Root monorepo configuration
├── pnpm-workspace.yaml                 # pnpm workspace definition
├── tsconfig.json                       # Global compiler configurations
└── turbo.json                          # Turborepo task pipeline configuration
```

### 2.2 Directory Responsibility Matrix

| Directory | Purpose | Dependencies | Consumers |
| :--- | :--- | :--- | :--- |
| `apps/api` | Serves API requests, runs Better Auth backend, connects to MongoDB Atlas. | `@leadforge/auth`, `@leadforge/core`, `@leadforge/integrations`, `@leadforge/logger`, `@leadforge/prompts`, `@leadforge/schema`, `@leadforge/workflows` | External clients, `apps/desktop` via SDK. |
| `apps/desktop` | Renders GTM screens, maintains local SQLite cache, manages scrapers. | `@leadforge/core`, `@leadforge/schema`, `@leadforge/sdk` | End user installers (macOS/Windows). |
| `apps/docs` | Contains system documentations, roadmaps, and forensic audit reports. | None | Developers. |
| `packages/auth` | Wraps Better Auth config and generates authorization checks. | `@leadforge/core`, `@leadforge/schema` | `apps/api` |
| `packages/core` | Shares environment validators, formatting utility guards, and response structures. | `@leadforge/schema` | `apps/api`, `apps/desktop`, all packages. |
| `packages/integrations`| Interfaces for scrapers, email IMAP/SMTP connections, and mail verifiers. | `@leadforge/schema`, `@leadforge/core` | `apps/api` |
| `packages/logger` | Standardizes Pino logs. | None | `apps/api`, other packages. |
| `packages/prompts` | Formats and tracks system prompt definitions for LLMs. | `@leadforge/schema` | `apps/api` |
| `packages/schema` | Declares all DB schemas, DTOs, Enums, and Electron IPC type agreements. | None | All apps and packages. |
| `packages/sdk` | Structured API wrapper exposing Hono routes with strict return types. | `@leadforge/schema`, `@leadforge/core` | `apps/desktop` (main process via IPC registers). |
| `packages/workflows` | Provides execution mechanisms for multi-step outreach automation. | `@leadforge/schema`, `@leadforge/core` | `apps/api` |

---

## 3. Package Documentation

### 3.1 `@leadforge/schema`
- **Purpose**: Centralizes validation schemas, TypeScript interfaces, enums, and IPC communication contracts to prevent runtime drift.
- **Public API & Exports**:
  - `enums/`: Standardized enums (`UserRole`, `CompanyStatus`, `CampaignStatus`, `OutreachChannel`, `StepType`).
  - `fields/`: Generic field validators (`email`, `password`, `url`, `uuid`).
  - `entities/`: Zod object validators for main database tables (e.g. `userSchema`, `companySchema`, `campaignSchema`).
  - `dto/`: Request payload validation shapes (e.g., `LoginDto`, `CreateCompanyDto`).
  - `ipc/`: The `IpcChannelMap` definition specifying inputs/outputs for every Electron IPC channel.
- **Consumers**: Every application and package in the monorepo.
- **When to Use**: Whenever defining a database schema, validating an API request, invoking an IPC channel, or typing a system variable.
- **When NOT to Use**: Do not put business logic, fetch clients, or configuration details in this package. It must remain a pure type/validation library.

### 3.2 `@leadforge/sdk`
- **Purpose**: Provides a fully-typed HTTP client wrapping the `apps/api` server.
- **Public API & Exports**:
  - `SdkClient`: Root coordinator class.
  - `AuthModule`: Manages logins, signups, sessions, and logouts.
  - `WorkspacesModule`: Manages workspace CRUD, members, invites, and settings.
  - `CompaniesModule` / `ContactsModule` / `CampaignsModule` / `ActivitiesModule`: CRUD and workspace-scoped data utilities.
  - `DiscoveryModule`: Triggers scraper jobs and fetches scraped results.
- **Consumers**: `apps/desktop` (specifically the Main Process IPC Handlers).
- **When to Use**: Any time a desktop component needs to send an API request to the central API server.
- **When NOT to Use**: Do not use in the React renderer process directly (renderer calls must go through the Electron IPC bridge to Main first).

### 3.3 `@leadforge/auth`
- **Purpose**: Sets up Better Auth with MongoDB database adapters and mounts the token authentication middleware.
- **Public API & Exports**:
  - `createBetterAuth`: Initializes the better-auth handler with MongoDB adapters and the `bearer()` plugin.
  - `createAuthMiddleware`: Hono middleware checking request header authorization.
- **Consumers**: `apps/api`.
- **When to Use**: Bootstrapping auth route handlers or securing API endpoints.
- **When NOT to Use**: Do not import in `apps/desktop` as it requires direct `mongodb` connections.

### 3.4 `@leadforge/core`
- **Purpose**: Houses environment validations, standardized API response structures, ID generation, and type guards.
- **Public API & Exports**:
  - `successResponse()`, `errorResponse()`: Standardized HTTP payload wrappers.
  - `validateEnv()`: Zod-based environment variable assertion.
  - Date and pagination helpers (`getPaginationParams`).
- **Consumers**: `apps/api`, `apps/desktop`, and shared packages.
- **When to Use**: Standardizing responses or validating `.env` configurations.
- **When NOT to Use**: Do not add large UI packages or complex business engines.

### 3.5 `@leadforge/workflows`
- **Purpose**: Sequential workflow automation executor.
- **Public API & Exports**:
  - `WorkflowEngine`: Sequential runner loop tracking context variables and logs.
  - `WorkflowBuilder`: Fluent builder for creating workflow steps.
- **Consumers**: `apps/api`.
- **When to Use**: Running multi-step automation campaigns (e.g. sequence steps with wait states).
- **When NOT to Use**: Do not use for simple single-step CRM tasks.

### 3.6 `@leadforge/integrations`
- **Purpose**: Houses communication adapters for email accounts, Playwright scraping, and address verification.
- **Public API & Exports**:
  - `EmailAdapter`: Manages IMAP and SMTP connections (using `nodemailer`).
  - `ScraperAdapter`: Playwright wrapper configuration.
  - `VerificationAdapter`: Checks email addresses for syntax, domain records, and SMTP handshakes.
- **Consumers**: `apps/api`.
- **When to Use**: Communicating with SMTP/IMAP servers or invoking scrapers.
- **When NOT to Use**: Direct use in the desktop app UI (renderer).

### 3.7 `@leadforge/logger`
- **Purpose**: Unified logging provider based on Pino.
- **Public API & Exports**:
  - `createLogger`: Factory setting up structured JSON output with support for custom formatters.
- **Consumers**: `apps/api` and packages.
- **When to Use**: Reporting warnings, debug states, or fatal crashes.
- **When NOT to Use**: Do not use raw `console.log` in production-critical backend layers.

### 3.8 `@leadforge/prompts`
- **Purpose**: Manages model templates, system prompts, and regex-based string interpolation.
- **Public API & Exports**:
  - `promptRegistry`: Singleton map registering standard templates (e.g. `emailColdOutreachTemplate`).
  - `PromptRenderer`: Interpolates variables into prompt strings.
- **Consumers**: `apps/api` and orchestration workers.
- **When to Use**: Building LLM input prompts for cold email writing or company enrichment.
- **When NOT to Use**: General string helper files.
