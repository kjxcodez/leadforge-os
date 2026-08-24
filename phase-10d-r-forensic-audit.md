# Phase 10D-R — Intelligence Trust Acceptance & UX Integrity Forensic Audit

**Audit Status:** READ-ONLY FORENSIC AUDIT COMPLETED  
**Repository:** LeadForge OS (`packages/*`, `apps/desktop`, `apps/api`)  
**Date:** 2026-08-24  

---

# 1. Executive Summary
A comprehensive read-only forensic audit was performed across all workspace packages and apps to evaluate Phase 10D implementation, trace intelligence data flow, verify migration consistency, inspect scoring provenance, and diagnose reported CRM, Discovery, Outreach, and Auth UX issues.

**Overall Assessment:** `PARTIALLY COMPLETE`
- **Intelligence Trust Foundation Engine:** Refactored into a grounded Evidence/Claim/Inference model with 0% score baseline and zero hardcoded defaults. All unit tests pass cleanly.
- **Sync Gap Identified:** Intelligence trust tables (`intelligence_sources`, `intelligence_evidence`, `intelligence_claims`, `intelligence_inferences`, `opportunity_scores`, `page_crawls`) are stored in local SQLite only and are **NOT** included in `SyncEngine`, preventing sync to remote API / MongoDB workspace databases.
- **UX & Runtime Bugs Verified:**
  1. **Template Variable Dropdown Bug:** Confirmed React state updater closure bug in `CampaignsScreen.tsx` where mutating `e.target.value = ''` before functional state execution causes `{{}}` insertions.
  2. **Location Model UX Issue:** Raw string location stored in `companies.location`; lacks structured `city`, `state`, `country` fields on `CompanyDocument` and `companies` table.
  3. **Contact Source Filter Duplication:** Confirmed two side-by-side "Source" dropdowns in `ContactsScreen.tsx` (`sourceFilter` vs `sourcePlatformFilter`), both labeled "All Sources".
  4. **Discovery Run Job Aggregation:** `DiscoveryScreen.tsx` queries background `jobs` directly rather than grouping child jobs (`crawler:website`, `enrich:intelligence`) under parent `discovery_runs`.
  5. **Transactional HTML Email Audit:** Auth/system emails (`sendVerificationEmail`, `sendResetPasswordEmail`, `sendWelcomeEmail`) currently render HTML shells (`emailShell`) rather than text-only format.
  6. **Auth Web Page Styling:** API auth pages in `apps/api/src/routes/auth/index.ts` use rounded `border-radius: 8px` instead of the Desktop design system's squared corners (`rounded-none`).

---

# 2. Phase 10D Acceptance Assessment

**Assessment:** `PARTIALLY COMPLETE`

| Objective | Requirement | Observed Repository Implementation | Status |
| --------- | ----------- | ---------------------------------- | ------ |
| **Pipeline Trace** | Source → Raw Obs → Evidence → Claim → Inference → Score → UI | Models exist in SQLite & engine; pipeline executes during `intelligence-worker` jobs. | **VERIFIED** |
| **Fake Defaults Removal** | Zero hardcoded Google Analytics, B2B, $1M-$5M revenue | Default 'Google Analytics' removed; estimated revenue defaults to 'Unknown'; B2B is explicitly labeled as `INFERRED`. | **VERIFIED** |
| **Grounded Scoring** | 0% baseline for unscored/empty leads | `ScoringEngine.calculate()` starts from 0 baseline and outputs explicit provenance array. | **VERIFIED** |
| **UI Trust Badges** | Render VERIFIED / INFERRED / UNKNOWN | `LeadIntelligenceDetails.tsx` displays green VERIFIED badges, amber INFERRED badges, and muted UNKNOWN badges. | **VERIFIED** |
| **Sync Persistence** | Provenance survives remote sync & machine restart | **NOT IMPLEMENTED IN SYNC ENGINE.** Intelligence tables are omitted from `sync-engine.ts`. | **INCOMPLETE / REMAINING** |
| **Migration Registry** | Clean sequential migrations | Migration `029_intelligence_trust_foundation` added; however, migration ID `022` is missing in `runner.ts` (jumps 021 → 023). | **AUDIT FINDING** |

---

# 3. Intelligence Pipeline Trace Matrix

