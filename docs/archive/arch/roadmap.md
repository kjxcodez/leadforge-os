# 17. Structural Implementation Roadmap

This document outlines the phased roadmap to transition LeadForge OS from the current standalone desktop model into a distributed, multi-workspace monorepo.

---

## Roadmap Phases

### Phase 1: Foundation (Current - Weeks 1–2)
- **Goals**: Resolve build configurations and set up style engines.
- **Deliverables**: Integrate Tailwind CSS v4, configure path aliases in tsconfig, and fix development server load URL routing.
- **Dependencies**: None.
- **Risks**: Local dev caching lockups.
- **Completion Criteria**: App compiles and runs without console errors.

### Phase 2: Core Monorepo Extraction (Weeks 3–4)
- **Goals**: Deconstruct the desktop monolith into clean package layers.
- **Deliverables**: Extract `packages/types`, `packages/shared`, and `packages/ui` from `apps/desktop/src/`.
- **Dependencies**: Phase 1.
- **Risks**: Broken relative import paths across workspace apps.
- **Completion Criteria**: `apps/desktop` imports UI elements and common types from workspace modules, typechecking passes.

### Phase 3: CRM & Local Database Layer (Weeks 5–6)
- **Goals**: Create local database tables and migration scripts.
- **Deliverables**: Extract local DB queries to `packages/db` and build migrations.
- **Dependencies**: Phase 2.
- **Risks**: Data corruption or schema update conflicts on updating client apps.
- **Completion Criteria**: Local SQLite writes function cleanly with versioned updates.

### Phase 4: Automation Workers (Weeks 7–8)
- **Goals**: Offload Playwright scraping out of the desktop main process.
- **Deliverables**: Create `apps/worker` background runner, and implement an atomic task queue in the database.
- **Dependencies**: Phase 3.
- **Risks**: Blocking main GUI events during CPU-heavy operations.
- **Completion Criteria**: Local child process scrapers run tasks without UI lag.

### Phase 5: AI & Agent Integration (Weeks 9–10)
- **Goals**: Secure LLM tool calling and local vector search.
- **Deliverables**: Setup `sqlite-vec` local database vector indexing, configure OpenRouter adapters, and store versioned prompt YAML files.
- **Dependencies**: Phase 4.
- **Risks**: Malicious prompts hijacking execution flows.
- **Completion Criteria**: AI agents qualify leads and fetch context local vector stores.

### Phase 6: Plugin SDK (Weeks 11–12)
- **Goals**: Allow secure third-party customization modules.
- **Deliverables**: Design plugin manifest parser and implement a sandboxed V8 Isolate execution wrapper.
- **Dependencies**: Phase 5.
- **Risks**: Plugins accessing filesystem credentials.
- **Completion Criteria**: Unsigned scripts are blocked; signed scripts execute within secure boundaries.
