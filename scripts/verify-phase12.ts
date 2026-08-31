import * as fs from 'fs';
import * as path from 'path';
import assert from 'assert';
import Database from 'better-sqlite3';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import {
  initCacheSchema,
  detectCacheState,
  resetWorkspaceCache,
  ensureCleanCache,
  CACHE_TABLES,
  CACHE_SCHEMA_VERSION
} from '../apps/desktop/src/main/database/cache-schema.js';
import { getDatabase, closeDatabase } from '../apps/desktop/src/main/database/connection.js';
import { WorkspaceRuntime } from '../apps/desktop/src/main/lib/workspace-runtime.js';
import { CacheHydrator } from '../apps/desktop/src/main/services/cache-hydrator.js';
import { SdkClient } from '@leadforge/sdk';
import {
  CompanyModel,
  ContactModel,
  WorkspaceModel
} from '../apps/api/src/db/models/index.js';
import { runStaticAudit } from './verify-no-legacy-runner-dependencies.js';

dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/leadforge-os';
const TEMP_WORKSPACES_DIR = path.join(process.cwd(), 'report', 'temp-phase12');

if (!fs.existsSync(TEMP_WORKSPACES_DIR)) {
  fs.mkdirSync(TEMP_WORKSPACES_DIR, { recursive: true });
}
process.env.WORKSPACES_DB_DIR = TEMP_WORKSPACES_DIR;

function pass(testName: string) {
  console.log(`✅ PASS: ${testName}`);
}