| Stage | Exists | Producer | Storage Location | Consumer | Synced | UI Representation | Tested | Status |
| ----- | ------ | -------- | ---------------- | -------- | ------ | ----------------- | ------ | ------ |
| **Source** | Yes | `intelligence-worker.ts`, `crawler.ts` | SQLite (`intelligence_sources`) | IPC `intelligence:get` | No | Source URL link | Yes | Local Only |
| **Raw Observation** | Yes | `crawler.ts` | SQLite (`page_crawls`) | `CompanyAnalyzer.analyze()` | No | Inspection drawer | Yes | Local Only |
| **Evidence** | Yes | `CompanyAnalyzer`, `WebsiteAnalyzer` | SQLite (`intelligence_evidence`) | `ScoringEngine`, IPC | No | **VERIFIED** badge | Yes | Local Only |
| **Claim** | Yes | `CompanyAnalyzer`, `WebsiteAnalyzer` | SQLite (`intelligence_claims`) | IPC `intelligence:get` | No | Verification details | Yes | Local Only |
| **Inference** | Yes | `CompanyAnalyzer` | SQLite (`intelligence_inferences`) | IPC `intelligence:get` | No | **INFERRED** badge + rule reason | Yes | Local Only |
| **Score** | Yes | `ScoringEngine.calculate()` | SQLite (`opportunity_scores`) | IPC `intelligence:get` | No | Grounded Score % + Provenance | Yes | Local Only |
| **UI** | Yes | `LeadIntelligenceDetails.tsx` | Renderer memory | User | N/A | Trust badges & breakdown drawer | Yes | Operational |

---

# 4. Fake / Default Intelligence Audit

- **Google Analytics Default:** Verified removed from [`intelligence-engine.ts:153`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/intelligence-engine.ts#L153). Detection requires deterministic HTML script/meta signatures.
- **Business Model Default:** Verified removed from hardcoded fallback. Set to `Unknown` or labeled as `INFERRED` via `RULE_HEURISTIC` based on industry keywords.
- **Estimated Revenue Default:** Verified hardcoded `'$1M - $5M'` string is removed; evaluates to `'Unknown'` without evidence.
- **Base Score Offsets:** Verified base scores (60/50/40/30) removed; baseline starts at 0%.

---

# 5. Migration Chain Audit

Inspection of [`apps/desktop/src/main/database/runner.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/runner.ts):

| Migration ID | Name | Exists | Registered | Executed on Boot | Depends On |
| ------------ | ---- | ------ | ---------- | ---------------- | ---------- |
| **001** | `001_initial_schema` | Yes | Yes | Yes | None |
| **020** | `020_sent_message_ids` | Yes | Yes | Yes | 019 |
| **021** | `021_lead_intelligence_engine` | Yes | Yes | Yes | 020 |
| **022** | *MISSING IN REGISTRY* | **No** | **No** | **No** | 021 |
| **023** | `023_audit_trail_and_observability` | Yes | Yes | Yes | 021 |
| **027** | `027_discovery_provenance` | Yes | Yes | Yes | 026 |
| **028** | `028_static_audiences` | Yes | Yes | Yes | 027 |
| **029** | `029_intelligence_trust_foundation` | Yes | Yes | Yes | 028 |

**Finding:** Migration `022` is skipped in `runner.ts`. The sequence jumps directly from `021_lead_intelligence_engine` to `023_audit_trail_and_observability`.

---

# 6. Intelligence Data Model Audit

**Canonical Source of Truth:**
The canonical source of truth for intelligence trust is the new evidence-backed model:
- `intelligence_sources`
- `intelligence_evidence`
- `intelligence_claims`
- `intelligence_inferences`
- `opportunity_scores` (with `provenance` JSON)

Legacy tables `company_intelligence`, `website_intelligence`, and `contact_intelligence` are populated as backward-compatible read caches by `intelligence-worker.ts`.

---

# 7. Score Provenance Audit

- `ScoringEngine.calculate()` initializes all factors (`fitScore`, `sizeScore`, `intentScore`, `urgencyScore`) at **0**.
- Points are awarded strictly when supporting evidence/claims exist:
  - High fit industry: +40
  - Verified stack detection: +30
  - Confirmed B2B model: +30
  - Multiple decision makers: +60
  - Active sales CTA / pricing page: +50
  - Technical pain point (HTTP / 404): +50
- Provenance array maps every point addition to its factor, points, reason, and claim/evidence reference.
- An un-analyzed company receives a score of **0%** ("Cold / Unscored").

---

# 8. AI Insight Audit

- `AIInsightGenerator.generate()` is called during worker execution if `openRouterKey` is present.
- If no key is provided, it returns a non-fabricated template fallback hook.
- `AIInsightGenerator` outputs opening lines and pain point hypotheses, but does **NOT** contaminate `intelligence_evidence` or `intelligence_claims`.
- `LeadIntelligenceDetails.tsx` renders AI hooks under an explicit `AI Lead Intelligence` section header.

---

# 9. Sync Audit

**AUDIT FINDING:** `SyncEngine` ([`apps/desktop/src/main/services/sync-engine.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/sync-engine.ts)) does **NOT** sync intelligence trust tables (`intelligence_sources`, `intelligence_evidence`, `intelligence_claims`, `intelligence_inferences`, `opportunity_scores`, `page_crawls`) to MongoDB or remote SdkClient.
Intelligence data is local-only.

