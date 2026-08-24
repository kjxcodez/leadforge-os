# Phase 10D — Deep Intelligence Forensic Audit

**Audit Status:** READ-ONLY COMPLETED  
**Repository:** LeadForge OS (`packages/*`, `apps/desktop`, `apps/api`)  
**Date:** 2026-08-24  

---

# 1. Current Intelligence Architecture

The existing intelligence capabilities in LeadForge OS are implemented across local workers, IPC handlers, in-memory analyzers, and UI renderer components:

1. **Analysis Engine (`apps/desktop/src/main/services/intelligence-engine.ts`)**:
   - `CompanyAnalyzer.analyze()`: Computes company-level tech stack, business model, estimated revenue, growth/hiring signals, and decision-maker likelihood.
   - `WebsiteAnalyzer.analyze()`: Inspects raw HTML string for buying intent signals, case studies, products/services, and technical issues.
   - `ContactAnalyzer.analyze()`: Evaluates contact title keywords to compute decision-maker score, seniority level, and buying influence.
   - `ScoringEngine.calculate()`: Calculates fit, size, intent, and urgency scores (0-100) and produces an overall opportunity score.
   - `AIInsightGenerator.generate()`: Generates opening lines, pain point hypotheses, and outreach angles via OpenRouter or local rule templates.

2. **Background Worker (`apps/desktop/src/main/workers/plugins/intelligence-worker.ts`)**:
   - Listens for `enrich:intelligence` jobs queued in SQLite.
   - Attempts to load `page_crawls` HTML for a target company (falls back to hardcoded mock HTML when missing).
   - Runs `CompanyAnalyzer`, `WebsiteAnalyzer`, `ContactAnalyzer`, and `ScoringEngine`.
   - Writes results into SQLite tables: `company_intelligence`, `website_intelligence`, `contact_intelligence`, and `opportunity_scores`.

3. **IPC Bridge & Renderer (`apps/desktop/src/main/ipc/crm.ts` & `LeadIntelligenceDetails.tsx`)**:
   - IPC channel `intelligence:get` queries SQLite intelligence tables and returns a combined object to Renderer.
   - IPC channel `intelligence:trigger` queues job type `enrich:intelligence`.
   - `LeadIntelligenceDetails.tsx` renders overall score, sub-scores, tech stack, revenue estimate, and buying signals.

---

# 2. Data Flow

```text
Discovery Run / Scraper / Manual Input
  │
  ├─► Insert into `companies` & `contacts` (SQLite: leadforge_<workspaceId>.db)
  │
User Click "Enrich Lead Profile" / Automation Step
  │
  ├─► IPC `intelligence:trigger`
  │     └─► Insert `enrich:intelligence` job into `jobs` table
  │
Worker Host (`intelligence-worker.ts`)
  │
  ├─► Query `companies` & `contacts`
  ├─► Query `page_crawls` (TABLE MISSING → Fallback to `<html><body>Mock site content</body></html>`)
  ├─► Run `CompanyAnalyzer.analyze()` (Assigns default 'Google Analytics', 'B2B', '$1M - $5M')
  ├─► Run `WebsiteAnalyzer.analyze()` (Scans mock HTML)
  ├─► Run `ContactAnalyzer.analyze()` (Regex title matching)
  ├─► Run `ScoringEngine.calculate()` (Base score fit: 60, size: 50, intent: 40, urgency: 30)
  │
  └─► Save to SQLite (`company_intelligence`, `website_intelligence`, `contact_intelligence`, `opportunity_scores`)
        │
IPC `intelligence:get`
  │
  └─► Renderer Component (`LeadIntelligenceDetails.tsx`) displays scores and defaults as verified facts.
```

---

# 3. Intelligence Fields Inventory

