import { getDatabase } from './connection';

interface Migration {
  name: string;
  up: string;
}

const MIGRATIONS: Migration[] = [
  {
    name: '001_initial_schema',
    up: `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        name TEXT,
        role TEXT,
        activeWorkspaceId TEXT,
        syncStatus TEXT DEFAULT 'synced',
        version INTEGER DEFAULT 1,
        createdAt DATETIME,
        updatedAt DATETIME
      );

      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT,
        slug TEXT,
        ownerId TEXT,
        settingsTimezone TEXT DEFAULT 'UTC',
        syncStatus TEXT DEFAULT 'synced',
        version INTEGER DEFAULT 1,
        createdAt DATETIME,
        updatedAt DATETIME
      );

      CREATE TABLE IF NOT EXISTS companies (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        name TEXT NOT NULL,
        domain TEXT,
        industry TEXT,
        status TEXT,
        syncStatus TEXT DEFAULT 'synced',
        version INTEGER DEFAULT 1,
        createdAt DATETIME,
        updatedAt DATETIME,
        deletedAt DATETIME DEFAULT NULL
      );

      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        firstName TEXT,
        lastName TEXT,
        email TEXT,
        phone TEXT,
        status TEXT,
        syncStatus TEXT DEFAULT 'synced',
        version INTEGER DEFAULT 1,
        createdAt DATETIME,
        updatedAt DATETIME,
        deletedAt DATETIME DEFAULT NULL
      );

      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        name TEXT NOT NULL,
        status TEXT,
        syncStatus TEXT DEFAULT 'synced',
        version INTEGER DEFAULT 1,
        createdAt DATETIME,
        updatedAt DATETIME,
        deletedAt DATETIME DEFAULT NULL
      );

      CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        type TEXT,
        content TEXT,
        syncStatus TEXT DEFAULT 'synced',
        version INTEGER DEFAULT 1,
        createdAt DATETIME,
        updatedAt DATETIME
      );

      CREATE TABLE IF NOT EXISTS outreach (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        channel TEXT,
        status TEXT,
        syncStatus TEXT DEFAULT 'synced',
        version INTEGER DEFAULT 1,
        createdAt DATETIME,
        updatedAt DATETIME
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT,
        value TEXT,
        workspaceId TEXT,
        syncStatus TEXT DEFAULT 'synced',
        version INTEGER DEFAULT 1,
        createdAt DATETIME,
        updatedAt DATETIME,
        PRIMARY KEY (key, workspaceId)
      );

      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        entityType TEXT NOT NULL,
        entityId TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload TEXT,
        retryCount INTEGER DEFAULT 0,
        error TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sync_metadata (
        workspaceId TEXT NOT NULL,
        entityType TEXT NOT NULL,
        lastSyncedAt DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (workspaceId, entityType)
      );

      CREATE INDEX IF NOT EXISTS idx_companies_workspaceId ON companies (workspaceId);
      CREATE INDEX IF NOT EXISTS idx_contacts_workspaceId ON contacts (workspaceId);
      CREATE INDEX IF NOT EXISTS idx_campaigns_workspaceId ON campaigns (workspaceId);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_workspaceId ON sync_queue (workspaceId);
    `,
  },
];

/**
 * Runs pending SQLite schema migrations sequentially inside a transaction.
 */
export function runMigrations(): void {
  const db = getDatabase();

  // Create migration tracking table if missing
  db.prepare(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      runAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  const runMigration = db.transaction((migration: Migration) => {
    // 1. Run actual migration payload
    db.exec(migration.up);

    // 2. Register migration in tracking table
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(migration.name);
    console.log(`[SQLite] Migration "${migration.name}" executed successfully.`);
  });

  for (const migration of MIGRATIONS) {
    const isApplied = db.prepare('SELECT 1 FROM _migrations WHERE name = ?').get(migration.name);

    if (!isApplied) {
      console.log(`[SQLite] Applying migration: ${migration.name}`);
      try {
        runMigration(migration);
      } catch (err) {
        console.error(`[SQLite] Migration failure: ${migration.name}`, err);
        throw err;
      }
    }
  }

  console.log('[SQLite] All migrations verified.');
}
