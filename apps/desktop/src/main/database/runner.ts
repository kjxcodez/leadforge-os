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
    `
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
    `
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
    `
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
    `
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
    `
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
    `
  },
  {
    name: '007_add_company_website_location',
    up: `
      ALTER TABLE companies ADD COLUMN website TEXT;
      ALTER TABLE companies ADD COLUMN location TEXT;
    `
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
    `
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
    `
  },
  {
    name: '010_sequence_execution_tracking',
    up: `
      ALTER TABLE sequence_executions ADD COLUMN cancelledAt DATETIME;
      ALTER TABLE sequence_executions ADD COLUMN cancelReason TEXT;
      ALTER TABLE sequence_executions ADD COLUMN parentJobId TEXT;

      CREATE INDEX IF NOT EXISTS idx_seq_exec_parent_job ON sequence_executions(parentJobId) WHERE parentJobId IS NOT NULL;
    `
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
    `
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
    `
  },
  {
    name: '013_execution_context',
    up: `
      ALTER TABLE sequence_executions ADD COLUMN executionContext TEXT;
    `
  },
  {
    name: '014_drop_legacy_discovery',
    up: `
      DROP TABLE IF EXISTS discovery_jobs;
      DROP TABLE IF EXISTS discovery_results;
    `
  },
  {
    name: '015_sync_dead_letter',
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
    name: '016_discovery_columns',
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
    name: '017_linkedin_enrichment',
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
    name: '018_campaigns_and_enrollments',
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
    name: '019_email_accounts_credentials',
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
    name: '020_sent_message_ids',
    up: `
      ALTER TABLE sequence_executions ADD COLUMN sentMessageIds TEXT;
    `
  },
  {
    name: '021_lead_intelligence_engine',
    up: `
      CREATE TABLE IF NOT EXISTS company_intelligence (
        companyId TEXT PRIMARY KEY,
        summary TEXT,
        techStack TEXT,
        businessModel TEXT,
        estimatedRevenue TEXT,
        growthSignals TEXT,
        hiringSignals TEXT,
        decisionMakerLikelihood REAL,
        leadConfidence TEXT,
        missingInformation TEXT
      );

      CREATE TABLE IF NOT EXISTS website_intelligence (
        companyId TEXT PRIMARY KEY,
        brandVoice TEXT,
        contentQuality TEXT,
        buyingSignals TEXT,
        seoSignals TEXT,
        technicalIssues TEXT,
        productsServices TEXT,
        testimonialsCaseStudies TEXT
      );

      CREATE TABLE IF NOT EXISTS contact_intelligence (
        contactId TEXT PRIMARY KEY,
        decisionMakerScore REAL,
        seniority TEXT,
        buyingInfluence TEXT,
        personalizationOpportunities TEXT,
        relationshipStrength REAL
      );

      CREATE TABLE IF NOT EXISTS opportunity_scores (
        companyId TEXT PRIMARY KEY,
        overallScore REAL,
        fitScore REAL,
        sizeScore REAL,
        intentScore REAL,
        urgencyScore REAL,
        explanation TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_opportunity_scores_overall ON opportunity_scores(overallScore);
    `
  },
  {
    name: '023_audit_trail_and_observability',
    up: `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        actor TEXT,
        action TEXT NOT NULL,
        entityId TEXT,
        entityType TEXT,
        beforeValue TEXT,
        afterValue TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_audit_logs_workspaceId ON audit_logs(workspaceId);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
    `
  },
  {
    name: '024_agent_memory',
    up: `
      CREATE TABLE IF NOT EXISTS workspace_memory (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        scope TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT,
        syncStatus TEXT DEFAULT 'synced',
        version INTEGER DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        deletedAt DATETIME DEFAULT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_memory_key ON workspace_memory(workspaceId, scope, key);
    `
  },
  {
    name: '025_add_contacts_tags',
    up: `
      ALTER TABLE contacts ADD COLUMN tags TEXT;
    `
  },
  {
    name: '026_email_accounts_gmail_oauth',
    up: `
      ALTER TABLE email_accounts ADD COLUMN refreshToken TEXT;
      ALTER TABLE email_accounts ADD COLUMN accessToken TEXT;
      ALTER TABLE email_accounts ADD COLUMN tokenExpiresAt TEXT;
      ALTER TABLE email_accounts ADD COLUMN googleAccountId TEXT;
    `
  },
  {
    name: '027_discovery_provenance',
    up: `
      CREATE TABLE IF NOT EXISTS discovery_runs (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        name TEXT NOT NULL,
        query TEXT NOT NULL,
        country TEXT,
        state TEXT,
        city TEXT,
        provider TEXT NOT NULL DEFAULT 'google_maps',
        status TEXT NOT NULL DEFAULT 'pending',
        resultCount INTEGER DEFAULT 0,
        error TEXT,
        startedAt DATETIME,
        finishedAt DATETIME,
        syncStatus TEXT DEFAULT 'pending',
        version INTEGER DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        deletedAt DATETIME DEFAULT NULL
      );

      CREATE TABLE IF NOT EXISTS company_discovery_runs (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        companyId TEXT NOT NULL,
        discoveryRunId TEXT NOT NULL,
        requiresReview INTEGER DEFAULT 0,
        syncStatus TEXT DEFAULT 'pending',
        version INTEGER DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS audiences (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        entityType TEXT NOT NULL DEFAULT 'contacts',
        filterDefinition TEXT NOT NULL DEFAULT '{}',
        syncStatus TEXT DEFAULT 'pending',
        version INTEGER DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        deletedAt DATETIME DEFAULT NULL
      );

      ALTER TABLE companies ADD COLUMN requiresReview INTEGER DEFAULT 0;

      CREATE INDEX IF NOT EXISTS idx_discovery_runs_workspaceId ON discovery_runs(workspaceId);
      CREATE INDEX IF NOT EXISTS idx_company_discovery_runs_companyId ON company_discovery_runs(companyId);
      CREATE INDEX IF NOT EXISTS idx_company_discovery_runs_runId ON company_discovery_runs(discoveryRunId);
      CREATE INDEX IF NOT EXISTS idx_audiences_workspaceId ON audiences(workspaceId);
    `
  },
  {
    name: '028_static_audiences',
    up: `
      ALTER TABLE audiences ADD COLUMN mode TEXT NOT NULL DEFAULT 'dynamic';
      ALTER TABLE audiences ADD COLUMN staticMemberIds TEXT;
    `
  }
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
  return statements.filter((stmt) => stmt.length > 0);
}

