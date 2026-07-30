"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// apps/desktop/src/main/services/campaign.test.ts
var campaign_test_exports = {};
__export(campaign_test_exports, {
  runCampaignTests: () => runCampaignTests
});
module.exports = __toCommonJS(campaign_test_exports);
var import_better_sqlite33 = __toESM(require("better-sqlite3"));

// apps/desktop/src/main/database/runner.ts
var import_better_sqlite32 = require("better-sqlite3");

// apps/desktop/src/main/database/connection.ts
var import_better_sqlite3 = __toESM(require("better-sqlite3"));
var import_path = require("path");
var import_electron = require("electron");
var import_fs = __toESM(require("fs"));
var globalDb = null;
var workspaceDbs = /* @__PURE__ */ new Map();
function getDatabase(workspaceId) {
  if (workspaceId) {
    let db = workspaceDbs.get(workspaceId);
    if (db) return db;
    const userDataPath2 = import_electron.app.getPath("userData");
    const workspacesPath = (0, import_path.join)(userDataPath2, "workspaces");
    if (!import_fs.default.existsSync(workspacesPath)) {
      import_fs.default.mkdirSync(workspacesPath, { recursive: true });
    }
    const dbPath2 = (0, import_path.join)(workspacesPath, `leadforge_${workspaceId}.db`);
    db = new import_better_sqlite3.default(dbPath2);
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
    db.pragma("busy_timeout = 5000");
    db.pragma("foreign_keys = ON");
    workspaceDbs.set(workspaceId, db);
    console.log(`[SQLite] Workspace database initialized at: ${dbPath2}`);
    return db;
  }
  if (globalDb) return globalDb;
  const userDataPath = import_electron.app.getPath("userData");
  const dbPath = (0, import_path.join)(userDataPath, "leadforge.db");
  globalDb = new import_better_sqlite3.default(dbPath);
  globalDb.pragma("journal_mode = WAL");
  globalDb.pragma("synchronous = NORMAL");
  globalDb.pragma("busy_timeout = 5000");
  globalDb.pragma("foreign_keys = ON");
  console.log(`[SQLite] Global database initialized at: ${dbPath}`);
  return globalDb;
}

