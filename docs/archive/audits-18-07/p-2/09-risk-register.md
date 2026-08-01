# LeadForge OS — Risk Register

> **Document Type**: Implementation Contract  
> **Source Specs**: All Phase 8 specifications, live codebase inspection  
> **Phase**: 9 — Implementation

---

## Risk Classification

**Probability**: High / Medium / Low  
**Impact**: Critical / High / Medium / Low  
**Priority**: P0 / P1 / P2 (aligned with build_order.md task priorities)

---

## RISK-001 — Playwright Chromium Binary Not Resolvable in Packaged Electron Build

| Field           | Detail                                                                                                                                                                                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Description** | Playwright downloads Chromium to a cache directory during development (`node_modules/.cache/ms-playwright`). When the Electron app is packaged by electron-builder, this cache may not be included in the package, or the path resolution may break.                                                         |
| **Probability** | High                                                                                                                                                                                                                                                                                                         |
| **Impact**      | Critical — `scraper:maps` plugin fails entirely in production                                                                                                                                                                                                                                                |
| **Mitigation**  | 1. Investigate `electron-playwright-helpers` or `playwright-chromium` for Electron-compatible binary bundling. 2. Test packaged build on Windows before marking TASK-017 complete. 3. Alternatively, ship a downloaded Chromium binary as an app resource and set `executablePath` explicitly in the plugin. |
| **Owner**       | DevOps / Build engineer                                                                                                                                                                                                                                                                                      |
| **Priority**    | P0                                                                                                                                                                                                                                                                                                           |
| **Source Spec** | new_packages.md §Package 001 UNKNOWN note                                                                                                                                                                                                                                                                    |

---

## RISK-002 — SQLite BUSY Errors Under 3 Concurrent Workers

| Field           | Detail                                                                                                                                                                                                                                                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Description** | Each forked worker opens its own `better-sqlite3` connection to the workspace database. Three concurrent writers can trigger `SQLITE_BUSY` errors even with WAL mode, especially during large bulk-insert transactions.                                                                                                       |
| **Probability** | Medium                                                                                                                                                                                                                                                                                                                        |
| **Impact**      | High — data loss on failed bulk inserts; worker job fails with database error                                                                                                                                                                                                                                                 |
| **Mitigation**  | 1. `busy_timeout = 5000ms` is already set — this is the primary mitigation and is likely sufficient. 2. If BUSY errors persist in load testing (T-PERF-3), evaluate routing all writes through Main process via IPC instead of direct worker connections. 3. Alternatively, use WAL2 mode if available on the SQLite version. |
| **Owner**       | Backend engineer                                                                                                                                                                                                                                                                                                              |
| **Priority**    | P1                                                                                                                                                                                                                                                                                                                            |
| **Source Spec** | runtime_health_report.md §3 R2                                                                                                                                                                                                                                                                                                |

---

## RISK-003 — API Automation Migration Causes Regression

| Field           | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Description** | `AutomationService.executeNextStep()` currently handles live sequence executions for any users. Removing it (TASK-023, BC-001) before the desktop replacement is fully operational will leave those executions stranded.                                                                                                                                                                                                              |
| **Probability** | High (if sequencing is wrong)                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Impact**      | Critical — active automations silently stop executing                                                                                                                                                                                                                                                                                                                                                                                 |
| **Mitigation**  | 1. TASK-023 must be blocked by TASK-022 (desktop plugin complete and tested). 2. Deploy API migration only after end-to-end acceptance test T-ACC-2 passes. 3. Before removal: drain all `IN_PROGRESS` server-side executions by running a one-time script that marks them `FAILED` with reason 'Migrated to desktop runtime'. 4. Add monitoring alert for stale `IN_PROGRESS` executions (age > 30 min) to detect missed migrations. |
| **Owner**       | Lead engineer                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Priority**    | P0                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Source Spec** | automation_engine_spec.md §1.3, breaking_changes.md BC-001                                                                                                                                                                                                                                                                                                                                                                            |

---

## RISK-004 — SMTP Credentials Exposed in Logs

