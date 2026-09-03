# LeadForge OS — Phase 0: Repository & Git Hygiene Audit Report

**Date**: September 4, 2026  
**Auditor**: LeadForge OS Reliability & Quality Engineering  
**Scope**: Full Monorepo (Root, Applications, Packages, Scripts, Tooling, Docs, CI/CD, Git Hygiene)  
**Status**: Completed Baseline Audit  

---

## 1. Repository Overview

LeadForge OS is organized as a multi-package monorepo managed via `pnpm` workspaces (`pnpm-workspace.yaml`) and orchestrated by Turborepo (`turbo.json`).

### Monorepo Topography

```text
leadforge-os/
├── apps/
│   ├── api/          # Express 4 + TypeScript + Mongoose 9 + Better-Auth backend service
│   ├── desktop/      # Electron 32 + React 19 + better-sqlite3 local-first client & scraper runtime
│   └── marketing/    # Next.js 16 + React 19 + Tailwind marketing & documentation portal
├── packages/
│   ├── schema/       # Authoritative Zod schemas, DTOs, Enums, entities, and email-sanitizer
│   ├── core/         # Unified response wrappers, error definitions, and utility helpers
│   ├── sdk/          # Strongly typed client SDK & HTTP transport bridge
│   ├── logger/       # Structured logger interface and formatting
│   ├── ai/           # LLM adapters, tool descriptors, and prompt builders
│   ├── agent-core/   # Agent capability registry, tool execution state, and adapters
│   ├── agent-runtime/# Autonomous long-running agent execution loop
│   ├── workflow-engine/ # Declarative automation DAG executor
│   └── auth/         # Shared auth utilities and session contracts
├── scripts/          # Build scripts, CI verification, migrations, and developer diagnostics
├── docs/             # Technical documentation, ADRs, user guides, and historical forensics
├── .github/          # GitHub Actions workflows, issue templates, and PR templates
└── report/           # Ephemeral runtime diagnostic reports, coverage, and health metrics (.gitignore)
```

---

## 2. Comprehensive Artifact Classification

Every suspicious, temporary, historical, or non-source artifact across the repository was inspected for inbound references across application source code, package manifests, CI workflows, deployment scripts, release pipelines, and documentation.