// apps/desktop/src/main/database/runner.ts
var import_fs2 = __toESM(require("fs"));
var MIGRATIONS = [
  {
    name: "001_initial_schema",
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
    `
  },
  {
    name: "002_discovery_schema",
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
    `
  },
  {
    name: "003_outreach_schema",
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
    `
  },
  {
    name: "004_automation_schema",
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
    `
  },
  {
    name: "005_local_first_foundation",
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
    `
  },
  {
    name: "006_local_schema_enrichment",
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
    `
  },
  {
    name: "007_add_company_website_location",
    up: `
      ALTER TABLE companies ADD COLUMN website TEXT;
      ALTER TABLE companies ADD COLUMN location TEXT;
    `
  },
  {
    name: "008_job_lifecycle_hardening",
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
    `
  },
  {
    name: "009_scraping_pipeline_schema",
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
    `
  },
  {
    name: "010_sequence_execution_tracking",
    up: `
      ALTER TABLE sequence_executions ADD COLUMN cancelledAt DATETIME;
      ALTER TABLE sequence_executions ADD COLUMN cancelReason TEXT;
      ALTER TABLE sequence_executions ADD COLUMN parentJobId TEXT;

      CREATE INDEX IF NOT EXISTS idx_seq_exec_parent_job ON sequence_executions(parentJobId) WHERE parentJobId IS NOT NULL;
    `
  },
  {
    name: "011_indexing_optimizations",
    up: `
      CREATE INDEX IF NOT EXISTS idx_contacts_companyId
      ON contacts(companyId);

      CREATE INDEX IF NOT EXISTS idx_activities_workspaceId
      ON activities(workspaceId);

      CREATE INDEX IF NOT EXISTS idx_sequence_exec_contactId
      ON sequence_executions(contactId);

      CREATE INDEX IF NOT EXISTS idx_sequence_exec_companyId
      ON sequence_executions(companyId);
    `
  },
  {
    name: "012_automation_reliability",
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
    `
  },
  {
    name: "013_execution_context",
    up: `
      ALTER TABLE sequence_executions ADD COLUMN executionContext TEXT;
    `
  },
  {
    name: "014_drop_legacy_discovery",
    up: `
      DROP TABLE IF EXISTS discovery_jobs;
      DROP TABLE IF EXISTS discovery_results;
    `
  },
  {
    name: "015_sync_dead_letter",
    up: `
      CREATE TABLE IF NOT EXISTS sync_dead_letter (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        entityType TEXT NOT NULL,
        entityId TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        retryCount INTEGER DEFAULT 0,
        lastError TEXT,
        createdAt DATETIME,
        updatedAt DATETIME,
        archivedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_sync_dead_letter_workspaceId ON sync_dead_letter(workspaceId);
    `
  },
  {
    name: "016_discovery_columns",
    up: `
      -- Add discovery/scraper columns to companies table
      ALTER TABLE companies ADD COLUMN website TEXT;
      ALTER TABLE companies ADD COLUMN location TEXT;
      ALTER TABLE companies ADD COLUMN phone TEXT;
      ALTER TABLE companies ADD COLUMN rating REAL;

      -- Add companyId FK to contacts table so contacts can be linked to discovered companies
      ALTER TABLE contacts ADD COLUMN companyId TEXT;

      -- Indexes for fast company+contact lookups by workspaceId
      CREATE INDEX IF NOT EXISTS idx_companies_workspaceId ON companies(workspaceId);
      CREATE INDEX IF NOT EXISTS idx_contacts_workspaceId ON contacts(workspaceId);
      CREATE INDEX IF NOT EXISTS idx_contacts_companyId ON contacts(companyId);
    `
  },
  {
    name: "017_linkedin_enrichment",
    up: `
      ALTER TABLE contacts ADD COLUMN title TEXT;
      ALTER TABLE contacts ADD COLUMN linkedinUrl TEXT;
      ALTER TABLE contacts ADD COLUMN headline TEXT;
      ALTER TABLE contacts ADD COLUMN profilePictureUrl TEXT;
      ALTER TABLE contacts ADD COLUMN type TEXT;
      ALTER TABLE contacts ADD COLUMN sourcePlatform TEXT;
    `
  },
  {
    name: "018_campaigns_and_enrollments",
    up: `
      -- Extend campaigns table
      ALTER TABLE campaigns ADD COLUMN description TEXT;
      ALTER TABLE campaigns ADD COLUMN sequenceId TEXT;
      ALTER TABLE campaigns ADD COLUMN sendingAccountId TEXT;
      ALTER TABLE campaigns ADD COLUMN schedule TEXT;
      ALTER TABLE campaigns ADD COLUMN timezone TEXT DEFAULT 'UTC';
      ALTER TABLE campaigns ADD COLUMN dailyLimit INTEGER DEFAULT 0;

      -- Extend sequence_executions (enrollments) table
      ALTER TABLE sequence_executions ADD COLUMN campaignId TEXT;
      ALTER TABLE sequence_executions ADD COLUMN currentStepName TEXT;
      ALTER TABLE sequence_executions ADD COLUMN currentExecutionId TEXT;
      ALTER TABLE sequence_executions ADD COLUMN lastRunAt DATETIME;
      ALTER TABLE sequence_executions ADD COLUMN emailsSent INTEGER DEFAULT 0;
      ALTER TABLE sequence_executions ADD COLUMN replies INTEGER DEFAULT 0;
      ALTER TABLE sequence_executions ADD COLUMN failures INTEGER DEFAULT 0;

      -- Add indexes for fast lookup
      CREATE INDEX IF NOT EXISTS idx_sequence_executions_campaignId ON sequence_executions(campaignId);
    `
  },
  {
    name: "019_email_accounts_credentials",
    up: `
      ALTER TABLE email_accounts ADD COLUMN smtpHost TEXT;
      ALTER TABLE email_accounts ADD COLUMN smtpPort INTEGER;
      ALTER TABLE email_accounts ADD COLUMN smtpSecure TEXT;
      ALTER TABLE email_accounts ADD COLUMN smtpUsername TEXT;
      ALTER TABLE email_accounts ADD COLUMN smtpPassword TEXT;
      ALTER TABLE email_accounts ADD COLUMN imapHost TEXT;
      ALTER TABLE email_accounts ADD COLUMN imapPort INTEGER;
      ALTER TABLE email_accounts ADD COLUMN imapSecure TEXT;
      ALTER TABLE email_accounts ADD COLUMN imapUsername TEXT;
      ALTER TABLE email_accounts ADD COLUMN imapPassword TEXT;
    `
  },
  {
    name: "020_sent_message_ids",
    up: `
      ALTER TABLE sequence_executions ADD COLUMN sentMessageIds TEXT;
    `
  }
];
var MigrationError = class extends Error {
  statement;
  originalError;
  constructor(message, statement, originalError) {
    super(message);
    this.name = "MigrationError";
    this.statement = statement;
    this.originalError = originalError;
  }
};
function stripComments(sql) {
  let result = sql.replace(/\/\*[\s\S]*?\*\//g, "");
  result = result.replace(/--.*$/gm, "");
  return result;
}
function splitSqlStatements(sql) {
  const statements = [];
  let current = "";
  let inString = false;
  let stringChar = "";
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    if ((char === "'" || char === '"') && (i === 0 || sql[i - 1] !== "\\")) {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (stringChar === char) {
        inString = false;
      }
    }
    if (char === ";" && !inString) {
      statements.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    statements.push(current.trim());
  }
  return statements.filter((stmt) => stmt.length > 0);
}
function tableExists(db, tableName) {
  const row = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName);
  return !!row;
}
function indexExists(db, indexName) {
  const row = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ?").get(indexName);
  return !!row;
}
function triggerExists(db, triggerName) {
  const row = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'trigger' AND name = ?").get(triggerName);
  return !!row;
}
function viewExists(db, viewName) {
  const row = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'view' AND name = ?").get(viewName);
  return !!row;
}
function columnExists(db, tableName, columnName) {
  try {
    const columns = db.pragma(`table_info(${tableName})`);
    return columns.some((col) => col.name.toLowerCase() === columnName.toLowerCase());
  } catch {
    return false;
  }
}
function executeIdempotentStatement(db, sql) {
  const cleanSql = sql.trim().replace(/\s+/g, " ");
  const createTableMatch = cleanSql.match(/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i);
  if (createTableMatch && createTableMatch[1]) {
    const tableName = createTableMatch[1];
    if (tableExists(db, tableName)) {
      return false;
    }
    db.prepare(sql).run();
    return true;
  }
  const createIndexMatch = cleanSql.match(/^CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i);
  if (createIndexMatch && createIndexMatch[1]) {
    const indexName = createIndexMatch[1];
    if (indexExists(db, indexName)) {
      return false;
    }
    db.prepare(sql).run();
    return true;
  }
  const createTriggerMatch = cleanSql.match(/^CREATE\s+TRIGGER\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i);
  if (createTriggerMatch && createTriggerMatch[1]) {
    const triggerName = createTriggerMatch[1];
    if (triggerExists(db, triggerName)) {
      return false;
    }
    db.prepare(sql).run();
    return true;
  }
  const createViewMatch = cleanSql.match(/^CREATE\s+VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i);
  if (createViewMatch && createViewMatch[1]) {
    const viewName = createViewMatch[1];
    if (viewExists(db, viewName)) {
      return false;
    }
    db.prepare(sql).run();
    return true;
  }
  const dropTableMatch = cleanSql.match(/^DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i);
  if (dropTableMatch && dropTableMatch[1]) {
    const tableName = dropTableMatch[1];
    if (!tableExists(db, tableName)) {
      return false;
    }
    if (tableName.toLowerCase() === "sync_queue" && columnExists(db, "sync_queue", "version")) {
      return false;
    }
    db.prepare(sql).run();
    return true;
  }
  const alterTableMatch = cleanSql.match(/^ALTER\s+TABLE\s+([a-zA-Z0-9_]+)\s+ADD\s+(?:COLUMN\s+)?([a-zA-Z0-9_]+)/i);
  if (alterTableMatch && alterTableMatch[1] && alterTableMatch[2]) {
    const tableName = alterTableMatch[1];
    const columnName = alterTableMatch[2];
    if (columnExists(db, tableName, columnName)) {
      return false;
    }
    db.prepare(sql).run();
    return true;
  }
  db.prepare(sql).run();
  return true;
}
function runMigrations(customDb) {
  const db = customDb || getDatabase();
  console.log("[SQLite] Database opened");
  let currentVersion = "none";
  const tableExistsInDb = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '_migrations'").get();
  if (tableExistsInDb) {
    try {
      const row = db.prepare("SELECT name FROM _migrations ORDER BY id DESC LIMIT 1").get();
      if (row) {
        currentVersion = row.name;
      }
    } catch {
    }
  }
  console.log(`[SQLite] Current schema version: ${currentVersion}`);
  db.prepare(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      runAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  const runMigration = db.transaction((migration, statements) => {
    for (const stmt of statements) {
      try {
        executeIdempotentStatement(db, stmt);
      } catch (err) {
        throw new MigrationError(
          `Failed to execute SQL statement: ${err.message || err}`,
          stmt,
          err
        );
      }
    }
    db.prepare("INSERT INTO _migrations (name) VALUES (?)").run(migration.name);
  });
  for (const migration of MIGRATIONS) {
    const numPrefix = migration.name.split("_")[0];
    console.log(`[SQLite] Checking migration ${numPrefix}...`);
    let isApplied = false;
    try {
      isApplied = !!db.prepare("SELECT 1 FROM _migrations WHERE name = ?").get(migration.name);
    } catch {
    }
    if (isApplied) {
      console.log("[SQLite] Skipped");
    } else {
      console.log(`[SQLite] Applying ${numPrefix}...`);
      const cleanedSql = stripComments(migration.up);
      const statements = splitSqlStatements(cleanedSql);
      try {
        if (migration.name === "008_job_lifecycle_hardening") {
          try {
            const dbPath = db.name;
            if (dbPath && dbPath !== ":memory:") {
              const backupPath = `${dbPath}.pre008.bak`;
              import_fs2.default.copyFileSync(dbPath, backupPath);
              console.log(`[SQLite] Pre-migration backup created at: ${backupPath}`);
            }
          } catch (backupErr) {
            console.error("[SQLite] Failed to create pre-migration backup for job lifecycle hardening:", backupErr);
          }
        }
        runMigration(migration, statements);
        console.log("[SQLite] Success");
      } catch (err) {
        let failedStmt = "unknown";
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
        if (migration.name === "008_job_lifecycle_hardening") {
          const dbPath = db.name;
          if (dbPath && dbPath !== ":memory:") {
            console.error(`[SQLite] Rollback manual recovery backup file is available at: ${dbPath}.pre008.bak`);
          }
        }
        throw err;
      }
    }
  }
  console.log("[SQLite] Completed");
}

// apps/desktop/src/main/services/campaign.test.ts
var import_crypto = require("crypto");
var import_assert = __toESM(require("assert"));

// apps/desktop/src/main/lib/logger.ts
var import_electron2 = require("electron");
var import_fs3 = __toESM(require("fs"));
var import_path2 = require("path");
var AppLoggerClass = class {
  logDir = "";
  constructor() {
    try {
      this.logDir = (0, import_path2.join)(import_electron2.app.getPath("userData"), "logs");
      if (!import_fs3.default.existsSync(this.logDir)) {
        import_fs3.default.mkdirSync(this.logDir, { recursive: true });
      }
      this.pruneOldLogFiles();
    } catch (e) {
    }
  }
  /**
   * Logs a message into terminal console, database table system_logs, and rotating files.
   */
  log(params) {
    const workspaceId = params.workspaceId || "global";
    const logId = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : require("crypto").randomUUID();
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const record = {
      id: logId,
      workspaceId,
      workerId: params.workerId || null,
      severity: params.severity,
      task: params.task,
      message: params.message,
      durationMs: params.durationMs || null,
      metadata: params.metadata || null,
      timestamp
    };
    const consoleMsg = `[${timestamp}] [${record.severity.toUpperCase()}] [${record.task}] ${record.message}`;
    if (record.severity === "error") {
      console.error(consoleMsg);
    } else if (record.severity === "warn") {
      console.warn(consoleMsg);
    } else {
      console.log(consoleMsg);
    }
    if (params.workspaceId) {
      try {
        const db = getDatabase(params.workspaceId);
        db.prepare(`
          INSERT INTO system_logs (id, workspaceId, workerId, severity, task, message, durationMs, metadata, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          record.id,
          record.workspaceId,
          record.workerId,
          record.severity,
          record.task,
          record.message,
          record.durationMs,
          record.metadata ? JSON.stringify(record.metadata) : null,
          record.timestamp
        );
        db.prepare(`
          DELETE FROM system_logs WHERE id NOT IN (
            SELECT id FROM system_logs ORDER BY timestamp DESC LIMIT 5000
          )
        `).run();
      } catch (err) {
        console.error("[Logger] Failed to write log to SQLite system_logs:", err);
      }
    }
    if (this.logDir) {
      try {
        const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
        const logFilename = `leadforge_${workspaceId}_${today}.jsonl`;
        const filePath = (0, import_path2.join)(this.logDir, logFilename);
        import_fs3.default.appendFileSync(filePath, JSON.stringify(record) + "\n", "utf8");
      } catch (err) {
        console.error("[Logger] Failed to write log to rotation file:", err);
      }
    }
    try {
      import_electron2.BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send("system:log:event", record);
        }
      });
    } catch (err) {
    }
  }
  info(task, message, workspaceId, metadata) {
    this.log({ severity: "info", task, message, workspaceId, metadata });
  }
  warn(task, message, workspaceId, metadata) {
    this.log({ severity: "warn", task, message, workspaceId, metadata });
  }
  error(task, message, workspaceId, err) {
    const meta = err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err;
    this.log({ severity: "error", task, message, workspaceId, metadata: meta });
  }
  /**
   * Prunes daily JSONL log files older than 10 days.
   */
  pruneOldLogFiles() {
    if (!this.logDir) return;
    try {
      const files = import_fs3.default.readdirSync(this.logDir);
      const now = Date.now();
      const tenDaysMs = 10 * 24 * 60 * 60 * 1e3;
      for (const file of files) {
        if (file.endsWith(".jsonl")) {
          const filePath = (0, import_path2.join)(this.logDir, file);
          const stat = import_fs3.default.statSync(filePath);
          if (now - stat.mtimeMs > tenDaysMs) {
            import_fs3.default.unlinkSync(filePath);
            console.log(`[Logger] Pruned old log file: ${file}`);
          }
        }
      }
    } catch (err) {
      console.error("[Logger] Failed to prune logs folder:", err);
    }
  }
};
var AppLogger = new AppLoggerClass();

