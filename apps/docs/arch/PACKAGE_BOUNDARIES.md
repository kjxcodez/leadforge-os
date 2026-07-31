# Package Boundaries & Dependency Rules

This specification establishes the modular boundaries of the AI and Agent subsystems in the LeadForge OS monorepo. It defines package scopes, folder structures, and rules to prevent circular references and protect runtime isolation.

---

## Workspace Package Layout

```text
packages/
  ├── ai-runtime/           # AI Runtime (Low-level model/API integration only)
  │     ├── src/providers/  # OpenRouter & Ollama client connectors
  │     └── src/core/       # Prompt compilation, routing, caches, and retry logic
  │
  ├── agent-core/           # Agent SDK Contracts (Pure interfaces, events, context types)
  │     └── src/types.ts    # Abstract types for Agents, Tools, and Contexts
  │
  ├── agent-framework/      # Agent Orchestration (Planners, loops, and framework adapters)
  │     ├── src/executors/  # Reflection loop, flow runners
  │     └── src/adapters/   # Framework adapters (Mastra, LangGraph, etc.)
  │
  └── agents/               # Business Agents (Specific logic parameters)
        ├── research/       # Lead discovery agent settings
        ├── campaign/       # Outreach template agent settings
        └── crm/            # Database updates safety checks
```

---

## Package Responsibilities

### 1. AI Runtime (`@leadforge/ai-runtime`)
* **Role**: Low-level LLM and API infrastructure.
* **Responsibilities**: Providers, prompt rendering, Zod output validation, cache lookups, retry policies, and latency logs.
* **Must NEVER Own**: Reasoning loops, planners, tool execution context, workspace states, or CRM logic.

### 2. Agent Core (`@leadforge/agent-core`)
* **Role**: Pure contracts and schemas.
* **Responsibilities**: Base interfaces (`BaseAgent`, `Tool`), memory store definitions, tool registries, and event tracing schemas.
* **Must NEVER Own**: Execution loops, planners, framework adapters, SQLite connections, or Electron APIs.

### 3. Agent Framework (`@leadforge/agent-framework`)
* **Role**: Execution, loops, and adapters.
* **Responsibilities**: `AgentExecutor` implementations, planning integrations, state checkpoint controllers, and adapters (Mastra, LangGraph).
* **Must NEVER Own**: Specific business prompts, UI screens, or raw database sync queues.

### 4. Business Agents (`@leadforge/agents`)
* **Role**: Agent configurations and prompt parameters.
* **Responsibilities**: System prompts, tool dependencies, input/output structures, and approval gates.
* **Must NEVER Own**: Provider configurations (Ollama URLs, API keys), HTTP clients, prompt compilation engines, or specific execution loop orchestrators.

---

## Dependency Rules Matrix

The table below governs import permissions across the monorepo. Import paths that violate this matrix will fail build scripts.

| Package | Can depend on | Must never depend on |
| :--- | :--- | :--- |
| **`packages/ai-runtime`** | `packages/schema`, `packages/core` | `packages/agent-core`, `packages/agents`, Electron, SQLite, UI |
| **`packages/agent-core`** | `packages/schema`, `packages/core` | `packages/ai-runtime`, `packages/agents`, UI, SQLite, Electron |
| **`packages/agent-framework`**| `packages/agent-core`, `packages/ai-runtime` | `packages/agents`, UI, SQLite, Electron |
| **`packages/agents`** | `packages/agent-core`, `packages/schema` | Provider configurations, raw HTTP clients, UI, Electron |
| **`apps/desktop`** | All packages | Nothing circular |
| **`worker-plugins`** | `packages/schema`, `packages/core` | Agent internals, UI, Electron |

---

## Architectural Verification Guide
To verify package isolation:
1. **Types-Only Import Boundary**: `packages/agents` must only import types from `@leadforge/agent-core`. It must never import concrete execution engines or framework libraries directly.
2. **Build-Order Isolation**: The monorepo builds `packages/schema`, `packages/ai-runtime`, and `packages/agent-core` first, followed by `packages/agent-framework`, and finally `packages/agents`.
