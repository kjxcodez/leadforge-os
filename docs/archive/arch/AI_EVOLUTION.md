# AI Platform Evolution Strategy

This document outlines the phased roadmap for building out the AI and agent systems within LeadForge OS. It prevents the team from attempting to build complex multi-agent architectures before establishing stable foundations.

---

## Phased Capability Roadmap

```text
  [ Phase 1: AI Runtime ] (Current State)
            │
            ▼
  [ Phase 2: Agent SDK & Core ] (Establish Interfaces & Tools)
            │
            ▼
  [ Phase 3: Planners & Checkpoints ] (Add Reasoning & Frameworks)
            │
            ▼
  [ Phase 4: Multi-Agent Collaboration ] (Shared Memory & Delegation)
```

---

## Detailed Phases

### Phase 1: AI Runtime (Stable Foundation)

- **Goal**: Stabilize low-level LLM access, caching, and Zod output validations.
- **Capabilities**:
  - Render prompts via static templates.
  - Fallback from OpenRouter to Ollama when offline.
  - Simple, non-agent lead scoring and text summarization.
- **Storage**: In-memory Map cache.

### Phase 2: Agent SDK & Tool Registry

- **Goal**: Establish the contract layer and wrap existing worker plugins as tools.
- **Capabilities**:
  - Define `BaseAgent` and `Tool` interfaces in `@leadforge/agent-core`.
  - Wrap Maps Scraper and Web Crawler plugins inside `SchedulerJobTool` adapters.
  - Run linear single-agent workflows (e.g. Research Agent crawls a target domain).
- **Storage**: Active workspace SQLite databases.

### Phase 3: Planner Integration & Checkpoints

- **Goal**: Introduce reasoning loops and third-party orchestration adapters.
- **Capabilities**:
  - Implement framework adapters (Mastra, LangGraph) in `@leadforge/agent-framework`.
  - Multi-step self-reflection loops (e.g. agent inspects crawl results and decides to crawl another page).
  - Human-in-the-loop approval gates for high-risk actions.
- **Storage**: SQLite-backed state checkpointing.

### Phase 4: Multi-Agent Collaboration

- **Goal**: Enable cooperative agents sharing workspace state.
- **Capabilities**:
  - Research Agent automatically handsoff qualified prospects to the Campaign Assistant.
  - Shared semantic vector memory using `sqlite-vec`.
  - Workspace-wide activity feeds logging agent collaborations.
- **Storage**: Local vector indices.
