# Changelog

All notable changes to LeadForge OS will be documented in this file.

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