---

# 10. Security Audit

- Workspace isolation is strictly enforced on all SQLite tables (`intelligence_sources`, `intelligence_evidence`, `intelligence_claims`, `intelligence_inferences`, `page_crawls`) via `workspaceId` column constraints and index queries.
- `crm.ts` IPC handlers (`intelligence:get`, `intelligence:trigger`) validate `workspaceId` before executing database queries.

---

# 11. Bug #1 — Template Variable Dropdown Audit

- **File:** [`apps/desktop/src/renderer/screens/CampaignsScreen.tsx:1505-1510, 1541-1546`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/screens/CampaignsScreen.tsx#L1541)
- **Root Cause:** The `onChange` handler for the `<select>` variable insertion dropdown resets `e.target.value = ''` synchronously on the DOM element while scheduling a functional state update `setTplBody((prev) => prev + ` {{${e.target.value}}}`)`. By the time React evaluates the state updater function, `e.target.value` has already been cleared to `''`, causing `{{}}` to be inserted.
- **Affected Inputs:** Subject line and body textareas in `CampaignsScreen.tsx` template creation dialog.

---

# 12. Bug #2 — Location Model Audit

- **Current State:** `companies.location` stores raw Google Maps address strings (e.g., `"100 SW 10th St Unit 511, Miami, FL 33130"`). `CompanyDocument` in MongoDB stores `location?: string`. `discovery_runs` table has `city`, `state`, `country`.
- **UX Issue:** CRM filter bars list full physical street addresses as filter options instead of clean `city, state, country` tokens.
- **Recommended Architecture (Option B):** Retain raw address in `location` / `locationRaw` for evidence, and add structured columns `city`, `state`, `country` to SQLite `companies` table and MongoDB `CompanyDocument` schema. Update Google Maps scraper and manual entry to parse/populate structured location fields.

---

# 13. Bug #3 — Contact Source Filter Duplication Audit

- **File:** [`apps/desktop/src/renderer/screens/ContactsScreen.tsx:342, 375`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/screens/ContactsScreen.tsx#L342)
- **Root Cause:** Two separate `<select>` dropdowns are rendered side-by-side in `EntityToolbar`:
  1. `sourceFilter` (Line 342): Distinct `source` string values from contacts database.
  2. `sourcePlatformFilter` (Line 375): Hardcoded platform options (`google_maps`, `linkedin`, `crawler`, `manual`), also labeled "All Sources".
- **Canonical Selector:** `sourcePlatformFilter` (`handleSourcePlatformFilterChange`) is the wired query parameter passed to `SyncContactRepository.listAndSync()`.

---

# 14. Discovery UX — Multiple Runs / Aggregation Audit

- **File:** [`apps/desktop/src/renderer/screens/DiscoveryScreen.tsx:229`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/screens/DiscoveryScreen.tsx#L229)
- **Root Cause:** `DiscoveryScreen` queries raw background `jobs` table (`scheduler:jobs:list`) instead of grouping child jobs under the logical `discovery_runs` table. Spawning 1 maps scrape job + 10 website crawler jobs displays 11 separate un-nested job rows in the UI, causing vertical list overflow.
- **Recommended UX Hierarchy:** Make `discovery_runs` the primary top-level row, with child crawler/enrichment jobs nested in an expandable detail row.

---

# 15. API Transactional Email Audit

- **File:** [`apps/api/src/lib/mailer.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/lib/mailer.ts)
- **Current Behavior:** System emails (`sendVerificationEmail`, `sendResetPasswordEmail`, `sendWelcomeEmail`) render a full HTML email shell (`emailShell`) with Nodemailer sending `multipart/alternative`.
- **Requirement:** System & transactional auth emails MUST be sent as text/plain. Outreach campaign emails remain unchanged.

---

# 16. API Auth UI Audit

- **File:** [`apps/api/src/routes/auth/index.ts:380-500`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/auth/index.ts#L380)
- **Current Behavior:** API-served auth pages (password reset, email verification, OAuth error pages) use rounded corners (`border-radius: 8px`).
- **Requirement:** Update CSS in `pageShell` to use squared corners (`border-radius: 0px`) matching the Desktop design system.

---

# 17. Design System Compliance

All UI components across CRM, Discovery, Outreach, and Auth must enforce:
- Dark surface background (`#0A0A0B`, `#131316`)
- Forge Orange primary accent (`#E8622C`)
- Squared corners (`rounded-none` / `border-radius: 0px`)
- Standardized status token colors (`info`, `success`, `warning`, `danger`)

---

# 18. Remaining Risks

1. **Unsynced Intelligence State:** Intelligence trust tables remain local-only until added to `SyncEngine`.
2. **Migration Gap:** Skipped migration ID `022` should be filled or documented to maintain clean sequence.

---

# 19. Recommended Architecture & Answers to Final Questions

1. **Can Phase 10D be considered trustworthy?**  
   *Yes, locally.* The analysis engine, scoring provenance, and UI trust badges are honest and evidence-aware. However, remote sync persistence is missing.
2. **What must be fixed before Phase 11?**  
   Template variable insertion bug, contact source filter duplication, location model structuring, discovery run job aggregation, transactional email text-only conversion, and auth page design alignment.
3. **Which reported UX bugs are real?**  
   All 4 reported UX bugs (Template Variable Dropdown, Location Filter, Duplicate Source Filter, Discovery Overflow) are confirmed real.
4. **What architecture should be used for structured location?**  
   Option B: Keep raw address in `location` / `locationRaw`, and add `city`, `state`, `country` columns to SQLite `companies` table and MongoDB `CompanyDocument` schema.
5. **What architecture should be used for Discovery child jobs?**  
   Primary UI list displays `discovery_runs` rows. Child jobs (`crawler:website`, `enrich:intelligence`) are nested inside an expandable accordion for each run.
6. **Which Source filter is canonical?**  
   `sourcePlatformFilter` (`handleSourcePlatformFilterChange`) is canonical.
7. **What is the exact root cause of template variable insertion bug?**  
   Mutating `e.target.value = ''` synchronously inside React's `onChange` before the state updater function `(prev) => prev + ` {{${e.target.value}}}` executes.
8. **Which auth pages/emails need changes?**  
   Emails: `sendVerificationEmail`, `sendResetPasswordEmail`, `sendWelcomeEmail` in `mailer.ts`.  
   Pages: `pageShell` in `apps/api/src/routes/auth/index.ts`.
9. **What should be implemented first?**  
   P0 bug fixes: Template variable insertion (10D-R2) and CRM filter consolidation (10D-R4).

---

# 20. Exact Files To Change

1. [`apps/desktop/src/renderer/screens/CampaignsScreen.tsx`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/screens/CampaignsScreen.tsx)
2. [`apps/desktop/src/renderer/screens/ContactsScreen.tsx`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/screens/ContactsScreen.tsx)
3. [`apps/desktop/src/main/database/runner.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/runner.ts)
4. [`apps/api/src/db/models/company.model.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/db/models/company.model.ts)
5. [`packages/schema/src/entities/company.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/schema/src/entities/company.ts)
6. [`apps/desktop/src/main/workers/plugins/scraper.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/scraper.ts)
7. [`apps/desktop/src/renderer/screens/DiscoveryScreen.tsx`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/screens/DiscoveryScreen.tsx)
8. [`apps/api/src/lib/mailer.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/lib/mailer.ts)
9. [`apps/api/src/routes/auth/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/auth/index.ts)
10. [`apps/desktop/src/main/services/sync-engine.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/sync-engine.ts)
