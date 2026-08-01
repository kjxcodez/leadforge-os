# LeadForge OS - Architectural Decision Records (ADRs)

This directory contains the Architectural Decision Records (ADRs) for LeadForge OS. They document the key design choices, runtime splits, and software structures adopted in the project.

## ADR Index

1. **[ADR-001: AI Runtime Responsibilities](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/docs/adr/ADR-001-runtime-responsibilities.md)**  
   Restricts `@leadforge/ai` to low-level runtime concerns (providers, yaml templates, zod validations, prompts cache).
2. **[ADR-002: Agent SDK Boundaries](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/docs/adr/ADR-002-agent-sdk.md)**  
   Defines decoupled interactions between agent scripts and the core Electron orchestrator.
3. **[ADR-003: Worker Plugins as Tools](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/docs/adr/ADR-003-worker-plugins-as-tools.md)**  
   Wraps job scheduler worker plugins as LLM tools to enable agent-guided executions.
4. **[ADR-004: Memory Model](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/docs/adr/ADR-004-memory-model.md)**  
   Adopts a workspace-isolated local CRM storing summaries and vectors on a per-tenant basis.
5. **[ADR-005: Framework Adapter Strategy](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/docs/adr/ADR-005-framework-adapter-strategy.md)**  
   Applies framework-agnostic interfaces to isolate Electron and Hono APIs.
6. **[ADR-006: Safety Model](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/docs/adr/ADR-006-safety-model.md)**  
   Guarantees credentials safety using safeStorage and sanitizing output logs from webhook triggers.
7. **[ADR-007: Dependency Rules](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/docs/adr/ADR-007-dependency-rules.md)**  
   Sets up dependency cruiser gates preventing cycle loops and coupling between packages.
8. **[ADR-008: LLM Infrastructure Separation](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/docs/adr/ADR-008-llm-infrastructure-separation.md)**  
   Separates prompt building from active model client instances.
9. **[ADR-009: Scheduler Gateway](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/docs/adr/ADR-009-scheduler-gateway.md)**  
   Orchestrates concurrent crawler pings and CPU utilization via the main process.
10. **[ADR-010: Distributed Data Model](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/docs/adr/ADR-010-distributed-data-model.md)**  
    Establishes offline-first mutations using isolated local-only SQLite schemas.
11. **[ADR-011: Sync Architecture](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/docs/adr/ADR-011-sync-architecture.md)**  
    Coordinates SQLite sync queues to Hono MongoDB sync targets over HTTP.
12. **[ADR-012: Provider Capability Model](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/docs/adr/ADR-012-provider-capability-model.md)**  
    Audits active model capabilities dynamically at startup.
13. **[ADR-013: Tool Catalog](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/docs/adr/ADR-013-tool-catalog.md)**  
    Declares a single registry for scraping and emailing tools to prevent model errors.