// apps/desktop/src/main/lib/crypto.ts
var safeStorage;
try {
  safeStorage = require("electron").safeStorage;
} catch {
}
function encryptSecret(plainText) {
  if (!plainText) return "";
  if (!safeStorage || !safeStorage.isEncryptionAvailable()) {
    AppLogger.warn("security", "Electron safeStorage encryption is not available. Saving secret in plain text.");
    return plainText;
  }
  try {
    const buffer = safeStorage.encryptString(plainText);
    return `_enc_base64:${buffer.toString("base64")}`;
  } catch (err) {
    AppLogger.error("security", "Electron safeStorage encryption failed. Saving secret in plain text.", void 0, err);
    return plainText;
  }
}
function decryptSecret(encryptedOrPlain) {
  if (!encryptedOrPlain) return "";
  if (!encryptedOrPlain.startsWith("_enc_base64:")) {
    return encryptedOrPlain;
  }
  if (!safeStorage || !safeStorage.isEncryptionAvailable()) {
    AppLogger.warn("security", "Electron safeStorage decryption requested but encryption is not available.");
    return "";
  }
  try {
    const base64Data = encryptedOrPlain.substring("_enc_base64:".length);
    const buffer = Buffer.from(base64Data, "base64");
    return safeStorage.decryptString(buffer);
  } catch (err) {
    AppLogger.error("security", "Electron safeStorage decryption failed.", void 0, err);
    return "";
  }
}

