# LeadForge OS — AI & Agent Platform Architecture

This document specifies the permanent AI & Agent Platform architecture for LeadForge OS. It establishes a strict separation between low-level model inference infrastructure (AI Runtime), orchestrating frameworks, agent capability schemas (Agent SDK), and business workflows.

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

## Phase 1 & 3: Runtime Boundaries

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

## Phase 4: Agent Platform Architecture

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

## Phase 5: Agent Core Definitions

This section defines the core concepts and invariants of the platform without committing to a concrete TypeScript API.

### 1. `BaseAgent`
* **Purpose**: Abstract representation of an agent identity.
* **Lifecycle**: Instantiated by the application workspace; active during a single pipeline run or a persistent user-chat session.
* **Responsibilities**:
  * Exposes agent metadata (name, description, role, icon).
  * Exposes system instructions and persona constraints.
  * Declares required capabilities and tool configurations.
* **Invariants**:
  * Must never import provider credentials (API keys) or endpoint configurations.
  * Must remain completely independent of the execution loop (e.g. it does not know if it is run inside a Graph or a linear chain).
* **Dependencies**: `AgentContext`, `AgentMemory`, `Tool`.

### 2. `Tool`
* **Purpose**: Defines an interface for actions that can be executed by an LLM or planner.
* **Lifecycle**: Registered globally at application startup.
* **Responsibilities**:
  * Declares input validation requirements.
  * Declares safety risk classification (Low, Medium, High).
  * Wraps execution callbacks.
* **Invariants**:
  * Must declare all parameters explicitly (no hidden or dynamic parameters).
  * Must execute within strict timeouts.
* **Dependencies**: `ZodSchema`, `ExecutionContext`.

### 3. `ToolRegistry`
* **Purpose**: A lookup table matching tools to their keys.
* **Responsibilities**:
  * Registers and resolves tools.
  * Lists available tools to help the LLM choose actions.

---

## Phase 6: Business Agent Boundaries

This section defines the operational scopes of the six business agents.

### 1. `ResearchAgent`
* **Responsibilities**: Discovers local businesses matching target niches and locations.
* **Inputs**: Search query (e.g. "Software agencies in Austin"), geographical radius limit.
* **Outputs**: List of company profiles with verified domains and business details.
* **Memory Needs**: Conversation (to refine search filters) and Scratchpad (to track pagination offsets).
* **Tool Requirements**: `search_local_businesses` (maps scraper).
* **Safety Considerations**: Must obey Google Maps terms of service.
* **Human Approval**: Automated (requires no human gate).

### 2. `LeadResearchAgent`
* **Responsibilities**: Crawls target company websites and parses online profiles to discover key decision makers.
* **Inputs**: Company details, target job titles (e.g., "CEO", "Marketing Director").
* **Outputs**: List of enriched contacts with names, titles, email addresses, and LinkedIn profiles.
* **Memory Needs**: Workspace memory (to avoid crawling recently parsed websites).
* **Tool Requirements**: `crawl_company_website`, `search_linkedin_profiles`.
* **Safety Considerations**: LinkedIn scraping must run with rate limits to protect session cookies (`li_at`).
* **Human Approval**: Automated, unless a session error is caught (which pauses the task and alerts the user).

### 3. `CampaignAssistant`
* **Responsibilities**: Writes personalized cold email templates, maps schedules, and queues outreach.
* **Inputs**: Target contacts, product description, value proposition, campaign parameters.
* **Outputs**: Formatted email templates with parsed tags.
* **Memory Needs**: Long-term memory (historical templates) and Conversation memory.
* **Tool Requirements**: None (pure LLM template generation).
* **Safety Considerations**: Prevents generation of misleading or spam-like email copy.
* **Human Approval**: **Mandatory Gate**. Draft templates must be reviewed and approved by the user before campaign enrollment.

### 4. `CRMNavigator`
* **Responsibilities**: Maintains CRM database records and logs timelines.
* **Inputs**: Target entity, field update payloads (e.g. tags, notes, lead stages).
* **Outputs**: Sync confirmations.
* **Memory Needs**: Execution memory.
* **Tool Requirements**: `update_crm_record`, `add_activity_log`.
* **Safety Considerations**: Prevents bulk deletes or accidental stage modifications.
* **Human Approval**: High-risk operations (such as bulk data wipes or archive triggers) require human approval.

### 5. `WorkflowAssistant`
* **Responsibilities**: Builds and edits automation sequences.
* **Inputs**: Trigger details, desired outcomes (e.g. "when lead replies, send webhook").
* **Outputs**: JSON execution steps for the workflow engine.
* **Memory Needs**: Scratchpad (to build node trees).
* **Tool Requirements**: None (produces validated sequence schemas).
* **Safety Considerations**: Validates sequences to prevent infinite GOTO loops.
* **Human Approval**: **Mandatory Gate**. New or updated automation structures require user approval before deployment.

### 6. `SupportAssistant`
* **Responsibilities**: Answers user questions and troubleshoots app errors.
* **Inputs**: Natural language questions, error logs.
* **Outputs**: Step-by-step instructions.
* **Memory Needs**: Conversation memory.
* **Tool Requirements**: `query_system_diagnostics`, `search_local_docs`.
* **Safety Considerations**: Must not modify any system configuration.
* **Human Approval**: Automated.

