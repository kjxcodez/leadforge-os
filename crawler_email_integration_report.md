# LeadForge OS — Phase 3: Production Crawler & Email Discovery Integration Report

**Date**: September 4, 2026  
**Scope**: Production Crawler Integration, Multi-Source Staged Extraction, Recursive DOM Traversal, Candidate Provenance, Domain Affiliation, and Idempotent Contact Persistence  
**Status**: Implemented, Verified (41/41 Fixture Tests Passing, 42/42 Sanitizer Tests Passing, 15/15 Desktop Suites Passing, 20/20 Typecheck Tasks Clean)  

---

## 1. Current Pipeline: Before vs. After

### Legacy Architecture (Defective Pipeline)
```text
                  HTML / Webpage
                        │
                        ▼
         cheerio: $('body').text()
         + arbitrary .after(' ') injection
                        │
                        ▼
         Greedy Regex: /\b...@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/
                        │
                        ▼
       Naive Local-Part Repair / Nav-Guessing
                        │
                        ▼
         firstName = "Discovered" (Role Accounts)
                        │
                        ▼
       Unchecked MongoDB insert / Duplicate Key Error
```

### Production Architecture (Evidence-Preserving Candidate Pipeline)
```text
                        WEBSITE
                           │
                           ▼
                  ┌─────────────────┐
                  │ HTML / DOM      │
                  └────────┬────────┘
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
        mailto:       structured data   DOM text (recursive)
             │             │             │
             └─────────────┼─────────────┘
                           ▼
                  RAW EMAIL CANDIDATES
                           │
                           ▼
                  NORMALIZATION ENGINE
                           │
                           ▼
                 EMAIL CANDIDATE MODEL
                           │
             ┌─────────────┼──────────────┐
             ▼             ▼              ▼
         syntax        domain/PSL      affiliation
             │             │              │
             └─────────────┼──────────────┘
                           ▼
                   CLASSIFICATION
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
          eligible     quarantined     third-party
             │             │              │
             ▼             ▼              ▼
     Contact Upsert  Audit Only      Logged / Excluded
             │
             ▼
      MongoDB / SQLite
```

---

## 2. Extraction Architecture

The crawler decouples **Extraction** from **Validation** across four explicit source types:

1. **`mailto:` URI Parser (`sourceType: 'mailto'`, Priority 4)**:
   - Queries `a[href^="mailto:"]`.
   - Strips protocol scheme case-insensitively (`/^mailto:/i`).
   - Parses target address from query parameters (strips `?subject=...`, `&cc=...`, `&bcc=...`).
   - Preserves raw target value and page URL where the anchor was discovered.

2. **JSON-LD Schema.org Extractor (`sourceType: 'json_ld'`, Priority 3)**:
   - Queries `<script type="application/ld+json">`.
   - Safe JSON parsing (`try/catch`) ensuring malformed blocks never crash or abort crawling.
   - Recursively traverses top-level objects, nested arrays, and `@graph` arrays.
   - Extracts email values from standard Schema.org structures: `Organization`, `LocalBusiness`, `ContactPoint`, `Corporation`, `Store`, `ProfessionalService`, `Person`, and nested `contactPoints` arrays.

3. **Explicit Metadata Extractor (`sourceType: 'metadata'`, Priority 2)**:
   - Extracts explicit semantic metadata tags:
     - `[itemprop="email"]`
     - `<meta property="og:email">`
     - `<meta name="email">`

4. **Recursive Depth-First DOM Text Traversal (`sourceType: 'dom_text'`, Priority 1)**:
   - Traverses DOM tree recursively rather than calling `$('body').text()`.
   - Strips non-visible elements: `<script>`, `<style>`, `<noscript>`, `<svg>`, `<head>`, `<iframe>`, `<object>`, `<audio>`, `<video>`.
   - Respects accessibility and CSS visibility attributes: skips `[aria-hidden="true"]`, `[hidden]`, and inline `display:none` or `visibility:hidden`.
   - Inserts boundary delimiter tokens (`' '`) around every text node and before/after block, section, list, and inline tags (`<p>`, `<div>`, `<section>`, `<article>`, `<header>`, `<footer>`, `<nav>`, `<aside>`, `<address>`, `<li>`, `<td>`, `<th>`, `<h1>`-`<h6>`, `<br>`, `<hr>`, `<tr`, `<dt>`, `<dd>`, `<form>`, `<label>`, `<button>`, `<blockquote>`, `<a>`, `<span>`).
   - Prevents adjacent sibling concatenation (e.g. `Information` + `info@...` + `Warranty` are strictly separated).