| Field | Current Default / Fallback | Extraction Method | Source | Code Location | Classification |
| ----- | -------------------------- | ----------------- | ------ | ------------- | -------------- |
| `techStack` | `['Google Analytics']` (+ URL substring match for WP/Shopify/SaaS) | Hardcoded default + URL string check | None | `intelligence-engine.ts:55` | **FABRICATED / DEFAULT** |
| `businessModel` | `'B2B'` (overridden to `'B2C'` if industry includes retail/shop) | Hardcoded fallback string | None | `intelligence-engine.ts:63` | **FABRICATED / DEFAULT** |
| `estimatedRevenue` | `'$1M - $5M'` | Hardcoded literal string | None | `intelligence-engine.ts:107` | **FABRICATED** |
| `summary` | `"${name} is a B2B company operating in the ${industry} sector."` | Hardcoded string template | None | `intelligence-engine.ts:104` | **FABRICATED** |
| `websiteQualityScore` | Base 50 (+20 if website exists, +15 if https, +15 if phone) | Heuristic score addition | Scraping / Company record | `intelligence-engine.ts:73` | **INFERRED** |
| `decisionMakerLikelihood` | `0.9` if CEO/Founder/Owner in title, else `0.3` | Keyword substring matching | Contact record | `intelligence-engine.ts:89` | **INFERRED** |
| `leadConfidence` | `'High'` if decisionMakerCount > 0 else `'Medium'` | Heuristic check | Contact record | `intelligence-engine.ts:111` | **INFERRED** |
| `growthSignals` | `'Modern tech stack adoption'`, `'Expanding executive team'` | Evaluates fake `techStack` & contact count | Internal calculations | `intelligence-engine.ts:94` | **FABRICATED / INFERRED** |
| `hiringSignals` | `[]` | Empty array | None | `intelligence-engine.ts:93` | **UNKNOWN** |
| `buyingSignals` | Substring match on `'pricing'`, `'book a call'`, `'free trial'` | Deterministic string check | Page HTML | `intelligence-engine.ts:128` | **VERIFIED (When HTML exists)** |
| `testimonialsCaseStudies` | Substring match on `'testimonial'`, `'case study'` | Deterministic string check | Page HTML | `intelligence-engine.ts:140` | **VERIFIED (When HTML exists)** |
| `technicalIssues` | Substring match on `'404'`, HTTP vs HTTPS | Deterministic string check | Page HTML & URL | `intelligence-engine.ts:158` | **VERIFIED** |
| `brandVoice` | `'Creative / Casual'` if includes 'creative', else `'Professional'` | Keyword match fallback | Page HTML | `intelligence-engine.ts:165` | **INFERRED** |
| `contentQuality` | `'High'` if HTML length > 5000 else `'Medium'` | Length check heuristic | Page HTML | `intelligence-engine.ts:173` | **INFERRED** |
| `decisionMakerScore` | 1.0 (CEO), 0.85 (VP), 0.7 (Director), 0.5 (Manager), 0.2 (Other) | Title keyword match | Contact record | `intelligence-engine.ts:189` | **INFERRED** |
| `overallScore` | `fitScore*0.3 + sizeScore*0.2 + intentScore*0.3 + urgencyScore*0.2` | Weighted formula with high base offsets | Company & Contact records | `intelligence-engine.ts:273` | **INFERRED / UNGROUNDED** |

---

# 4. Fake / Default Intelligence Findings

