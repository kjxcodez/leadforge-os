import Database from 'better-sqlite3';
import { getDatabase } from './connection';
import fs from 'fs';


interface Migration {
  name: string;
  up: string;
}

export const MIGRATIONS: Migration[] = [
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
  {
    name: '002_discovery_schema',
    up: `
      CREATE TABLE IF NOT EXISTS discovery_jobs (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        name TEXT NOT NULL,
        provider TEXT NOT NULL,
        status TEXT NOT NULL,
        progress INTEGER DEFAULT 0,
        query TEXT,
        error TEXT,
        statisticsJson TEXT,
        startedAt DATETIME,
        finishedAt DATETIME,
        syncStatus TEXT DEFAULT 'synced',
        version INTEGER DEFAULT 1,
        createdAt DATETIME,
        updatedAt DATETIME,
        deletedAt DATETIME DEFAULT NULL
      );

      CREATE TABLE IF NOT EXISTS discovery_results (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        jobId TEXT NOT NULL,
        companyName TEXT NOT NULL,
        website TEXT,
        email TEXT,
        phone TEXT,
        linkedinUrl TEXT,
        description TEXT,
        status TEXT DEFAULT 'pending',
        contactsJson TEXT,
        syncStatus TEXT DEFAULT 'synced',
        version INTEGER DEFAULT 1,
        createdAt DATETIME,
        updatedAt DATETIME,
        deletedAt DATETIME DEFAULT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_discovery_jobs_workspaceId ON discovery_jobs (workspaceId);
      CREATE INDEX IF NOT EXISTS idx_discovery_results_workspaceId ON discovery_results (workspaceId);
    `,
  },
  {
    name: '003_outreach_schema',
    up: `
      CREATE TABLE IF NOT EXISTS email_accounts (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        provider TEXT NOT NULL,
        status TEXT NOT NULL,
        dailyLimit INTEGER NOT NULL DEFAULT 200,
        hourlyLimit INTEGER NOT NULL DEFAULT 50,
        dailySent INTEGER NOT NULL DEFAULT 0,
        hourlySent INTEGER NOT NULL DEFAULT 0,
        signature TEXT,
        lastVerifiedAt TEXT,
        lastError TEXT,
        syncStatus TEXT DEFAULT 'synced',
        version INTEGER DEFAULT 1,
        createdAt DATETIME,
        updatedAt DATETIME,
        deletedAt DATETIME DEFAULT NULL
      );

      CREATE TABLE IF NOT EXISTS templates (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        name TEXT NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        variables TEXT NOT NULL,
        syncStatus TEXT DEFAULT 'synced',
        version INTEGER DEFAULT 1,
        createdAt DATETIME,
        updatedAt DATETIME,
        deletedAt DATETIME DEFAULT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_email_accounts_workspaceId ON email_accounts (workspaceId);
      CREATE INDEX IF NOT EXISTS idx_templates_workspaceId ON templates (workspaceId);
    `,
  },
  {
    name: '004_automation_schema',
    up: `
      CREATE TABLE IF NOT EXISTS sequences (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        trigger TEXT NOT NULL,
        steps TEXT NOT NULL,
        createdBy TEXT,
        syncStatus TEXT DEFAULT 'synced',
        version INTEGER DEFAULT 1,
        createdAt DATETIME,
        updatedAt DATETIME,
        deletedAt DATETIME DEFAULT NULL
      );

      CREATE TABLE IF NOT EXISTS sequence_executions (
        id TEXT PRIMARY KEY,
        sequenceId TEXT NOT NULL,
        workspaceId TEXT NOT NULL,
        companyId TEXT,
        contactId TEXT,
        currentStep INTEGER DEFAULT 0,
        status TEXT NOT NULL,
        startedAt DATETIME,
        completedAt DATETIME,
        nextExecutionAt DATETIME,
        logs TEXT,
        syncStatus TEXT DEFAULT 'synced',
        version INTEGER DEFAULT 1,
        createdAt DATETIME,
        updatedAt DATETIME,
        deletedAt DATETIME DEFAULT NULL
      );

      CREATE TABLE IF NOT EXISTS sequence_logs (
        id TEXT PRIMARY KEY,
        executionId TEXT NOT NULL,
        workspaceId TEXT NOT NULL,
        timestamp DATETIME,
        step INTEGER,
        action TEXT NOT NULL,
        status TEXT NOT NULL,
        message TEXT,
        syncStatus TEXT DEFAULT 'synced',
        version INTEGER DEFAULT 1,
        createdAt DATETIME,
        updatedAt DATETIME
      );

      CREATE INDEX IF NOT EXISTS idx_sequences_workspaceId ON sequences (workspaceId);
      CREATE INDEX IF NOT EXISTS idx_sequence_executions_workspaceId ON sequence_executions (workspaceId);
      CREATE INDEX IF NOT EXISTS idx_sequence_logs_workspaceId ON sequence_logs (workspaceId);
    `,
  },
  {
    name: '005_local_first_foundation',
    up: `
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('queued', 'running', 'waiting', 'retrying', 'paused', 'cancelled', 'completed', 'failed', 'interrupted')),
        priority INTEGER DEFAULT 1,
        payload TEXT,
        progress INTEGER DEFAULT 0,
        retryCount INTEGER DEFAULT 0,
        maxRetries INTEGER DEFAULT 3,
        workerId TEXT,
        error TEXT,
        startedAt DATETIME,
        finishedAt DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS system_logs (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        workerId TEXT,
        severity TEXT NOT NULL,
        task TEXT NOT NULL,
        message TEXT NOT NULL,
        durationMs INTEGER,
        metadata TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      DROP TABLE IF EXISTS sync_queue;

      CREATE TABLE sync_queue (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        entityType TEXT NOT NULL,
        entityId TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        retryCount INTEGER DEFAULT 0,
        lastError TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_jobs_scheduler ON jobs(workspaceId, status, priority, createdAt);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_v2_workspaceId ON sync_queue(workspaceId, createdAt);
    `,
  },
  {
    name: '006_local_schema_enrichment',
    up: `
      ALTER TABLE contacts ADD COLUMN companyId TEXT;
      ALTER TABLE contacts ADD COLUMN title TEXT;
      ALTER TABLE contacts ADD COLUMN linkedin TEXT;
      ALTER TABLE contacts ADD COLUMN linkedinUrl TEXT;
      ALTER TABLE contacts ADD COLUMN source TEXT;
      ALTER TABLE contacts ADD COLUMN notes TEXT;

      ALTER TABLE companies ADD COLUMN industry TEXT;
      ALTER TABLE companies ADD COLUMN size TEXT;
      ALTER TABLE companies ADD COLUMN employeeCount INTEGER;
      ALTER TABLE companies ADD COLUMN revenue TEXT;
      ALTER TABLE companies ADD COLUMN linkedin TEXT;
      ALTER TABLE companies ADD COLUMN linkedinUrl TEXT;
      ALTER TABLE companies ADD COLUMN tags TEXT;
      ALTER TABLE companies ADD COLUMN notes TEXT;
    `,
  },
  {
    name: '007_add_company_website_location',
    up: `
      ALTER TABLE companies ADD COLUMN website TEXT;
      ALTER TABLE companies ADD COLUMN location TEXT;
    `,
  },
  {
    name: '008_job_lifecycle_hardening',
    up: `
      CREATE TABLE IF NOT EXISTS jobs_new (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'queued', 'starting', 'running', 'waiting', 'retrying', 'paused', 'cancelled', 'completed', 'failed', 'interrupted')),
        priority INTEGER DEFAULT 1,
        payload TEXT,
        progress INTEGER DEFAULT 0,
        retryCount INTEGER DEFAULT 0,
        maxRetries INTEGER DEFAULT 3,
        workerId TEXT,
        error TEXT,
        startedAt DATETIME,
        finishedAt DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO jobs_new (id, workspaceId, type, status, priority, payload, progress, retryCount, maxRetries, workerId, error, startedAt, finishedAt, createdAt, updatedAt)
      SELECT id, workspaceId, type, status, priority, payload, progress, retryCount, maxRetries, workerId, error, startedAt, finishedAt, createdAt, updatedAt FROM jobs;

      DROP TABLE jobs;

      ALTER TABLE jobs_new RENAME TO jobs;

      CREATE INDEX IF NOT EXISTS idx_jobs_scheduler ON jobs(workspaceId, status, priority, createdAt);

      ALTER TABLE jobs ADD COLUMN scheduledAt DATETIME;
      ALTER TABLE jobs ADD COLUMN checkpointData TEXT;
      ALTER TABLE jobs ADD COLUMN checkpointAt DATETIME;
      ALTER TABLE jobs ADD COLUMN idempotencyKey TEXT;
      ALTER TABLE jobs ADD COLUMN durationMs INTEGER;

      CREATE INDEX IF NOT EXISTS idx_jobs_scheduled ON jobs(workspaceId, status, scheduledAt);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_idempotency ON jobs(workspaceId, idempotencyKey) WHERE idempotencyKey IS NOT NULL;
    `,
  },
  {
    name: '009_scraping_pipeline_schema',
    up: `
      ALTER TABLE companies ADD COLUMN crawlStatus TEXT DEFAULT 'pending' CHECK(crawlStatus IN ('pending','in_progress','completed','failed','skipped'));
      ALTER TABLE companies ADD COLUMN crawledAt DATETIME;
      ALTER TABLE companies ADD COLUMN crawlError TEXT;
      ALTER TABLE companies ADD COLUMN contactCount INTEGER DEFAULT 0;
      ALTER TABLE companies ADD COLUMN score INTEGER;
      ALTER TABLE companies ADD COLUMN scoreUpdatedAt DATETIME;

      ALTER TABLE contacts ADD COLUMN confidence TEXT DEFAULT 'low' CHECK(confidence IN ('high','medium','low'));
      ALTER TABLE contacts ADD COLUMN type TEXT DEFAULT 'unknown' CHECK(type IN ('human','department','unknown'));
      ALTER TABLE contacts ADD COLUMN verificationStatus TEXT DEFAULT 'unverified' CHECK(verificationStatus IN ('unverified','valid','invalid','catch_all'));
      ALTER TABLE contacts ADD COLUMN sourceUrl TEXT;
      ALTER TABLE contacts ADD COLUMN sourcePlatform TEXT;
      ALTER TABLE contacts ADD COLUMN priority INTEGER DEFAULT 1;

      CREATE INDEX IF NOT EXISTS idx_companies_crawl_status ON companies(workspaceId, crawlStatus);
      CREATE INDEX IF NOT EXISTS idx_contacts_confidence ON contacts(workspaceId, confidence, priority);
    `,
  },
  {
    name: '010_sequence_execution_tracking',
    up: `
      ALTER TABLE sequence_executions ADD COLUMN cancelledAt DATETIME;
      ALTER TABLE sequence_executions ADD COLUMN cancelReason TEXT;
      ALTER TABLE sequence_executions ADD COLUMN parentJobId TEXT;

      CREATE INDEX IF NOT EXISTS idx_seq_exec_parent_job ON sequence_executions(parentJobId) WHERE parentJobId IS NOT NULL;
    `,
  },
  {
    name: '011_indexing_optimizations',
    up: `
      CREATE INDEX IF NOT EXISTS idx_contacts_companyId
      ON contacts(companyId);

      CREATE INDEX IF NOT EXISTS idx_activities_workspaceId
      ON activities(workspaceId);

      CREATE INDEX IF NOT EXISTS idx_sequence_exec_contactId
      ON sequence_executions(contactId);

      CREATE INDEX IF NOT EXISTS idx_sequence_exec_companyId
      ON sequence_executions(companyId);
    `,
  },
  {
    name: '012_automation_reliability',
    up: `
      CREATE TABLE IF NOT EXISTS automation_locks (
        sequenceId TEXT NOT NULL,
        entityId TEXT NOT NULL,
        workspaceId TEXT NOT NULL,
        lockedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        expiresAt DATETIME NOT NULL,
        PRIMARY KEY (sequenceId, entityId)
      );

      ALTER TABLE sequence_executions ADD COLUMN retryCount INTEGER DEFAULT 0;
      ALTER TABLE sequence_executions ADD COLUMN workerPid INTEGER DEFAULT NULL;
      ALTER TABLE sequence_executions ADD COLUMN recoveryCount INTEGER DEFAULT 0;

      CREATE INDEX IF NOT EXISTS idx_sequence_executions_sched ON sequence_executions(workspaceId, status, nextExecutionAt);
      CREATE INDEX IF NOT EXISTS idx_sequence_executions_sequenceId ON sequence_executions(sequenceId);
      CREATE INDEX IF NOT EXISTS idx_sequence_logs_executionId ON sequence_logs(executionId);
    `,
  },
];


