# Developer Changelog (CHANGELOG-DEV.md)

This log tracks technical details, architectures, and dev tools improvements for LeadForge OS.

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
