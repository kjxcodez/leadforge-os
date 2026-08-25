# Developer Changelog (CHANGELOG-DEV.md)

This log tracks technical details, architectures, and dev tools improvements for LeadForge OS.

## [1.0.0-beta.6] - 2026-08-25

### Added
- **`@leadforge/sdk` (`variable-resolver.ts`)**: Built canonical `renderCanonicalVariables()` resolver with strict namespacing (`contact.*`, `company.*`, `sender.*`, `sequence.*`, `workspace.*`) and fallback resolution for un-namespaced legacy tokens.
- **SQLite Migration 030 (`030_structured_location_and_sync_hardening`)**: Added structured `city`, `state`, `country`, and `location` columns to `companies` and `discovery_runs` tables with indexes.
- **Electron Node Testing Harness**: Documented and standardized `$env:ELECTRON_RUN_AS_NODE=1 npx electron node_modules/tsx/dist/cli.mjs` execution pattern for running native `better-sqlite3` test suites against Electron ABI 130 without native dlopen mismatch errors.

### Changed
- **`main/workers/plugins/outreach.ts`**: Replaced custom regex `renderTemplate` function with SDK's `renderCanonicalVariables`, unifying variable rendering across Automation sequences and Outreach dispatcher.
- **`main/services/scheduler.ts`**: Corrected SQL column name in `reconcileStaleJobs()` from `lastError` to `error` on `jobs` table and `logs` on `sequence_executions` table to match Migration 008.
- **`main/ipc/campaigns-ipc.ts`**: Removed duplicate `campaigns:schedule` handler and removed plaintext `_secrets: { sessionToken }` payload insertion from SQLite `jobs` table.
- **`apps/api/src/services/workspace/workspace.service.ts`**: Added owner workspace existence check in `createWorkspace()` to ensure idempotent workspace provisioning on network retry.

## [1.0.0-beta.5] - 2026-08-06

### Added
- **`lib/playwright-setup.ts`**: New utility module exposing `ensurePlaywrightBrowsers()`. Uses `playwright-core`'s internal path resolver to detect a missing Chromium binary without hard-coding versioned folder names. If missing, forks `playwright-core/cli.js install chromium` — no dependency on `npx` or any globally installed tool. Browser is stored under `{userData}/playwright-browsers` (controlled via `PLAYWRIGHT_BROWSERS_PATH`) for stable, cross-update persistence with full user-level write access.

### Changed
- **`main/index.ts`**: Made `app.whenReady()` callback `async`. Added `ensurePlaywrightBrowsers()` call in the startup sequence (between migrations and IPC registration), wired to `updateSplashProgress` so the splash screen shows installation progress on first launch.
- **`services/scheduler.ts`**: Added `PLAYWRIGHT_BROWSERS_PATH` to the worker `fork()` env whitelist. Without this, forked worker processes could not find the Chromium binary because the explicit env whitelist blocked inheritance of the variable set by the main process.

## [1.0.0-beta.4] - 2026-08-05


### Changed
- **Removed Electron Dependency in Worker**: Eliminated the transitive `electron` module dependency from worker chunks by removing `decryptSecret` imports from background worker plugins, resolving the `MODULE_NOT_FOUND` crash in standard Node.js processes.

## [1.0.0-beta.3] - 2026-08-05

### Added
- **Database Schema Migration (`025_add_contacts_tags`)**: Added SQLite schema migration logic to guarantee the existence of the `tags` column on the `contacts` table prior to automation worker boot.
- **Lead Intelligence Engine**: Integrated a headless intelligence pipeline for scraping, analyzing, and scoring leads asynchronously in workspace worker processes.
- **Design System Email Templates**: Refactored the core notification layouts and templates under the `DESIGN.md` guidelines.

### Changed
- **Client-Authoritative Primary Keys**: Migrated MongoDB models and client databases to use String/UUID identifiers authoritatively. Supported legacy schema formats using explicit casting bypasses and fallback query matches in `BaseRepository`.
- **Local SQLite Credential Preservation**: Changed raw database sync writes from `INSERT OR REPLACE` to standard `UPDATE` statements to prevent purging local-only credential properties.
- **Campaign-Specific SMTP Decryption**: Integrated Electron `decryptSecret` module within raw `child_process.fork` worker threads to support secure local decryption of sender email account passwords.
- **Observability IPC Prepared Query Parameter Binding**: Fixed a prepared query validation error by binding parameters explicitly during runtime telemetry extraction.
- **Operations Center Schema Alignment**: Selected dual key alias (`j.id` and `j.id as jobId`) in scheduler queues query to align with `<OperationsCenterScreen>` component list rendering parameters.
- **GitHub Templates and CI/CD Automation**: Injected issue templates, PR checklists, and release workflows under `.github/`.

## [1.0.0-beta.2] - 2026-08-05

### Changed
- **Circular Dependency Exemption**: Reconfigured logging connection instances to bind to `globalThis` to resolve cycles flagged by `dependency-cruiser`.
- **Global Error Boundary & Screen Sheets**: Refactored React context providers and injected component sheets for dashboard/reports components.

## [1.0.0-beta.1] - 2026-08-01

### Added

- **Dynamic AI Test Suite**: Created `scripts/test-ai.ts` querying the OpenRouter Models API, verifying timeouts, cancellation signals, and rate limits.
- **Headless Desktop Subsystems Smoke Test**: Created `scripts/smoke-test.ts` testing SQLite schema migrations, JobScheduler lifecycles, and AppLogger file rotations headlessly via Electron environment.
- **Master Release Gates Runner**: Added `scripts/release-check.ts` executing all 10 release gates sequentially.
- **Expanded Doctor Diagnostics**: Integrated Node/pnpm/Electron version audits, boundaries analysis, and git status validation.

### Changed

- **Logging Circular Exemption**: Shifted connection and logger synchronization to `globalThis` reference to resolve compile-time cycles in `dependency-cruiser`.
- **Sync Logging Redirect**: Moved raw `console.log` in sync-engine and connection routines to structured `AppLogger` info streams.