| Field           | Detail                                                                                                                                                                                                                                                                                                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Description** | The outreach plugin reads SMTP credentials from the `email_accounts` SQLite table. If those credentials are accidentally included in IPC messages, `{ type: 'log' }` messages, or `system_logs`, they will be stored in plaintext and visible in log files.                                                                                                      |
| **Probability** | Medium                                                                                                                                                                                                                                                                                                                                                           |
| **Impact**      | Critical — credential leak                                                                                                                                                                                                                                                                                                                                       |
| **Mitigation**  | 1. SMTP credentials must be read by the worker directly from SQLite (via `ctx.dbPath`), never passed through IPC. 2. Log scrubbing: before inserting any log into `system_logs`, check message against a list of known sensitive field names and redact values. 3. Code review gate: no PR for outreach plugin ships without a security review of all log calls. |
| **Owner**       | Security reviewer                                                                                                                                                                                                                                                                                                                                                |
| **Priority**    | P0                                                                                                                                                                                                                                                                                                                                                               |
| **Source Spec** | new_packages.md §Package 005 Security Impact, acceptance_criteria.md AC-012 #2                                                                                                                                                                                                                                                                                   |

---

## RISK-005 — Windows SIGTERM Equivalence to SIGKILL

| Field           | Detail                                                                                                                                                                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Description** | `worker.kill('SIGTERM')` on Windows Node.js does not send SIGTERM — it sends SIGKILL immediately. Any remaining code that calls `worker.kill('SIGTERM')` as a soft cancellation will corrupt workers on Windows.                                                                                       |
| **Probability** | High (on Windows, which is the primary target)                                                                                                                                                                                                                                                         |
| **Impact**      | High — SQLite writes in-flight are dropped; sequence logs may be incomplete                                                                                                                                                                                                                            |
| **Mitigation**  | 1. All cancellation paths must use soft cancel via IPC message (TASK-011). 2. Remaining SIGTERM calls (e.g., in `scheduler.stop()`) must be converted to SIGKILL explicitly (acknowledging they are hard kills, not soft). 3. Test suite must include a cancel test specifically on Windows (T-011-1). |
| **Owner**       | Windows test engineer                                                                                                                                                                                                                                                                                  |
| **Priority**    | P0                                                                                                                                                                                                                                                                                                     |
| **Source Spec** | worker_runtime_spec.md §3.3, runtime_health_report.md §W5                                                                                                                                                                                                                                              |

---

## RISK-006 — p-limit ESM/CJS Incompatibility

| Field           | Detail                                                                                                                                                                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Description** | `p-limit` v4+ is ESM-only. The worker-host compiles to CJS per worker_runtime_spec.md §4.1. Using p-limit v4+ in a CJS worker bundle will throw `ERR_REQUIRE_ESM`.                                                                              |
| **Probability** | High                                                                                                                                                                                                                                            |
| **Impact**      | Medium — `crawler:website` plugin fails entirely if p-limit cannot be imported                                                                                                                                                                  |
| **Mitigation**  | 1. Use `p-limit@3.x` (last CJS-compatible version). 2. OR configure the worker bundle to output ESM and update all plugin imports accordingly. 3. Investigate p-limit alternatives (`bottleneck`, `async.parallelLimit`) as CJS-safe fallbacks. |
| **Owner**       | Build engineer                                                                                                                                                                                                                                  |
| **Priority**    | P1                                                                                                                                                                                                                                              |
| **Source Spec** | new_packages.md §Package 006 UNKNOWN note                                                                                                                                                                                                       |

---

## RISK-007 — electron-vite Worker Entry Configuration Unknown

| Field           | Detail                                                                                                                                                                                                                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Description** | The exact electron-vite configuration syntax for adding a second entry point (for worker-host) is not confirmed. `electron-vite` may not support multi-entry builds in the same way as standard Vite. Incorrect configuration could break the entire build.                                                |
| **Probability** | Medium                                                                                                                                                                                                                                                                                                     |
| **Impact**      | Critical — breaks all builds until resolved                                                                                                                                                                                                                                                                |
| **Mitigation**  | 1. Research electron-vite documentation for multi-entry or external worker patterns before implementing TASK-005. 2. Alternative: build the worker separately using `tsc --outDir dist/worker` as a secondary build step alongside the main electron-vite build. 3. Test build in a branch before merging. |
| **Owner**       | Build engineer                                                                                                                                                                                                                                                                                             |
| **Priority**    | P0                                                                                                                                                                                                                                                                                                         |
| **Source Spec** | worker_runtime_spec.md §4.1, build_order.md TASK-005                                                                                                                                                                                                                                                       |