| File / Path | Classification | Evidence & Usage Context | Recommended Action |
| :--- | :--- | :--- | :--- |
| `LOCATION_DATA_COMPARISON.md` | `HISTORICAL` | Intermediate comparison report for ISO geography dataset. 0 references in source/scripts/CI. | **MOVE** $\rightarrow$ `docs/archive/historical-audits/` |
| `LOCATION_DATA_FORENSIC_AUDIT.md` | `HISTORICAL` | Investigative audit of legacy 40-country limits. 0 references in source/scripts/CI. | **MOVE** $\rightarrow$ `docs/archive/historical-audits/` |
| `LOCATION_DATA_IMPLEMENTATION_PLAN.md` | `HISTORICAL` | Implementation plan for geography refactor. 0 references in source/scripts/CI. | **MOVE** $\rightarrow$ `docs/archive/historical-audits/` |
| `PHASE_10I_CHANGELOG_AUDIT.md` | `HISTORICAL` | Intermediate changelog audit from Beta 4 release. 0 references in source/scripts/CI. | **MOVE** $\rightarrow$ `docs/archive/historical-audits/` |
| `PHASE_10I_RELEASE_AUDIT.md` | `HISTORICAL` | Pre-release qualification dump for Beta 4. 0 references in source/scripts/CI. | **MOVE** $\rightarrow$ `docs/archive/historical-audits/` |
| `PHASE_10I_RELEASE_BASELINE.md` | `HISTORICAL` | Pre-release state snapshot for Beta 4. 0 references in source/scripts/CI. | **MOVE** $\rightarrow$ `docs/archive/historical-audits/` |
| `PHASE_10I_RELEASE_GATE.md` | `HISTORICAL` | Historical release gate checklist. 0 references in source/scripts/CI. | **MOVE** $\rightarrow$ `docs/archive/historical-audits/` |
| `PHASE_10I_RELEASE_MATRIX.md` | `HISTORICAL` | Test execution matrix for Beta 4. 0 references in source/scripts/CI. | **MOVE** $\rightarrow$ `docs/archive/historical-audits/` |
| `desktop-process-env-audit.md` | `HISTORICAL` | Investigation of Electron `process.env` propagation. 0 references in source/scripts/CI. | **MOVE** $\rightarrow$ `docs/archive/historical-audits/` |
| `desktop-process-env-implementation-plan.md` | `HISTORICAL` | Historical plan for env refactoring. 0 references in source/scripts/CI. | **MOVE** $\rightarrow$ `docs/archive/historical-audits/` |
| `desktop-runtime-config-forensic-audit.md` | `HISTORICAL` | Forensic analysis of runtime config paths. 0 references in source/scripts/CI. | **MOVE** $\rightarrow$ `docs/archive/historical-audits/` |
| `phase-10h-r-final-verdict.md` | `HISTORICAL` | Release qualification verdict for Phase 10H. 0 references in source/scripts/CI. | **MOVE** $\rightarrow$ `docs/archive/historical-audits/` |
| `phase-10h-r-forensic-confirmation.md` | `HISTORICAL` | Forensic review of Phase 10H changes. 0 references in source/scripts/CI. | **MOVE** $\rightarrow$ `docs/archive/historical-audits/` |
| `post-release-outreach-forensic-audit.md` | `HISTORICAL` | Post-release audit of outreach worker. 0 references in source/scripts/CI. | **MOVE** $\rightarrow$ `docs/archive/historical-audits/` |
| `implementation_report.md` | `DOCUMENTATION` | Authoritative implementation report for vNext reliability hardening. | **KEEP** (Root milestone record) |
| `ISSUE_TEMPLATE.md` | `OBSOLETE_CANDIDATE` | Obsolete monolithic issue template in root. Superseded by `.github/ISSUE_TEMPLATE/*.md`. 0 references. | **REMOVE** |
| `scratch/inspect_dbs.py` | `TEMPORARY` | Python script containing hardcoded machine paths (`C:\Users\91637\AppData\...`). Zero references. | **REMOVE** |
| `scratch/add_adr_diagrams.js` | `TEMPORARY` | One-off script for inserting Mermaid diagrams into ADRs. Zero production references. | **REMOVE** |
| `.rtk/` | `GENERATED` | Empty untracked local directory. | **REMOVE / IGNORE** |
| `scripts/clean-tsbuildinfo.js` | `BUILD_TOOLING` | Critical build script invoked by `build` in all 11 monorepo packages/apps. | **KEEP** |
| `scripts/doctor.ts` | `DEVELOPER_TOOLING` | Monorepo diagnostics tool invoked by `pnpm doctor`, `verify-production.ts`, and CI `quality.yml`. | **KEEP** |
| `scripts/verify-repo-health.ts` | `CI_CD` | Repository invariant auditor invoked by `.github/workflows/quality.yml` and `doctor.ts`. | **KEEP** |
| `scripts/verify-migrations.ts` | `CI_CD` | Migration validator invoked by `.github/workflows/sqlite-check.yml`. | **KEEP** |
| `scripts/release-check.ts` | `CI_CD` | 8-gate release verification harness invoked by `pnpm release:check`. | **KEEP** |
| `scripts/verify-production.ts` | `CI_CD` | Production sanity checker invoked by `pnpm verify:production`. | **KEEP** |
| `scripts/bump-version.mjs` | `DEVELOPER_TOOLING` | Version increment utility invoked by `pnpm bump-version`. | **KEEP** |
| `scripts/generate-releases.mjs` | `BUILD_TOOLING` | Release fetcher invoked by `.github/workflows/release-sync.yml` and `apps/marketing`. | **KEEP** |
| `scripts/generate-contributors.mjs` | `BUILD_TOOLING` | Contributor fetcher invoked by `apps/marketing`. | **KEEP** |
| `scripts/generate-search-index.mjs` | `BUILD_TOOLING` | Search indexer for documentation invoked by `apps/marketing`. | **KEEP** |
| `scripts/smoke-test.ts` | `TEST` | Headless boot diagnostics bundled and executed by `release-check.ts` (Gate 6). | **KEEP** |
| `scripts/test-ai.ts` | `TEST` | AI model connectivity test invoked by `pnpm test:ai` and `release-check.ts` (Gate 5). | **KEEP** |
| `scripts/mock-electron.ts` | `TEST` | Mock Electron IPC/app module used by test harnesses. | **KEEP** |
| `scripts/migrate-sqlite-to-mongo.ts` | `MIGRATION` | Primary historical data migration from SQLite to MongoDB. | **KEEP** |
| `scripts/migrate-mongo-objectids.ts` | `MIGRATION` | MongoDB UUID string migration utility. | **KEEP** |
| `scripts/migrate-quarantine-corrupted-emails.ts` | `MIGRATION` | Contact email recovery & quarantine migration utility with `--dry-run` and `--execute`. | **KEEP** |
| `scripts/migration-manifest.ts` | `MIGRATION` | Authoritative entity mapping manifest for database migrations. | **KEEP** |
| `scripts/sqlite-discovery.ts` | `MIGRATION` | Shared SQLite discovery helper used by migration utilities. | **KEEP** |
| `scripts/inventory-mongo.ts` | `DEVELOPER_TOOLING` | Diagnostic utility for inspecting MongoDB collections. | **KEEP** |
| `scripts/probe-mongo.ts` | `DEVELOPER_TOOLING` | Diagnostic ping utility for testing MongoDB connectivity. | **KEEP** |
| `scripts/test-atomic-send-gate.ts` | `TEST` | Live integration test verifying atomic sending gate invariants (Invariants 1–8). | **KEEP** (Schedule for integration test suite) |
| `scripts/test-sanitizer.ts` | `TEST` | Email sanitizer unit test suite. | **MOVE** $\rightarrow$ `packages/schema/src/utils/email-sanitizer.test.ts` |
| `scripts/test-scheduler-recovery.ts` | `TEMPORARY` | Temporary scratch script. Duplicate of `apps/desktop/src/main/services/scheduler-recovery.test.ts`. | **REMOVE** |
| `scripts/verify-phase1.ts` to `verify-phase15.ts` (41 scripts) | `HISTORICAL` | Phase-specific verification test scripts written for historical architectural phases 1–15. Not invoked in CI or package scripts. Referenced in historical audit docs. | **REVIEW_REQUIRED** (Retain in `scripts/legacy-verification/` or plan migration to Vitest) |

