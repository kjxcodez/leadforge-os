# 04 — Company-Contact Relationship Audit

## Schema

### contacts table (migration 001 + 006)

```sql
contacts (
  id TEXT PRIMARY KEY,
  workspaceId TEXT NOT NULL,
  companyId TEXT,           -- FK to companies.id
  firstName TEXT,
  lastName TEXT,
  email TEXT,
  phone TEXT,
  status TEXT,
  ...
)
```

`companyId` is a soft foreign key — SQLite does not enforce FK constraints by default and `PRAGMA foreign_keys` is not explicitly enabled in connection.ts.

### Index

```sql
-- migration 011
CREATE INDEX IF NOT EXISTS idx_contacts_companyId ON contacts(companyId);
```

Index exists. Lookups by companyId are O(log n). OK.

---

## How the Relationship Is Established

### Path 1: Maps Scraper (scraper.ts)

```
scrapeDetailsAndStore() creates companyId = randomUUID()
  → INSERT INTO companies (..., id=companyId, ...)
  → if (phone || website):
      INSERT INTO contacts (..., companyId=companyId, phone=phone, ...)
```

The contact is created with the correct `companyId` in the same transaction. Relationship is always valid.

### Path 2: Website Crawler (crawler.ts)

```
crawlWebsite() receives ctx.payload.companyId (set by scraper auto-chain at scraper.ts:273)
  → for each email found:
      INSERT INTO contacts (..., companyId=companyId, email=email, ...)
```

The `companyId` comes from the job payload, which is the company created by the scraper. Relationship is always valid.

---

## Foreign Key Integrity

**No PRAGMA foreign_keys = ON** is set in the connection. This means:

- SQLite does NOT enforce that `contacts.companyId` references a valid `companies.id`.
- If a company is deleted, its contacts are NOT cascade-deleted. They become orphaned.
- The `LocalCRMRepository.delete()` does not clean up related contacts.

Evidence: `connection.ts` — no PRAGMA enforcement found.

---

## Renderer

### ContactsScreen.tsx — List Table (lines 159-165)

```tsx
<th>Name</th>
<th>Email</th>
<th>Phone</th>
<th>Job Title</th>
<th>Status</th>
<th>Actions</th>
```

**No Company column**. The relationship is invisible at the list level.

### ContactsScreen.tsx — Side Panel (line 283)

```tsx
companies.find((c: any) => c.id === selectedContact.companyId)?.name || 'No associated company';
```

Relationship is resolved via an in-memory array `find()`. This works correctly only when:

1. `companies` is loaded (it is — line 42)
2. `selectedContact.companyId` is not null (it is set by both scraper and crawler)

This lookup is correct and functional. It resolves company name from the loaded companies list.

### CompaniesScreen.tsx — Side Panel

No contacts section exists. Company detail view does not show associated contacts.

---

## What Works

| Feature                                  | Status  |
| ---------------------------------------- | ------- |
| companyId set on contacts (scraper)      | WORKS   |
| companyId set on contacts (crawler)      | WORKS   |
| idx_contacts_companyId index             | EXISTS  |
| Company name shown in contact side panel | WORKS   |
| Company column in contacts list          | MISSING |
| Contacts list in company detail          | MISSING |
| Orphan protection on company delete      | MISSING |
| FK enforcement                           | MISSING |

---

## Recommendations

1. Add Company column to ContactsScreen list table — renderer only, data already exists.
2. Add contacts section to CompaniesScreen side panel — query `contacts WHERE companyId = selectedCompany.id`.
3. Enable `PRAGMA foreign_keys = ON` in connection.ts after migration.
4. Add cascade soft-delete: when a company is deleted, update contacts.deletedAt.