---

## RISK-008 — Memory Leak from Playwright Context Not Closed on Cancel

| Field           | Detail                                                                                                                                                                                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Description** | If a hard-kill (SIGKILL) is applied to a worker that has an open Playwright browser context, the Chromium subprocess may become orphaned (not killed). Over multiple scrape-cancel cycles, orphaned Chromium processes accumulate and consume RAM.                                                      |
| **Probability** | Medium                                                                                                                                                                                                                                                                                                  |
| **Impact**      | Medium — app becomes unusable over extended sessions                                                                                                                                                                                                                                                    |
| **Mitigation**  | 1. The soft-cancel protocol (TASK-011) gives the plugin time to call `context.close()` before exiting. This is the primary mitigation. 2. Implement a process cleanup guard in the plugin's `finally` block: always close context. 3. Add OS-level process monitoring check in acceptance test T-017-5. |
| **Owner**       | Plugin engineer                                                                                                                                                                                                                                                                                         |
| **Priority**    | P1                                                                                                                                                                                                                                                                                                      |
| **Source Spec** | runtime_health_report.md §3 R3, scraping_pipeline_spec.md §3.1                                                                                                                                                                                                                                          |

---

## RISK-009 — Sync Queue Overflow During Offline Operation

| Field           | Detail                                                                                                                                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Description** | If the network is unavailable for extended periods while scraping is active, the `sync_queue` table grows without bound. A large scrape session (10,000 companies) could produce 10,000+ sync_queue rows. SQLite can handle this, but the file may grow to multiple gigabytes. |
| **Probability** | Low                                                                                                                                                                                                                                                                            |
| **Impact**      | Medium — disk exhaustion, slow sync when network returns                                                                                                                                                                                                                       |
| **Mitigation**  | 1. Add a soft cap: alert user when `sync_queue` exceeds 5,000 rows. 2. Add configurable max `sync_queue` size in workspace settings. 3. Implement batch sync: send 50 records per API call instead of one at a time.                                                           |
| **Owner**       | Backend engineer                                                                                                                                                                                                                                                               |
| **Priority**    | P2                                                                                                                                                                                                                                                                             |
| **Source Spec** | runtime_health_report.md §3 R4, runtime_health_report.md §4 SyncEngine bottleneck                                                                                                                                                                                              |

---

## RISK-010 — jobs Table Recreation (Migration 008) Fails Mid-Transaction

| Field           | Detail                                                                                                                                                                                                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Description** | Migration 008 recreates the `jobs` table using rename-and-copy. If this operation fails mid-way (power loss, crash), the database may be left with a partial state: `jobs_new` exists but `jobs` was already dropped.                                            |
| **Probability** | Low                                                                                                                                                                                                                                                              |
| **Impact**      | High — workspace database is unrecoverable without backup                                                                                                                                                                                                        |
| **Mitigation**  | 1. Wrap the entire table recreation in a SQLite transaction (`BEGIN ... COMMIT`). 2. Create pre-migration backup before migration 008 runs (database_changes.md requirement). 3. Implement migration health check: verify `jobs` table structure post-migration. |
| **Owner**       | Database engineer                                                                                                                                                                                                                                                |
| **Priority**    | P0                                                                                                                                                                                                                                                               |
| **Source Spec** | database_changes.md §Migration 008, Rollback Strategy                                                                                                                                                                                                            |

---

## RISK-011 — Renderer Job Status Badge Does Not Handle `starting` State