### Finding 4.1: Hardcoded Tech Stack Default
- **Location:** [`apps/desktop/src/main/services/intelligence-engine.ts:55`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/intelligence-engine.ts#L55)
- **Behavior:** `const techStack: string[] = ['Google Analytics'];`. Every company processed by the intelligence engine is automatically assigned Google Analytics as a detected technology, even without crawling a single web page. If the industry contains "tech" or "software", `['React', 'Next.js', 'TailwindCSS']` are blindly pushed into the array.

### Finding 4.2: Hardcoded B2B Business Model
- **Location:** [`apps/desktop/src/main/services/intelligence-engine.ts:63`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/intelligence-engine.ts#L63)
- **Behavior:** `let businessModel: 'B2B' | 'B2C' | 'Hybrid' | 'Unknown' = 'B2B';`. Defaults every business to B2B without checking source evidence.

### Finding 4.3: Hardcoded Estimated Revenue
- **Location:** [`apps/desktop/src/main/services/intelligence-engine.ts:107`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/intelligence-engine.ts#L107)
- **Behavior:** `estimatedRevenue: '$1M - $5M'`. Hardcoded literal value assigned to ALL enriched companies.

### Finding 4.4: Missing Database Table Fallback to Mock Content
- **Location:** [`apps/desktop/src/main/workers/plugins/intelligence-worker.ts:48-62`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/intelligence-worker.ts#L48-L62)
- **Behavior:** `intelligence-worker.ts` attempts to query `page_crawls` table. `page_crawls` does not exist in any database migration [`runner.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/runner.ts). The query fails silently, setting `htmlContent = '<html><body>Mock site content</body></html>'`.

### Finding 4.5: Schema Mismatch in Automation Plugin
- **Location:** [`apps/desktop/src/main/workers/plugins/automation.ts:2755,2806`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/automation.ts#L2755)
- **Behavior:** `automation.ts` attempts `INSERT INTO company_intelligence (companyId, openingLine, createdAt, updatedAt)...`. Table `company_intelligence` in schema migration 021 [`runner.ts:583`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/runner.ts#L583) lacks `openingLine`, `createdAt`, or `updatedAt` columns, causing SQL errors on execution.

---

# 5. Evidence Gaps

1. **No Evidence Entity**: The codebase lacks any representation of `Evidence`. There is no table, interface, or model storing raw DOM snippets, HTTP header responses, JSON-LD fragments, or scraper observations.
2. **No Source Association**: When a technology or signal is recorded, there is no reference to the URL, HTTP response header, script src attribute, or DOM selector from which it was extracted.
3. **No Retained Observation History**: Crawled HTML content is discarded during job execution. There is no timestamped audit trail of what was observed on a specific date.

---

# 6. Claim Gaps

1. **No Claim Normalization Model**: Findings are directly stored as raw scalar strings or string arrays on `company_intelligence` and `website_intelligence` tables without a normalized `Claim` entity.
2. **No Claim Status**: Claims cannot be marked as `VERIFIED`, `INFERRED`, or `CONTRADICTED`. All values in the DB are rendered identically in the UI.

---

# 7. Inference Gaps

1. **Inferences Hidden as Facts**: Heuristic conclusions (such as `businessModel = 'B2B'`, `leadConfidence = 'High'`, `growthSignals`) are stored in the same columns as factual data.
2. **No Inference Provenance**: Inferences do not list supporting claim/evidence IDs, methodology (`RULE_HEURISTIC`, `STATISTICAL`, `AI`), or explicit confidence scores.
3. **Arbitrary Confidence Numbers**: Arbitrary floating-point numbers (e.g. `0.9` for decision maker likelihood, `0.1` for relationship strength) are hardcoded into functions without a rigorous confidence calculation model.

---

# 8. Score Provenance Gaps

1. **Ungrounded Base Offsets**: `ScoringEngine.calculate()` initializes base scores:
   - `fitScore = 60`
   - `sizeScore = 50`
   - `intentScore = 40`
   - `urgencyScore = 30`
   An empty company record with no industry match, no contacts, and no website receives an overall score of `46%` ("Warm Lead").
2. **No Component Evidence Mapping**: The score explanation string contains hardcoded text lines (`+20: Industry match`) but does NOT reference supporting evidence IDs or claims.
3. **Scoring Influenced by Fabricated Data**: `ScoringEngine` computes fit and intent based on `company.industry` strings and fake `buyingSignals` from mock HTML.

---

# 9. Storage / Sync Findings

1. **Local SQLite Only**: Intelligence tables (`company_intelligence`, `website_intelligence`, `contact_intelligence`, `opportunity_scores`) exist only in local SQLite (`leadforge_${workspaceId}.db`).
2. **Missing from SyncEngine**: `SyncEngine` ([`apps/desktop/src/main/services/sync-engine.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/sync-engine.ts)) does not include intelligence tables in queue processing or pull routines. Intelligence data is not persisted to remote API or MongoDB workspace stores.
3. **No Tombstoning / Deduplication**: Re-running intelligence enrichment completely overwrites existing records using SQLite `ON CONFLICT DO UPDATE`, discarding prior state without retaining observation history or evidence lineage.

---

# 10. Security Findings

1. **Workspace Isolation**: Database queries in `crm.ts` and `intelligence-worker.ts` operate on workspace-scoped SQLite files (`leadforge_${workspaceId}.db`).
2. **IPC Scope Checks**: `intelligence:get` and `intelligence:trigger` validate `workspaceId` before opening database handles.
3. **Observation Boundaries**: Evidence and source metadata MUST enforce strict `workspaceId` column constraints and index scoping to prevent cross-workspace leakages.

---

# 11. UI Trust Findings

1. **Lack of Certainty Badges**: `LeadIntelligenceDetails.tsx` displays `Est. Revenue ($1M - $5M)`, `Business Model (B2B)`, and `Technologies Detected` with no visual distinction between verified facts and rule guesses.
2. **Hardcoded Preview Text**: Custom outreach angle section renders a hardcoded quote `"Saw that you guys are building out your digital infrastructure..."`.
3. **No "Why?" Breakdown**: Clicking a score or claim does not allow the user to inspect the underlying source URL, extraction timestamp, or rule justification.
4. **Unknown State Treated as Missing**: When fields are missing, the UI displays default fallback strings (e.g. `'B2B'`) rather than an explicit `UNKNOWN` state.

---

# 12. Recommended Canonical Trust Model

We propose a minimal, normalized, workspace-scoped **Intelligence Trust Model**:

```text
Source
  │ (sourceId, workspaceId, sourceType, url, retrievedAt, status)
  ▼
Raw Observation / Excerpt
  │ (observationId, workspaceId, sourceId, contentHash, excerpt, observedAt)
  ▼
Evidence
  │ (evidenceId, workspaceId, companyId, sourceId, observationId, evidenceType, key, value, extractionMethod, observedAt)
  ▼
Claim
  │ (claimId, workspaceId, companyId, evidenceIds[], subject, predicate, objectValue, verificationStatus: 'VERIFIED'|'UNVERIFIED')
  ▼
Inference
  │ (inferenceId, workspaceId, companyId, claimIds[], field, value, inferenceMethod: 'RULE_HEURISTIC', confidence, reason)
  ▼
Score Component Provenance
  │ (companyId, overallScore, fitScore, sizeScore, intentScore, urgencyScore, scoreBreakdownJson)
```

---

# 13. Exact Files To Change

1. [`apps/desktop/src/main/database/runner.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/runner.ts)
   - Add migration `026_intelligence_trust_foundation` defining `intelligence_sources`, `intelligence_evidence`, `intelligence_claims`, `intelligence_inferences`, and updated `opportunity_scores` schema.
2. [`apps/desktop/src/main/services/intelligence-engine.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/intelligence-engine.ts)
   - Remove hardcoded defaults (`'Google Analytics'`, `'B2B'`, `'$1M - $5M'`).
   - Implement deterministic rule extraction that outputs `Evidence`, `Claim`, `Inference`, and explainable `Score`.
   - Update `ScoringEngine` to start from base `0` and only score based on verified/inferred claims with explicit component provenance.
3. [`apps/desktop/src/main/workers/plugins/intelligence-worker.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/intelligence-worker.ts)
   - Refactor worker to extract evidence from actual page crawls, discovery runs, and company records.
   - Save structured `Source`, `Evidence`, `Claim`, `Inference`, and `Score` records into SQLite in a single transaction.
4. [`apps/desktop/src/main/workers/plugins/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/automation.ts)
   - Fix SQL schema mismatch for `company_intelligence` columns or route through new trust models.
5. [`packages/schema/src/ipc/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/schema/src/ipc/index.ts) & [`apps/desktop/src/main/ipc/crm.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/crm.ts)
   - Update `intelligence:get` IPC contract and handler to return claims, inferences, evidence, and score provenance.
6. [`apps/desktop/src/renderer/components/crm/LeadIntelligenceDetails.tsx`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/components/crm/LeadIntelligenceDetails.tsx)
   - Update UI to show **VERIFIED**, **INFERRED**, and **UNKNOWN** trust badges.
   - Implement progressive disclosure "Why?" popover/drawer for score provenance and evidence inspection.
7. [`apps/desktop/src/main/services/intelligence.test.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/intelligence.test.ts`)
   - Update existing tests and add comprehensive regression tests for zero fake defaults, evidence-to-claim tracking, score provenance, and workspace isolation.

---

# 14. Risks

1. **UI Backward Compatibility**: Renderers expects existing `companyIntelligence` and `opportunityScore` fields. We must maintain compatible fields alongside the trust model to prevent UI runtime crashes.
2. **Score Degradation for Existing Companies**: Removing base offset scores (60/50/40/30) will reduce ungrounded high scores down to 0 for companies with no data. This is intended, honest product behavior.
3. **Database Migration Overhead**: Adding 4 new tables into workspace SQLite databases must execute cleanly without affecting existing CRM company records.

---

# 15. Implementation Sequence

1. **Stage 10D.1**: Read-only forensic audit (COMPLETE - documented in this file).
2. **Stage 10D.2**: Data Model & Schema Migration (`026_intelligence_trust_foundation`).
3. **Stage 10D.3**: Source & Retrieval Metadata Infrastructure.
4. **Stage 10D.4**: Deterministic Extraction Cleanup (Removal of hardcoded defaults).
5. **Stage 10D.5**: Inference Labeling & Rule Engine.
6. **Stage 10D.6**: Score Provenance & Missing-Data Safety.
7. **Stage 10D.7**: Intelligence UI Trust Indicators & Progressive Disclosure.
8. **Stage 10D.8**: Regression Verification Tests.
