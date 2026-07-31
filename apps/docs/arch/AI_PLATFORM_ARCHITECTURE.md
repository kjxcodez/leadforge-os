# LeadForge OS — AI & Agent Platform Architecture

This document specifies the permanent AI & Agent Platform architecture for LeadForge OS. It establishes a strict separation between model inference infrastructure (AI Runtime), orchestrating frameworks, agent capability schemas (Agent SDK), and business workflows.

---

## Phase 0: Repository Capability Audit

We audit all existing and stubbed components of the LeadForge OS monorepo to classify them into clean architectural boundaries. This ensures that features are placed strictly according to their domain, avoiding coupling between business agents and provider configurations.

| Code/Subsystem Component | Current Folder Location | Existing Role | Future Classification | Action |
| :--- | :--- | :--- | :--- | :--- |
| **Ollama Provider** | `packages/ai/src/providers/ollama.ts` | Dispatches local inference requests | **AI Runtime** | Keep in `@leadforge/ai-runtime` |
| **OpenRouter Provider** | `packages/ai/src/providers/openrouter.ts` | Dispatches cloud inference requests | **AI Runtime** | Keep in `@leadforge/ai-runtime` |
| **AIRuntime Executor** | `packages/ai/src/core/runtime.ts` | Handles cache, routing, LLM fetch | **AI Runtime** | Keep in `@leadforge/ai-runtime` |
| **Prompt Templates** | `packages/ai/src/prompts/library.ts` | Hardcoded prompt strings & helpers | **AI Runtime** | Keep in `@leadforge/ai-runtime` (convert to static assets) |
| **Zod Output Schemas** | `packages/ai/src/types/index.ts` | Outputs schema validators (Zod) | **AI Runtime** | Keep in `@leadforge/ai-runtime` |
| **Google Maps Scraper** | `apps/desktop/src/main/workers/plugins/scraper.ts` | Automates Playwright listing crawl | **Tool / Worker** | Expose as AI Tool contract via Agent SDK |
| **Cheerio Crawler** | `apps/desktop/src/main/workers/plugins/crawler.ts` | Website BFS mail/phone extractor | **Tool / Worker** | Expose as AI Tool contract via Agent SDK |
| **LinkedIn Enricher** | `apps/desktop/src/main/workers/plugins/linkedin.ts` | Executive finder with DDG fallback | **Tool / Worker** | Expose as AI Tool contract via Agent SDK |
| **SMTP Dispatcher** | `apps/desktop/src/main/workers/plugins/outreach.ts` | Sends email via Nodemailer | **Tool / Worker** | Expose as AI Tool contract (High Risk) |
| **IMAP Reply Poller** | `apps/desktop/src/main/workers/plugins/imap-poller.ts`| Correlates replies, updates CRM | **Tool / Worker** | Expose as AI Tool contract |
| **JobScheduler Service** | `apps/desktop/src/main/services/scheduler.ts` | Process control, heartbeats, queues | **Host Infrastructure**| Stays inside desktop main services |
| **Local CRM Repository** | `apps/desktop/src/main/database/repositories/local-crm.ts`| SQLite reads/writes | **Services / Data** | Stays inside desktop main db repositories |
| **SyncEngine** | `apps/desktop/src/main/services/sync-engine.ts` | Local-to-cloud mutations | **Services / Data** | Stays inside desktop main services |
| **SRE Observability** | `apps/desktop/src/main/ipc/observability-ipc.ts` | Metrics, logs, system pings | **Operations Center** | Stays inside desktop main IPC |
| **Workflow Engine** | `apps/desktop/src/main/workers/plugins/automation.ts`| Sequence executor | **Services / Workflows** | Stays inside desktop main workers |

### Classification Dictionary
1. **Should Become Runtime**: Core LLM providers, model configuration tables, prompt template loaders, cache controllers, and Zod output-validation layers.
2. **Should Become Agent Core**: Base interfaces, memory storage definitions, tool registries, and event tracing schemas.
3. **Should Become Agent Framework**: Planners, executors, and external adapters (Mastra, LangGraph, etc.) that run orchestration.
4. **Should Become Tool**: Worker plugin wrappers that translate inputs to scheduler job dispatches and return unified result payloads.
5. **Should Stay Business Logic**: Specific agent definitions, reasoning loops, prompts for custom workflows (e.g. Lead Qualification).
6. **Should Stay Scheduler**: Processes fork monitoring, CPU caps, heartbeats, and database claims.
7. **Should Never Become AI**: Standard CRUD CRM repositories, local-first SQLite sync mechanisms, network status hooks.

---

## Runtime Boundaries

The **AI Runtime** (`@leadforge/ai-runtime`) owns ONLY low-level model access utilities. It acts as an isolation barrier between the LLM and the application logic.

### Responsibilities
* **Provider Adapters**: Standardizing communication with Ollama, OpenRouter, and potential future providers (e.g. Anthropic, OpenAI).
* **Prompt Compilation**: Rendering raw parameters into text templates.
* **Structured Output Validation**: Enforcing output JSON structures using Zod schemas.
* **Caching**: Managing in-memory or database request/response caches.
* **Routing**: Selecting cloud vs. local execution based on cost, payload complexity, or offline state.
* **Retry/Fallback Policies**: Handling rate limits (HTTP 429) or timeouts, falling back to local models or mock templates.
* **Tracing Interfaces**: Emitting raw prompt latency, tokens consumed, and validation results.

