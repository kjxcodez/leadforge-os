# LeadForge OS Architecture Reference Index

This is the entry point for the Canonical Architecture Reference & Repository Audit of LeadForge OS. It maps out the actual current state of the repository, compares it with the target systems, and defines architectural blueprints for long-term scalability.

## Documents

1. **[Architecture Overview](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/docs/arch/architecture-overview.md)**
   _Overall philosophy, monorepo strategy, stack rationale, and process communication._

2. **[Repository Structure](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/docs/arch/repository-structure.md)**
   _Complete audit of current tracked directories, files, and target layouts._

3. **[Applications Architecture (apps/)](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/docs/arch/apps-architecture.md)**
   _Audit of apps/desktop, apps/docs, and recommended future applications._

4. **[Packages Architecture (packages/)](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/docs/arch/packages-architecture.md)**
   _Deconstruction of the empty packages directory and recommended library extractions._

5. **[Desktop Application Structure](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/docs/arch/desktop-architecture.md)**
   _Electron processes deconstruction, context isolation, and IPC boundaries._

6. **[Renderer Process Audit](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/docs/arch/renderer-architecture.md)**
   _React screens directory structure, styling compilation, and state._

7. **[Main Process Audit](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/docs/arch/main-process-architecture.md)**
   _System handlers, window lifecycles, and forbidden Node operations._

8. **[Dependency Graph](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/docs/arch/dependency-graph.md)**
   _Permitted vs. forbidden package dependencies and architectural layers._

9. **[Security Architecture](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/docs/arch/security-architecture.md)**
   _IPC validation, credential safeStorage, sandbox restrictions, and updates._

10. **[Documentation Strategy](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/docs/arch/documentation-strategy.md)**
    _Architecture Decision Records (ADRs) and folder organizations._

11. **[Plugin Architecture](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/docs/arch/plugin-architecture.md)**
    _Dynamic loading sandbox runtime, signatures, and extensibility._

12. **[Workflow Architecture](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/docs/arch/workflow-architecture.md)**
    _Headless Playwright processes, task queues, n8n automation, and runtime recovery._

13. **[AI Architecture](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/docs/arch/ai-architecture.md)**
    _Model providers, prompts versioning, tool-calling structures, and local SQLite-vec vector storage._

14. **[Scalability Review](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/docs/arch/scalability-review.md)**
    _Multi-developer boundaries, Vitest configurations, and monorepo build caches._

15. **[Repository Scorecard](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/docs/arch/repository-scorecard.md)**
    _Grading of codebase health, security, and developer experience._

16. **[Technical Debt Log](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/docs/arch/technical-debt.md)**
    _Prioritized catalog of immediate, medium-term, and long-term architectural debt._

17. **[Implementation Roadmap](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/docs/arch/roadmap.md)**
    _Phased steps from Horizon 1 MVP to Horizon 3 plugin marketplace._
