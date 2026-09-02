# LeadForge OS — Migration Baseline & Startup Design

## 1. Overview & Objectives
This baseline proposal replaces the existing 33-step SQLite migration system (`runner.ts`) with a clean dual-layer initialization architecture:
1. **MongoDB Migration & Index Baseline (API Layer)**.
2. **SQLite Cache Baseline (Desktop Application Layer)**.

---

## 2. Layer 1: MongoDB Migration & Index Baseline (API)

Relational migration runners (`ALTER TABLE`, column tracking) are replaced by Mongoose schema declarations and programmatic index initialization at server startup.

### 2.1 Mongoose Schema Evolution
* Schemas handle non-breaking field additions via default values (`default: null`, `default: []`).
* Strict schema validation prevents corrupt document shapes.

### 2.2 Programmatic Index Management (`initMongoIndexes()`)
An initialization script executed at API startup ensures all Mongo indexes exist:

```typescript
export async function initMongoIndexes(): Promise<void> {
  logger.info('[Mongo] Verifying database index definitions...');
  await Promise.all([
    CompanyModel.syncIndexes(),
    ContactModel.syncIndexes(),
    CampaignModel.syncIndexes(),
    SequenceModel.syncIndexes(),
    JobModel.syncIndexes(),
    EmailDeliveryModel.syncIndexes()
  ]);
  logger.info('[Mongo] Index synchronization completed.');
}
```

---

## 3. Layer 2: SQLite Cache Schema Baseline (Desktop)

The 33 legacy migrations in `runner.ts` are consolidated into a single idempotent cache schema creator: `initCacheSchema(db)`.

```typescript
export function initCacheSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      workspaceId TEXT NOT NULL,
      name TEXT NOT NULL,
      domain TEXT,
      industry TEXT,
      website TEXT,
      location TEXT,
      city TEXT,
      state TEXT,
      country TEXT,
      phone TEXT,
      status TEXT,
      createdAt DATETIME,
      updatedAt DATETIME
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      workspaceId TEXT NOT NULL,
      companyId TEXT,
      firstName TEXT NOT NULL,
      lastName TEXT,
      email TEXT,
      phone TEXT,
      title TEXT,
      linkedinUrl TEXT,
      tags TEXT,
      lastContactedAt DATETIME,
      createdAt DATETIME,
      updatedAt DATETIME
    );

    CREATE INDEX IF NOT EXISTS idx_companies_ws ON companies(workspaceId);
    CREATE INDEX IF NOT EXISTS idx_contacts_ws ON contacts(workspaceId);
    CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(companyId);
  `);
}
```

This replaces legacy sync columns (`syncStatus`, `version`) and eliminates `_migrations` tracking tables from SQLite!