---

## 3. Candidate Handling & Correctness Engine Flow

Every extracted raw candidate flows through the Phase 2 correctness engine (`evaluateEmailCandidate` in `@leadforge/schema`):

1. **Normalization**:
   - Strips whitespace and Unicode non-printable control characters (`[\x00-\x1F\x7F\u0080-\u009F\u200B-\u200D\uFEFF]`), while preserving valid UTF-8 international letters.
2. **Domain & PSL Parsing**:
   - Parses domain with compiled Mozilla Public Suffix List via `tldts`.
   - Rejects non-ICANN or unassigned top-level domains.
3. **Conservative Repair Rules**:
   - Only repairs if exactly one defensible interpretation exists:
     - `AFFILIATION_EXACT_DOMAIN_MATCH`: Strips appended navigation/path tokens matching company domain.
     - `SUFFIX_STRIP_<TLD>`: Strips unspaced link text following unambiguous TLDs (`.com`, `.net`, `.org`, `.edu`, `.gov`, `.io`, `.co.uk`, `.com.au`, `.co.in`).
     - `PREFIX_STRIP_HOST_LABEL`: Strips domain prefixes prepended to local-part (`princetonazjohn` $\rightarrow$ `john`).
     - `PREFIX_STRIP_HOST_REPEATED_ROLE`: Strips repeated role prefix (`careerscareers` $\rightarrow$ `careers`).
4. **Classification**:
   - Assigns candidate tier: `exact`, `role_based`, `recovered`, `third_party`, `ambiguous`, `quarantined`, or `invalid`.

---

## 4. Domain Affiliation

Candidates discovered on a website are evaluated against the company's canonical registrable domain (eTLD+1):

```text
Company Domain:   acmeplumbing.com (eTLD+1: acmeplumbing.com)
Candidate 1:      info@acmeplumbing.com       -> exact match (domainMatched: true)
Candidate 2:      bids@dispatch.acmeplumbing.com -> subdomain match (domainMatched: true)
Candidate 3:      support@pixelagency.com     -> external domain (domainMatched: false)
```

### Affiliation Rules
1. **Exact & Subdomain Affiliation**:
   - If candidate's registrable domain matches company's registrable domain, `domainMatched = true`.
   - Candidate is classified as company personnel/inbox.
2. **Third-Party Domain Isolation**:
   - If candidate's registrable domain does not match company's registrable domain, `domainMatched = false` and classification is forced to `third_party`.
   - **Isolation Rule**: Third-party candidates (e.g. web agency credits, cookie banners, platform support) are captured in `thirdPartyCandidates`, logged for discovery intelligence, but **NEVER persisted as company contacts**.

---

## 5. Provenance

Every persisted contact retains comprehensive discovery provenance in `emailMeta`:

```typescript
emailMeta: {
  raw: string;              // Original un-normalized string extracted from page
  sourceUrl: string;        // Exact HTTP URL where candidate was discovered
  sourceType: string;       // 'mailto' | 'json_ld' | 'metadata' | 'dom_text'
  confidenceTier: string;   // 'exact' | 'recovered' | 'role_based' | 'quarantined'
  domainMatched: boolean;   // true if affiliated with crawled company
  repaired: boolean;        // true if conservative repair was applied
  repairRule?: string;      // Specific rule ID (e.g. SUFFIX_STRIP_COM)
  isRoleAccount: boolean;   // true for generic mailboxes (info, sales, support)
}
```

---

## 6. Persistence & Schema Evolution

### `@leadforge/schema`
- **`contactSchema` & `createContactDtoSchema`**:
  - Added `contactEmailMetaSchema`.
  - Added optional `emailMeta: contactEmailMetaSchema.nullable().optional()`.
  - Changed `firstName` from strict `min(1)` to `z.string().max(100).nullable().optional()` to natively support role accounts without name hallucination.

