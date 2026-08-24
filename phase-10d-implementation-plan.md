# Phase 10D — Intelligence Trust Foundation Implementation Plan

This implementation plan details the architectural changes required to make LeadForge OS's intelligence pipeline honest, evidence-backed, and traceable, removing all hardcoded fake intelligence defaults and introducing explicit trust provenance (**VERIFIED**, **INFERRED**, **UNKNOWN**).

---

## User Review Required

> [!IMPORTANT]
> **Score Baseline Shift**: Previously, empty companies received an ungrounded base score of 46% ("Warm Lead") due to hardcoded offset scores (fit: 60, size: 50, intent: 40, urgency: 30). Under the new Evidence/Claim model, missing data produces a score of **0%** and an explicit state of **UNKNOWN**. This changes lead prioritization for un-analyzed leads from "Warm" to "Cold/Unscored", ensuring complete honesty.

> [!NOTE]
> **No AI Infrastructure Added**: As required by Phase 10D rules, no AI provider abstraction, AI routers, vector databases, or LLM summarization features are included in this plan.

---

## Open Questions

- None. All requirements and architectural specifications are fully defined by the Phase 10D guidelines and repository forensic audit findings.

---

## Proposed Changes

### Database & Schema Layer

#### [MODIFY] [`apps/desktop/src/main/database/runner.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/runner.ts)
- Add migration `026_intelligence_trust_foundation` creating SQLite tables:
  - `intelligence_sources`: `id`, `workspaceId`, `sourceType`, `url`, `retrievedAt`, `status`, `contentHash`
  - `intelligence_evidence`: `id`, `workspaceId`, `companyId`, `sourceId`, `evidenceType`, `key`, `value`, `rawExcerpt`, `extractionMethod`, `observedAt`
  - `intelligence_claims`: `id`, `workspaceId`, `companyId`, `evidenceIds`, `subject`, `predicate`, `objectValue`, `verificationStatus`
  - `intelligence_inferences`: `id`, `workspaceId`, `companyId`, `supportingClaimIds`, `field`, `value`, `inferenceMethod`, `confidence`, `reason`
  - Update `opportunity_scores` table to include `provenance` JSON string column.

---

### Intelligence Engine & Analyzers

#### [MODIFY] [`apps/desktop/src/main/services/intelligence-engine.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/intelligence-engine.ts)
- Remove hardcoded tech stack default (`['Google Analytics']`).
- Remove hardcoded business model default (`'B2B'`).
- Remove hardcoded revenue default (`'$1M - $5M'`).
- Implement deterministic HTML extraction for technologies (inspecting script tags, meta tags, header signatures).
- Return explicit `Evidence`, `Claim`, and `Inference` objects.
- Refactor `ScoringEngine.calculate()`:
  - Base scores start at `0`.
  - Missing data (`UNKNOWN`) adds `0` points.
  - Calculate scores strictly from evidence-backed claims and labeled inferences.
  - Output explicit component provenance array detailing exact evidence/claim IDs and point allocations.

---

### Background Workers & Automation

#### [MODIFY] [`apps/desktop/src/main/workers/plugins/intelligence-worker.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/intelligence-worker.ts)
- Extract evidence from actual page crawls, discovery runs, or company metadata.
- Store `Source`, `Evidence`, `Claim`, `Inference`, and `Score` in SQLite transaction.
- Eliminate fallback to mock HTML string.

#### [MODIFY] [`apps/desktop/src/main/workers/plugins/automation.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/automation.ts)
- Fix SQL query references to `company_intelligence` columns.

---

### IPC Bridge & Schemas

#### [MODIFY] [`packages/schema/src/ipc/index.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/schema/src/ipc/index.ts)
- Update `intelligence:get` IPC type contract to include claims, inferences, evidence, and score provenance.

#### [MODIFY] [`apps/desktop/src/main/ipc/crm.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/crm.ts)
- Update IPC handler for `intelligence:get` to fetch from `intelligence_evidence`, `intelligence_claims`, `intelligence_inferences`, and `opportunity_scores`.

---

### User Interface & Trust Indicators

#### [MODIFY] [`apps/desktop/src/renderer/components/crm/LeadIntelligenceDetails.tsx`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/components/crm/LeadIntelligenceDetails.tsx)
- Render trust indicators:
  - **VERIFIED**: Green badge showing exact source URL and extraction method.
  - **INFERRED**: Amber badge showing rule/heuristic reason and confidence.
  - **UNKNOWN**: Muted badge indicating no reliable evidence found.
- Add progressive disclosure "Why?" popover to inspect score breakdown provenance and supporting evidence snippets.
- Remove fake hardcoded preview text in custom outreach angle section.

---

### Regression Testing

#### [MODIFY] [`apps/desktop/src/main/services/intelligence.test.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/intelligence.test.ts)
- Add automated test assertions verifying:
  - Zero hardcoded defaults (`Google Analytics`, `B2B`, `$1M-$5M`).
  - Evidence links to source.
  - Claims reference evidence.
  - Inferences reference claims/evidence.
  - Missing evidence produces `UNKNOWN` state and 0 score addition.
  - Score components include provenance.
  - Workspace isolation is enforced.

---

## Verification Plan

### Automated Tests
Run desktop tests via script:
```powershell
node apps/desktop/scripts/run-tests.js
```

### Manual Verification
1. Open Desktop App CRM screen.
2. Select a company without enriched intelligence: verify fields display **UNKNOWN** rather than fake defaults (`Google Analytics`, `B2B`, `$1M-$5M`).
3. Trigger lead enrichment on a company with website HTML: verify detected technologies render with **VERIFIED** badges and source links.
4. Inspect score breakdown: click "Score Explanations" and verify each score contribution lists supporting claim IDs and evidence.