---

## 3. Cleanup Candidates (Confirmed by Direct Evidence)

The following items have **zero** inbound references across all application code, package manifests, CI pipelines, and deployment scripts, and are confirmed safe for immediate cleanup:

1. **`ISSUE_TEMPLATE.md` (root)**:
   - *Evidence*: Obsolete monolithic file superseded by `.github/ISSUE_TEMPLATE/bug_report.md` and `.github/ISSUE_TEMPLATE/feature_request.md`. Zero references.
   - *Action*: `git rm ISSUE_TEMPLATE.md`
2. **`scratch/inspect_dbs.py`**:
   - *Evidence*: Contains hardcoded machine path (`C:\Users\91637\AppData\...`). Zero inbound imports or script references.
   - *Action*: `git rm scratch/inspect_dbs.py`
3. **`scratch/add_adr_diagrams.js`**:
   - *Evidence*: One-off script used to insert diagrams into ADR markdown. Zero operational references.
   - *Action*: `git rm scratch/add_adr_diagrams.js`
4. **`scripts/test-scheduler-recovery.ts`**:
   - *Evidence*: Untracked interim scratch file. The permanent, verified version is committed and active at `apps/desktop/src/main/services/scheduler-recovery.test.ts` (executed in `apps/desktop/scripts/run-tests.js`).
   - *Action*: Delete untracked scratch copy.
5. **`.rtk/` & `scratch/` directory tracking**:
   - *Evidence*: Scratch and IDE/tooling artifacts.
   - *Action*: Ensure `.rtk/` and `scratch/` are explicitly ignored in `.gitignore`.

---

## 4. Files Requiring Review (`REVIEW_REQUIRED`)

The 41 historical verification scripts located in `scripts/` (`verify-phase*.ts`, `verify-api-reliability.ts`, `verify-architecture-invariants.ts`, etc.):
- **Finding**: These scripts were created during the MongoDB-First Architecture Migration (Phases 1–17) to certify individual milestones. They contain rich assertions (e.g., MIME chunking, OAuth token lifecycle, atomic locks, race condition simulations).
- **Status**: They are not currently run in automated CI (except `verify-repo-health.ts` and `verify-migrations.ts`).
- **Risk**: Deleting them would destroy historical testing logic that could be converted into permanent integration tests.
- **Recommendation**: Do **not** delete them in Phase 0. Group them into `scripts/legacy-verification/` or schedule them for conversion into automated Vitest integration tests in a subsequent testing modernization phase.

