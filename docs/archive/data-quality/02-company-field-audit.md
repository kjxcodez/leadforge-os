# 02 — Company Field Audit

Every company field, traced from source to renderer.

---

## Field: id
- **Source**: randomUUID() in scraper.ts:328
- **Normalization**: None needed (UUID)
- **Persistence**: companies.id PRIMARY KEY
- **Renderer**: Never displayed (internal FK reference)
- **Completeness**: Always set. OK.

---

## Field: name
- **Source**: `page.locator("h1").first().innerText()` — scraper.ts:296
- **Normalization**: None. Raw DOM text.
- **Persistence**: companies.name TEXT NOT NULL
- **Renderer**: CompaniesScreen.tsx:181 — displayed as-is
- **Completeness**: Always set (required). OK.
- **Risk**: May contain leading/trailing whitespace from DOM. Should be `.trim()`-ed.

---

## Field: domain
- **Source**: `extractDomain(website)` — scraper.ts:315 → scraper.ts:38
- **Normalization**: Hostname lowercased, `www.` stripped
- **Persistence**: companies.domain TEXT
- **Renderer**: CompaniesScreen.tsx:182 — displayed as monospace
- **Completeness**: Only set if website exists. NULL if no website. OK.
- **Duplicate guard**: `SELECT id FROM companies WHERE domain = ?` — scraper.ts:318. OK.

---

## Field: website
- **Source**: `page.locator('a[data-item-id="authority"]').getAttribute("href")` — scraper.ts:303
- **Normalization**: `resolveRedirect()` follows link shorteners. Domain extracted separately.
- **Persistence**: companies.website TEXT (migration 007, redundantly in 016)
- **Renderer**: Not shown in list or detail panel (MISSING from renderer)
- **Completeness**: NULL if Google Maps listing has no website link. Common for small businesses.

---

## Field: location
- **Source**: `page.locator('[data-item-id="address"]').first().innerText()` — scraper.ts:307
- **Normalization**: NONE. Raw DOM text with Google Maps UI separators.
- **Persistence**: companies.location TEXT (migration 007)
- **Renderer**: CompaniesScreen.tsx:267 — displayed raw with MapPin icon
- **Completeness**: NULL if no address on listing.
- **PROBLEM**: Contains non-standard characters (· separator, business hours text). Fix required.

---

## Field: phone
- **Source**: `page.locator('[data-item-id^="phone:tel:"]').getAttribute("data-item-id")` — scraper.ts:304
- **Normalization**: `.replace("phone:tel:", "").trim()` — raw international format
- **Persistence**: companies.phone TEXT (migration 016 — redundant, already in 009)
- **Renderer**: NOT displayed in CompaniesScreen. Phone is only on contacts.
- **Completeness**: NULL if no phone on listing. Common.

---

## Field: status
- **Source**: NOT EXTRACTED by scraper
- **Normalization**: N/A
- **Persistence**: companies.status TEXT — never set by scraper INSERT
- **Renderer**: CompaniesScreen.tsx:186 — Badge displays `item.status` which is NULL
- **Completeness**: ALWAYS NULL for scraped companies. PROBLEM.
- **Fix**: Default to 'LEAD' in scraper INSERT.

---

## Field: industry
- **Source**: NOT EXTRACTABLE from Google Maps
- **Normalization**: N/A
- **Persistence**: companies.industry TEXT (migration 006)
- **Renderer**: CompaniesScreen.tsx:183 — shows `item.industry || 'N/A'`
- **Completeness**: ALWAYS NULL for scraped companies.
- **Note**: Google Maps does not expose industry classification in a structured field. Category tags (e.g. "Mechanical Engineer", "Consultant") are available from the page subtitle but are not scraped.

---

## Field: size
- **Source**: NOT EXTRACTABLE from Google Maps
- **Normalization**: N/A
- **Persistence**: companies.size TEXT (migration 006)
- **Renderer**: CompaniesScreen.tsx:184 — shows `item.size || 'N/A'`
- **Completeness**: ALWAYS NULL for scraped companies.
- **Note**: Cannot be determined from Google Maps. Future enrichment via LinkedIn or Clearbit required.

---

## Field: rating
- **Source**: `extractRating(page)` — scraper.ts:56–74 — extracted but never persisted
- **Normalization**: parseFloat(), NaN check
- **Persistence**: companies.rating REAL (migration 016). INSERT never includes it.
- **Renderer**: NOT displayed
- **Completeness**: Extracted but DISCARDED. PROBLEM. Fix: include rating in INSERT.

---

## Field: crawlStatus
- **Source**: Set by crawler.ts on UPDATE
- **Normalization**: Enum: pending/in_progress/completed/failed/skipped
- **Persistence**: companies.crawlStatus TEXT (migration 009)
- **Renderer**: NOT displayed in CompaniesScreen
- **Completeness**: Set correctly by crawler. Missing from renderer.

---

## Field: contactCount
- **Source**: Set by crawler.ts:385 via UPDATE
- **Normalization**: Count of discovered email contacts
- **Persistence**: companies.contactCount INTEGER (migration 009)
- **Renderer**: NOT displayed in CompaniesScreen
- **Completeness**: Set correctly by crawler. Missing from renderer.

---

## Field: tags
- **Source**: Manual user input
- **Normalization**: JSON array stored as TEXT
- **Persistence**: companies.tags TEXT (migration 006)
- **Renderer**: CompaniesScreen.tsx:275 — TagSystem component
- **Completeness**: OK for manual input. Never populated by scraper.

---

## Field: notes
- **Source**: Manual user input
- **Normalization**: JSON stored as TEXT
- **Persistence**: companies.notes TEXT (migration 006)
- **Renderer**: CompaniesScreen.tsx:290 — NotesSystem component
- **Completeness**: OK for manual input. Never populated by scraper.

---

## Field: createdAt / updatedAt
- **Source**: `datetime("now")` in scraper INSERT
- **Normalization**: SQLite datetime format
- **Persistence**: OK
- **Renderer**: NOT displayed
- **Completeness**: OK.

---

## Summary Table

| Field | Scraped | Normalized | Persisted | Rendered | Issue |
|-------|---------|------------|-----------|----------|-------|
| id | ✓ | ✓ | ✓ | — | None |
| name | ✓ | Partial (no trim) | ✓ | ✓ | Minor |
| domain | ✓ | ✓ | ✓ | ✓ | None |
| website | ✓ | ✓ | ✓ | ✗ | Missing from renderer |
| location | ✓ | ✗ | ✓ | ✓ (raw) | Unicode + hours text mixed in |
| phone | ✓ | Partial | ✓ | ✗ | Not shown on company panel |
| status | ✗ | — | ✗ | ✗ (null) | Never set |
| industry | ✗ | — | ✗ | ✗ (N/A) | Not available from Maps |
| size | ✗ | — | ✗ | ✗ (N/A) | Not available from Maps |
| rating | ✓ extracted | ✓ | ✗ | ✗ | Extracted but discarded |
| crawlStatus | ✓ (crawler) | ✓ | ✓ | ✗ | Not rendered |
| contactCount | ✓ (crawler) | ✓ | ✓ | ✗ | Not rendered |
| tags | Manual | ✓ | ✓ | ✓ | None |
| notes | Manual | ✓ | ✓ | ✓ | None |
