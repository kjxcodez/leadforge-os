# Changelog

All notable changes to LeadForge OS will be documented in this file.

## [1.0.0-beta.6] - 2026-08-25

### Added
- **Unified Canonical Template Variable Resolution**: Integrated full namespaced variable resolution across outreach email dispatchers, automation sequences, and template previews. Supports `{{contact.firstName}}`, `{{contact.lastName}}`, `{{contact.email}}`, `{{company.name}}`, `{{company.industry}}`, `{{company.location}}`, and `{{sender.name}}` with seamless legacy alias fallback.
- **Structured Geographic Location Modeling**: Added structured city, state, and country attributes to companies and lead discovery runs for precise regional filtering.
- **Offline Sync Dead-Letter Protection**: Failed mutations after 5 retries are now isolated safely in a dedicated dead-letter queue rather than blocking offline queue execution.

### Fixed
- **Campaign Scheduling & Worker Crash Recovery**: Fixed database column schema errors in the scheduler recovery engine, ensuring stale and interrupted jobs recover cleanly to retry or failure states on application restart.
- **Duplicate Campaign Scheduling Guard**: Consolidated campaign schedule handlers under a single authoritative local-first scheduler, preventing duplicate dispatch events.
- **Worker Credential Storage Sanitization**: Removed plaintext user session tokens from persistent SQLite job storage on disk; credentials are now injected strictly in memory at worker dispatch.
- **Workspace Provisioning Idempotency**: Network retries and initial onboarding setups now detect existing default workspaces and prevent creating duplicate workspaces with randomized slug suffixes.

## [1.0.0-beta.5] - 2026-08-06

### Fixed
- **Automatic Browser Engine Setup**: The desktop app now automatically downloads and installs the required Chromium browser engine on first launch. Previously, users on fresh machines received a silent failure on every Google Maps discovery job with the error "Executable doesn't exist". The app now detects a missing browser at startup and performs a one-time download (~80 MB) with progress visible on the splash screen. Subsequent launches are unaffected (check completes in < 10 ms).

## [1.0.0-beta.4] - 2026-08-05


### Fixed
- **Background Worker Decoupling**: Resolved a critical startup crash where background worker processes (running under standard Node.js) were unable to load the `electron` module. Decoupled worker execution by removing transitive Electron module dependencies and handling decryption in the Main process instead.

## [1.0.0-beta.3] - 2026-08-05

### Added
- **Interactive Auth UI**: Implemented `AuthLayout` with an interactive, animated background component for premium visual aesthetics.
- **Lead Intelligence Engine**: Built the intelligence engine for deep analysis, scoring, and automated insight generation for leads.
- **Forgot Password & Email Verification Flows**: Integrated secure forgotten password and verification email flows, with manual check actions and session polling to auto-unblock verified users.
- **Design System Email Templates**: Upgraded all system email templates and hosted pages to match the `DESIGN.md` guidelines.

### Fixed
- **Campaign & Sequence Execution**: Resolved the crash when loading sequence step counts when online by checking the type of `sequence.steps` before parsing.
- **SQLite Schema Migration (`tags` column)**: Added migration `025_add_contacts_tags` to alter and add the missing `tags` column to the `contacts` table, resolving worker execution boot crashes.
- **SMTP Credentials & Sender Decryption**: Updated automation worker's email sender step to resolve campaign-specific sending accounts, retrieve SMTP connection credentials, and decrypt SMTP passwords using Electron's `decryptSecret` tool.
- **Unified String/UUID Identifiers**: Standardized client-provided UUID string identifiers across all workspace-scoped models, reverted temporary casting bypasses, and added conflict protection for local-to-cloud pull synchronization.
- **Pre-Encrypted Password Support**: Handled sync payloads with pre-encrypted credentials and preserved local-only credentials in SQLite by switching from REPLACE to standard UPDATE queries.
- **Campaign Status Casing**: Mapped campaign status casing between local SQLite (capitalized) and remote API (uppercase) during sync.
- **Observability Metrics RangeError**: Bound the `type` parameter when executing the `getAvgDuration` prepared query inside `observability-ipc.ts`.
- **Operations Center List Rendering**: Selected both `j.id` and `j.id as jobId` in the scheduler queue list IPC query to support both the Operations Center list view and CRM QueueMonitor component.
- **Preload Script Whitelist**: Whitelisted missing `campaigns`, `scheduler`, `auth:forgot-password`, and `auth:resend-verification` IPC channels in the preload script.
- **Windows Silent Installer**: Resolved Windows silent installer execution blockages and throttled download progress IPC updates to improve auto-updater performance.

## [1.0.0-beta.2] - 2026-08-05

### Added
- **Global Command Search Palette (Ctrl+K)**: Built a keyboard-accessible overlay finder tool that allows users to fuzzy-find and jump directly to dashboard, lists, sequences, preferences, and operations routes.
- **Notification Drawer**: Added a real-time operations activity history sidebar (queried from SQLite live logs) with slide-over motion.
- **Personal Preferences Screen**: Introduced a `/preferences` screen containing Theme Settings (Dark/Light/System), AI Provider Selector (Mock/OpenRouter Cloud), OpenRouter key masking, logging verbosity controls, and hotkey references.
- **Slide-over Sheets**: Redesigned the Companies and Contacts side details panels to render inside premium modal overlays using `Sheet` components. Added rendering guards to prevent `null` value property crashes when closed.
- **Advanced Reports & Live Charts**: Connected Recharts area and bar charts on the Reports screen to live SQLite telemetry databases instead of mockup tables.
- **Premium UX Motion**: Integrated snappy 180ms page route transitions, sliding sidebar active indicators, CountUp KPI digits, staggered table row animations, and floating empty state illustrations across the renderer layout.
- **Global Error Handling**: Integrated `AppErrorBoundary` fallback page to capture React rendering failures with debug logs and quick reload options.
- **Authorized Preload Whitelist**: Authorized custom config endpoints in `preload/index.ts` and refactored secure local credential decryptions in main process modules.

## [1.0.0-beta.1] - 2026-08-01

### Added
- **Quality & Release Gates**: Introduced a strict 10-gate release verification check to ensure maximum platform stability prior to any distribution.
- **Dynamic AI Model Discovery**: The desktop application dynamically detects active free LLM options at runtime to prevent broken key or service-dependent starts.
- **Diagnostics Dashboard**: Embedded local telemetry capturing startup latencies, SQLite migration status, and memory footprints.
- **Robust Local Logging**: Implemented local daily rotating logs with circular database buffers to prevent file growth from consuming disk space.