function tableExists(db: Database.Database, tableName: string): boolean {
  const row = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName);
  return !!row;
}

function indexExists(db: Database.Database, indexName: string): boolean {
  const row = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ?")
    .get(indexName);
  return !!row;
}

function triggerExists(db: Database.Database, triggerName: string): boolean {
  const row = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'trigger' AND name = ?")
    .get(triggerName);
  return !!row;
}

function viewExists(db: Database.Database, viewName: string): boolean {
  const row = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'view' AND name = ?")
    .get(viewName);
  return !!row;
}

function columnExists(db: Database.Database, tableName: string, columnName: string): boolean {
  try {
    const columns = db.pragma(`table_info(${tableName})`) as Array<{ name: string }>;
    return columns.some((col) => col.name.toLowerCase() === columnName.toLowerCase());
  } catch {
    return false;
  }
}

function executeIdempotentStatement(db: Database.Database, sql: string): boolean {
  const cleanSql = sql.trim().replace(/\s+/g, ' ');

  // 1. CREATE TABLE
  const createTableMatch = cleanSql.match(
    /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i
  );
  if (createTableMatch && createTableMatch[1]) {
    const tableName = createTableMatch[1];
    if (tableExists(db, tableName)) {
      return false; // Skipped
    }
    db.prepare(sql).run();
    return true; // Applied
  }

  // 2. CREATE INDEX
  const createIndexMatch = cleanSql.match(
    /^CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i
  );
  if (createIndexMatch && createIndexMatch[1]) {
    const indexName = createIndexMatch[1];
    if (indexExists(db, indexName)) {
      return false; // Skipped
    }
    db.prepare(sql).run();
    return true;
  }

  // 3. CREATE TRIGGER
  const createTriggerMatch = cleanSql.match(
    /^CREATE\s+TRIGGER\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i
  );
  if (createTriggerMatch && createTriggerMatch[1]) {
    const triggerName = createTriggerMatch[1];
    if (triggerExists(db, triggerName)) {
      return false; // Skipped
    }
    db.prepare(sql).run();
    return true;
  }

  // 4. CREATE VIEW
  const createViewMatch = cleanSql.match(
    /^CREATE\s+VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i
  );
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
  const alterTableMatch = cleanSql.match(
    /^ALTER\s+TABLE\s+([a-zA-Z0-9_]+)\s+ADD\s+(?:COLUMN\s+)?([a-zA-Z0-9_]+)/i
  );
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
  const dbPath = db.name;
  let backupPath = '';

  // 1. Create a workspace database backup before applying migrations
  if (dbPath && dbPath !== ':memory:') {
    try {
      backupPath = `${dbPath}.migration.bak`;
      fs.copyFileSync(dbPath, backupPath);
      console.log(`[SQLite] Pre-migration database backup created at: ${backupPath}`);
    } catch (backupErr) {
      console.error('[SQLite] Failed to create pre-migration database backup:', backupErr);
    }
  }

  try {
    console.log('[SQLite] Database opened');

    // Determine current schema version
    let currentVersion = 'none';
    const tableExistsInDb = db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '_migrations'")
      .get();
    if (tableExistsInDb) {
      try {
        const row = db.prepare('SELECT name FROM _migrations ORDER BY id DESC LIMIT 1').get() as
          { name: string } | undefined;
        if (row) {
          currentVersion = row.name;
        }
      } catch {
        // ignore
      }
    }
    console.log(`[SQLite] Current schema version: ${currentVersion}`);

    // Create migration tracking table if missing
    db.prepare(
      `
      CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        runAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `
    ).run();

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
              console.error(
                '[SQLite] Failed to create pre-migration backup for job lifecycle hardening:',
                backupErr
              );
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
              console.error(
                `[SQLite] Rollback manual recovery backup file is available at: ${dbPath}.pre008.bak`
              );
            }
          }

          throw err;
        }
      }
    }

    // Seed workflow presets if sequences table exists
    if (tableExists(db, 'sequences')) {
      const match = db.name.match(/leadforge_([a-zA-Z0-9_-]+)\.db/);
      const wsId = match ? match[1] : 'default';

      const count = db.prepare('SELECT count(*) as cnt FROM sequences').get() as { cnt: number };
      if (count && count.cnt === 0) {
        console.log(`[SQLite] Seeding workflow presets for workspace: ${wsId}`);
        const presets = [
          {
            id: 'preset_daily_discovery',
            name: 'Daily Lead Discovery',
            description: 'Scan Google Maps for leads, crawl websites, and export CSV daily.',
            status: 'active',
            trigger: JSON.stringify({ type: 'SCHEDULE', config: { cron: '0 9 * * *' } }),
            steps: JSON.stringify([
              {
                id: 'step_1',
                type: 'RUN_DISCOVERY',
                config: { query: 'Software Companies', limit: 20 }
              },
              { id: 'step_2', type: 'WAIT', config: { delaySeconds: 300 } },
              { id: 'step_3', type: 'EXPORT_CSV', config: {} }
            ])
          },
          {
            id: 'preset_auto_qualify',
            name: 'Auto Qualify Leads',
            description: 'Trigger website crawl and lead intelligence when a company is created.',
            status: 'active',
            trigger: JSON.stringify({ type: 'COMPANY_CREATED', config: {} }),
            steps: JSON.stringify([
              { id: 'step_1', type: 'RUN_CRAWLER', config: {} },
              { id: 'step_2', type: 'WAIT', config: { delaySeconds: 60 } },
              { id: 'step_3', type: 'RUN_INTELLIGENCE', config: {} }
            ])
          },
          {
            id: 'preset_auto_enroll',
            name: 'Auto Enroll High Scores',
            description: 'Generate personalized opening lines and enroll hot leads into campaigns.',
            status: 'active',
            trigger: JSON.stringify({
              type: 'LEAD_SCORE_CHANGED',
              conditions: [{ field: 'leadScore', op: '>=', value: 75 }]
            }),
            steps: JSON.stringify([
              { id: 'step_1', type: 'GENERATE_OPENING_LINE', config: {} },
              { id: 'step_2', type: 'ENROLL_CONTACT', config: { campaignId: 'default_campaign' } }
            ])
          },
          {
            id: 'preset_follow_up',
            name: 'Follow Up After 3 Days',
            description:
              'Check reply status after 3 days and automatically send follow-up templates.',
            status: 'active',
            trigger: JSON.stringify({ type: 'EMAIL_SENT', config: {} }),
            steps: JSON.stringify([
              { id: 'step_1', type: 'WAIT', config: { delaySeconds: 259200 } },
              { id: 'step_2', type: 'CONDITION', config: { conditionType: 'NO_REPLY_RECEIVED' } },
              { id: 'step_3', type: 'SEND_EMAIL', config: { templateId: 'follow_up' } }
            ])
          },
          {
            id: 'preset_notify_replies',
            name: 'Notify on Replies',
            description: 'Send desktop and in-app alerts on prospect replies.',
            status: 'active',
            trigger: JSON.stringify({ type: 'REPLY_RECEIVED', config: {} }),
            steps: JSON.stringify([
              {
                id: 'step_1',
                type: 'SEND_NOTIFICATION',
                config: { message: 'Lead replied to campaign!', type: 'success' }
              }
            ])
          },
          {
            id: 'preset_nightly_backup',
            name: 'Backup Every Night',
            description: 'Trigger automatic nightly database snapshot backups.',
            status: 'active',
            trigger: JSON.stringify({ type: 'SCHEDULE', config: { cron: '0 1 * * *' } }),
            steps: JSON.stringify([{ id: 'step_1', type: 'BACKUP_WORKSPACE', config: {} }])
          }
        ];

        const insertStmt = db.prepare(`
          INSERT INTO sequences (id, workspaceId, name, description, status, trigger, steps, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `);
        for (const p of presets) {
          insertStmt.run(p.id, wsId, p.name, p.description, p.status, p.trigger, p.steps);
        }
      }
    }

    // Delete pre-migration backup on success
    if (backupPath && fs.existsSync(backupPath)) {
      try {
        fs.unlinkSync(backupPath);
        console.log('[SQLite] Pre-migration database backup cleaned up.');
      } catch {}
    }
    console.log('[SQLite] Completed');
  } catch (err: any) {
    console.error('[SQLite] Migration failed. Restoring from pre-migration backup...', err);
    if (backupPath && fs.existsSync(backupPath) && dbPath && dbPath !== ':memory:') {
      try {
        db.close();
        fs.copyFileSync(backupPath, dbPath);
        console.log('[SQLite] Database successfully rolled back and restored from backup.');
      } catch (restoreErr) {
        console.error('[SQLite] CRITICAL: Database restore failed during rollback!', restoreErr);
      }
    }
    throw err;
  }
}