| Field           | Detail                                                                                                                                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Description** | After migration 008 and TASK-001, jobs can have `status = 'starting'`. If the renderer's status badge component uses a switch/case without a default or does not handle `'starting'`, it may render nothing, crash, or show a blank/wrong state. |
| **Probability** | High                                                                                                                                                                                                                                             |
| **Impact**      | Low — cosmetic / UX defect only                                                                                                                                                                                                                  |
| **Mitigation**  | 1. Update renderer components to handle `'starting'` identically to `'running'` (show spinner). 2. Add TypeScript exhaustiveness check on `JobStatus` in renderer components.                                                                    |
| **Owner**       | Frontend engineer                                                                                                                                                                                                                                |
| **Priority**    | P1                                                                                                                                                                                                                                               |
| **Source Spec** | breaking_changes.md BC-008, file_level_tasks.md Renderer section                                                                                                                                                                                 |

---

## RISK-012 — AutomationTriggerEvaluator Delays crm:created Events

| Field           | Detail                                                                                                                                                                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Description** | `AutomationTriggerEvaluator` queries SQLite on every `crm:created` / `crm:updated` event (synchronously or asynchronously). If many automations are active, this query runs frequently and may add latency to the event bus.             |
| **Probability** | Low                                                                                                                                                                                                                                      |
| **Impact**      | Low — performance degradation only                                                                                                                                                                                                       |
| **Mitigation**  | 1. Keep the automation trigger query fast: use the `trigger` JSON index and limit results. 2. If event throughput is high (e.g., bulk import), debounce trigger evaluation by 100ms. 3. Monitor trigger query duration in `system_logs`. |
| **Owner**       | Backend engineer                                                                                                                                                                                                                         |
| **Priority**    | P2                                                                                                                                                                                                                                       |
| **Source Spec** | automation_engine_spec.md §2.2                                                                                                                                                                                                           |

---

## RISK-013 — Conflict C2: crawler:website vs enrich:website Boundary Unresolved

| Field           | Detail                                                                                                                                                                                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Description** | The specs are ambiguous on whether `crawler:website` and `enrich:website` are truly separate jobs or whether they should be merged. If implemented as separate, the pipeline requires two job dispatches. If merged, checkpointing is simpler but the plugin is larger. |
| **Probability** | Medium (conflict unresolved)                                                                                                                                                                                                                                            |
| **Impact**      | Medium — implementation diverges from spec or creates technical debt                                                                                                                                                                                                    |
| **Mitigation**  | Resolve Conflict C2 from `runtime_dependency_graph.md §5` before implementing TASK-018 and TASK-019. Document the decision.                                                                                                                                             |
| **Owner**       | Architect                                                                                                                                                                                                                                                               |
| **Priority**    | P1                                                                                                                                                                                                                                                                      |
| **Source Spec** | runtime_dependency_graph.md §5 Conflict Register                                                                                                                                                                                                                        |

---

## RISK-014 — sequence:start IPC Still Calls SDK After Automation Migration

| Field           | Detail                                                                                                                                                                                                                                                                                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Description** | `apps/desktop/src/main/ipc/automation.ts` line 66: `sequence:start` calls `sdk.executions.start()` which calls the API. After BC-001, the API no longer executes the sequence. But the IPC handler is not updated until file_level_tasks TASK for automation.ts is complete. There is a window where the handler calls the API but the API no longer runs the sequence. |
| **Probability** | High (if deployment is not atomic)                                                                                                                                                                                                                                                                                                                                      |
| **Impact**      | High — sequences appear to start but never execute                                                                                                                                                                                                                                                                                                                      |
| **Mitigation**  | 1. The `sequence:start` IPC handler update (file_level_tasks.md automation.ts) must be deployed simultaneously with TASK-023 (API method removal). 2. These two changes are a single atomic deployment unit. 3. Interim: have API return `202 Accepted` + log warning instead of silently doing nothing.                                                                |
| **Owner**       | Lead engineer                                                                                                                                                                                                                                                                                                                                                           |
| **Priority**    | P1                                                                                                                                                                                                                                                                                                                                                                      |
| **Source Spec** | breaking_changes.md BC-001, file_level_tasks.md automation.ts                                                                                                                                                                                                                                                                                                           |
