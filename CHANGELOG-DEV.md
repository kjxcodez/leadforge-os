# Developer Changelog (CHANGELOG-DEV.md)

This log tracks technical details, architectures, and dev tools improvements for LeadForge OS.

## [1.0.0-beta.1] - 2026-08-01

### Added

- **Dynamic AI Test Suite**: Created `scripts/test-ai.ts` querying the OpenRouter Models API, verifying timeouts, cancellation signals, and rate limits.
- **Headless Desktop Subsystems Smoke Test**: Created `scripts/smoke-test.ts` testing SQLite schema migrations, JobScheduler lifecycles, and AppLogger file rotations headlessly via Electron environment.
- **Master Release Gates Runner**: Added `scripts/release-check.ts` executing all 10 release gates sequentially.
- **Expanded Doctor Diagnostics**: Integrated Node/pnpm/Electron version audits, boundaries analysis, and git status validation.

### Changed

- **Logging Circular Exemption**: Shifted connection and logger synchronization to `globalThis` reference to resolve compile-time cycles in `dependency-cruiser`.
- **Sync Logging Redirect**: Moved raw `console.log` in sync-engine and connection routines to structured `AppLogger` info streams.
