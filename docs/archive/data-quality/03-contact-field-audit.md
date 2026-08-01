# 03 — Contact Field Audit

## Contact Sources

Contacts are created by two distinct plugins:

1. **scraper.ts** — Creates phone-only contacts for every Google Maps listing with a phone number.
2. **crawler.ts** — Creates email contacts for every unique email found on the company website.

---

## Field: id

- **Source**: `randomUUID()` — scraper.ts:347, crawler.ts:314
- **Persistence**: contacts.id PRIMARY KEY
- **Completeness**: Always set. OK.

---

## Field: workspaceId

- **Source**: `ctx.workspaceId`
- **Persistence**: contacts.workspaceId NOT NULL
- **Completeness**: Always set. OK.

---

## Field: companyId

- **Source**: `companyId` passed from parent scraper job
- **Persistence**: contacts.companyId TEXT (migration 006 + 011 index)
- **Scraper sets it**: YES — scraper.ts:349 `INSERT INTO contacts (..., companyId, ...)`
- **Crawler sets it**: YES — crawler.ts:316 `INSERT INTO contacts (..., companyId, ...)`
- **Renderer (list table)**: MISSING — ContactsScreen.tsx thead has no Company column
- **Renderer (side panel)**: EXISTS — ContactsScreen.tsx:283 resolves `companies.find(c => c.id === selectedContact.companyId)?.name`
- **Completeness**: Set correctly in DB. NOT surfaced in list. Issue.

---

## Field: firstName

- **Source**: NOT EXTRACTED by any plugin
- **Persistence**: contacts.firstName TEXT (migration 001)
- **Renderer**: ContactsScreen.tsx:189 — `{item.firstName} {item.lastName || ''}`
- **Completeness**: ALWAYS NULL for scraped contacts. All scraped contacts have no name.
- **Note**: Human-type emails (john.doe@company.com) could have prefix split on `.` or `_`. Department emails (info@, sales@) should use company name as context.

---

## Field: lastName

- **Source**: NOT EXTRACTED
- **Persistence**: contacts.lastName TEXT (migration 001)
- **Renderer**: ContactsScreen.tsx:189 — appended after firstName
- **Completeness**: ALWAYS NULL. Same issue as firstName.

---

## Field: email

- **Source**: Cheerio regex + mailto extraction — crawler.ts:254-273
- **Normalization**: `.toLowerCase()` applied
- **Persistence**: contacts.email TEXT
- **Renderer**: ContactsScreen.tsx:191
- **Completeness**: Only set by crawler. Scraper phone contacts have NULL email.
- **Deduplication**: `SELECT id FROM contacts WHERE workspaceId = ? AND email = ?` — crawler.ts:305. OK.
- **Filtering**: `validateEmailFormat()` + `isNoiseEmail()` applied. OK.

---

## Field: phone

- **Source (scraper contacts)**: `phone` from Maps `[data-item-id^="phone:tel:"]` — scraper.ts:304
- **Source (crawler contacts)**: `pagePhones` from `tel:` links or regex — crawler.ts:276-296
- **Normalization**: None. Raw international format from scraper. Raw regex match from crawler.
- **Persistence**: contacts.phone TEXT (migration 001)
- **Renderer**: ContactsScreen.tsx:192
- **Completeness**: Phone contacts from scraper always have phone. Crawler contacts share one extracted phone per page.
- **Deduplication**: NO duplicate guard for phone contacts from scraper. Issue.

---

## Field: status

- **Source**: NOT SET by scraper or crawler
- **Persistence**: contacts.status TEXT
- **Renderer**: ContactsScreen.tsx:194-208 — Badge shows `item.status` which is NULL
- **Completeness**: ALWAYS NULL for scraped contacts. Issue.
- **Fix**: Default to 'LEAD' in scraper INSERT; 'UNVERIFIED' in crawler sync_queue payload already set but not in INSERT row.

---

## Field: confidence

- **Source**: `classifyEmail()` — crawler.ts:107
- **Normalization**: Enum: high/medium/low
- **Persistence**: contacts.confidence TEXT (migration 009)
- **Renderer**: NOT displayed
- **Completeness**: Set by crawler. Not set by scraper.

---

## Field: type

- **Source**: `classifyEmail()` — crawler.ts:107
- **Normalization**: Enum: human/department/unknown
- **Persistence**: contacts.type TEXT (migration 009)
- **Renderer**: NOT displayed
- **Completeness**: Set by crawler. Not set by scraper.

---

## Field: verificationStatus

- **Source**: Hardcoded 'unverified' — crawler.ts:317
- **Normalization**: Enum: unverified/valid/invalid/catch_all
- **Persistence**: contacts.verificationStatus TEXT (migration 009)
- **Renderer**: NOT displayed
- **Completeness**: Always 'unverified'. No email verification implemented.

---

## Field: sourceUrl

- **Source**: `item.url` (current crawled page) — crawler.ts:318
- **Normalization**: None
- **Persistence**: contacts.sourceUrl TEXT (migration 009)
- **Renderer**: NOT displayed
- **Completeness**: Set by crawler. Not set by scraper.

---

## Field: sourcePlatform

- **Source**: Hardcoded 'web' — crawler.ts:317
- **Persistence**: contacts.sourcePlatform TEXT (migration 009)
- **Renderer**: NOT displayed
- **Completeness**: Set by crawler to 'web'. Scraper contacts have NULL.

---

## Field: title

- **Source**: NOT EXTRACTED
- **Persistence**: contacts.title TEXT (migration 006)
- **Renderer**: ContactsScreen.tsx:193 — `item.title || 'N/A'`
- **Completeness**: ALWAYS NULL for scraped contacts.

---

## Field: linkedin / linkedinUrl

- **Source**: NOT EXTRACTED by any plugin
- **Persistence**: contacts.linkedin TEXT, contacts.linkedinUrl TEXT (migration 006)
- **Renderer**: ContactsScreen.tsx:287-289 — shown in side panel
- **Completeness**: ALWAYS NULL.

---

## Summary Table

| Field              | Scraper | Crawler        | Normalized | Rendered        | Issue             |
| ------------------ | ------- | -------------- | ---------- | --------------- | ----------------- |
| id                 | ✓       | ✓              | —          | —               | None              |
| workspaceId        | ✓       | ✓              | —          | —               | None              |
| companyId          | ✓       | ✓              | —          | Side panel only | Missing from list |
| firstName          | ✗       | ✗              | —          | ✓ (shows blank) | Never extracted   |
| lastName           | ✗       | ✗              | —          | ✓ (shows blank) | Never extracted   |
| email              | ✗       | ✓              | lowercase  | ✓               | None              |
| phone              | ✓       | Partial        | ✗          | ✓               | Not normalized    |
| status             | ✗       | ✗              | —          | ✓ (shows null)  | Never set         |
| confidence         | ✗       | ✓              | Enum       | ✗               | Not rendered      |
| type               | ✗       | ✓              | Enum       | ✗               | Not rendered      |
| verificationStatus | ✗       | ✓ (unverified) | Enum       | ✗               | Not rendered      |
| sourceUrl          | ✗       | ✓              | —          | ✗               | Not rendered      |
| title              | ✗       | ✗              | —          | ✓ (N/A)         | Never extracted   |
| linkedin           | ✗       | ✗              | —          | ✓ (N/A)         | Never extracted   |
