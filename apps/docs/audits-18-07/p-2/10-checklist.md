# LeadForge OS — Phase 9 Pre-Implementation Checklist

> **Document Type**: Implementation Contract  
> **Source Specs**: All Phase 8 specifications + all Phase 9 contract documents  
> **Purpose**: Every item on this checklist must be resolved and signed off before any Phase 9 code is written.

---

## Category 1 — UNKNOWN Resolutions (from contract documents)

These items were marked **UNKNOWN** in the specification documents. They must be investigated and answered before implementation begins.

- [ ] **U-01** — Playwright binary in packaged build  
  **Source**: new_packages.md §Package 001  
  **Action**: Test whether `electron-builder` correctly includes Playwright Chromium binary in a packaged Windows build. Document the exact configuration required. If it cannot be included, document the alternative (ship binary separately, or prompt user to install).

- [ ] **U-02** — Node.js fetch availability  
  **Source**: new_packages.md §Package 003  
  **Action**: Confirm the Node.js version bundled with the current Electron version. If Node ≥ 18, use native `fetch`. If not, add `node-fetch@^3.3` as a dependency. Document the decision.

- [ ] **U-03** — p-limit ESM vs CJS resolution  
  **Source**: new_packages.md §Package 006, risk_register.md RISK-006  
  **Action**: Confirm whether the worker bundle will be CJS or ESM. If CJS: use `p-limit@3.x`. If ESM: use `p-limit@6.x`. If neither: document alternative (e.g., `bottleneck`). Decision must be made before TASK-018 begins.

- [ ] **U-04** — `is.dev` utility in scheduler.ts  
  **Source**: new_packages.md §Package 009  
  **Action**: Check whether `is` from `electron-util` is already imported in `scheduler.ts`. If not, identify the correct is-dev check for the codebase (may be `!app.isPackaged` or a custom flag).

- [ ] **U-05** — Sync eligibility of new columns  
  **Source**: database_changes.md §Migration 009 UNKNOWN  
  **Action**: Decide: should `crawlStatus`, `score`, `confidence`, `verificationStatus` sync to MongoDB? If yes, verify the SyncEngine and API handle these fields correctly. If no, mark them as local-only and exclude from `sync_queue`.

- [ ] **U-06** — Test framework for desktop package  
  **Source**: test_plan.md §Testing Infrastructure  
  **Action**: Confirm what test framework is configured for `apps/desktop`. If none exists, select and configure `vitest` before writing any tests.

- [ ] **U-07** — Renderer component files for job display  
  **Source**: file_level_tasks.md Renderer section  
  **Action**: Locate all renderer components that render job status, progress, job list, or automation status. List them explicitly. These files must be updated to handle `'starting'` status and real-time event subscriptions.

- [ ] **U-08** — `robots-parser` TypeScript types availability  
  **Source**: new_packages.md §Package 004, §Package 008  
  **Action**: Verify whether `@types/robots-parser` exists on npm. If not, confirm that `robots-parser` ships its own types, or that a `declare module` stub is needed.

---

## Category 2 — Conflict Resolutions (from dependency graph)

These conflicts were identified in `runtime_dependency_graph.md §5` and must be resolved before implementation.

- [ ] **C-01** — `starting` not in current jobs CHECK constraint  
  **Action**: Confirm migration 008 strategy: table recreation or adding `starting` via alternative. Confirm pre-migration backup strategy. Confirm which code paths must be updated to write `status = 'starting'` on fork.

- [ ] **C-02** — `crawler:website` vs `enrich:website` boundary  
  **Source**: runtime_dependency_graph.md §5 Conflict C2, risk_register.md RISK-013  
  **Action**: Make an explicit architecture decision: are these two separate job types or merged into one? The decision affects TASK-018 and TASK-019 scope. Document the decision and update specs if needed.

- [ ] **C-03** — retrying jobs dispatched immediately vs scheduledAt delay  
  **Source**: runtime_dependency_graph.md §5 Conflict C4  
  **Action**: Confirm that migration 008 adds `scheduledAt` column and that the tick query is updated to filter `scheduledAt <= datetime('now')` for `retrying` jobs. Test that existing retries (which have NULL `scheduledAt`) are handled correctly.

---

## Category 3 — Architecture Decisions Required

These decisions are not yet made and must be resolved before coding begins.

- [ ] **D-01** — electron-vite worker entry syntax  
  **Source**: risk_register.md RISK-007, build_order.md TASK-005  
  **Action**: Research electron-vite multi-entry documentation. Confirm exact `electron.vite.config.js` syntax. Test in a prototype branch before implementing.

- [ ] **D-02** — Worker bundle format (CJS or ESM)  
  **Source**: worker_runtime_spec.md §4.1  
  **Action**: Confirm whether worker compiles to CJS or ESM. This affects all import decisions (p-limit version, require() vs import() usage in plugins).

- [ ] **D-03** — Resolved path for `worker-host.js` in scheduler  
  **Source**: worker_runtime_spec.md §4.1, breaking_changes.md BC-004  
  **Action**: After TASK-005 prototype, document the exact resolved path that `scheduler.ts` must reference. This must be a deterministic path that works in both dev and production.

