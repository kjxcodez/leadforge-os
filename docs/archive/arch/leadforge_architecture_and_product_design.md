# LeadForge — Architecture & Product Design Handbook

**Document type:** Internal architecture handbook
**Audience:** Founders, future engineers, contractors, and AI coding agents (Claude Code) implementing LeadForge
**Status:** Living document — version 1
**Prepared as:** A Staff/Principal Engineer's architectural blueprint

**Cost constraint governing every decision in this document:** LeadForge is currently a zero-budget, pre-revenue experiment being built for a single customer (Green Tech Modelers) by a solo/small team. Every architectural choice below has been filtered through one hard rule: **if it costs money before the product proves itself, it does not belong in v1.** Where a paid service is mentioned, a free-tier or self-hosted alternative is always specified as the default, and the paid version is marked explicitly as a "later, when revenue exists" upgrade.

---

## Table of Contents

1. Product Vision
2. Product Roadmap
3. Architecture
4. Monorepo Design
5. Data Architecture
6. Workflow Engine
7. Worker Architecture
8. Desktop Architecture
9. Integrations & Orchestration Layer
10. AI Architecture
11. Security
12. UX Architecture
13. Extensibility
14. Deployment
15. Coding Standards
16. Engineering Principles
17. Critical Review & Forward Look

---

# 1. Product Vision

## 1.1 Why LeadForge Is an Operating System, Not a CRM

A CRM answers one question: _"What is the state of my relationships with prospects and customers?"_ It is a system of record. LeadForge has to answer a much larger set of questions: _Where do new companies come from? Who are the right people to contact inside them? What do we know about them? Is this email valid? Should an AI agent qualify this lead before a human ever sees it? What message should we send, in what sequence, through what channel? Did they reply? What do we do next?_

That is not a single application feature — it is a **lifecycle**, spanning discovery, enrichment, qualification, outreach, conversation, and reporting. A CRM is the system of record for the _output_ of that lifecycle (the contact, the deal, the note). LeadForge is the system that _runs_ the lifecycle end to end. The CRM module is real and important, but it is one of ~20 modules sitting on top of a shared kernel: a workspace-scoped data layer, a workflow engine, a worker fleet, and a provider-adapter layer that lets external services do the heavy lifting.

The operating-system framing matters practically, not just rhetorically. An OS provides: process scheduling (→ workflow engine + job queue), a filesystem (→ MongoDB collections + repositories), device drivers (→ provider adapters for Apify, Hunter, SMTP, etc.), a shell (→ command palette + UI), and inter-process communication (→ Electron IPC + internal API). Every architectural decision in this document maps back to that analogy: LeadForge's job is to schedule work, route it to the right executor (human, internal worker, or external API), and record what happened — not to reimplement scraping, email verification, or LLM inference internally.

## 1.2 Philosophy

Three philosophical commitments run through this document:

1. **Orchestrate, don't reinvent.** Wherever a mature external service (Apify, n8n, Hunter, NeverBounce, OpenRouter) solves a problem reliably, LeadForge integrates it behind an adapter rather than building an in-house equivalent. Custom code is reserved for the things that are actually LeadForge's differentiation: the workflow model, the data model, the desktop-native orchestration UX, and workspace-scoped governance (audit, permissions, telemetry) _around_ those external calls.
2. **Workflows, not commands.** Users think in outcomes ("find me qualified MEP leads in Texas"), not in discrete CLI-style steps. The product surface is a small number of composable workflows; underneath, the workflow engine fans out into many discrete worker executions, some local, some remote (n8n, Apify actors, LLM calls).
3. **Workspace is the universal scope.** Every document, every job, every credential, every report is scoped to a workspace from day one — even though today there is exactly one workspace (Green Tech Modelers). Retrofitting multi-tenancy later is far more expensive than designing for it now, even in a $0-budget MVP; it costs nothing extra to add a `workspaceId` field today.

## 1.3 Product Principles (Expanded)