class MigrationError extends Error {
  public statement: string;
  public originalError: any;

  constructor(message: string, statement: string, originalError: any) {
    super(message);
    this.name = 'MigrationError';
    this.statement = statement;
    this.originalError = originalError;
  }
}

function stripComments(sql: string): string {
  // Remove multi-line comments
  let result = sql.replace(/\/\*[\s\S]*?\*\//g, '');
  // Remove single-line comments
  result = result.replace(/--.*$/gm, '');
  return result;
}

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    if ((char === "'" || char === '"') && (i === 0 || sql[i - 1] !== '\\')) {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (stringChar === char) {
        inString = false;
      }
    }
    if (char === ';' && !inString) {
      statements.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    statements.push(current.trim());
  }
  return statements.filter(stmt => stmt.length > 0);
}

function tableExists(db: Database.Database, tableName: string): boolean {
  const row = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName);
  return !!row;
}

function indexExists(db: Database.Database, indexName: string): boolean {
  const row = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ?").get(indexName);
  return !!row;
}

function triggerExists(db: Database.Database, triggerName: string): boolean {
  const row = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'trigger' AND name = ?").get(triggerName);
  return !!row;
}

function viewExists(db: Database.Database, viewName: string): boolean {
  const row = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'view' AND name = ?").get(viewName);
  return !!row;
}