// apps/desktop/src/main/services/campaign.test.ts
async function runCampaignTests() {
  console.log("--- STARTING CAMPAIGN INTEGRATION TESTS ---");
  const db = new import_better_sqlite33.default(":memory:");
  console.log("[Test] Created in-memory SQLite database.");
  runMigrations(db);
  console.log("[Test] Applied schema migrations successfully.");
  const campaignId = (0, import_crypto.randomUUID)();
  const workspaceId = (0, import_crypto.randomUUID)();
  const sequenceId = (0, import_crypto.randomUUID)();
  const sendingAccountId = (0, import_crypto.randomUUID)();
  db.prepare(`
    INSERT INTO campaigns (
      id, workspaceId, name, description, sequenceId, sendingAccountId,
      dailyLimit, timezone, status, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(
    campaignId,
    workspaceId,
    "SaaS Launch Outbound",
    "Cold outreach sequence for Q3 leads",
    sequenceId,
    sendingAccountId,
    150,
    "EST",
    "Draft"
  );
  const campRow = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(campaignId);
  import_assert.default.strictEqual(campRow.name, "SaaS Launch Outbound");
  import_assert.default.strictEqual(campRow.dailyLimit, 150);
  import_assert.default.strictEqual(campRow.timezone, "EST");
  import_assert.default.strictEqual(campRow.status, "Draft");
  console.log("\u2705 Campaign schema and creation verified.");
  const contactId = (0, import_crypto.randomUUID)();
  const enrollmentId = (0, import_crypto.randomUUID)();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  db.prepare(`
    INSERT INTO sequence_executions (
      id, sequenceId, campaignId, workspaceId, contactId, companyId,
      currentStep, currentStepName, status, startedAt, logs,
      emailsSent, replies, failures, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, NULL, 0, 'Initial', 'paused', ?, '[]', 0, 0, 0, ?, ?)
  `).run(
    enrollmentId,
    sequenceId,
    campaignId,
    workspaceId,
    contactId,
    now,
    now,
    now
  );
  const enrollRow = db.prepare("SELECT * FROM sequence_executions WHERE id = ?").get(enrollmentId);
  import_assert.default.strictEqual(enrollRow.campaignId, campaignId);
  import_assert.default.strictEqual(enrollRow.contactId, contactId);
  import_assert.default.strictEqual(enrollRow.status, "paused");
  console.log("\u2705 Contact campaign enrollment verified.");
  db.prepare("UPDATE campaigns SET status = 'Active', updatedAt = datetime('now') WHERE id = ?").run(campaignId);
  const pausedEnrollments = db.prepare(`
    SELECT id, contactId, nextExecutionAt FROM sequence_executions
    WHERE campaignId = ? AND status = 'paused' AND deletedAt IS NULL
  `).all(campaignId);
  db.transaction(() => {
    for (const enroll of pausedEnrollments) {
      const isWaiting = enroll.nextExecutionAt && new Date(enroll.nextExecutionAt) > /* @__PURE__ */ new Date();
      const newStatus = isWaiting ? "waiting" : "running";
      db.prepare(`
        UPDATE sequence_executions
        SET status = ?, updatedAt = datetime('now')
        WHERE id = ?
      `).run(newStatus, enroll.id);
      if (!isWaiting) {
        const jobId = (0, import_crypto.randomUUID)();
        db.prepare(`
          INSERT INTO jobs (id, workspaceId, type, status, priority, payload, progress, retryCount, maxRetries, createdAt, updatedAt)
          VALUES (?, ?, 'automation:workflow', 'queued', 3, ?, 0, 0, 3, datetime('now'), datetime('now'))
        `).run(
          jobId,
          workspaceId,
          JSON.stringify({
            sequenceId,
            entityId: enroll.contactId,
            entityType: "contact",
            executionId: enroll.id,
            workspaceId
          })
        );
      }
    }
  })();
  const activeEnrollRow = db.prepare("SELECT * FROM sequence_executions WHERE id = ?").get(enrollmentId);
  import_assert.default.strictEqual(activeEnrollRow.status, "running");
  const queuedJob = db.prepare("SELECT * FROM jobs WHERE workspaceId = ? AND type = 'automation:workflow'").get(workspaceId);
  import_assert.default.ok(queuedJob);
  import_assert.default.strictEqual(queuedJob.status, "queued");
  console.log("\u2705 Campaign activation cascade and scheduler job enqueuing verified.");
  db.prepare("UPDATE campaigns SET status = 'Paused', updatedAt = datetime('now') WHERE id = ?").run(campaignId);
  db.transaction(() => {
    db.prepare(`
      UPDATE sequence_executions
      SET status = 'paused', updatedAt = datetime('now')
      WHERE campaignId = ? AND status IN ('running', 'queued', 'starting', 'waiting') AND deletedAt IS NULL
    `).run(campaignId);
    db.prepare(`
      UPDATE jobs
      SET status = 'cancelled', updatedAt = datetime('now')
      WHERE workspaceId = ?
        AND type = 'automation:workflow'
        AND json_extract(payload, '$.executionId') IN (
          SELECT id FROM sequence_executions WHERE campaignId = ?
        )
        AND status IN ('queued', 'starting', 'running', 'retrying')
    `).run(workspaceId, campaignId);
  })();
  const pausedEnrollRowAfter = db.prepare("SELECT * FROM sequence_executions WHERE id = ?").get(enrollmentId);
  import_assert.default.strictEqual(pausedEnrollRowAfter.status, "paused");
  const cancelledJob = db.prepare("SELECT * FROM jobs WHERE id = ?").get(queuedJob.id);
  import_assert.default.strictEqual(cancelledJob.status, "cancelled");
  console.log("\u2705 Campaign pause cascade and queued jobs cancellation verified.");
  const checkContactStatus = (cId) => {
    const contact = db.prepare("SELECT status FROM contacts WHERE id = ?").get(cId);
    return contact?.status || "NEW";
  };
  db.prepare(`
    INSERT INTO contacts (id, workspaceId, firstName, lastName, email, status, createdAt, updatedAt)
    VALUES (?, ?, 'John', 'Doe', 'john@test.com', 'NEW', datetime('now'), datetime('now'))
  `).run(contactId, workspaceId);
  import_assert.default.strictEqual(checkContactStatus(contactId), "NEW");
  db.prepare("UPDATE contacts SET status = 'REPLIED' WHERE id = ?").run(contactId);
  import_assert.default.strictEqual(checkContactStatus(contactId), "REPLIED");
  const shouldAbort = ["REPLIED", "BOUNCED", "UNSUBSCRIBED"].includes(checkContactStatus(contactId));
  import_assert.default.ok(shouldAbort);
  console.log("\u2705 Stop-If-Replied hook verification query passed.");
  const testSecret = "SuperSecretSMTPPassword123!";
  const encrypted = encryptSecret(testSecret);
  const decrypted = decryptSecret(encrypted);
  import_assert.default.strictEqual(decrypted, testSecret);
  console.log("\u2705 safeStorage encryption fallback verified.");
  const staleJobId1 = (0, import_crypto.randomUUID)();
  const staleJobId2 = (0, import_crypto.randomUUID)();
  db.prepare(`
    INSERT INTO jobs (id, workspaceId, type, status, priority, payload, progress, retryCount, maxRetries, createdAt, updatedAt)
    VALUES (?, ?, 'automation:workflow', 'running', 3, '{}', 0, 1, 3, datetime('now'), datetime('now'))
  `).run(staleJobId1, workspaceId);
  db.prepare(`
    INSERT INTO jobs (id, workspaceId, type, status, priority, payload, progress, retryCount, maxRetries, createdAt, updatedAt)
    VALUES (?, ?, 'automation:workflow', 'starting', 3, '{}', 0, 3, 3, datetime('now'), datetime('now'))
  `).run(staleJobId2, workspaceId);
  const staleJobs = db.prepare(`
    SELECT id, retryCount, maxRetries FROM jobs
    WHERE workspaceId = ? AND status IN ('running', 'starting')
  `).all(workspaceId);
  for (const job of staleJobs) {
    if (job.retryCount < job.maxRetries) {
      db.prepare(`
        UPDATE jobs
        SET status = 'retrying', retryCount = retryCount + 1, lastError = 'Worker execution interrupted due to application restart.', updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(job.id);
    } else {
      db.prepare(`
        UPDATE jobs
        SET status = 'failed', lastError = 'Worker execution interrupted due to application restart. Max retries exceeded.', updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(job.id);
    }
  }
  const job1After = db.prepare("SELECT status, retryCount, lastError FROM jobs WHERE id = ?").get(staleJobId1);
  import_assert.default.strictEqual(job1After.status, "retrying");
  import_assert.default.strictEqual(job1After.retryCount, 2);
  import_assert.default.ok(job1After.lastError.includes("application restart"));
  const job2After = db.prepare("SELECT status, retryCount, lastError FROM jobs WHERE id = ?").get(staleJobId2);
  import_assert.default.strictEqual(job2After.status, "failed");
  import_assert.default.strictEqual(job2After.retryCount, 3);
  import_assert.default.ok(job2After.lastError.includes("Max retries exceeded"));
  console.log("\u2705 Scheduler stale job reconciliation verified.");
  console.log("--- ALL CAMPAIGN INTEGRATION TESTS PASSED ---");
}
if (require.main === module) {
  runCampaignTests().catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  runCampaignTests
});
