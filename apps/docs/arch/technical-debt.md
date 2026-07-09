# 16. Technical Debt Log

This log registers the technical debt present in the codebase, prioritized by structural impact.

---

## 1. Immediate Debt (High Priority)
- **Monolith UI Coupling**: The Tailwind tokens and shared `cn.ts` are located inside `apps/desktop/src/shared` instead of being shared packages. 
- **Missing Shared Types**: The React frontend imports type descriptions from unstructured paths. These must be extracted to `packages/types`.

---

## 2. Medium-Term Debt (Medium Priority)
- **Local SQLite / Prisma Database Layer**: Local database writes currently reside directly in the main Electron process file. This needs to be isolated into a database package (`packages/db`) to support clean migrations.
- **Preload API Expansion**: The IPC channels allowlist is currently hardcoded inside `preload/index.ts`. Exposing new channels requires modifying the preload script. A typed channel registry is needed.

---

## 3. Long-Term Debt (Low Priority)
- **Plugin Sandbox isolation**: Dynamic plugins currently execute without isolation. As third-party integrations expand, these must run inside V8 Isolates.
- **Distributed Worker Queue**: The local in-memory job runner needs to be refactored into a MongoDB/Redis-backed queue to support headless worker container scaling.