### `apps/api` (MongoDB)
- **`ContactDocument` & `contactSchema`**:
  - Added `emailMeta: { type: Schema.Types.Mixed, default: null }`.
  - Set `firstName: { type: String, default: null, trim: true }`.
- **`ContactService.createContact`**:
  - Implemented **Idempotent Upsert**:
    - If a contact with the email already exists in the workspace, instead of throwing an unhandled `E11000 duplicate key error`, the record is updated.
    - Evaluates evidentiary rank (`mailto` > `json_ld` > `metadata` > `dom_text`). Higher-ranking evidence enriches existing records; weaker evidence can never downgrade stronger metadata.

### `apps/desktop` (SQLite Cache)
- **`cache-schema.ts`**:
  - Added `emailStatus TEXT DEFAULT 'unverified'` and `emailMeta TEXT DEFAULT NULL` to `contacts` table definition.
  - Added automatic column migration (`ALTER TABLE contacts ADD COLUMN ...`) for backward compatibility with existing databases.

---

## 7. Name Handling Behavior

1. **Role Accounts (`info@`, `sales@`, `support@`, `careers@`, `admin@`, `contact@`, etc.)**:
   - `firstName = null`
   - `lastName = null`
   - **Eliminated Hallucinations**: No longer creates contacts named `"Discovered"`, `"Info Smith"`, or `"Sales"`. Outreach email templates gracefully format as `"Hello,"` or fallback to company name.
2. **Personal Accounts (`john.smith@company.com`)**:
   - Conservatively infers `firstName = "John"`, `lastName = "Smith"`.
   - Single-token handles (`david@company.com`) infer `firstName = "David"`, `lastName = null`.
   - Non-standard tokens without alphabetical names leave names as `null`.

---

## 8. Deduplication Engine

When a page or crawl session exposes the same email address across multiple channels, candidates are deduplicated by evidentiary rank:

$$\text{mailto (4)} > \text{json\_ld (3)} > \text{metadata (2)} > \text{dom\_text (1)}$$

- If an email is discovered via visible DOM text and subsequently in a `mailto:` link, the candidate is upgraded to `sourceType: 'mailto'`.
- The exact `sourceUrl` is preserved.
- Weaker evidence cannot overwrite stronger evidence.

---

## 9. Test Fixtures & Invariants

An integration test suite ([crawler-extractor.test.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/crawler-extractor.test.ts)) validates 12 deterministic HTML fixtures and core crawler invariants:

| Fixture | Scenario | Verification Result |
| :--- | :--- | :--- |
| **Fixture 1** | Simple `mailto:` | Clean extraction, `sourceType = 'mailto'`, `domainMatched = true` |
| **Fixture 2** | Adjacent Navigation Text | `<nav>Information</nav><a href="mailto:info@...">` $\rightarrow$ `info@...` extracted without `information` or `warranty` |
| **Fixture 3** | Complex Semantic Tree | `<header>`, `<nav>`, `<label>`, `<button>`, `<address>`, `<footer>` tree traversed cleanly |
| **Fixture 4** | Multiple Adjacent Links | `<a href="mailto:a@...">A</a><a href="mailto:b@...">B</a>` $\rightarrow$ 2 separate candidates, no string concatenation |
| **Fixture 5** | JSON-LD Organization | Schema.org `Organization.email` extracted with `sourceType = 'json_ld'` |
| **Fixture 6** | JSON-LD ContactPoint & `@graph` | Nested ContactPoint inside `@graph` extracted with `sourceType = 'json_ld'` |
| **Fixture 7** | Malformed JSON-LD | Broken syntax gracefully ignored; fallback candidate extracted from HTML without parser crash |
| **Fixture 8** | Third-Party Separation | `info@acmeplumbing.com` persisted; `support@pixelagency.com` routed to `thirdPartyCandidates` (`domainMatched = false`) |
| **Fixture 9** | Role Account Naming | `info@company.com` extracted with `firstName = null`, `lastName = null` (NOT `"Discovered"`) |
| **Fixture 10** | Personal Account Naming | `john.smith@company.com` infers `firstName = "John"`, `lastName = "Smith"` |
| **Fixture 11** | Repeated Brand Mailbox | `tomtom@company.com` preserved verbatim |
| **Fixture 12** | Parked / Landers | "Domain is for sale \| GoDaddy" detected as parked template; candidate quarantined |
| **Invariant D** | Evidentiary Ranking | `mailto` outranks `dom_text` for identical address |
| **Invariant E** | Idempotency | Multiple extraction passes yield identical candidate list |
| **Invariant H** | Source URL Integrity | `emailMeta.sourceUrl` exactly matches extraction page URL |

