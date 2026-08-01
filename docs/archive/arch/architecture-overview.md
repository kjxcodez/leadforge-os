# 1. Repository Architecture & Technology Stack Overview

## Monorepo Strategy & Philosophy

LeadForge OS is built using a **Monorepo Strategy** powered by **pnpm workspaces** and **Turborepo**. The key goal is to maintain a unified workspace containing multiple logical packages and applications, ensuring a single source of truth for dependencies, type definitions, and configurations.

### Rationale for Core Stack Selection:

1. **Turborepo**:
   - _Why_: Turborepo operates as the orchestrator for building, linting, and testing tasks. It uses local caching (`.turbo`) to skip execution for unchanged code, which is critical for reducing CI/CD execution time.
   - _Advantages_: Significant speedups in monorepo compilation pipelines; declarative task definition (`turbo.json`) makes build ordering predictable.
   - _Disadvantages_: Requires learning a task syntax; misconfigured caching keys can lead to stale build assets in local development.
   - _Long-term implications_: Scales cleanly up to 100+ packages without linearly increasing execution times.

2. **pnpm workspaces**:
   - _Why_: Fast dependency resolution and a content-addressable storage store that avoids duplicating identical dependencies across projects.
   - _Advantages_: Hard links prevent the "phantom dependencies" common in npm or yarn workspaces; faster installations.
   - _Disadvantages_: Simlinked layouts can sometimes cause compatibility issues with legacy node tools.
   - _Long-term implications_: Keeps disk space minimal and enables modular package boundaries.

3. **Electron**:
   - _Why_: Offers desktop-native integration (system tray control, local SQLite databases, child process spawning for scrapers, hardware access) while using standard web development tooling.
   - _Advantages_: Bypasses hosting costs for scraping operations by executing them directly on client machines; runs completely offline.
   - _Disadvantages_: Increased memory consumption and installer bundle sizes.
   - _Long-term implications_: Decoupled backend boundaries (Internal API) make migrating to a cloud client in the future a minor transport layer update.

4. **React**:
   - _Why_: Component modularity matches the high-density dashboard layouts required for lead acquisition screens.
   - _Advantages_: Wide developer pool; excellent virtualized tables support.
   - _Disadvantages_: React rendering cycles can block UI threads if state updates are unoptimized.
   - _Long-term implications_: Easily reusable layout elements for future web applications.

5. **TypeScript**:
   - _Why_: Type safety is essential when passing data boundaries between the Main, Preload, and Renderer processes.
   - _Advantages_: Early compile-time catching of mismatched contracts.
   - _Disadvantages_: Additional build time overhead.

---

## Inter-Process Communication (IPC) Flow

The Electron app boundaries communicate through a strictly defined hierarchy. Web-facing code in the Renderer cannot execute Node APIs; it must pass through a validated Preload script boundary.

```mermaid
sequenceDiagram
    participant R as Renderer (React UI)
    participant P as Preload Script (ContextBridge)
    participant M as Main Process (Node/Electron)
    participant DB as SQLite Local Database

    R->>P: window.ipc.invoke('ipc:test')
    Note over P: Validates payload and channels
    P->>M: ipcRenderer.invoke('ipc:test')
    Note over M: Handles request, runs Node service
    M->>DB: Query / Write
    DB-->>M: Record data
    M-->>P: Resolves result DTO
    P-->>R: Returns data state to React component
```
