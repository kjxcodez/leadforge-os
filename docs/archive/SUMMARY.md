# LeadForge OS Architecture Reference Index

This is the entry point for the Canonical Architecture Reference & Repository Audit of LeadForge OS. It maps out the actual current state of the repository, compares it with the target systems, and defines architectural blueprints for long-term scalability.

## Documents

1. **[Architecture Overview](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/docs/arch/architecture-overview.md)**
   *Overall philosophy, monorepo strategy, stack rationale, and process communication.*

2. **[Repository Structure](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/docs/arch/repository-structure.md)**
   *Complete audit of current tracked directories, files, and target layouts.*

3. **[Applications Architecture (apps/)](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/docs/arch/apps-architecture.md)**
   *Audit of apps/desktop, apps/docs, and recommended future applications.*

4. **[Packages Architecture (packages/)](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/docs/arch/packages-architecture.md)**
   *Deconstruction of the empty packages directory and recommended library extractions.*

5. **[Desktop Application Structure](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/docs/arch/desktop-architecture.md)**
   *Electron processes deconstruction, context isolation, and IPC boundaries.*

6. **[Renderer Process Audit](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/docs/arch/renderer-architecture.md)**
   *React screens directory structure, styling compilation, and state.*

7. **[Main Process Audit](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/docs/arch/main-process-architecture.md)**
   *System handlers, window lifecycles, and forbidden Node operations.*

8. **[Dependency Graph](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/docs/arch/dependency-graph.md)**
   *Permitted vs. forbidden package dependencies and architectural layers.*

9. **[Security Architecture](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/docs/arch/security-architecture.md)**
   *IPC validation, credential safeStorage, sandbox restrictions, and updates.*

10. **[Documentation Strategy](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/docs/arch/documentation-strategy.md)**
    *Architecture Decision Records (ADRs) and folder organizations.*

11. **[Plugin Architecture](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/docs/arch/plugin-architecture.md)**
    *Dynamic loading sandbox runtime, signatures, and extensibility.*

12. **[Workflow Architecture](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/docs/arch/workflow-architecture.md)**
    *Headless Playwright processes, task queues, n8n automation, and runtime recovery.*

13. **[AI Architecture](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/docs/arch/ai-architecture.md)**
    *Model providers, prompts versioning, tool-calling structures, and local SQLite-vec vector storage.*

14. **[Scalability Review](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/docs/arch/scalability-review.md)**
    *Multi-developer boundaries, Vitest configurations, and monorepo build caches.*

15. **[Repository Scorecard](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/docs/arch/repository-scorecard.md)**
    *Grading of codebase health, security, and developer experience.*

16. **[Technical Debt Log](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/docs/arch/technical-debt.md)**
    *Prioritized catalog of immediate, medium-term, and long-term architectural debt.*

17. **[Implementation Roadmap](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/docs/arch/roadmap.md)**
    *Phased steps from Horizon 1 MVP to Horizon 3 plugin marketplace.*