function columnExists(db: Database.Database, tableName: string, columnName: string): boolean {
  try {
    const columns = db.pragma(`table_info(${tableName})`) as Array<{ name: string }>;
    return columns.some(col => col.name.toLowerCase() === columnName.toLowerCase());
  } catch {
    return false;
  }
}

function executeIdempotentStatement(db: Database.Database, sql: string): boolean {
  const cleanSql = sql.trim().replace(/\s+/g, ' ');

  // 1. CREATE TABLE
  const createTableMatch = cleanSql.match(/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i);
  if (createTableMatch && createTableMatch[1]) {
    const tableName = createTableMatch[1];
    if (tableExists(db, tableName)) {
      return false; // Skipped
    }
    db.prepare(sql).run();
    return true; // Applied
  }

  // 2. CREATE INDEX
  const createIndexMatch = cleanSql.match(/^CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i);
  if (createIndexMatch && createIndexMatch[1]) {
    const indexName = createIndexMatch[1];
    if (indexExists(db, indexName)) {
      return false; // Skipped
    }
    db.prepare(sql).run();
    return true;
  }

  // 3. CREATE TRIGGER
  const createTriggerMatch = cleanSql.match(/^CREATE\s+TRIGGER\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i);
  if (createTriggerMatch && createTriggerMatch[1]) {
    const triggerName = createTriggerMatch[1];
    if (triggerExists(db, triggerName)) {
      return false; // Skipped
    }
    db.prepare(sql).run();
    return true;
  }

  // 4. CREATE VIEW
  const createViewMatch = cleanSql.match(/^CREATE\s+VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i);
  if (createViewMatch && createViewMatch[1]) {
    const viewName = createViewMatch[1];
    if (viewExists(db, viewName)) {
      return false; // Skipped
    }
    db.prepare(sql).run();
    return true;
  }

  // 5. DROP TABLE
  const dropTableMatch = cleanSql.match(/^DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i);
  if (dropTableMatch && dropTableMatch[1]) {
    const tableName = dropTableMatch[1];
    if (!tableExists(db, tableName)) {
      return false; // Skipped
    }
    if (tableName.toLowerCase() === 'sync_queue' && columnExists(db, 'sync_queue', 'version')) {
      return false; // Skipped
    }
    db.prepare(sql).run();
    return true;
  }

  // 6. ALTER TABLE ADD COLUMN
  const alterTableMatch = cleanSql.match(/^ALTER\s+TABLE\s+([a-zA-Z0-9_]+)\s+ADD\s+(?:COLUMN\s+)?([a-zA-Z0-9_]+)/i);
  if (alterTableMatch && alterTableMatch[1] && alterTableMatch[2]) {
    const tableName = alterTableMatch[1];
    const columnName = alterTableMatch[2];
    if (columnExists(db, tableName, columnName)) {
      return false; // Skipped
    }
    db.prepare(sql).run();
    return true;
  }

  // Fallback
  db.prepare(sql).run();
  return true;
}

