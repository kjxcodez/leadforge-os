# 01 — Data Quality Audit

## Executive Summary

The LeadForge OS data pipeline has four distinct layers: **scraping** (Playwright/Google Maps), **crawling** (Cheerio/website contact extraction), **persistence** (SQLite via better-sqlite3), and **rendering** (React/TanStack Query).

The pipeline is mostly functional but has several quality gaps:

1. **Address corruption** — `location` values are scraped raw from Google Maps `innerText()` with no Unicode normalization. Characters such as · (U+00B7) and other non-standard glyphs come directly from Google Maps DOM text nodes.
2. **Company field incompleteness** — `industry`, `size`, `status` are never populated by the scraper. The schema supports them, but the scraper never extracts them.
3. **Contact–company relationship** — `companyId` exists in the contacts table and the scraper sets it correctly. However, the link is not shown in the contacts list table — only in the side panel.
4. **Duplicate contacts** — The crawler deduplicates by `(workspaceId, email)` but no deduplication exists for phone-only contacts created by the scraper.
5. **Contact names missing** — Neither the scraper nor the crawler extract `firstName`/`lastName`. All scraped contacts have null names.

---

## Current Data Flow

```
Google Maps (Playwright)
        ↓
  scrapeDetailsAndStore()  [scraper.ts:292]
        ↓
  INSERT INTO companies   [scraper.ts:330] — name, domain, website, location, phone
  INSERT INTO contacts    [scraper.ts:349] — phone-only contact if phone/website exists
  INSERT INTO sync_queue  [scraper.ts:334]
        ↓
  Auto-chain: INSERT INTO jobs (crawler:website) [scraper.ts:266]
        ↓
  crawlWebsite()          [crawler.ts:126]
        ↓
  Cheerio email regex extraction [crawler.ts:250-293]
        ↓
  isNoiseEmail() + validateEmailFormat() filters
        ↓
  INSERT INTO contacts    [crawler.ts:316] — email + phone + companyId
  INSERT INTO sync_queue  [crawler.ts:321]
        ↓
  SyncEngine              [workspace-runtime.ts:115]
        ↓
  Push to MongoDB Atlas
        ↓
  Renderer (TanStack Query + IPC)
```

---

## Problems Found

| #   | Problem                                                     | Layer             | Severity |
| --- | ----------------------------------------------------------- | ----------------- | -------- |
| 1   | Address contains raw Google Maps separators (·, hours text) | Scraper           | High     |
| 2   | status never set on companies (shows null in renderer)      | Scraper           | High     |
| 3   | Company column missing from Contacts list table             | Renderer          | Medium   |
| 4   | Duplicate phone-only contacts created on re-scrape          | Scraper           | Medium   |
| 5   | Contact status never set by scraper                         | Scraper           | Medium   |
| 6   | firstName/lastName never extracted — contacts have no name  | Scraper + Crawler | Medium   |
| 7   | industry, size, rating never persisted from scraper         | Scraper           | Medium   |
| 8   | phone from contacts not normalized                          | Scraper           | Low      |

---

## Root Cause Analysis

### 1. Address Corruption

`innerText()` on `[data-item-id="address"]` returns full text of the DOM node including Google Maps UI separators. The · character (U+00B7 MIDDLE DOT) is used by Google Maps as a separator between address text and business hours metadata.

Source: `scraper.ts:307`

```typescript
const location = await page
  .locator('[data-item-id="address"]')
  .first()
  .innerText({ timeout: 2000 })
  .catch(() => null);
```

Fix layer: Scraper — normalize `location` string before INSERT.

### 2. Company Status Null

`status` is never included in the companies INSERT statement.

Source: `scraper.ts:330`

```typescript
INSERT INTO companies (id, workspaceId, name, domain, website, location, phone, syncStatus, ...)
```

Fix layer: Scraper — add `status: 'LEAD'` to INSERT.

### 3. Company Column Missing from Contact List

The contacts table header at `ContactsScreen.tsx:159-165` has columns: Name, Email, Phone, Job Title, Status. No Company column exists.

The side panel does resolve the company name via `companies.find((c) => c.id === selectedContact.companyId)?.name` at line 283, but the list table does not.

Fix layer: Renderer — add Company column to ContactsScreen.tsx table.

### 4. Duplicate Phone Contacts

No deduplication guard exists before the scraper inserts phone contacts.

Source: `scraper.ts:346-363`

```typescript
if (phone || website) {
  db.prepare(`INSERT INTO contacts (id, workspaceId, companyId, phone, ...)`).run(...)
}
```

Fix layer: Scraper — add `SELECT id FROM contacts WHERE workspaceId = ? AND companyId = ? AND phone = ?` guard before insert.

### 5. Contact Names Missing

No name extraction logic exists in either scraper.ts or crawler.ts. The `firstName` and `lastName` columns are always null for scraped contacts.

For department emails: company name is a reasonable fallback.
For human emails: split email prefix on `.` or `_`.

Fix layer: Scraper + Crawler.

---

## Confidence Levels

| Finding                                   | Evidence Source                         | Confidence |
| ----------------------------------------- | --------------------------------------- | ---------- |
| Address corruption from innerText()       | scraper.ts:307 exact selector           | HIGH       |
| Status null from missing INSERT field     | scraper.ts:330 exact SQL                | HIGH       |
| companyId relationship works in DB        | crawler.ts:316, scraper.ts:349          | HIGH       |
| Company column missing from contacts list | ContactsScreen.tsx thead L159-165       | HIGH       |
| Duplicate phone contacts — no guard       | scraper.ts:346, no SELECT before INSERT | HIGH       |
| industry/size not in Google Maps DOM      | Google Maps DOM — not reliably exposed  | MEDIUM     |