### Non-Owned Domains (Must NOT Own)
* **Reasoning Loops**: It must never know if a prompt is part of a plan, chain, or loop.
* **Agent Context**: It does not track agent roles, memory stores, or tools.
* **Tool Execution**: It is completely unaware of the existence of file systems, scrapers, or network requests.
* **Workflow Orchestration**: It does not coordinate state jumps or campaign sequences.

---

## Agent Platform Architecture

We separate the Agent Platform into two distinct modules:
1. **`agent-core`**: Defines pure **contracts** and metadata schemas.
2. **`agent-framework`**: Houses the **execution semantics**, loop controllers, and third-party orchestration adapters.

```text
  [ agent-core ] (Stable Contracts)
        ▲
        │ (Inherits/Implements)
  [ agent-framework ] (Execution/Adapters: Mastra, LangGraph)
        ▲
        │ (Executes)
  [ agents ] (Business Logic Agents)
```

---

## Agent Core Definitions

This section defines the core concepts and invariants of the platform without committing to a concrete TypeScript API.

### 1. `BaseAgent`
* **Purpose**: Metadata-only representation of an agent identity.
* **Invariants**: Must NEVER perform planning, looping, provider access, or database/network execution.
* **Metadata Fields**:
  * `id`: Unique agent identity key.
  * `name`: User-facing name.
  * `description`: Purpose explanation.
  * `systemPrompt`: Instruction template.
  * `tools`: List of catalog tool keys.
  * `memoryScopes`: Array of scopes needed.
  * `capabilities`: Provider capability flags needed.

### 2. `Tool`
* **Purpose**: Defines an interface for actions that can be executed by an LLM or planner.
* **Lifecycle**: Registered globally at application startup.
* **Responsibilities**:
  * Declares input validation requirements using Zod.
  * Declares safety risk classification (Low, Medium, High).
  * Wraps execution callbacks.
* **Invariants**:
  * Must declare all parameters explicitly (no hidden or dynamic parameters).
  * Must execute within strict timeouts.
* **Dependencies**: `ZodSchema`, `ExecutionContext`.

### 3. `ToolRegistry`
* **Purpose**: A runtime lookup table matching tool implementations to their keys.
* **Invariants**: Metadata lookup must contain zero database/scheduler dependencies. The registry must never execute or dispatch tools itself.

---

## Scheduler Gateway

To enforce strict boundary isolation (ADR-009), tools are forbidden from accessing the SQLite database or scheduler table schemas directly. All dispatches flow through a `SchedulerGateway` (or `JobSubmissionService`):

```text
Tool Execution ──► SchedulerGateway ──► SQL INSERT jobs ──► JobScheduler ──► Worker Process
```

### Responsibilities
* Accept job submission payloads.
* Validate parameter structures.
* Execute database entries.
* Subscribe to EventBus and return normalized `ToolResult` on complete/fail.
* Hide SQLite schema details from tools.

---

## Expanded ExecutionContext

The execution context exposes correlation IDs and actor identities without leaking credentials:
* `workspaceId`: Target tenant identifier.
* `executionId`: Execution transaction identifier.
* `traceId`: Observability correlation tracker.
* `jobId`: Optional scheduler job ID.
* `actorId`: User or agent key.
* `actorType`: 'user' | 'agent' | 'system'.
* `requestedBy`: Invocation source label.
* `permissions`: Array of user scopes.
* `executionMode`: 'offline' | 'online'.
* `abortSignal`: Propagation for cancellation.
* `metadata`: Free-form metrics.

*Explicitly excludes: API keys, SMTP passwords, session cookies, database handles.*

---

## Expanded ToolResult & ToolError Taxonomy

### 1. ToolResult Envelope
* `success`: Boolean.
* `data`: Typed success payload.
* `error`: Discriminated `ToolError`.
* `metadata`:
  * `startedAt` / `completedAt`: ISO-8601 timestamps.
  * `durationMs`: Latency tracking.
  * `attempt`: Current try index.
  * `workerId`: Executing process PID.
  * `traceId` / `jobId` / `workspaceId`: Correlation scopes.
  * `cached`: Boolean flag.
  * `provider`: LLM provider name.
  * `checkpointUsed`: Last verified checkpoint.
  * `retryCount`: Integer value.

### 2. ToolError Taxonomy
* `VALIDATION_ERROR`: Schema validation fails.
* `PERMISSION_DENIED`: Unauthorized operation.
* `APPROVAL_REQUIRED`: Paused awaiting user gate.
* `TIMEOUT`: Execution exceeded deadline limit.
* `RATE_LIMITED`: Target API rate limit hit.
* `RESOURCE_EXHAUSTED`: Disk/CPU boundaries exceeded.
* `UNAVAILABLE`: Remote network or model offline.
* `SCHEDULER_ERROR`: Spawn failure or SQLite lock.
* `WORKER_ERROR`: Node child process crashed.
* `CHECKPOINT_RESTORED`: Resumed from checkpoint.
* `CANCELLED_BY_USER`: AbortSignal triggered.
* `UNKNOWN`: Generic errors.

*Each error exposes an `isRetryable: boolean` property to determine backoff paths.*