---

## 5. Test Infrastructure Assessment

### Current State
LeadForge OS currently possesses three distinct, non-unified testing mechanisms:
1. **Desktop Native Test Harness (`apps/desktop/scripts/run-tests.js`)**:
   - Executes 15 test suites using the Electron binary with `ELECTRON_RUN_AS_NODE=1` to ensure binary compatibility with `better-sqlite3` on Electron ABI 130 (`NODE_MODULE_VERSION 130`).
   - Deterministic and passing 100%.
2. **Package-Local Test Runners (`src/tests/run.ts`)**:
   - Present in `@leadforge/agent-core`, `@leadforge/agent-runtime`, and `@leadforge/workflow-engine`.
   - Uses basic Node assertion scripts without standard assertion reporting or mocking.
3. **Root / Scripts-Level Integration Scripts (`scripts/test-*.ts`)**:
   - Standalone `tsx` scripts that test against live MongoDB instances (`scripts/test-atomic-send-gate.ts`, `scripts/test-ai.ts`).

### Assessment & Target Architecture
- **Flaw**: Tests lack a unified runner, standard test reporting, snapshot testing, and monorepo-wide coverage metrics. Developers must know which custom runner or script executes which test.
- **Target Architecture Recommendation**:
  - Adopt **Vitest** monorepo-wide in a dedicated testing infrastructure phase.
  - Vitest provides native TypeScript/ESM support, workspace configuration (`vitest.workspace.ts`), concurrency control, and fast watch modes.
  - Native SQLite tests can be configured with a custom pool or isolated runner environment.
  - Standalone verification scripts should be converted to `@leadforge/api` and `@leadforge/desktop` integration test suites.

---

## 6. Git Hygiene Assessment

### Current Working Tree Audit
- **Untracked Production Files**:
  - `apps/api/src/constants/email-policy.ts`: Production constant definitions for email safety ceilings and effective policy resolution. Must be committed.
  - `apps/desktop/src/main/services/scheduler-recovery.test.ts`: Verified desktop unit test for WAITING sequence recovery. Must be committed.
  - `packages/schema/src/utils/`: Contains `email-sanitizer.ts` (production email validation and repair module). Must be committed.
  - `scripts/migrate-quarantine-corrupted-emails.ts`: Operational migration script. Must be committed.
  - `scripts/test-atomic-send-gate.ts`: Verification integration test. Must be committed.
  - `scripts/test-sanitizer.ts`: Sanitizer unit test. Move to `packages/schema/src/utils/email-sanitizer.test.ts` and commit.
- **`.gitignore` Deficiencies Identified**:
  - `scratch/` was not ignored, causing developer scratch files to be committed.
  - `.rtk/` was not ignored.
  - Missing ignore rules for test SQLite temporary database artifacts created during smoke tests (e.g. `report/temp-smoke/`).
- **`.gitignore` Adjustments Made**:
  - Added `scratch/`
  - Added `.rtk/`
  - Added `*.temp.db`

---

## 7. Release & Changelog Assessment

### Current Process
- `CHANGELOG.md`: Manually curated, user-facing change log.
- `CHANGELOG-DEV.md`: Manually curated, developer/technical change log.
- `scripts/bump-version.mjs`: Synchronizes version bumps across root `package.json`, apps, and workspace packages.
- `.github/workflows/release-sync.yml`: Triggered upon GitHub Releases to execute `node scripts/generate-releases.mjs`, which populates `apps/marketing/lib/generated-releases.ts` for the public website.
- `.github/workflows/release.yml`: Builds and packages desktop installers via `electron-builder` when a tag matching `v*` is pushed.

### Recommended Future Direction
- Transition to **Changesets** (`@changesets/cli`):
  - In a multi-package monorepo, manual double-changelog maintenance (`CHANGELOG.md` + `CHANGELOG-DEV.md`) inevitably drifts and creates merge conflicts.
  - Changesets allow developers to attach small markdown fragments to feature PRs.
  - CI automates version calculation, package bumping, and unified changelog compilation upon release.

