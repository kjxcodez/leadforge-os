import Database from 'better-sqlite3';

/**
 * LeadForge OS — Clean Disposable SQLite Cache Schema Initializer (Phase 6)
 * 
 * Defines the minimal, read-optimized local SQLite schema.
 * SQLite is strictly a disposable read projection of authoritative MongoDB state.
 * 
 * Absolute Invariants:
 *  1. Zero sync infrastructure tables (no sync_queue, sync_metadata, sync_dead_letter).
 *  2. Zero sync status columns (no syncStatus, version, pending flags).
 *  3. All IDs are exact canonical strings matching MongoDB document _id.
 *  4. Database can be dropped (rm leadforge_<wsId>.db) and fully recreated without data loss.
 */

export const CACHE_SCHEMA_VERSION = 2;

export const CACHE_TABLES = [
  'workspaces',
  'companies',
  'contacts',
  'campaigns',
  'sequences',
  'sequence_executions',
  'templates',
  'email_accounts',
  'audiences',
  'discovery_runs',
  'company_discovery_runs',
  'cache_metadata'
] as const;

export type CacheTable = (typeof CACHE_TABLES)[number];

/**
 * Initializes the clean SQLite cache schema directly without running the 33-step legacy migration runner.
 */
export function initCacheSchema(db: Database.Database): void {
  // Configure high-performance WAL and pragmas for read concurrency
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');

  db.transaction(() => {
    // 1. Cache Metadata Table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS cache_metadata (
        key TEXT PRIMARY KEY,
        value TEXT,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    try {
      const metaCols = (db.pragma('table_info(cache_metadata)') as Array<{ name: string }>).map((c) => c.name);
      if (!metaCols.includes('updatedAt')) {
        db.prepare(`ALTER TABLE cache_metadata ADD COLUMN updatedAt DATETIME`).run();
      }
    } catch (err) {
      console.warn('[CacheSchema] Failed to add updatedAt to cache_metadata:', err);
    }

    // 2. Workspaces Cache
    db.prepare(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT,
        ownerId TEXT,
        plan TEXT DEFAULT 'free',
        settings TEXT,
        createdAt DATETIME,
        updatedAt DATETIME
      )
    `).run();

    // Ensure plan column exists if table existed from an earlier version
    try {
      const wsCols = (db.pragma('table_info(workspaces)') as Array<{ name: string }>).map(
        (c) => c.name
      );
      if (!wsCols.includes('plan')) {
        db.prepare(`ALTER TABLE workspaces ADD COLUMN plan TEXT DEFAULT 'free'`).run();
      }
    } catch {}

    // 3. Companies Cache
    db.prepare(`
      CREATE TABLE IF NOT EXISTS companies (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        name TEXT NOT NULL,
        domain TEXT,
        industry TEXT,
        status TEXT,
        website TEXT,
        address TEXT,
        phone TEXT,
        email TEXT,
        employeeCount INTEGER,
        size TEXT,
        revenue TEXT,
        city TEXT,
        state TEXT,
        country TEXT,
        location TEXT,
        linkedin TEXT,
        linkedinUrl TEXT,
        notes TEXT,
        opportunityScore REAL,
        tags TEXT DEFAULT '[]',
        customFields TEXT DEFAULT '{}',
        metrics TEXT DEFAULT '{}',
        createdAt DATETIME,
        updatedAt DATETIME,
        deletedAt DATETIME DEFAULT NULL
      )
    `).run();

    db.prepare(`CREATE INDEX IF NOT EXISTS idx_cache_companies_ws ON companies(workspaceId)`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_cache_companies_ws_del ON companies(workspaceId, deletedAt)`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_cache_companies_domain ON companies(workspaceId, domain)`).run();

    // 4. Contacts Cache
    db.prepare(`
      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        companyId TEXT,
        firstName TEXT,
        lastName TEXT,
        email TEXT,
        phone TEXT,
        title TEXT,
        linkedin TEXT,
        linkedinUrl TEXT,
        source TEXT,
        priority INTEGER DEFAULT 0,
        status TEXT,
        notes TEXT,
        tags TEXT DEFAULT '[]',
        lastContactedAt DATETIME,
        customFields TEXT DEFAULT '{}',
        createdAt DATETIME,
        updatedAt DATETIME,
        deletedAt DATETIME DEFAULT NULL
      )
    `).run();

    db.prepare(`CREATE INDEX IF NOT EXISTS idx_cache_contacts_ws ON contacts(workspaceId)`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_cache_contacts_ws_comp ON contacts(workspaceId, companyId)`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_cache_contacts_ws_del ON contacts(workspaceId, deletedAt)`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_cache_contacts_email ON contacts(workspaceId, email)`).run();

    // 5. Campaigns Cache
    db.prepare(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        sequenceId TEXT,
        sendingAccountId TEXT,
        name TEXT NOT NULL,
        description TEXT,
        dailyLimit INTEGER DEFAULT 50,
        timezone TEXT DEFAULT 'UTC',
        status TEXT DEFAULT 'DRAFT',
        settings TEXT DEFAULT '{}',
        stats TEXT DEFAULT '{}',
        createdAt DATETIME,
        updatedAt DATETIME,
        deletedAt DATETIME DEFAULT NULL
      )
    `).run();

    db.prepare(`CREATE INDEX IF NOT EXISTS idx_cache_campaigns_ws ON campaigns(workspaceId)`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_cache_campaigns_ws_del ON campaigns(workspaceId, deletedAt)`).run();

    // 6. Sequences Cache
    db.prepare(`
      CREATE TABLE IF NOT EXISTS sequences (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        steps TEXT DEFAULT '[]',
        status TEXT DEFAULT 'DRAFT',
        trigger TEXT DEFAULT '{}',
        triggers TEXT DEFAULT '[]',
        createdAt DATETIME,
        updatedAt DATETIME,
        deletedAt DATETIME DEFAULT NULL
      )
    `).run();

    db.prepare(`CREATE INDEX IF NOT EXISTS idx_cache_sequences_ws ON sequences(workspaceId)`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_cache_sequences_ws_del ON sequences(workspaceId, deletedAt)`).run();

    // 7. Sequence Executions Cache
    db.prepare(`
      CREATE TABLE IF NOT EXISTS sequence_executions (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        sequenceId TEXT,
        campaignId TEXT,
        contactId TEXT,
        companyId TEXT,
        status TEXT DEFAULT 'PENDING',
        currentStep INTEGER DEFAULT 0,
        currentStepName TEXT,
        startedAt DATETIME,
        completedAt DATETIME,
        failedAt DATETIME,
        pausedAt DATETIME,
        nextExecutionAt DATETIME,
        logs TEXT DEFAULT '[]',
        metrics TEXT DEFAULT '{}',
        emailsSent INTEGER DEFAULT 0,
        replies INTEGER DEFAULT 0,
        failures INTEGER DEFAULT 0,
        createdAt DATETIME,
        updatedAt DATETIME,
        deletedAt DATETIME DEFAULT NULL
      )
    `).run();

    db.prepare(`CREATE INDEX IF NOT EXISTS idx_cache_seq_exec_ws ON sequence_executions(workspaceId)`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_cache_seq_exec_camp ON sequence_executions(workspaceId, campaignId)`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_cache_seq_exec_cont ON sequence_executions(workspaceId, contactId)`).run();

    // 8. Templates Cache
    db.prepare(`
      CREATE TABLE IF NOT EXISTS templates (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        name TEXT NOT NULL,
        subject TEXT,
        body TEXT,
        variables TEXT DEFAULT '[]',
        attachments TEXT DEFAULT '[]',
        createdAt DATETIME,
        updatedAt DATETIME,
        deletedAt DATETIME DEFAULT NULL
      )
    `).run();

    db.prepare(`CREATE INDEX IF NOT EXISTS idx_cache_templates_ws ON templates(workspaceId)`).run();

    // 9. Email Accounts Cache (Safe, non-secret fields only)
    db.prepare(`
      CREATE TABLE IF NOT EXISTS email_accounts (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        name TEXT,
        provider TEXT,
        email TEXT NOT NULL,
        displayName TEXT,
        dailyLimit INTEGER DEFAULT 50,
        status TEXT DEFAULT 'ACTIVE',
        smtpHost TEXT,
        smtpPort INTEGER,
        imapHost TEXT,
        imapPort INTEGER,
        createdAt DATETIME,
        updatedAt DATETIME,
        deletedAt DATETIME DEFAULT NULL
      )
    `).run();

    db.prepare(`CREATE INDEX IF NOT EXISTS idx_cache_email_acc_ws ON email_accounts(workspaceId)`).run();

    // Email Deliveries Cache
    db.prepare(`
      CREATE TABLE IF NOT EXISTS email_deliveries (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        campaignId TEXT,
        sequenceId TEXT,
        executionId TEXT,
        stepIndex INTEGER DEFAULT 0,
        contactId TEXT,
        companyId TEXT,
        accountId TEXT,
        senderEmail TEXT,
        recipientEmail TEXT,
        subject TEXT,
        providerMessageId TEXT,
        status TEXT DEFAULT 'PENDING',
        attempt INTEGER DEFAULT 1,
        idempotencyKey TEXT UNIQUE,
        sentAt DATETIME,
        createdAt DATETIME,
        updatedAt DATETIME
      )
    `).run();

    db.prepare(`CREATE INDEX IF NOT EXISTS idx_cache_email_del_ws ON email_deliveries(workspaceId)`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_cache_email_del_idem ON email_deliveries(idempotencyKey)`).run();

    // 10. Audiences Cache
    db.prepare(`
      CREATE TABLE IF NOT EXISTS audiences (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        entityType TEXT DEFAULT 'contacts',
        type TEXT DEFAULT 'STATIC',
        mode TEXT DEFAULT 'dynamic',
        isDynamic INTEGER DEFAULT 0,
        filterRules TEXT DEFAULT '[]',
        filterDefinition TEXT DEFAULT '{}',
        memberCount INTEGER DEFAULT 0,
        staticMemberIds TEXT DEFAULT '[]',
        createdAt DATETIME,
        updatedAt DATETIME,
        deletedAt DATETIME DEFAULT NULL
      )
    `).run();

    db.prepare(`CREATE INDEX IF NOT EXISTS idx_cache_audiences_ws ON audiences(workspaceId)`).run();

    // 11. Discovery Runs Cache
    db.prepare(`
      CREATE TABLE IF NOT EXISTS discovery_runs (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        name TEXT NOT NULL,
        query TEXT NOT NULL,
        country TEXT,
        state TEXT,
        city TEXT,
        provider TEXT DEFAULT 'google_maps',
        status TEXT DEFAULT 'pending',
        resultCount INTEGER DEFAULT 0,
        startedAt DATETIME,
        completedAt DATETIME,
        failedAt DATETIME,
        error TEXT,
        createdAt DATETIME,
        updatedAt DATETIME,
        deletedAt DATETIME DEFAULT NULL
      )
    `).run();

    db.prepare(`CREATE INDEX IF NOT EXISTS idx_cache_discovery_ws ON discovery_runs(workspaceId)`).run();

    // 12. Company Discovery Runs Junction Cache
    db.prepare(`
      CREATE TABLE IF NOT EXISTS company_discovery_runs (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        discoveryRunId TEXT NOT NULL,
        companyId TEXT NOT NULL,
        createdAt DATETIME
      )
    `).run();

    db.prepare(`CREATE INDEX IF NOT EXISTS idx_cache_comp_disc_ws ON company_discovery_runs(workspaceId, discoveryRunId)`).run();

    // 13. Intelligence Sources Cache
    db.prepare(`
      CREATE TABLE IF NOT EXISTS intelligence_sources (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        companyId TEXT NOT NULL,
        sourceType TEXT NOT NULL,
        url TEXT,
        retrievedAt DATETIME,
        status TEXT,
        createdAt DATETIME,
        updatedAt DATETIME
      )
    `).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_cache_intel_src_ws ON intelligence_sources(workspaceId)`).run();

    // 14. Intelligence Evidence Cache
    db.prepare(`
      CREATE TABLE IF NOT EXISTS intelligence_evidence (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        companyId TEXT NOT NULL,
        sourceId TEXT NOT NULL,
        evidenceType TEXT NOT NULL,
        key TEXT,
        value TEXT,
        rawExcerpt TEXT,
        extractionMethod TEXT,
        observedAt DATETIME,
        createdAt DATETIME
      )
    `).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_cache_intel_evi_ws ON intelligence_evidence(workspaceId)`).run();

    // 15. Intelligence Claims Cache
    db.prepare(`
      CREATE TABLE IF NOT EXISTS intelligence_claims (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        companyId TEXT NOT NULL,
        evidenceIds TEXT DEFAULT '[]',
        subject TEXT,
        predicate TEXT,
        objectValue TEXT,
        verificationStatus TEXT,
        createdAt DATETIME
      )
    `).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_cache_intel_clm_ws ON intelligence_claims(workspaceId)`).run();

    // 16. Intelligence Inferences Cache
    db.prepare(`
      CREATE TABLE IF NOT EXISTS intelligence_inferences (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        companyId TEXT NOT NULL,
        supportingClaimIds TEXT DEFAULT '[]',
        field TEXT,
        value TEXT,
        inferenceMethod TEXT,
        confidence REAL,
        reason TEXT,
        createdAt DATETIME
      )
    `).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_cache_intel_inf_ws ON intelligence_inferences(workspaceId)`).run();

    // 17. Settings Cache
    db.prepare(`
      CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT,
        createdAt DATETIME,
        updatedAt DATETIME
      )
    `).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_cache_settings_ws ON settings(workspaceId, key)`).run();

    // Store schema version in metadata
    db.prepare(`
      INSERT OR REPLACE INTO cache_metadata (key, value, updatedAt)
      VALUES ('schema_version', ?, datetime('now'))
    `).run(String(CACHE_SCHEMA_VERSION));
  })();
}

export type CacheState = 'CLEAN' | 'EMPTY' | 'LEGACY' | 'CORRUPT';

/**
 * Deterministically inspects an open SQLite database or file path to classify its cache state.
 */
export function detectCacheState(dbOrPath: Database.Database | string): CacheState {
  let db: Database.Database;
  let shouldClose = false;

  if (typeof dbOrPath === 'string') {
    try {
      const DatabaseConstructor = require('better-sqlite3');
      db = new DatabaseConstructor(dbOrPath);
      shouldClose = true;
    } catch {
      return 'CORRUPT';
    }
  } else {
    db = dbOrPath;
  }

  try {
    // 1. Integrity check
    const integrityRow = db.pragma('integrity_check', { simple: true }) as string;
    if (integrityRow !== 'ok') {
      return 'CORRUPT';
    }

    // 2. Inspect existing tables
    const tables = (
      db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
        .all() as Array<{ name: string }>
    ).map((r) => r.name);

    if (tables.length === 0) {
      return 'EMPTY';
    }

    // 3. Check for legacy migration or legacy sync remnants
    const legacyRemnants = ['_' + 'migrations', 'sync_' + 'queue', 'sync_' + 'metadata', 'sync_' + 'dead_letter'];
    for (const legacy of legacyRemnants) {
      if (tables.includes(legacy)) {
        return 'LEGACY';
      }
    }

    // 4. Check cache_metadata table exists
    if (!tables.includes('cache_metadata')) {
      return 'LEGACY';
    }

    // 5. Check schema_version in cache_metadata
    try {
      const versionRow = db
        .prepare("SELECT value FROM cache_metadata WHERE key = 'schema_version'")
        .get() as { value: string } | undefined;

      if (!versionRow || Number(versionRow.value) !== CACHE_SCHEMA_VERSION) {
        return 'LEGACY';
      }
    } catch {
      return 'LEGACY';
    }

    // 6. Check that all required cache tables exist
    for (const table of CACHE_TABLES) {
      if (!tables.includes(table)) {
        return 'LEGACY';
      }
    }

    return 'CLEAN';
  } catch (err) {
    return 'CORRUPT';
  } finally {
    if (shouldClose && db) {
      try {
        db.close();
      } catch {}
    }
  }
}

/**
 * Safely resets a workspace cache database:
 * Archives the old file with a timestamped .bak extension, removes SQLite lockfiles,
 * and initializes a fresh, clean cache schema.
 */
export function resetWorkspaceCache(
  workspaceId: string,
  archivePrefix: string = 'legacy_archive'
): Database.Database {
  // Dynamically import connection helpers to avoid circular dependencies
  const { getDatabase, closeDatabase } = require('./connection');

  let dbPath: string;
  try {
    const existingDb = getDatabase(workspaceId);
    dbPath = existingDb.name;
    closeDatabase(workspaceId);
  } catch {
    // If opening failed (e.g. corrupt), compute fallback path
    const { join } = require('path');
    const workspacesPath = process.env.WORKSPACES_DB_DIR || require('path').join(process.cwd(), 'report/temp-workspaces');
    dbPath = join(workspacesPath, `leadforge_${workspaceId}.db`);
  }

  const fs = require('fs');
  if (fs.existsSync(dbPath)) {
    const archivePath = `${dbPath}.${archivePrefix}_${Date.now()}.bak`;
    try {
      fs.copyFileSync(dbPath, archivePath);
    } catch (err) {
      console.warn(`[CacheReset] Failed to create backup archive for ${workspaceId}:`, err);
    }

    try {
      fs.unlinkSync(dbPath);
    } catch {}
    try {
      if (fs.existsSync(`${dbPath}-wal`)) fs.unlinkSync(`${dbPath}-wal`);
      if (fs.existsSync(`${dbPath}-shm`)) fs.unlinkSync(`${dbPath}-shm`);
    } catch {}
  }

  const newDb = getDatabase(workspaceId);
  initCacheSchema(newDb);
  return newDb;
}

/**
 * Ensures a workspace database is in a clean cache state.
 * If legacy or corrupt, safely archives and rebuilds a fresh cache.
 */
export function ensureCleanCache(
  db: Database.Database,
  workspaceId?: string
): Database.Database {
  const state = detectCacheState(db);

  if (state === 'CLEAN') {
    return db;
  }

  if (state === 'EMPTY') {
    initCacheSchema(db);
    return db;
  }

  if (workspaceId && (state === 'LEGACY' || state === 'CORRUPT')) {
    console.log(
      `[CacheLifecycle] Detected ${state} cache for workspace "${workspaceId}". Performing safe archive and clean rebuild.`
    );
    const prefix = state === 'CORRUPT' ? 'corrupt_archive' : 'legacy_archive';
    return resetWorkspaceCache(workspaceId, prefix);
  }

  // Fallback in-memory or global DB
  initCacheSchema(db);
  return db;
}