---

## 10. Verification Results

### 1. Crawler Extractor Integration Suite
```bash
npx tsx apps/desktop/src/main/workers/plugins/crawler-extractor.test.ts
```
```text
=================================================================
TOTAL FIXTURE ASSERTIONS: 41 | PASSED: 41 | FAILED: 0
=================================================================
ALL CRAWLER INTEGRATION FIXTURES & INVARIANTS PASSED!
```

### 2. Phase 2 Deterministic Candidate Correctness Corpus
```bash
pnpm --filter @leadforge/schema exec tsx src/utils/email-sanitizer.test.ts
```
```text
=================================================================
TOTAL TESTS: 42 | PASSED: 42 | FAILED: 0
=================================================================
ALL DETERMINISTIC CANDIDATE CORRECTNESS TESTS PASSED!
```

### 3. Monorepo-Wide Typecheck
```bash
pnpm check-types
```
```text
Tasks:    20 successful, 20 total
Cached:   19 cached, 20 total
Time:     13.338s
```

### 4. Electron Desktop Test Runner
```bash
node apps/desktop/scripts/run-tests.js
```
```text
[Desktop Test] PASS: src/main/services/onboarding.test.ts
[Desktop Test] PASS: src/main/services/updater.test.ts
[Desktop Test] PASS: src/main/services/intelligence.test.ts
[Desktop Test] PASS: src/main/ai/tools/adapter.test.ts
[Desktop Test] PASS: src/main/services/campaign.test.ts
[Desktop Test] PASS: src/main/services/email-test-recipients.test.ts
[Desktop Test] PASS: src/main/services/send-test-attachment.test.ts
[Desktop Test] PASS: src/main/services/audiences.test.ts
[Desktop Test] PASS: src/main/services/post-release-stabilization.test.ts
[Desktop Test] PASS: src/main/services/desktop-runtime-config.test.ts
[Desktop Test] PASS: src/main/services/fresh-database.test.ts
[Desktop Test] PASS: src/main/services/fresh-database-all-queries.test.ts
[Desktop Test] PASS: src/main/services/locations.test.ts
[Desktop Test] PASS: src/main/lib/playwright-setup.test.ts
[Desktop Test] PASS: src/main/services/scheduler-recovery.test.ts
(15/15 Suites Passed)
```

---

## 11. Migration & Legacy Contact Considerations

1. **Non-Destructive Evolution**:
   - `emailMeta` is optional across all schemas and models. Existing contacts without `emailMeta` continue to function without error.
2. **Re-Crawl Enrichment**:
   - When a company website is re-crawled, existing contacts are automatically enriched with high-confidence `emailMeta` and correct `emailStatus` via the idempotent upsert logic.
3. **Legacy Name Cleanup**:
   - Contacts that were historically assigned `firstName = "Discovered"` are overwritten with null or real names upon subsequent crawl discovery.

---

## 12. Known Limitations & Explicit System Boundaries

The discovery and candidate pipeline adheres to strict semantic boundaries:

1. **Discovered $\ne$ Verified**:
   - Publishing an email address on a public webpage does not guarantee the inbox is active or accepting mail.
2. **Syntax Valid $\ne$ Mailbox Exists**:
   - An address may be syntactically valid and conform to RFC 5322 without an existing account on the destination mail server.
3. **MX Record Valid $\ne$ Deliverable**:
   - A domain having valid DNS MX records does not indicate whether the specific recipient mailbox exists or will accept connections.
4. **Company-Domain Match $\ne$ Outreach Permission**:
   - Domain matching confirms attribution, but delivery safety boundaries and campaign compliance rules govern sending eligibility.