- [ ] **D-04** — Automation IPC handler migration timing  
  **Source**: risk_register.md RISK-014, file_level_tasks.md automation.ts  
  **Action**: Define the exact deployment sequence for: (1) desktop `automation:workflow` plugin live, (2) IPC handler switched from SDK to local queue, (3) API `executeNextStep` removed. These three must be sequenced with zero gap for production users.

- [ ] **D-05** — Soft cancel timeout value  
  **Source**: job_lifecycle_spec.md §5.2, breaking_changes.md BC-005  
  **Action**: Confirm `cancelTimeoutMs = 15000ms` is appropriate. If Playwright page loads can take longer, the timeout may need to be longer. Decision must be made before TASK-011.

- [ ] **D-06** — Heartbeat interval and timeout values  
  **Source**: worker_runtime_spec.md §4.4  
  **Action**: Confirm `heartbeatIntervalMs = 10000ms` and `heartbeatTimeoutMs = 30000ms` are appropriate. These values determine the maximum time a hung worker holds a concurrency slot.

- [ ] **D-07** — Non-recoverable job types list  
  **Source**: job_lifecycle_spec.md §6, build_order.md TASK-016  
  **Action**: Confirm that `outreach:campaign` should NOT auto-recover on restart. Confirm the complete list of auto-recoverable types: `['scraper:maps', 'crawler:website', 'enrich:website', 'automation:workflow']`.

---

## Category 4 — Infrastructure Prerequisites

These infrastructure items must be in place before implementation begins.

- [ ] **I-01** — Test SMTP account configured  
  Configure a Mailtrap (or equivalent) test inbox for outreach plugin tests. No real user emails must be sent during development.

- [ ] **I-02** — SQLite in-memory test harness  
  Verify that `better-sqlite3` with `:memory:` databases works in the test environment. Write a trivial smoke test: create table, insert row, select row.

- [ ] **I-03** — Test framework installed and configured  
  Install and configure the selected test framework (from U-06) for `apps/desktop`. Verify `pnpm test` runs. Write one passing placeholder test.

- [ ] **I-04** — Build output path confirmed  
  Confirm that `pnpm build` and `pnpm dev` both work without errors before any Phase 9 changes. Establish baseline.

- [ ] **I-05** — Branch strategy defined  
  Confirm whether Phase 9 work happens on a single feature branch or per-task branches. Define merge criteria (all acceptance criteria pass, code review complete).

- [ ] **I-06** — Windows test machine available  
  The primary target platform is Windows. At least one Windows machine must be available for cancellation tests (RISK-005), Playwright packaging tests (RISK-001), and full acceptance tests.

---

## Category 5 — Implementation Gates

These gates ensure no task begins before its prerequisites are verified.

- [ ] **G-01** — Layer A tasks complete before Layer B begins  
  TASK-001 (schema), TASK-002 (EventType), TASK-003 (company/contact columns), TASK-004 (sequence_executions) must all pass their acceptance criteria before TASK-005 begins.

- [ ] **G-02** — Worker build confirmed (TASK-005) before any plugin work  
  TASK-017, TASK-018, TASK-019, TASK-020, TASK-021, TASK-022 must not begin until TASK-005 is complete and a worker process can be successfully forked.

- [ ] **G-03** — IPC protocol (TASK-006, TASK-008) complete before plugin rewrites  
  All plugin rewrites (TASK-017–TASK-020) must use the new `JobContext` interface. Do not rewrite plugins against the old interface.

- [ ] **G-04** — TASK-022 complete and tested before TASK-023  
  The API `executeNextStep` removal (TASK-023) must not be deployed before the desktop `automation:workflow` plugin is confirmed working end-to-end.

- [ ] **G-05** — Migration 008 backup tested on real workspace database  
  Before deploying migration 008 to any environment, verify that the pre-migration backup correctly restores the database if the migration is rolled back manually.

- [ ] **G-06** — All RISK-001 through RISK-005 (P0 risks) mitigations confirmed  
  Each P0 risk must have a documented mitigation that has been validated. No P0 risk may be left with status "pending investigation" at implementation start.

---

## Sign-Off Checklist

| Item | Owner | Status |
|---|---|---|
| All UNKNOWN items resolved (U-01 through U-08) | Architect | ☐ |
| All conflicts resolved (C-01 through C-03) | Architect | ☐ |
| All architecture decisions made (D-01 through D-07) | Lead engineer | ☐ |
| Infrastructure prerequisites in place (I-01 through I-06) | DevOps | ☐ |
| Implementation gates acknowledged (G-01 through G-06) | Lead engineer | ☐ |
| All P0 risks have validated mitigations | Lead engineer | ☐ |
| Test framework installed and smoke test passing | QA engineer | ☐ |
| Windows test machine available | DevOps | ☐ |
| Phase 8 specification documents marked as read by all implementers | All engineers | ☐ |
| build_order.md has been reviewed and task assignments agreed | Lead engineer | ☐ |

---

> **Gate**: Implementation of Phase 9 may NOT begin until all items in this checklist are checked off and the checklist is reviewed by at least two engineers.
