# Phase 10D-R — Intelligence Trust Acceptance & Stabilization Implementation Plan

## Goal Description
Hardening LeadForge OS intelligence pipeline trust, fixing critical CRM/Outreach UI bugs, structuring company locations for cleaner filtering, grouping child jobs under logical Discovery Runs, converting system emails to plain text, and aligning standalone API auth pages with the Desktop design system (`rounded-none`, dark theme, LeadForge tokens).

---

## User Review Required

> [!IMPORTANT]
> - **Template Variable Bug Root Cause:** Fixed by capturing `const val = e.target.value;` prior to resetting the dropdown selection, preventing variable string erasure.
> - **Structured Location Architecture (Option B):** Preserves raw address in `location` / `locationRaw`, adding `city`, `state`, `country` columns to SQLite `companies` and MongoDB `CompanyDocument` to provide clean CRM filters.
> - **Transactional Email Format:** System emails (`sendVerificationEmail`, `sendResetPasswordEmail`, `sendWelcomeEmail`) switch to plain text format for maximum deliverability during beta. Outreach emails are untouched.

---

## Open Questions

None. All repository findings and architectural decisions have been verified empirically against current source code.

---

## Proposed Changes

### Phase 10D-R1 — Intelligence Trust Reconciliation & Sync
#### [MODIFY] [sync-engine.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/services/sync-engine.ts)
- Add intelligence trust tables (`intelligence_sources`, `intelligence_evidence`, `intelligence_claims`, `intelligence_inferences`, `opportunity_scores`, `page_crawls`) to `SyncEngine` tracking and sync queues.

#### [MODIFY] [runner.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/runner.ts)
- Add migration `030_structured_location_and_sync_hardening` to include `city`, `state`, `country` on `companies` table.

---

### Phase 10D-R2 — Template Variable Insertion Fix
#### [MODIFY] [CampaignsScreen.tsx](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/screens/CampaignsScreen.tsx)
- Refactor `onChange` handlers for variable dropdowns in subject and body textareas:
```tsx
onChange={(e) => {
  const val = e.target.value;
  if (val) {
    setTplBody((prev) => `${prev} {{${val}}}`);
    e.target.value = '';
  }
}}
```

---

### Phase 10D-R3 — Structured Location Model
#### [MODIFY] [company.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/schema/src/entities/company.ts)
- Add `city`, `state`, `country` optional string fields to Zod company schema.

#### [MODIFY] [company.model.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/db/models/company.model.ts)
- Add `city`, `state`, `country` optional string fields to MongoDB `CompanyDocument` schema.

#### [MODIFY] [scraper.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/scraper.ts)
- Update Google Maps scraper normalization to parse city, state, and zip/country into structured columns while retaining raw text in `location`.

---

### Phase 10D-R4 — CRM Filter Cleanup
#### [MODIFY] [ContactsScreen.tsx](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/screens/ContactsScreen.tsx)
- Consolidate duplicate "Source" dropdowns into a single canonical `Source Platform` selector (`sourcePlatformFilter`).
- Remove duplicated distinct `source` dropdown to eliminate state confusion.

---

### Phase 10D-R5 — Discovery Run Aggregation & Overflow UX
#### [MODIFY] [DiscoveryScreen.tsx](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/screens/DiscoveryScreen.tsx)
- Group child jobs (`crawler:website`, `enrich:intelligence`) under parent `discovery_runs` rows.
- Render expandable child job progress accordion for each Discovery Run row to prevent screen overflow.

---

### Phase 10D-R6 — Transactional Email Text-Only Cleanup
#### [MODIFY] [mailer.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/lib/mailer.ts)
- Update `sendVerificationEmail`, `sendResetPasswordEmail`, and `sendWelcomeEmail` to send plain text bodies (`text` parameter) without wrapping in `emailShell` HTML.

---

### Phase 10D-R7 — Auth Page Design System Alignment
#### [MODIFY] [index.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/auth/index.ts)
- Update `pageShell` CSS: change `border-radius: 8px` to `border-radius: 0px` across card container, buttons, inputs, and icon boxes to align with Desktop squared-corner design rules.

---

## Verification Plan

### Automated Tests
- Run test runner script:
  ```powershell
  node apps/desktop/scripts/run-tests.js
  ```
- Run intelligence test suite:
  ```powershell
  npx vitest run apps/desktop/src/main/services/intelligence.test.ts
  ```

### Manual Verification
1. Open Template Editor in Campaigns screen, select `Contact First Name` from dropdown, verify `{{contact.firstName}}` is inserted into textarea without truncation.
2. Verify Contacts Screen filter toolbar renders exactly one `Source` dropdown.
3. Check Discovery Screen: verify discovery runs display as aggregated top-level rows with nested job details.
4. Trigger verification email and check plain text delivery.
5. Inspect password reset web page in browser to confirm squared-corner design alignment.