---

## Phase 7: Framework Adapter Layer

The **Framework Adapter Layer** (located in `packages/agent-framework`) wraps third-party orchestration libraries (such as Mastra or LangGraph) in standard platform interfaces. 

Adapters query the framework's features and return a comprehensive capabilities matrix:

```typescript
interface FrameworkCapabilities {
  supportsStreaming: boolean;
  supportsPlanning: boolean;
  supportsCheckpointing: boolean;
  supportsInterrupts: boolean;
  supportsCancellation: boolean;
  supportsMultiAgent: boolean;
  supportsHumanApproval: boolean;
  supportsStructuredOutputs: boolean;
  supportsRetries: boolean;
  supportsTracing: boolean;
  supportsMCP: boolean;
  supportsBackgroundExecution: boolean;
  supportsPersistence: boolean;
  supportsBranching: boolean;
  supportsReflection: boolean;
  supportsGuardrails: boolean;
}
```

If a framework lacks native support for a capability (e.g., local state checkpointing), the adapter must implement a fallback (such as serializing state to the local SQLite database).

---

## Phase 8: Memory Model Dimensions

LeadForge OS defines memory scopes across four distinct dimensions: **Owner**, **Lifetime**, **Visibility**, and **Persistence**.

| Memory Scope | Owner | Lifetime | Visibility (Shared?) | Persistence (Storage) |
| :--- | :--- | :--- | :--- | :--- |
| **Conversation** | Active Session | Session | Single User (No) | SQLite (`messages` table) |
| **Workspace** | Workspace | Permanent | Shared across Workspace (Yes) | SQLite (`settings` table) |
| **Execution** | Job | Job | Single Worker (No) | In-Memory (Job payload context) |
| **Scratchpad** | Planner | Loop Iteration | Single Step (No) | In-Memory (State variables) |
| **Semantic** | Workspace | Permanent | Shared across Workspace (Yes) | SQLite + `sqlite-vec` index |

---

## Phase 9: Execution Model

The workflow from user action to LLM response and back:

```text
[1. User Interface]  -- Triggers task (e.g. "Find leads in Austin")
       │
       ▼
[2. Business Agent]  -- Resolves tools and system prompts
       │
       ▼
[3. Planner]         -- Generates step-by-step execution plan
       │
       ▼
[4. Tool Registry]   -- Resolves tools (e.g. "search_local_businesses")
       │
       ▼
[5. JobScheduler]    -- Claims job, forks sandboxed child worker
       │
       ▼
[6. Worker Process]  -- Executes worker plugin (e.g. Maps Playwright scraper)
       │
       ▼
[7. SQLite Database] -- Writes newly discovered leads to database
       │
       ▼
[8. Agent Executor]  -- Reads database changes, formats output payload
       │
       ▼
[9. AI Runtime]      -- Sends data to LLM provider (Ollama/OpenRouter)
       │
       ▼
[10. LLM Engine]     -- Generates qualified lead DTO
       │
       ▼
[11. User Interface] -- Displays results in local CRM dashboard
```

---

## Phase 10: Tracing Architecture

All agent actions, LLM calls, and tool runs are logged in the `system_logs` and `audit_logs` tables in SQLite.

```typescript
interface AgentTrace {
  traceId: string;
  jobId?: string;
  agentId: string;
  provider: string;
  model: string;
  promptText: string;
  responseText?: string;
  tokensConsumed?: { prompt: number; completion: number };
  latencyMs: number;
  toolCalls: Array<{ toolName: string; durationMs: number; success: boolean }>;
  error?: string;
}
```

The Operations Center queries these logs to build trace visualizers, tracking LLM latency, cost calculations (for cloud models), and tool runs.

---

## Phase 11: Safety & Guardrails

The safety model protects users from rate limits, IP blacklisting, and credential leaks.

### Tool Permission Levels
Tools are categorized by risk level:
* **Low Risk**: Read-only database queries, local document searches, website HTML crawls. (Automated execution).
* **Medium Risk**: CRM record updates, tag assignments. (Requires validation checks, but runs automatically).
* **High Risk**: Sending emails, LinkedIn actions, changing workflow steps. (Requires manual approval).

```text
[ High Risk Action Triggered ]
              │
              ▼
  [ Check Approval Table ] ──(Approved)──► [ Execute Tool ]
              │
         (Unapproved)
              ▼
  [ Write to approvals table ]
  [ Emit IPC status notification ]
  [ Pause job scheduler execution ]
              │
      (User Clicks 'Approve')
              ▼
  [ Set state to 'approved' ]
  [ Resume job scheduler execution ]
```

### Approval Gates
High-risk tools write a request to the `approvals` table, pause the running job, and notify the user via IPC. The scheduler resumes execution only after the user approves the action.

### Recovery and Rollbacks
If a tool fails:
* **Scrapers/Crawlers**: The worker saves a checkpoint, releases database locks, and exits. The scheduler handles retries using exponential backoffs.
* **Database Updates**: Database writes run inside SQL transactions. If an update fails, the transaction is rolled back to prevent corrupted data states.