- **Desktop-first:** the desktop app is the primary and, initially, only client. This avoids hosting costs (no servers to run 24/7 for a web app) and gives direct filesystem/OS integration (tray, notifications, local Playwright browser control).
- **Offline-capable where possible:** local MongoDB (via a free Community Server or a local container) means the CRM, contacts, and cached enrichment data are usable without connectivity; only live discovery/enrichment/send actions require network access.
- **Workflow-driven:** every repeatable multi-step process (discover → extract → enrich → verify → qualify → campaign) is modeled as a workflow definition, not hardcoded control flow.
- **AI-assisted, not AI-dependent:** AI (via OpenRouter's free/cheap models first) adds qualification, drafting, and summarization on top of deterministic pipelines; the system must degrade gracefully with AI disabled.
- **Modular:** modules (CRM, Discovery, Campaigns, Reports…) are independently buildable/shippable packages behind one shell app.
- **Multi-workspace:** implemented from day 1 at the data-model level even with a single active workspace.
- **Event-driven:** state changes emit domain events (`contact.enriched`, `email.verified`, `campaign.replied`) that both the workflow engine and the audit/telemetry system subscribe to.
- **Automation-first:** any action a human does more than a few times becomes a workflow node candidate.
- **Extensible:** provider adapters and workflow nodes are pluggable, enabling a future marketplace without an initial rewrite.
- **Secure by default:** credentials encrypted at rest, workspace isolation enforced in the repository layer itself (not just in the UI), least-privilege by default.

## 1.4 Long-Term Evolution

LeadForge evolves in three horizons:

- **Horizon 1 (0–6 months, $0 budget):** Single-tenant desktop app for Green Tech Modelers. CRM + Discovery + basic Outreach, orchestrating free-tier external services. Success = GTM's own pipeline runs on it daily.
- **Horizon 2 (6–18 months):** Workflow engine matures, AI agents assist qualification and drafting, n8n becomes the automation backbone for anything more complex than the built-in workflow nodes, multi-workspace is activated for a second pilot customer.
- **Horizon 3 (18+ months):** Cloud sync, licensing/subscriptions, a plugin marketplace, and a partner ecosystem around provider adapters — at which point paid tiers of Apify/Hunter/NeverBounce/etc. become justified by revenue.

---

# 2. Product Roadmap

The roadmap is organized into phases that each deliver a usable increment, ordered so that later phases depend only on earlier ones — never the reverse. Every phase below assumes $0 cash cost using free tiers unless explicitly noted.

## Phase 0 — Foundation (Weeks 1–3)

Monorepo scaffold, MongoDB (local, free), internal API skeleton, auth stub (single workspace, single user), logging (Pino), config/env layer, base UI shell (Electron + React + shadcn). **No external integrations yet.** Dependency: none.

## Phase 1 — CRM Core

Companies, Contacts, Opportunities modules. Manual CRUD, tables, filters, saved views, activity feed. This is the system of record that every later phase writes into. Dependency: Phase 0.

## Phase 2 — Discovery

Google Maps scraping via a free-tier-friendly approach (Google Places API free monthly credit, or Apify's free-credit actors) + Playwright for website scraping. Produces Company + raw contact candidates into the CRM. Dependency: Phase 1 (needs somewhere to store results).

## Phase 3 — Enrichment & Verification

Adapters for Hunter (free tier: 25 searches/month), Apollo, Dropcontact as alternates; email verification via Reoon/NeverBounce/ZeroBounce free-tier credits, with a fallback to a simple SMTP-handshake verifier written in-house for $0 when free tiers are exhausted. Dependency: Phase 2 (needs raw contacts to enrich).

## Phase 4 — AI Qualification

OpenRouter as the provider abstraction (free/low-cost models like Gemini Flash or Llama variants first), scoring and qualifying contacts/companies against ICP criteria, drafting outreach copy. Dependency: Phase 3 (needs enriched data to qualify).

## Phase 5 — Outreach & Campaigns

Multi-step email campaigns via SMTP/Nodemailer (free — using the customer's existing mailbox or a free-tier transactional provider), reply tracking via IMAP polling, conversation timeline. Dependency: Phase 4 (qualified leads feed campaigns).

## Phase 6 — Workflow Engine (Generalization)

Everything built as bespoke pipelines in Phases 2–5 gets refactored into the generic workflow engine (triggers, nodes, executors) so future pipelines are configured, not coded. Dependency: Phases 2–5 provide the reference implementations the engine generalizes from.

## Phase 7 — Automation via n8n

Self-hosted n8n (free, open-source, Docker container) is introduced as the escape hatch for any automation more complex or more volatile than what's worth hardcoding into the native workflow engine — e.g. Slack/Discord notifications, Google Sheets sync, ad-hoc integrations. LeadForge invokes and monitors n8n workflows via its REST API, while keeping logging/audit/workspace-scoping inside LeadForge. Dependency: Phase 6 (engine + adapters must exist for n8n to plug into the same audit/telemetry pipeline).

## Phase 8 — Reports & Analytics

Cross-module reporting (pipeline velocity, response rates, source ROI). Dependency: Phases 1–5 (needs data from all modules).

## Phase 9 — Multi-Tenancy Activation

Turn on true multi-workspace support for a second customer; introduce workspace-level settings and billing hooks (still unpriced). Dependency: Phase 0's workspace scoping being honored everywhere.

## Phase 10 — Marketplace & Plugin SDK

Public workflow-node SDK, community adapters, listing/install mechanism. Dependency: Phase 6's workflow engine and Phase 9's multi-tenancy.

## Phase 11 — Cloud Sync & Commercialization

Optional cloud mirror of local data, licensing, subscriptions. Only pursued once there is a paying customer base. Dependency: Phase 9.

---

# 3. Architecture

## 3.1 Layered View

```
Desktop Shell (Electron)
        │
   ┌────┴────┐
   │  Main   │  (Node process: window mgmt, tray, updater, native menus, secure IPC bridge)
   └────┬────┘
        │ IPC (contextBridge, no nodeIntegration in renderer)
   ┌────┴────┐
   │Renderer │  React + Vite + TanStack Query + shadcn/ui
   └────┬────┘
        │ calls
  Internal API (packages/api) — an in-process API layer, NOT a public HTTP server in v1
        │
  Repositories (packages/repositories) — the ONLY code allowed to touch MongoDB
        │
  Services (packages/services) — business logic, orchestration, calls adapters
        │
   ┌────┴─────────────────┐
   │                      │
Workflow Engine     Provider Adapters (packages/integrations)
   │                      │
Background Workers   External Services (Apify, Hunter, OpenRouter, n8n, SMTP...)
(worker-node, worker-python)
```

## 3.2 Layer Responsibilities & Boundaries

- **Renderer (UI):** Presentation only. No business logic, no direct database access, no direct provider calls. Talks to the Internal API exclusively through a typed IPC bridge exposed by the Electron preload script.
- **Main process:** Owns the app lifecycle, window/tray/menu management, auto-updates, and hosts the Internal API + background worker orchestration in-process (v1) so there is no separate server to deploy or pay for.
- **Internal API:** A typed function-call layer (not REST, since everything is local in v1) exposed over IPC. Each "endpoint" is a thin controller that validates input (Zod), calls a service, and returns a DTO. This layer is what would become an HTTP API later (Phase 11 cloud sync) with minimal rework because it is already request/response shaped.
- **Repositories:** The single choke point for MongoDB access. Repositories never contain business logic — only queries, projections, and workspace-scoping guarantees (every repository method requires a `workspaceId`).
- **Services:** Orchestrate one or more repositories and/or adapters to fulfill a use case (e.g., `EnrichContactService` reads a contact via repository, calls the enrichment adapter, writes the result back). Services are where business rules live.
- **Provider Adapters (Integrations layer):** One adapter per external capability (Maps, Scraping, Enrichment, Verification, AI, Email, Chat notifications, Automation/n8n). Adapters implement a shared interface per capability category so providers are swappable (see Section 9).
- **Workflow Engine:** Executes workflow definitions by calling services/adapters in sequence/parallel per a declarative graph, persisting execution state so long-running, multi-day workflows (e.g., a 5-step email campaign) survive app restarts.
- **Workers (Node & Python):** Execute the actual long-running or CPU-heavy or language-specific tasks (Playwright scraping, OCR, embeddings) outside the Electron main-process event loop, communicating via an internal queue.

## 3.3 Why This Layering

The strict repository/service/adapter separation exists so that (a) MongoDB could be swapped for another store without touching services, (b) any provider could be swapped without touching business logic, and (c) the UI could be swapped (e.g., a future web client) without touching anything below the Internal API. This is the same reasoning as classic hexagonal/ports-and-adapters architecture, applied to a desktop app instead of a server.

---

# 4. Monorepo Design

## 4.1 Structure

```
leadforge/
  apps/
    desktop/         # Electron shell + React renderer (the product)
    website/         # marketing site (static, free hosting e.g. Vercel/Netlify free tier)
    docs/            # internal + eventual public docs (Docusaurus or plain markdown)
    worker-node/     # long-running Node worker process(es)
    worker-python/   # OCR/vision/ML worker process(es), invoked only when needed
  packages/
    api/             # internal API layer (controllers, DTO mapping, validation)
    auth/             # session/identity, workspace membership (single-user in v1)
    db/               # Mongo connection, schema/index management, migrations
    repositories/      # one file per collection; only Mongo-touching code
    services/          # business logic per module (crm, discovery, enrichment, campaigns...)
    workflow-engine/    # trigger/node/executor runtime
    workflow-nodes/     # built-in node implementations (map to services/adapters)
    integrations/       # provider adapters (maps, scraping, enrichment, verification, ai, email, chat, automation)
    telemetry/          # structured event emission + local analytics store
    queue/              # lightweight job queue (BullMQ-style, backed by Mongo or Redis-free alt)
    scraper/            # Playwright wrapper utilities shared by discovery workers
    email/              # Nodemailer + IMAP polling utilities
    ai/                 # OpenRouter/Gemini/Claude/OpenAI client abstraction + prompt templates
    ui/                 # shared design system (shadcn-based components, tokens, "Yarrow"-style theming approach if reused)
    types/              # shared TypeScript types/interfaces across all packages
    logger/             # Pino wrapper with consistent structured fields (workspaceId, module, correlationId)
    config/             # env loading, per-environment config, secrets resolution
    utils/               # generic helpers (dates, pagination, DTO mapping helpers)
  tooling/
    eslint-config/
    tsconfig-base/
    scripts/            # repo automation (release, changelog, codegen)
  installers/           # electron-builder configs per OS
  docker/               # optional local docker-compose (Mongo, n8n, Redis) for dev
```

## 4.2 Package Responsibilities, Dependencies & Import Rules

- **Dependency direction is strictly one-way:** `apps/* → packages/services → packages/repositories → packages/db`. A lower layer must never import from a higher layer. `packages/ui` and `packages/types` are leaf packages importable from anywhere. This is enforced with an ESLint import-boundary rule (`eslint-plugin-boundaries` or a custom rule) so violations fail CI, not just code review.
- **`repositories` may only import `db` and `types`.** It must never import `services`, `integrations`, or anything provider-related. This is what makes "repositories only access Mongo" enforceable rather than aspirational.
- **`services` may import `repositories`, `integrations`, `workflow-engine`, `telemetry`, `logger`, `types`, `utils`.** Services never import from `apps/*`.
- **`integrations` may only import `types`, `logger`, `config`.** No adapter may import a service or repository — adapters are pure I/O boundaries and must remain swappable/testable in isolation.
- **`workflow-nodes` import `services` and `integrations`**, translating a generic node execution call into a concrete service/adapter call. The `workflow-engine` itself never imports a concrete node — nodes register themselves into an engine-owned registry, keeping the engine generic.
- **Ownership:** each package has a single "owning" area of the roadmap (e.g., `packages/services/discovery` owned by whoever is building Phase 2). Cross-package changes always require updating `packages/types` first, then dependents — never the reverse, to avoid type drift.

## 4.3 Turborepo & pnpm Rationale

pnpm's content-addressable store keeps install size and time low (relevant when running everything locally with no CI budget); Turborepo's task caching means `pnpm build`/`test` only re-runs what changed, which matters once `worker-python` and `desktop` both grow. Both tools are free and open-source, consistent with the $0 constraint.

---

# 5. Data Architecture

## 5.1 Core Collections

- `workspaces` — id, name, settings, createdAt.
- `users` — id, workspaceIds[], role, auth fields.
- `companies` — workspaceId, name, domain, source, enrichment fields, ICP score, status.
- `contacts` — workspaceId, companyId, name, title, emails[] (with verification status per email), phones[], source, enrichmentStatus.
- `opportunities` — workspaceId, companyId/contactId, stage, value, owner, timestamps.
- `campaigns` — workspaceId, name, steps[] (each a channel + template + delay), status.
- `campaignEnrollments` — campaignId, contactId, currentStep, status (active/paused/replied/bounced/completed).
- `messages` — workspaceId, conversationId, direction (in/out), channel, body, providerMessageId, timestamps.
- `conversations` — groups messages per contact/thread for the timeline view.
- `workflows` — workspaceId, definition (graph JSON), version, isActive.
- `workflowRuns` — workflowId, status, startedAt, finishedAt, nodeExecutions[].
- `jobs` — queue documents (or a dedicated queue store — see 5.5) for background work.
- `auditLogs` — workspaceId, actor, action, entity, before/after diff, timestamp.
- `telemetryEvents` — workspaceId, eventName, payload, timestamp (local-only analytics, no external transmission by default).
- `integrationCredentials` — workspaceId, provider, encryptedPayload, scopes.
- `providerUsage` — workspaceId, provider, period, unitsUsed (to track free-tier consumption so the app can warn before a paid overage occurs).

## 5.2 Indexing Strategy

Every collection is indexed first on `{ workspaceId: 1 }` as a compound-index prefix, since virtually all reads are workspace-scoped. Secondary indexes follow query patterns: `contacts` on `{ workspaceId: 1, companyId: 1 }` and `{ workspaceId: 1, "emails.address": 1 }` (unique-ish lookup); `campaignEnrollments` on `{ campaignId: 1, status: 1 }`; `workflowRuns` on `{ workflowId: 1, startedAt: -1 }`. Text search (company/contact name lookup for the command palette) uses a MongoDB text index rather than standing up a separate search service — free, and sufficient at this data scale.

## 5.3 Repositories & DTOs

Each repository exposes typed methods (`findById`, `findMany(filter, pagination)`, `insert`, `update`, `softDelete`) that always require `workspaceId` as the first parameter — there is no method that can accidentally query across workspaces. Repositories return raw persistence-shaped documents; **DTO mapping happens in the API layer**, not in repositories or services, so the same domain object can be projected differently for different callers (e.g., a lightweight `ContactListItemDTO` for tables vs. a full `ContactDetailDTO` for the detail view).

## 5.4 Caching & Projections

TanStack Query on the renderer side provides client-side caching/invalidation, which covers most "caching" needs for a single desktop user — there is no need for a server-side cache like Redis in v1. Materialized views (e.g., a `companySummary` collection pre-aggregating contact counts, last-activity date, ICP score) are recomputed via lightweight change-stream listeners on the core collections, avoiding expensive aggregation pipelines on every dashboard load — implemented with MongoDB itself (which supports change streams even in a single-node replica-set configuration, free).

## 5.5 Task Queue

Rather than adding Redis (an extra process/cost) purely for a queue, v1 uses a MongoDB-backed queue (a `jobs` collection with atomic `findOneAndUpdate` claiming, similar to the pattern used by libraries like `agenda`). This keeps infra to "just MongoDB" while still providing retry counts, scheduling (`runAt`), and priority. Redis-backed BullMQ is a documented future upgrade path once job volume justifies the extra moving part.

## 5.6 Audit Logs & Event History

Every service-layer mutation that matters (contact enriched, email sent, workflow run, credential changed) writes an immutable `auditLogs` entry and emits a domain event on an in-process event bus (`packages/telemetry`). The workflow engine and any n8n bridge both subscribe to this bus so that automation actions and manual actions produce the same audit trail — auditability is a property of the event bus, not of any one code path.

---

# 6. Workflow Engine

## 6.1 Core Model

A **workflow** is a directed graph of **nodes** connected by **edges**, stored as versioned JSON in the `workflows` collection. A **trigger** starts a run (manual button, schedule, or incoming event like `email.replied`). A **run** persists per-node execution state so it can resume after an app restart or a crashed worker.

```
Trigger → Node A → Node B ─┬→ Node C → Node E (join)
                            └→ Node D ┘
```

## 6.2 Node Types

- **Action nodes** — call a service or provider adapter (e.g., "Scrape Google Maps", "Enrich Contact", "Send Email").
- **Condition nodes** — branch based on data (e.g., "if ICP score > 70").
- **Loop nodes** — iterate over a list (e.g., every discovered company).
- **Delay nodes** — wait N hours/days (used heavily in campaign sequences).
- **Human-in-the-loop nodes** — pause and require manual approval (e.g., "review before send" for cold outreach, honoring the stop-and-propose approval pattern for anything compliance-sensitive).
- **Sub-workflow nodes** — invoke another workflow, enabling composition.
- **n8n-bridge nodes** — hand off execution to a named n8n workflow via its REST API and await/poll for completion, while LeadForge still logs the invocation and result as a normal node execution (see Section 9.4).

## 6.3 Executors

Each node type has an **executor** — a small class implementing `execute(input, context) → output` where `context` carries `workspaceId`, `runId`, credentials, and a logger scoped to that run. Executors are registered in a runtime registry keyed by node type; the engine core has zero knowledge of what any specific node does, which is what keeps the engine generic and future nodes addable without touching engine code (this is also the seam the Plugin SDK in Section 13 builds on).

## 6.4 Retries, Scheduling & Error Recovery

Every node execution records `attempt`, `maxAttempts`, `backoffStrategy` (exponential by default), and `lastError`. On failure, the engine re-enqueues the node execution as a job (via the Mongo-backed queue from 5.5) up to `maxAttempts`, then marks the run `failed` and emits a `workflow.failed` event (surfaced in-app and optionally via the Slack/Discord adapter). Scheduling (cron-like triggers, e.g. "run Discovery every Monday") reuses the same queue with `runAt` timestamps rather than a separate cron daemon.

## 6.5 Variables & Data Passing

Each node's output is stored under a `runId`-scoped variable bag (`{ nodeId: output }`); downstream nodes reference upstream outputs via a small expression syntax (`{{nodes.discoverCompanies.output.companies}}`), evaluated by a constrained expression evaluator (not `eval` — a small allow-listed expression parser) for safety.

## 6.6 Marketplace & Plugin SDK (Forward-Looking)

Node executors implement a documented `WorkflowNode` interface (`type`, `inputSchema` (Zod), `outputSchema`, `execute`). Once this interface is stable (post Phase 6), third parties can ship node packages that self-register, which is the foundation for the Phase 10 marketplace — no engine rewrite required, only a package-loading mechanism.

---

# 7. Worker Architecture

## 7.1 Why Separate Processes

Electron's main process must stay responsive for UI/IPC; anything CPU-heavy (Playwright scraping, embeddings, OCR) runs in separate child processes (`worker-node`) or a separate Python process (`worker-python`), communicating over the Mongo-backed job queue rather than direct function calls, so a worker crash never takes down the desktop shell.

## 7.2 Node Workers

- **Discovery worker** — drives Playwright + adapter calls (Google Maps / Apify) to find companies and websites.
- **Contact Extraction worker** — parses scraped HTML/text for names, emails, roles.
- **Outreach worker** — sends queued campaign-step emails via the email adapter, respecting per-domain rate limits.
- **Scheduler** — polls the queue for due jobs (`runAt <= now`) and dispatches them to the right worker type.
- **Email worker** — IMAP polling for replies/bounces, updating `conversations`/`campaignEnrollments`.
- **Queue worker(s)** — generic claim-and-execute loop shared by the above via a small `runJob(type, payload)` dispatcher.

## 7.3 Python Workers (Introduced Only When Needed)

OCR, computer vision, PDF parsing, embeddings, and heavier ML tasks are deferred to a `worker-python` process using free/open-source libraries (e.g., Tesseract for OCR, sentence-transformers for embeddings) rather than paid APIs, invoked via the same job-queue contract (a `python` job type row that the Python worker polls for) so the Node side never needs a Python runtime dependency.

## 7.4 Crash Recovery, Locking & Health

Jobs are claimed with an atomic `findOneAndUpdate` setting `status: 'processing'`, `lockedBy`, `lockedAt`. A periodic reaper resets jobs whose `lockedAt` is older than a timeout back to `pending` (crash recovery without needing a dedicated orchestrator like Kubernetes). Each worker process emits a heartbeat document; the desktop UI's "System Health" panel reads these to show worker status. Graceful shutdown listens for `SIGTERM`/Electron's `before-quit`, finishes the current job (or checkpoints it), and exits cleanly rather than mid-job.

## 7.5 Scaling Path

v1 runs all workers as child processes of the single desktop app on the user's machine — $0 infra cost. The queue abstraction (5.5) is written so that swapping the Mongo-backed queue for Redis/BullMQ, and swapping child-process workers for real distributed workers, requires no change to service-layer code — only to the queue package's internals. This is the deliberate seam for eventual cloud/team-scale deployment (Phase 11).

---

# 8. Desktop Architecture

## 8.1 Process Model

- **Main process:** window/tray/menu lifecycle, auto-updater (electron-updater, pointed at a free GitHub Releases feed rather than a paid update server), secure IPC bridge (contextBridge only, `nodeIntegration: false`, `contextIsolation: true`), and hosts the Internal API + queue scheduler in-process.
- **Renderer process:** React app, sandboxed, communicates only through the typed preload-exposed API — never direct Node/OS access.
- **Worker processes:** spawned/managed by the main process as child processes, each with its own crash boundary (Section 7).

## 8.2 IPC Contract

A single typed `window.leadforge.invoke(channel, payload)` surface backed by a generated map of channel → Zod input/output schema, so a renderer call and its main-process handler can never silently drift in shape. No ad-hoc `ipcRenderer.send` calls scattered through components.

## 8.3 Native Integration

- **Notifications:** OS-native notifications for campaign replies, workflow failures, discovery completion.
- **Tray:** quick status (jobs in progress, unread replies) and quick actions (pause all campaigns).
- **Native menus:** standard app menu plus a command-palette-triggering shortcut.
- **File system:** CSV import/export, local attachment storage under the app's userData directory.
- **Local database:** MongoDB running either embedded (via a bundled `mongodb-memory-server`-style local binary for zero-install trial mode) or as a local service the user already runs — both $0.
- **Offline strategy:** CRM, reporting, and campaign drafting all work offline against local Mongo; only discovery/enrichment/verification/send/AI actions require connectivity and queue themselves for retry when connectivity returns.

## 8.4 Auto Updates & Versioning

electron-builder produces per-OS installers; electron-updater checks a GitHub Releases feed (free) for new versions. Semantic versioning; every release includes a migration script (Section 14) run automatically on first launch after update.

---

# 9. Integrations & Orchestration Layer

## 9.1 Core Principle: Orchestrate, Don't Reinvent

LeadForge's competitive value is in **coordination**, not in re-implementing scraping engines, email-verification SMTP handshakes, or LLM inference. Any capability where a mature external service exists is implemented as a **provider adapter** — a thin, swappable wrapper — rather than custom infrastructure. Custom code is written only where no adequate external option exists, or where the free/cheap option needs a lightweight in-house fallback (e.g., a basic SMTP-handshake email checker as a $0 fallback once free verification-API credits run out).

## 9.2 Provider Abstraction Pattern

Every integration category defines a small TypeScript interface in `packages/integrations`, e.g.:

```ts
interface EmailVerificationProvider {
  name: string;
  verify(
    email: string
  ): Promise<{ status: 'valid' | 'invalid' | 'risky' | 'unknown'; raw: unknown }>;
}
```

Concrete adapters (`ReoonProvider`, `NeverBounceProvider`, `ZeroBounceProvider`, `SmtpHandshakeProvider`) implement this interface. A `ProviderRegistry` resolves the active provider per workspace per capability from `integrationCredentials` + workspace settings, with a configured **fallback chain** (e.g., try Reoon free tier → fall back to the in-house SMTP-handshake check if the monthly quota is exhausted). This directly satisfies "no provider hardcoded; providers must be interchangeable," and mirrors the pattern already proven in LeadForge's OpenRouter AI integration (mandatory fallback + feature-flag gating).

## 9.3 Integration Catalog & Default (Free) Choice

| Capability          | Adapters supported                                  | Default (v1, $0)                                                |
| ------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| Company discovery   | Google Maps, Apify actors                           | Google Maps API free monthly credit                             |
| Website scraping    | Playwright (self-hosted), Apify                     | Self-hosted Playwright                                          |
| Contact enrichment  | Hunter, Apollo, Dropcontact                         | Hunter free tier (25 searches/mo)                               |
| Email verification  | Reoon, NeverBounce, ZeroBounce, in-house SMTP check | Free-tier credits → in-house fallback                           |
| AI / LLM            | OpenRouter, Gemini, Claude, OpenAI                  | OpenRouter routing to free/cheap models                         |
| Email sending       | SMTP/Nodemailer                                     | Customer's existing mailbox (no new cost)                       |
| Automation          | n8n (self-hosted)                                   | Local Docker n8n instance                                       |
| Team notifications  | Slack, Discord                                      | Whichever the customer already uses (free webhook)              |
| File/sheet sync     | Google Sheets, Google Drive, Microsoft 365          | Google Sheets/Drive (free personal account)                     |
| Social/professional | LinkedIn                                            | Manual-assist only initially (ToS-safe, no scraping automation) |

## 9.4 The n8n Bridge

n8n is treated as a first-class **execution target**, not a bypass of LeadForge's governance. The `workflow-engine` package includes an `N8nBridgeNode` executor that: (1) triggers a named n8n workflow via its REST/webhook API with a scoped payload, (2) polls or receives a callback for completion, (3) writes the result back into the LeadForge run as a normal node output, and (4) emits the same audit/telemetry events any native node would. Practically, this means: use a **native workflow node** when the logic is core to LeadForge and needs tight data-model integration (e.g., writing a `Contact`); use **n8n** when the logic is a glue/notification/sync task that changes often or talks to a long tail of third-party APIs (e.g., "post a Slack digest every morning," "append new leads to a Google Sheet"). This keeps n8n's flexibility available without letting automation logic escape LeadForge's workspace isolation, logging, or permissions.

## 9.5 Credential Management for Integrations

All third-party credentials live in `integrationCredentials`, encrypted at rest (Section 11), scoped per workspace, and resolved by the `ProviderRegistry` at call time — adapters never read credentials directly from environment variables in production use, only in local dev.

---

# 10. AI Architecture

## 10.1 Provider Abstraction

`packages/ai` defines a single `ChatModelProvider` interface (`complete(messages, options) → response`) implemented by an `OpenRouterProvider` (default — gives access to many models, including free ones, through one API key), plus direct `GeminiProvider`, `ClaudeProvider`, `OpenAIProvider` for cases needing a specific model's capabilities. OpenRouter is the default precisely because it gives provider-swap flexibility "for free" (one integration, many backing models), matching the "no provider hardcoded" requirement.

## 10.2 Prompt Management

Prompts are versioned templates stored in `packages/ai/prompts/*.md` with typed variable interpolation (not string concatenation scattered through services), so prompt changes are reviewable like code and don't require touching business logic.

## 10.3 Use Cases

- **ICP Qualification scoring** — structured-output prompt (JSON schema enforced) scoring a company/contact against the customer's ideal-customer-profile criteria.
- **Outreach drafting** — generates first-draft campaign copy per contact, always routed through a human-in-the-loop review node before send (Section 6.2), never auto-sent without approval for cold outreach.
- **Reply classification** — classifies inbound replies (interested / not interested / OOO / unsubscribe) to drive campaign-enrollment state transitions.
- **Summarization** — condenses long scraped website text before it's used as enrichment context, reducing token spend (cost-consciousness matters even on cheap models).

## 10.4 Embeddings & RAG (Forward-Looking)

Once volume justifies it, `worker-python` can generate embeddings (via a free local model) for company/contact records to support semantic search and "find similar leads," stored in Mongo (Atlas Vector Search or a simple in-app cosine-similarity scan at this data scale — no dedicated vector DB needed yet).

## 10.5 Agent System & Tools

AI "agents" in LeadForge are modeled as workflow nodes with **tool access** limited to a declared allow-list of services (e.g., a Qualification Agent can call `CompanyService.read` and `ScoreService.write`, nothing else) — this keeps agent behavior auditable and bounded rather than granting broad tool access.

## 10.6 MCP Compatibility

Because provider adapters and workflow nodes already share a typed input/output schema convention, exposing selected LeadForge capabilities as MCP tools (or consuming external MCP-compatible tools as new adapters) is additive rather than a redesign — this is the intended integration point for "future MCP-compatible tools and AI agents."

---

# 11. Security

## 11.1 Authentication & Authorization

v1 is single-user/single-workspace, but the `auth` package models `users` and `workspaceMemberships` with roles (`owner`, `member`, `viewer`) from day one so multi-user support (Phase 9) is additive. Session tokens are local-only (no external auth server needed while single-user).

## 11.2 Workspace Isolation

Enforced at the repository layer (Section 5.3): every query requires `workspaceId`; there is no repository method that can return cross-workspace data, so isolation cannot be bypassed by a service-layer bug alone — it would require bypassing the repository entirely, which the import-boundary lint rule (Section 4.2) prevents.

## 11.3 Secrets & Credential Storage

Third-party API keys/tokens (Section 9.5) are encrypted at rest using OS-level keychain integration where available (Electron's `safeStorage`, backed by macOS Keychain / Windows DPAPI / libsecret on Linux — all free, no external KMS needed) with an application-level encryption fallback for environments without OS keychain support.

## 11.4 Desktop Security Hardening

`contextIsolation: true`, `nodeIntegration: false`, a strict Content-Security-Policy in the renderer, and no `remote` module usage. Auto-updater verifies release signatures before applying updates.

## 11.5 Rate Limiting & Validation

Outbound calls to each provider respect a per-provider rate limiter (token-bucket, in-process) tuned to each free tier's documented limits, tracked via the `providerUsage` collection so the app can proactively warn ("Hunter free tier: 3 searches left this month") rather than fail silently on a 429.

All inputs — IPC payloads, workflow node inputs, adapter responses — are validated with Zod schemas at every layer boundary; nothing crosses a layer boundary unvalidated.

## 11.6 Threat Model (Summary)

Primary risks at this stage: (1) leaked API keys if `safeStorage` encryption is misconfigured — mitigated by never logging credential values and encrypting at rest; (2) malicious/compromised n8n workflows executing unexpected actions — mitigated by scoping the n8n bridge's LeadForge-side credentials narrowly and logging every invocation; (3) prompt injection via scraped web content reaching an AI qualification prompt — mitigated by treating scraped text as untrusted data, never as instructions, enforced via structured-output prompting and never letting AI output directly trigger a send/write without a human-in-the-loop node for anything outward-facing.

---

# 12. UX Architecture

## 12.1 Navigation & Layout

A persistent left sidebar lists modules (Dashboard, CRM, Discovery, Campaigns, Workflows, Reports, Settings…), consistent with the "Linear/Attio/Raycast" reference points from the vision doc — calm, information-dense, no gradient/neon styling. Each module follows a consistent list → detail pattern: a dense, sortable/filterable table on the left, a detail drawer or route on the right.

## 12.2 Tables, Forms, Dialogs

Tables use virtualized rendering for large contact/company lists, column visibility toggles, saved views (persisted per user), and server-side (repository-level) sort/filter/pagination rather than client-side filtering of full datasets — this was already validated in LeadForge's CRM work (server-side sort, saved views). Forms use shared schema-driven form components (Zod schema → form fields) so validation logic isn't duplicated between the API layer and the UI. Dialogs are used for quick actions (bulk tag, quick-add contact); full-page routes are used for anything with its own deep-linkable state (workflow editor, campaign detail).

## 12.3 Activity Feed & Timeline

A cross-entity activity feed (powered by the audit-log/event-bus data from Section 5.6) shows what happened to a company/contact/campaign over time; the conversation timeline specifically renders `messages` threaded by `conversationId` with inline reply/compose.

## 12.4 Command Palette & Keyboard Shortcuts

A single ⌘K/Ctrl+K command palette provides fuzzy navigation (via the Mongo text index, Section 5.2) plus quick actions ("New Company," "Run Discovery Workflow"), following the Raycast-style pattern the vision calls out. Standard keyboard shortcuts (j/k row navigation, / to search, g+letter to jump modules) are layered on top for power users, matching the target audience of engineers/ops-heavy small teams.

## 12.5 Infinite Scroll, Pagination & Filtering

List views use cursor-based pagination (stable under concurrent inserts, unlike offset pagination) with an optional infinite-scroll UX for feeds (activity, conversation timeline) and page-based UX for tables (clearer for scanning/sorting large CRM lists).

---

# 13. Extensibility

## 13.1 Plugin SDK

Building on the `WorkflowNode` interface (Section 6.6) and the provider-adapter interfaces (Section 9.2), a documented Plugin SDK lets third parties ship: (a) new workflow nodes, (b) new provider adapters for a given capability category, (c) new report widgets. Plugins are npm packages following a `leadforge-plugin-*` naming convention and a manifest (`leadforge.plugin.json`) declaring what they register.

## 13.2 Marketplace (Phase 10)

A marketplace is, at its core, a curated registry (initially just a JSON index hosted on GitHub Pages — free) mapping plugin package names to metadata; the desktop app can browse/install from this registry once the SDK is stable. No custom backend is needed for the marketplace's first version.

## 13.3 Custom Integrations & Community Packages

Because every integration category has a narrow, documented interface (Section 9.2), community-contributed adapters (e.g., a new email-verification provider) require no core changes — only registering the new adapter class with the `ProviderRegistry`.

## 13.4 Future Public API

The Internal API layer (Section 3.2) is already request/response shaped; exposing a subset over HTTP (for a future public API or web client) is a matter of adding an HTTP transport in front of existing controllers, not rewriting business logic.

---

# 14. Deployment

## 14.1 Development

Local dev runs via `pnpm dev`, spinning up Electron in dev mode with hot-reload for the renderer, local MongoDB (via Docker Compose, optional), and — if testing the automation bridge — a local n8n Docker container. All free, all offline-capable except for actual third-party API calls.

## 14.2 Production Packaging

`electron-builder` produces signed installers per OS (macOS `.dmg`/notarized, Windows `.exe`/`.msi`, Linux `.AppImage`/`.deb`). Code-signing certificates are the one line item that may eventually cost money (Apple Developer Program, Windows code-signing cert) — until then, unsigned/dev-signed builds are used for the single pilot customer.

## 14.3 Auto Updates & Versioning

Semantic versioning (`MAJOR.MINOR.PATCH`); every release tag on GitHub triggers a free GitHub Actions workflow to build installers and publish them to GitHub Releases, which `electron-updater` polls (Section 8.4) — no paid release infrastructure required.

## 14.4 Migration Strategy

Each release that changes the data model ships a numbered migration script (`packages/db/migrations/00XX_description.ts`) run automatically on first launch post-update, recorded in a `migrations` collection so each migration runs exactly once. Migrations are always additive/backward-compatible where possible (add fields with defaults rather than destructive renames) to reduce rollback risk.

## 14.5 Backup & Restore

Local MongoDB is backed up via a scheduled `mongodump` to a local (and optionally user-configured Google Drive, using the existing free adapter) folder — giving off-machine backup redundancy at $0 additional infrastructure cost. Restore is a documented `mongorestore` flow exposed as a Settings-page action.

---

# 15. Coding Standards

## 15.1 Folder & Naming Conventions

Feature-first folders within each package (`packages/services/discovery/`, not a flat `services/` file dump). Files: `kebab-case.ts`; React components: `PascalCase.tsx`; types/interfaces: `PascalCase` with no `I` prefix; constants: `SCREAMING_SNAKE_CASE`. Test files sit beside the code they test as `*.test.ts`.

## 15.2 Repository & Service Pattern

Repository methods are named after the query they perform (`findActiveByWorkspace`, not `getAll`). Services are named after the use case (`QualifyCompanyService`, not `CompanyService2`). One service class per use case is preferred over large multi-purpose service classes, keeping each file's responsibility legible.

## 15.3 React & TypeScript Standards

Function components only; hooks for all state; no class components. `strict: true` in every `tsconfig.json`; `noImplicitAny`; **`any` is banned** except in explicitly justified, commented exceptions reviewed like any other exception to a lint rule. Shared types live in `packages/types`, never duplicated locally.

## 15.4 Error Handling

Services throw typed domain errors (`class ContactNotFoundError extends DomainError`) rather than generic `Error`; the API layer maps domain errors to a consistent error DTO shape (`{ code, message, details }`) so the renderer can branch on `code` rather than parsing message strings.

## 15.5 Logging

Pino structured logging everywhere; every log line includes `workspaceId`, `module`, and (where applicable) `runId`/`jobId` for correlation. No `console.log` in committed code — enforced via lint rule.

## 15.6 Testing

Unit tests for services and repositories (with an in-memory Mongo instance for repository tests — free, no shared test DB needed); adapter tests use recorded fixtures/mocks rather than live API calls (protects free-tier quotas from being burned by CI runs). Workflow engine tests run full graphs against mocked node executors to verify retry/branching logic.

## 15.7 Documentation

Every package has a `README.md` stating its responsibility and its allowed dependencies (mirroring Section 4.2's import rules) so the boundary rules are documented in the same place a new contributor would look first.

---

# 16. Engineering Principles

These are non-negotiable. A pull request violating any of these should not merge, regardless of who wrote it (including an AI coding agent).

1. **No business logic in the UI.** The renderer calls the Internal API and renders what it gets back — it does not decide qualification scores, retry logic, or workspace scoping.
2. **Repositories only access MongoDB.** No repository calls an adapter, a service, or another repository's private internals.
3. **Services orchestrate; they don't do I/O directly.** A service composes repository and adapter calls; it never opens a raw socket or writes a file itself — that belongs in an adapter or utility.
4. **Every external provider sits behind an adapter implementing a shared capability interface.** No service ever imports `axios`/an SDK for Hunter, OpenRouter, etc. directly.
5. **Every API response is a DTO**, never a raw Mongo document (which could leak internal fields like `_id` internals, encrypted credential blobs, etc.).
6. **Everything is workspace-scoped.** Every collection, every query, every job, every credential, every report carries and is filtered by `workspaceId`.
7. **Strong typing everywhere; `any` is banned** except in narrowly justified, reviewed cases.
8. **No duplicated business logic.** If two workflow nodes or two UI actions need the same qualification rule, that rule lives once in a service, called from both places.
9. **Orchestrate before you build.** Before writing custom infrastructure for a capability, check whether an existing adapter (Apify, n8n, Hunter, OpenRouter, etc.) already solves it reliably — building custom is the exception, not the default.
10. **Human approval gates any outward-facing automated action** (sending an email, posting publicly) until the qualification/drafting pipeline has a proven track record — matching the "stop-and-propose" discipline used elsewhere in this project for compliance/data-integrity-sensitive decisions.
11. **Every mutation worth remembering is audited.** If it changes state a user or customer cares about, it goes through the event bus and lands in `auditLogs`.
12. **Free tier first, paid tier only with a documented reason.** Any dependency that costs money before there is revenue needs an explicit note in the relevant adapter's README explaining why no free/self-hosted alternative was sufficient.

---

# 17. Critical Review & Forward Look

A Staff/Principal Architect's job is not to rubber-stamp the plan — it is to stress-test it. Below are the weaknesses in the architecture above, honestly stated, along with the recommended mitigation for each.

## 17.1 The Desktop-First Choice Will Eventually Become a Constraint

Desktop-first is the right call for a $0-budget, single-customer MVP — it avoids hosting costs entirely and gives native OS integration for free. But it is a real constraint on Phase 9+ (multi-tenant, team-shared data, cloud sync): a purely local MongoDB doesn't give you a shared source of truth across teammates without building sync logic, which is nontrivial (conflict resolution, offline-first merge). **Recommendation:** design the repository layer's query patterns now as if they might run against a remote MongoDB Atlas free-tier cluster later — i.e., avoid any repository logic that assumes it's the only writer (like non-atomic read-then-write patterns), so that swapping a local Mongo for Atlas in Phase 9 is a connection-string change, not a rewrite.

## 17.2 The "Everything Is a Workflow" Ambition Can Slow Down Early Delivery

Generalizing every pipeline into the workflow engine (Phase 6) before Phases 2–5 are proven in production risks over-engineering: you'd be building an abstraction on top of only one or two concrete use cases, which usually produces the wrong abstraction. **Recommendation:** the roadmap in Section 2 already sequences this correctly (bespoke pipelines first, generalize into the engine second) — hold this ordering firmly even under pressure to "do it right the first time." Two or three concrete, working pipelines are a far better basis for a generic engine than a spec written in advance.

## 17.3 Free-Tier Dependence Is a Single Point of Fragility

Hunter's 25 searches/month, Google Maps' free credit, and similar limits are real operational constraints, not just cost-avoidance details — hitting them mid-workflow will silently degrade the product for the pilot customer if not surfaced clearly. The `providerUsage` tracking (Section 5.6, 9.3, 11.5) mitigates this, but it needs to be built in Phase 2/3, not deferred — quota exhaustion is a Day-30 problem, not a Year-2 problem, given a single active customer running real discovery workflows.

## 17.4 The n8n Bridge Is a Governance Risk If Under-Specified

n8n workflows can call arbitrary HTTP endpoints and execute arbitrary logic outside LeadForge's own codebase. If the n8n bridge (9.4) is implemented loosely — e.g., giving n8n broad credentials instead of narrowly scoped ones per bridge invocation — it becomes the easiest way to accidentally violate workspace isolation or leak a credential, since n8n's own execution logs live outside LeadForge's audit trail. **Recommendation:** treat every n8n workflow as an external, semi-trusted integration: scope its credentials per-invocation (short-lived tokens where possible), never hand it a workspace-wide credential, and always log both the _invocation_ and the _result_ on the LeadForge side even though n8n has its own internal logs — LeadForge's audit trail must be self-sufficient, not dependent on cross-referencing n8n's UI.

## 17.5 AI Qualification Risks Silent Bias/Drift Without Ground Truth

An LLM-based ICP qualification score (Section 10.3) will drift in quality as prompts, models, or the customer's ICP definition change, and without a labeled ground-truth set, regressions can go unnoticed until pipeline output visibly degrades. **Recommendation:** from Phase 4 onward, maintain a small hand-labeled evaluation set (even 30–50 companies scored by a human) and re-run it whenever the qualification prompt or model changes, tracking score agreement over time — this is cheap ($0, just time) and prevents silent quality regressions.

## 17.6 Single-User Auth Will Need Real Design Attention Sooner Than Phase 9 Suggests

Even a single freelancer today may want a second collaborator (a VA, a sales rep at Green Tech Modelers) well before "Phase 9 — Multi-Tenancy Activation" as currently scoped for a _second customer_. **Recommendation:** split multi-_user_ (multiple humans in one workspace) from multi-_tenant_ (multiple workspaces/customers) explicitly — the former is far cheaper to bring forward (the `users`/`workspaceMemberships` model in Section 11.1 already supports it) and should likely land around Phase 5–6, well before true multi-tenancy.

## 17.7 The Biggest Long-Term Risk: Scope

The long-term module list in the vision document (20+ modules) is a strong articulation of ambition, but it is also the classic way an infrastructure-minded engineer over-builds a platform before it has one delighted customer. The single most important discipline for the next 6 months is resisting the pull toward Section 3's full layered architecture before Phase 1's CRM and Phase 2's Discovery are genuinely used daily by Green Tech Modelers. This document should guide _direction_, not _sequencing pressure_ — every phase in Section 2 is deliberately ordered so that the next line of code written is always the one that gets the pilot customer closer to daily real usage, not the one that makes the architecture more "complete."

---

_End of document. This handbook should be revisited and versioned as LeadForge moves through each roadmap phase — particularly Sections 9 (Integrations) and 16 (Engineering Principles), which will accumulate the most real-world exceptions and lessons over time._