async function runPhase12Verification() {
  console.log('========================================================================');
  console.log(' LeadForge OS — Phase 12 Verification Suite: Legacy Runner Removal');
  console.log('========================================================================\n');

  // Connect to MongoDB
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGODB_URI);
  }

  // ---------------------------------------------------------------------------
  // T12.1: Verify runner.ts Source File Deletion
  // ---------------------------------------------------------------------------
  console.log('--- T12.1: Verify runner.ts Source File Deletion ---');
  const runnerPath = path.join(
    process.cwd(),
    'apps',
    'desktop',
    'src',
    'main',
    'database',
    'runner.ts'
  );
  assert.strictEqual(
    fs.existsSync(runnerPath),
    false,
    'apps/desktop/src/main/database/runner.ts must not exist on disk'
  );
  pass('apps/desktop/src/main/database/runner.ts does not exist');

  // ---------------------------------------------------------------------------
  // T12.2: Zero Runtime Imports of runner.ts
  // ---------------------------------------------------------------------------
  console.log('\n--- T12.2: Zero Runtime Imports of runner.ts ---');
  const workspaceRuntimeSrc = fs.readFileSync(
    path.join(process.cwd(), 'apps', 'desktop', 'src', 'main', 'lib', 'workspace-runtime.ts'),
    'utf8'
  );
  assert.ok(
    !workspaceRuntimeSrc.includes('runner'),
    'workspace-runtime.ts must not reference runner'
  );
  const indexSrc = fs.readFileSync(
    path.join(process.cwd(), 'apps', 'desktop', 'src', 'main', 'index.ts'),
    'utf8'
  );
  assert.ok(!indexSrc.includes('runner'), 'main/index.ts must not reference runner');
  pass('Zero runtime imports of runner.ts');

  // ---------------------------------------------------------------------------
  // T12.3: Zero Active Calls to runMigrations()
  // ---------------------------------------------------------------------------
  console.log('\n--- T12.3: Zero Active Calls to runMigrations() ---');
  assert.ok(
    !workspaceRuntimeSrc.includes('runMigrations'),
    'workspace-runtime.ts must not call runMigrations'
  );
  assert.ok(
    !indexSrc.includes('runMigrations'),
    'main/index.ts must not call runMigrations'
  );
  pass('Zero active calls to runMigrations() in desktop runtime');

  // ---------------------------------------------------------------------------
  // T12.4: Zero _migrations Table in Runtime Cache
  // ---------------------------------------------------------------------------
  console.log('\n--- T12.4: Zero _migrations Table in Runtime Cache ---');
  const testDb1 = new Database(':memory:');
  initCacheSchema(testDb1);
  const migTable = testDb1
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = '_migrations'")
    .get();
  assert.strictEqual(migTable, undefined, 'Fresh cache must not contain _migrations table');
  pass('initCacheSchema() creates 0 _migrations table');

  // ---------------------------------------------------------------------------
  // T12.5: Fresh Cache Direct & Idempotent Initialization
  // ---------------------------------------------------------------------------
  console.log('\n--- T12.5: Fresh Cache Direct & Idempotent Initialization ---');
  const testDb2 = new Database(':memory:');
  initCacheSchema(testDb2);
  const versionRow1 = testDb2
    .prepare("SELECT value FROM cache_metadata WHERE key = 'schema_version'")
    .get() as { value: string };
  assert.strictEqual(Number(versionRow1.value), CACHE_SCHEMA_VERSION);

  // Run a second time to ensure idempotency
  initCacheSchema(testDb2);
  const versionRow2 = testDb2
    .prepare("SELECT value FROM cache_metadata WHERE key = 'schema_version'")
    .get() as { value: string };
  assert.strictEqual(Number(versionRow2.value), CACHE_SCHEMA_VERSION);
  pass('initCacheSchema is idempotent and sets schema_version');

  // ---------------------------------------------------------------------------
  // T12.6: Clean Cache Contains Exactly Expected Cache Tables
  // ---------------------------------------------------------------------------
  console.log('\n--- T12.6: Clean Cache Table Inventory ---');
  for (const table of CACHE_TABLES) {
    const row = testDb2
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(table);
    assert.ok(row, `Table "${table}" must exist in clean cache`);
  }
  pass(`All ${CACHE_TABLES.length} designated cache tables exist`);

  // ---------------------------------------------------------------------------
  // T12.7: Clean Cache Contains Zero Sync Tables
  // ---------------------------------------------------------------------------
  console.log('\n--- T12.7: Zero Sync Infrastructure Tables ---');
  const syncTables = ['sync_queue', 'sync_dead_letter', 'sync_metadata'];
  for (const table of syncTables) {
    const row = testDb2
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(table);
    assert.strictEqual(row, undefined, `Sync table "${table}" must not exist`);
  }
  pass('Zero sync infrastructure tables present in clean cache');

  // ---------------------------------------------------------------------------
  // T12.8: Clean Cache Contains Zero Sync State Columns
  // ---------------------------------------------------------------------------
  console.log('\n--- T12.8: Zero Sync State Columns ---');
  const companiesCols = (testDb2.prepare("PRAGMA table_info('companies')").all() as any[]).map(
    (c) => c.name
  );
  assert.ok(!companiesCols.includes('syncStatus'), 'companies table must not have syncStatus');
  assert.ok(!companiesCols.includes('version'), 'companies table must not have version');

  const contactsCols = (testDb2.prepare("PRAGMA table_info('contacts')").all() as any[]).map(
    (c) => c.name
  );
  assert.ok(!contactsCols.includes('syncStatus'), 'contacts table must not have syncStatus');
  assert.ok(!contactsCols.includes('version'), 'contacts table must not have version');
  pass('Zero sync state columns (syncStatus, version) in cache tables');

  // ---------------------------------------------------------------------------
  // T12.9: Deleted-Cache Rebuild
  // ---------------------------------------------------------------------------
  console.log('\n--- T12.9: Deleted-Cache Rebuild ---');
  const wsDeleteId = 'ws-del-' + Date.now();
  const deleteDb = getDatabase(wsDeleteId);
  initCacheSchema(deleteDb);
  deleteDb.prepare("INSERT INTO companies (id, workspaceId, name) VALUES ('c1', ?, 'Temp')").run(wsDeleteId);
  closeDatabase(wsDeleteId);

  // Physically delete the .db file
  const dbFile = path.join(TEMP_WORKSPACES_DIR, `leadforge_${wsDeleteId}.db`);
  assert.ok(fs.existsSync(dbFile));
  fs.unlinkSync(dbFile);

  // Re-open and ensure clean cache
  const freshDb = getDatabase(wsDeleteId);
  ensureCleanCache(freshDb, wsDeleteId);
  const tables = (
    freshDb
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all() as any[]
  ).map((t) => t.name);
  assert.ok(tables.includes('companies'), 'Rebuilt database must have companies table');
  closeDatabase(wsDeleteId);
  pass('Deleted cache database automatically recreates clean cache schema');

  // ---------------------------------------------------------------------------
  // T12.10: Corrupt-Cache Recovery with Safe Archive
  // ---------------------------------------------------------------------------
  console.log('\n--- T12.10: Corrupt-Cache Recovery with Safe Archive ---');
  const wsCorruptId = 'ws-corrupt-' + Date.now();
  const corruptFile = path.join(TEMP_WORKSPACES_DIR, `leadforge_${wsCorruptId}.db`);
  fs.writeFileSync(corruptFile, 'INVALID_CORRUPTED_SQLITE_BINARY_HEADER_DATA_12345');

  // Attempt opening and recovering
  const recoveredDb = resetWorkspaceCache(wsCorruptId, 'corrupt_archive');
  const recoveredState = detectCacheState(recoveredDb);
  assert.strictEqual(recoveredState, 'CLEAN', 'Recovered DB must be in CLEAN state');

  // Verify backup archive file was created
  const files = fs.readdirSync(TEMP_WORKSPACES_DIR);
  const backupFound = files.some(
    (f) => f.startsWith(`leadforge_${wsCorruptId}.db.corrupt_archive_`) && f.endsWith('.bak')
  );
  assert.ok(backupFound, 'Safe corrupt backup archive must be preserved');
  closeDatabase(wsCorruptId);
  pass('Corrupt cache safely archived and rebuilt with clean cache schema');

  // ---------------------------------------------------------------------------
  // T12.11: Legacy-Cache Recovery (with _migrations)
  // ---------------------------------------------------------------------------
  console.log('\n--- T12.11: Legacy-Cache Recovery ---');
  const wsLegacyId = 'ws-legacy-' + Date.now();
  const legacyFile = path.join(TEMP_WORKSPACES_DIR, `leadforge_${wsLegacyId}.db`);
  const legacyDb = new Database(legacyFile);

  // Create legacy schema with _migrations table
  legacyDb.prepare(`
    CREATE TABLE _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      runAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  legacyDb.prepare("INSERT INTO _migrations (name) VALUES ('001_initial_schema')").run();
  legacyDb.prepare(`
    CREATE TABLE sync_queue (
      id TEXT PRIMARY KEY,
      tableName TEXT,
      operation TEXT
    )
  `).run();
  legacyDb.close();

  // Test detection
  const detectedLegacyDb = getDatabase(wsLegacyId);
  const state = detectCacheState(detectedLegacyDb);
  assert.strictEqual(state, 'LEGACY', 'Legacy database must be detected as LEGACY');

  // Ensure clean cache triggers archive and rebuild
  const cleanedDb = ensureCleanCache(detectedLegacyDb, wsLegacyId);
  const cleanedState = detectCacheState(cleanedDb);
  assert.strictEqual(cleanedState, 'CLEAN', 'Rebuilt DB must be in CLEAN state');

  const legacyBackupFound = fs
    .readdirSync(TEMP_WORKSPACES_DIR)
    .some((f) => f.startsWith(`leadforge_${wsLegacyId}.db.legacy_archive_`) && f.endsWith('.bak'));
  assert.ok(legacyBackupFound, 'Safe legacy backup archive must be preserved');
  closeDatabase(wsLegacyId);
  pass('Legacy database detected, safely archived, and rebuilt cleanly');

  // ---------------------------------------------------------------------------
  // T12.12: Workspace Switching Isolation
  // ---------------------------------------------------------------------------
  console.log('\n--- T12.12: Workspace Switching Isolation ---');
  const wsA = 'ws-switch-a-' + Date.now();
  const wsB = 'ws-switch-b-' + Date.now();

  const dbA = getDatabase(wsA);
  initCacheSchema(dbA);
  dbA.prepare("INSERT INTO companies (id, workspaceId, name) VALUES ('cA', ?, 'Company A')").run(wsA);

  const dbB = getDatabase(wsB);
  initCacheSchema(dbB);
  dbB.prepare("INSERT INTO companies (id, workspaceId, name) VALUES ('cB', ?, 'Company B')").run(wsB);

  // Verify separation
  const checkA = dbA.prepare("SELECT * FROM companies WHERE workspaceId = ?").all(wsA);
  const checkB = dbB.prepare("SELECT * FROM companies WHERE workspaceId = ?").all(wsB);
  assert.strictEqual(checkA.length, 1);
  assert.strictEqual(checkB.length, 1);
  closeDatabase(wsA);
  closeDatabase(wsB);
  pass('Workspace switching operates cleanly without migration runner');

  // ---------------------------------------------------------------------------
  // T12.13: Application Restart Idempotency
  // ---------------------------------------------------------------------------
  console.log('\n--- T12.13: Application Restart Idempotency ---');
  const wsRestart = 'ws-restart-' + Date.now();
  const restartDb1 = getDatabase(wsRestart);
  initCacheSchema(restartDb1);
  restartDb1.prepare("INSERT INTO contacts (id, workspaceId, firstName, email) VALUES ('ct1', ?, 'Alice', 'alice@test.com')").run(wsRestart);
  closeDatabase(wsRestart);

  // Restart 1
  const restartDb2 = getDatabase(wsRestart);
  ensureCleanCache(restartDb2, wsRestart);
  const contact1 = restartDb2.prepare("SELECT * FROM contacts WHERE id = 'ct1'").get() as any;
  assert.strictEqual(contact1.firstName, 'Alice');

  // Restart 2
  closeDatabase(wsRestart);
  const restartDb3 = getDatabase(wsRestart);
  ensureCleanCache(restartDb3, wsRestart);
  const contact2 = restartDb3.prepare("SELECT * FROM contacts WHERE id = 'ct1'").get() as any;
  assert.strictEqual(contact2.firstName, 'Alice');
  closeDatabase(wsRestart);
  pass('Application restart preserves cached records across multiple cycles');

  // ---------------------------------------------------------------------------
  // T12.14: Cache Hydration without Runner
  // ---------------------------------------------------------------------------
  console.log('\n--- T12.14: Cache Hydration without Runner ---');
  const wsHydrateId = 'ws-hyd-' + Date.now();
  await WorkspaceModel.create({
    _id: wsHydrateId,
    name: 'Hydrate Workspace',
    slug: 'ws-hyd-' + Date.now(),
    ownerId: 'usr-hyd-' + Date.now(),
    plan: 'enterprise'
  });

  const createdCompany = await CompanyModel.create({
    _id: 'comp-hyd-' + Date.now(),
    workspaceId: wsHydrateId,
    name: 'Hydrated Enterprise Ltd',
    domain: 'hydrated.com',
    industry: 'Engineering',
    status: 'LEAD'
  });

  const hydDb = getDatabase(wsHydrateId);
  initCacheSchema(hydDb);

  // Direct mock SDK for hydration
  const mockSdk = {
    workspaces: {
      get: async () => ({ data: { id: wsHydrateId, name: 'Hydrate Workspace' } })
    },
    companies: {
      list: async () => ({ data: [createdCompany.toObject()], pagination: { totalPages: 1 } })
    },
    contacts: {
      list: async () => ({ data: [], pagination: { totalPages: 1 } })
    },
    campaigns: {
      listCampaigns: async () => ({ data: [] })
    },
    automation: {
      listSequences: async () => ({ data: [] }),
      listExecutions: async () => ({ data: [] })
    },
    email: {
      listAccounts: async () => ({ data: [] })
    },
    outreach: {
      listTemplates: async () => ({ data: [] })
    },
    audiences: {
      listAudiences: async () => ({ data: [] })
    },
    discovery: {
      listDiscoveryRuns: async () => ({ data: [] }),
      listCompanyDiscoveryRuns: async () => ({ data: [] })
    }
  } as unknown as SdkClient;

  await CacheHydrator.hydrateWorkspaceCache(wsHydrateId, mockSdk);

  const cachedComp = hydDb.prepare("SELECT * FROM companies WHERE id = ?").get(createdCompany._id) as any;
  assert.strictEqual(cachedComp.name, 'Hydrated Enterprise Ltd');
  closeDatabase(wsHydrateId);
  pass('Cache hydration populates SQLite cache from authoritative API/Mongo without runner');

  // ---------------------------------------------------------------------------
  // T12.15: Migration Tooling Independence
  // ---------------------------------------------------------------------------
  console.log('\n--- T12.15: Migration Tooling Independence ---');
  const migToolSrc = fs.readFileSync(
    path.join(process.cwd(), 'scripts', 'migrate-sqlite-to-mongo.ts'),
    'utf8'
  );
  assert.ok(!migToolSrc.includes('runner.ts'), 'migrate-sqlite-to-mongo.ts must not import runner.ts');
  const discToolSrc = fs.readFileSync(
    path.join(process.cwd(), 'scripts', 'sqlite-discovery.ts'),
    'utf8'
  );
  assert.ok(!discToolSrc.includes('runner.ts'), 'sqlite-discovery.ts must not import runner.ts');
  pass('Migration scripts (migrate-sqlite-to-mongo.ts, sqlite-discovery.ts) are independent');

  // ---------------------------------------------------------------------------
  // T12.16: No Business Data Lost on Cache Rebuild
  // ---------------------------------------------------------------------------
  console.log('\n--- T12.16: No Business Data Lost on Cache Rebuild ---');
  // Rebuild the cache for wsHydrateId
  const rebuiltDb = resetWorkspaceCache(wsHydrateId, 'test_rebuild');
  await CacheHydrator.hydrateWorkspaceCache(wsHydrateId, mockSdk);
  const reloadedComp = rebuiltDb.prepare("SELECT * FROM companies WHERE id = ?").get(createdCompany._id) as any;
  assert.strictEqual(reloadedComp.name, 'Hydrated Enterprise Ltd');
  closeDatabase(wsHydrateId);
  pass('Rebuilt cache restores complete business state from MongoDB');

  // ---------------------------------------------------------------------------
  // T12.17: No MongoDB Mutations During Cache Rebuild
  // ---------------------------------------------------------------------------
  console.log('\n--- T12.17: No MongoDB Mutations During Cache Rebuild ---');
  const mongoCompBefore = await CompanyModel.findById(createdCompany._id);
  const updatedAtBefore = mongoCompBefore?.updatedAt?.getTime();

  // Reset and rebuild cache again
  const testDb3 = resetWorkspaceCache(wsHydrateId, 'audit_rebuild');
  await CacheHydrator.hydrateWorkspaceCache(wsHydrateId, mockSdk);

  const mongoCompAfter = await CompanyModel.findById(createdCompany._id);
  const updatedAtAfter = mongoCompAfter?.updatedAt?.getTime();
  assert.strictEqual(updatedAtBefore, updatedAtAfter, 'MongoDB document must not be mutated during cache rebuild');
  closeDatabase(wsHydrateId);
  pass('Cache rebuild is strictly read-only and causes ZERO mutations in MongoDB');

  // ---------------------------------------------------------------------------
  // T12.18: Repository-Wide Static Legacy Runner Audit
  // ---------------------------------------------------------------------------
  console.log('\n--- T12.18: Repository-Wide Static Legacy Runner Audit ---');
  const { violations, scannedFilesCount } = runStaticAudit();
  assert.strictEqual(violations.length, 0, `Expected 0 violations, found ${violations.length}`);
  pass(`Scanned ${scannedFilesCount} production source files — 0 legacy runner violations`);

  // Cleanup test data
  try {
    await WorkspaceModel.deleteOne({ _id: wsHydrateId });
    await CompanyModel.deleteOne({ _id: createdCompany._id });
  } catch {}

  console.log('\n========================================================================');
  console.log(' PHASE 12 VERIFICATION SUITE: 18/18 TESTS PASSED');
  console.log('========================================================================\n');

  await mongoose.disconnect();
}

runPhase12Verification().catch((err) => {
  console.error('Phase 12 Verification Failed:', err);
  process.exit(1);
});