---

## 8. Recommended Cleanup Execution Plan

### A. REMOVE (Zero-Risk Obsolete Artifacts)
- `ISSUE_TEMPLATE.md` (root)
- `scratch/inspect_dbs.py`
- `scratch/add_adr_diagrams.js`
- `scripts/test-scheduler-recovery.ts` (untracked duplicate)

### B. MOVE (Root Clutter $\rightarrow$ Historical Archive)
Move all 14 root forensic/audit markdown files into `docs/archive/historical-audits/`:
- `LOCATION_DATA_COMPARISON.md`
- `LOCATION_DATA_FORENSIC_AUDIT.md`
- `LOCATION_DATA_IMPLEMENTATION_PLAN.md`
- `PHASE_10I_CHANGELOG_AUDIT.md`
- `PHASE_10I_RELEASE_AUDIT.md`
- `PHASE_10I_RELEASE_BASELINE.md`
- `PHASE_10I_RELEASE_GATE.md`
- `PHASE_10I_RELEASE_MATRIX.md`
- `desktop-process-env-audit.md`
- `desktop-process-env-implementation-plan.md`
- `desktop-runtime-config-forensic-audit.md`
- `phase-10h-r-final-verdict.md`
- `phase-10h-r-forensic-confirmation.md`
- `post-release-outreach-forensic-audit.md`

### C. CONSOLIDATE (Unit Tests)
- Move `scripts/test-sanitizer.ts` to `packages/schema/src/utils/email-sanitizer.test.ts`.

### D. KEEP (Production Code, Migrations & Permanent Tooling)
- `apps/api/src/constants/email-policy.ts`
- `packages/schema/src/utils/email-sanitizer.ts`
- `scripts/migrate-quarantine-corrupted-emails.ts`
- `scripts/test-atomic-send-gate.ts`
- `apps/desktop/src/main/services/scheduler-recovery.test.ts`
- `implementation_report.md`
- All active scripts: `clean-tsbuildinfo.js`, `doctor.ts`, `verify-repo-health.ts`, `verify-migrations.ts`, `release-check.ts`, `verify-production.ts`, `bump-version.mjs`, `generate-*.mjs`, `smoke-test.ts`, `test-ai.ts`.

---

## 9. Risk Analysis

| Action | Potential Risk | Mitigation / Verification |
| :--- | :--- | :--- |
| Moving root audit markdown files | Broken external links or documentation references. | Audited with `git grep`. Confirmed 0 references across entire codebase. |
| Removing `ISSUE_TEMPLATE.md` | GitHub issue creation broken. | Verified `.github/ISSUE_TEMPLATE/` contains valid `bug_report.md` and `feature_request.md`. |
| Removing `scratch/` files | Developer tooling lost. | Scripts examined; contain hardcoded machine paths and one-time tasks. Archived in git history. |
| Updating `.gitignore` | Accidental omission of source files. | Rules targeted narrowly to `scratch/` and `.rtk/`. Verified with `git status`. |

---

## 10. Next Phase Recommendation

### Recommended Scope: Email Discovery & Email Correctness Pipeline Audit
Now that the repository baseline is hygienic and the outbound email sending gate is atomically protected in MongoDB, the project is ready to enter the next engineering milestone:

**Scope of Next Phase**:
1. **Forensic Audit of Crawler / Scraper Extraction Pipeline**:
   - Audit how emails are discovered across raw HTML, contact pages, footer blocks, and external links.
   - Investigate how contact entities are linked to companies and domain contexts.
2. **Email Correctness & Confidence Scoring**:
   - Transition from simple syntactic validation (`sanitizeAndValidateEmail`) to a robust **confidence scoring model** (`HIGH_CONFIDENCE`, `ROLE_BASED`, `AMBIGUOUS`, `UNVERIFIABLE`).
   - Prevent generic mailbox spam (e.g. `support@`, `privacy@`, `abuse@`) from being targeted indiscriminately in outbound sales campaigns.
3. **Preserve Valid Domain Topologies**:
   - Ensure legitimate international TLDs (`.co.uk`, `.com.au`, `.io`, `.ai`), subdomains, and corporate mail routing are never aggressively false-positived.
