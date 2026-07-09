# 14. Scalability Review

This document audits how the repository handles growth to 100+ developers and 500k+ lines of code.

---

## 1. Monorepo Boundary Enforcement

1. **Git CODEOWNERS Mapping**: Assign folders to distinct engineering squads:
   - `/apps/desktop/src/main/` -> `@leadforge/desktop-core`
   - `/apps/desktop/src/renderer/` -> `@leadforge/frontend-team`
   - `/packages/` -> `@leadforge/platform-infra`
2. **Task Parallelization**: Configure `turbo.json` to cache typechecking and test tasks, ensuring that only modified files trigger rebuilds on developers' machines.

---

## 2. Testing & Release Pipelines

- **Vitest Workspace**: Configure a Vitest workspace file to execute tests concurrently across all apps and extracted packages. Mock native Electron APIs (`safeStorage`, `ipcMain`) to allow package unit tests to run in clean Node contexts without spinning up virtual GUI displays.
- **Package Release**: Use `changesets` in git actions to automate package version bumps, dependency updates, and changelog updates.
