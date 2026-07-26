# 05 — Normalization Plan

Every normalization issue, root cause, correct layer, and implementation scope.
No code. Audit only.

---

## Issue 1 — Address (location) Contains Google Maps UI Text

**Root cause**: `innerText()` on `[data-item-id="address"]` captures the full text content of the DOM node, which includes Google Maps separator characters (· U+00B7) and sometimes business hours or phone text appended inline.

**Correct layer**: Scraper — before INSERT.

**Files affected**:
- `apps/desktop/src/main/workers/plugins/scraper.ts`

**Implementation scope**:
- Extract only the text before the first `·` separator.
- Strip non-printable and non-standard Unicode characters (U+00B7, U+2022, U+2019, etc.).
- Trim whitespace.
- Result: `"3571 S Fulton Ave, Atlanta, GA"` instead of `"3571 S Fulton AveClosed · Opens 7am · +1 404-..."`.

---

## Issue 2 — Company status Never Set

**Root cause**: The scraper INSERT statement does not include `status`. The `sync_queue` payload sets `status: 'LEAD'` but the `companies` table row does not.

**Correct layer**: Scraper — at INSERT time.

**Files affected**:
- `apps/desktop/src/main/workers/plugins/scraper.ts`

**Implementation scope**:
- Add `status` to the INSERT column list.
- Default value: `'LEAD'`.

---

## Issue 3 — Contact status Never Set

**Root cause**: Neither the scraper nor the crawler sets `status` on contacts. It defaults to NULL.

**Correct layer**: Scraper + Crawler — at INSERT time.

**Files affected**:
- `apps/desktop/src/main/workers/plugins/scraper.ts`
- `apps/desktop/src/main/workers/plugins/crawler.ts`

**Implementation scope**:
- Scraper: add `status = 'LEAD'` to contact INSERT.
- Crawler: add `status = 'LEAD'` to contact INSERT.

---

## Issue 4 — rating Extracted but Not Persisted

**Root cause**: `extractRating(page)` correctly extracts the rating value, but `rating` is never included in the companies INSERT statement.

**Correct layer**: Scraper — at INSERT time.

**Files affected**:
- `apps/desktop/src/main/workers/plugins/scraper.ts`

**Implementation scope**:
- Add `rating` to the INSERT column list.
- Pass the extracted `rating` value (or null).

---

## Issue 5 — Duplicate Phone Contacts on Re-scrape

**Root cause**: No deduplication guard before phone-only contact creation in the scraper. The crawler has a `SELECT ... WHERE email = ?` guard but the scraper has no equivalent for phone contacts.

**Correct layer**: Scraper — before INSERT.

**Files affected**:
- `apps/desktop/src/main/workers/plugins/scraper.ts`

**Implementation scope**:
- Add: `SELECT id FROM contacts WHERE workspaceId = ? AND companyId = ?` before creating phone contact.
- If a contact for this company already exists, skip creation.

---

## Issue 6 — Contact firstName/lastName Never Extracted

**Root cause**: No name extraction logic in any plugin. Both `firstName` and `lastName` are always NULL.

**Correct layer**: Scraper + Crawler — at INSERT time (derive from available signals).

**Files affected**:
- `apps/desktop/src/main/workers/plugins/scraper.ts`
- `apps/desktop/src/main/workers/plugins/crawler.ts`

**Implementation scope**:
For scraper phone contacts:
- Use company name as a display reference (e.g. store the company name in notes or as a placeholder; do NOT fake a person name).
- Leave firstName/lastName null — it is honest.

For crawler email contacts:
- If `type === 'human'` (e.g. john.doe@company.com), split email prefix on `.` or `_`:
  - Prefix: `john.doe` → firstName: `John`, lastName: `Doe`
  - Apply only when confidence = 'high'.
- If `type === 'department'` (e.g. info@company.com), leave name null.
- Capitalize first letter only.

---

## Issue 7 — Company Column Missing from Contacts List Table

**Root cause**: The ContactsScreen list table omits a Company column. The data exists (companyId is set, companies are loaded), but the relationship is only visible in the side panel.

**Correct layer**: Renderer — ContactsScreen.tsx.

**Files affected**:
- `apps/desktop/src/renderer/screens/ContactsScreen.tsx`

**Implementation scope**:
- Add `Company` column header to contacts list table thead.
- In each row, resolve `companies.find(c => c.id === item.companyId)?.name || '—'`.
- This is pure rendering — no data change needed.

---

## Issue 8 — Contacts Panel Missing from Company Detail

**Root cause**: CompaniesScreen side panel shows Overview, Tags, Notes — but no Contacts section. The data exists in the contacts table with companyId set.

**Correct layer**: Renderer — CompaniesScreen.tsx.

**Files affected**:
- `apps/desktop/src/renderer/screens/CompaniesScreen.tsx`

**Implementation scope**:
- Load all contacts via `useEntityList(SyncContactRepository)`.
- Filter by `selectedCompany.id === contact.companyId`.
- Display list of contact emails/phones in a "Contacts" section in the side panel.

---

## Issue 9 — website Not Shown in Company Detail

**Root cause**: The companies side panel shows domain, industry, location — but not `website` (the full URL). Website is persisted but not rendered.

**Correct layer**: Renderer — CompaniesScreen.tsx.

**Files affected**:
- `apps/desktop/src/renderer/screens/CompaniesScreen.tsx`

**Implementation scope**:
- Add website row with Globe icon in the Overview section.
- Make it a clickable link (open in browser via `shell.openExternal`).

---

## Issue 10 — phone Not Normalized

**Root cause**: Phone numbers from Google Maps are in raw international format (e.g. `+91 98260 28834`). Phone numbers from the crawler regex are unstructured (e.g. `404-555-1234`, `(404) 555 1234`). No normalization is applied.

**Correct layer**: Scraper + Crawler — before INSERT.

**Files affected**:
- `apps/desktop/src/main/workers/plugins/scraper.ts`
- `apps/desktop/src/main/workers/plugins/crawler.ts`

**Implementation scope**:
- Strip non-digit characters except leading `+`.
- For display purposes only — do not lose the original format.
- Store as normalized digits for deduplication; keep original for display if needed.

---

## Priority Order for Implementation

| Priority | Issue | Step |
|----------|-------|------|
| 1 | Address location normalization | Step 1 |
| 2 | Company status default to LEAD | Step 2 |
| 3 | Contact status default to LEAD | Step 2 |
| 4 | rating persisted from scraper | Step 2 |
| 5 | Duplicate phone contact guard | Step 3 |
| 6 | Contact firstName from email prefix | Step 4 |
| 7 | Company column in contacts list | Step 5 |
| 8 | Contacts panel in company detail | Step 6 |
| 9 | website shown in company detail | Step 6 |
| 10 | phone normalization | Step 7 |
