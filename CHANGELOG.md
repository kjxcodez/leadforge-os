# Changelog

All notable changes to LeadForge OS will be documented in this file.

## [1.0.0-beta.1] - 2026-08-01

### Added

- **Quality & Release Gates**: Introduced a strict 10-gate release verification check to ensure maximum platform stability prior to any distribution.
- **Dynamic AI Model Discovery**: The desktop application dynamically detects active free LLM options at runtime to prevent broken key or service-dependent starts.
- **Diagnostics Dashboard**: Embedded local telemetry capturing startup latencies, SQLite migration status, and memory footprints.
- **Robust Local Logging**: Implemented local daily rotating logs with circular database buffers to prevent file growth from consuming disk space.
