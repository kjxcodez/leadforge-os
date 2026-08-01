# Package Boundaries & Dependency Rules

This specification establishes the modular boundaries of the AI, Agent, and Database subsystems in the LeadForge OS monorepo. It defines package scopes, folder structures, and rules to prevent circular references and protect runtime isolation.

---

## Workspace Package Layout

```text
packages/
  ├── ai/                   # AI Runtime (Low-level model/API integration only)
  │     ├── src/providers/  # OpenRouter & Ollama client connectors
  │     └── src/core/       # Prompt compilation, routing, caches, and retry logic
  │
  ├── agent-core/           # Agent SDK Contracts (Pure interfaces, events, context types)
  │     ├── src/agent/      # BaseAgent metadata specs
  │     ├── src/tools/      # Tool catalog, registry, result, and error contracts
  │     └── src/context/    # ExecutionContext contracts
  │
  └── database/             # Consolidated Local CRM DB Repositories
        ├── src/contracts/  # LeadRepository, CompanyRepository, ContactRepository
        └── src/sqlite/     # Concrete better-sqlite3 database access queries
```

---

## Subsystem Responsibilities

### 1. AI Runtime (`@leadforge/ai`)
* **Role**: Low-level LLM and API infrastructure.
* **Responsibilities**: Providers, prompt rendering, Zod output validation, cache lookups, retry policies, and latency logs.
* **Must NEVER Own**: Reasoning loops, planners, tool execution context, workspace states, or CRM logic.

### 2. Agent Core (`@leadforge/agent-core`)
* **Role**: Pure contracts, schemas, and metadata definitions.
* **Responsibilities**: Base interfaces (`BaseAgent`, `Tool`), memory store definitions, tool registries, catalog parameters, and event tracing schemas.
* **Must NEVER Own**: Execution loops, planners, SQLite connections, MongoDB Atlas APIs, or Electron handlers.

### 3. Database Layer (`@leadforge/database`)
* **Role**: Data access mapping isolation.
* **Responsibilities**: Defines and exposes `LeadRepository`, `CompanyRepository`, `ContactRepository`, `CampaignRepository`, `WorkflowRepository`, and `AgentMemoryRepository` contracts. Houses local SQLite reads/writes.
* **Must NEVER Own**: Sync change propagation, AI prompt rendering, agent planning loops, or UI components.

### 4. Sync Engine (`@leadforge/desktop` / `sync-engine`)
* **Role**: Data synchronization and replication.
* **Responsibilities**: Outbox logging, outbound batch transmission to MongoDB Atlas, inbound sync consolidation, conflict resolutions, and local-first offline availability hooks.
* **Must NEVER Own**: LLM prompts, agent planner logic, tool executions, or CRM UI views.

---

## Dependency Rules Matrix

The table below governs import permissions across the monorepo. Import paths that violate this matrix will fail build scripts.

| Package | Can depend on | Must never depend on |
| :--- | :--- | :--- |
| **`packages/ai`** | `packages/schema`, `packages/core` | `packages/agent-core`, Electron, SQLite, UI |
| **`packages/agent-core`** | `packages/schema`, `packages/core` | `packages/ai`, UI, SQLite, Electron, MongoDB |
| **`packages/database`** | `packages/schema`, `packages/core` | `packages/agent-core`, UI, Electron, MongoDB |
| **`apps/desktop`** | All packages | Nothing circular |
| **`worker-plugins`** | `packages/schema`, `packages/core` | Agent internals, UI, Electron |

---

## Architectural Verification Guide
To verify package isolation:
1. **Types-Only Import Boundary**: `packages/agent-core` must remain free of runtime infrastructure.
2. **Database Driver Isolation**: Direct imports of `better-sqlite3` and `mongodb` are forbidden outside of the concrete database repository implementations.