/**
 * Runs pending SQLite schema migrations sequentially inside a transaction.
 */
export function runMigrations(customDb?: Database.Database): void {
  const db = customDb || getDatabase();

  console.log('[SQLite] Database opened');

  // Determine current schema version
  let currentVersion = 'none';
  const tableExistsInDb = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '_migrations'").get();
  if (tableExistsInDb) {
    try {
      const row = db.prepare('SELECT name FROM _migrations ORDER BY id DESC LIMIT 1').get() as { name: string } | undefined;
      if (row) {
        currentVersion = row.name;
      }
    } catch {
      // ignore
    }
  }
  console.log(`[SQLite] Current schema version: ${currentVersion}`);

  // Create migration tracking table if missing
  db.prepare(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      runAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  const runMigration = db.transaction((migration: Migration, statements: string[]) => {
    for (const stmt of statements) {
      try {
        executeIdempotentStatement(db, stmt);
      } catch (err: any) {
        throw new MigrationError(
          `Failed to execute SQL statement: ${err.message || err}`,
          stmt,
          err
        );
      }
    }
    // 2. Register migration in tracking table
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(migration.name);
  });

  for (const migration of MIGRATIONS) {
    const numPrefix = migration.name.split('_')[0]; // e.g. '001'
    console.log(`[SQLite] Checking migration ${numPrefix}...`);

    let isApplied = false;
    try {
      isApplied = !!db.prepare('SELECT 1 FROM _migrations WHERE name = ?').get(migration.name);
    } catch {
      // If table doesn't exist or is locked, treat as not applied
    }

    if (isApplied) {
      console.log('[SQLite] Skipped');
    } else {
      console.log(`[SQLite] Applying ${numPrefix}...`);
      const cleanedSql = stripComments(migration.up);
      const statements = splitSqlStatements(cleanedSql);

      try {
        if (migration.name === '008_job_lifecycle_hardening') {
          try {
            const dbPath = db.name;
            if (dbPath && dbPath !== ':memory:') {
              const backupPath = `${dbPath}.pre008.bak`;
              fs.copyFileSync(dbPath, backupPath);
              console.log(`[SQLite] Pre-migration backup created at: ${backupPath}`);
            }
          } catch (backupErr) {
            console.error('[SQLite] Failed to create pre-migration backup for job lifecycle hardening:', backupErr);
          }
        }

        runMigration(migration, statements);
        console.log('[SQLite] Success');
      } catch (err: any) {
        let failedStmt = 'unknown';
        let originalErr = err;
        if (err instanceof MigrationError) {
          failedStmt = err.statement;
          originalErr = err.originalError;
        }

        console.error(`[SQLite] Migration failure: ${migration.name}`);
        console.error(`- migration: ${migration.name}`);
        console.error(`- SQL statement: ${failedStmt}`);
        console.error(`- error: ${originalErr.message || originalErr}`);
        console.error(`- rollback status: rolled back`);

        if (migration.name === '008_job_lifecycle_hardening') {
          const dbPath = db.name;
          if (dbPath && dbPath !== ':memory:') {
            console.error(`[SQLite] Rollback manual recovery backup file is available at: ${dbPath}.pre008.bak`);
          }
        }

        throw err;
      }
    }
  }

  console.log('[SQLite] Completed');
}


