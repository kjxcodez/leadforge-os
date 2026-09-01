import * as fs from 'fs';
import * as path from 'path';
import assert from 'assert';
import Database from 'better-sqlite3';
import {
  initCacheSchema,
  detectCacheState,
  resetWorkspaceCache,
  ensureCleanCache,
  CACHE_TABLES,
  CACHE_SCHEMA_VERSION
} from '../apps/desktop/src/main/database/cache-schema.js';
import { LocalWorkspaceRepository } from '../apps/desktop/src/main/database/repositories/local-workspace.js';
import { getDatabase, closeDatabase } from '../apps/desktop/src/main/database/connection.js';

const TEMP_DIR = path.join(process.cwd(), 'report', 'temp-cache-contract-audit');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}
process.env.WORKSPACES_DB_DIR = TEMP_DIR;

async function run() {
  console.log('========================================================================');
  console.log(' LeadForge OS — Cache Contract & Schema Reliability Verification');
  console.log('========================================================================\n');

  // Test 1: Clean initialization
  console.log('--- [Test 1] Schema Version 2 Initialization & Table Verification ---');
  const memoryDb = new Database(':memory:');
  initCacheSchema(memoryDb);
  assert.strictEqual(detectCacheState(memoryDb), 'CLEAN');

  const metaVersion = memoryDb
    .prepare("SELECT value FROM cache_metadata WHERE key = 'schema_version'")
    .get() as { value: string };
  assert.strictEqual(Number(metaVersion.value), CACHE_SCHEMA_VERSION);
  assert.strictEqual(CACHE_SCHEMA_VERSION, 2);

  const tables = (
    memoryDb.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as any[]
  ).map((r) => r.name);

  for (const t of CACHE_TABLES) {
    assert.ok(tables.includes(t), `Table ${t} should exist in cache schema`);
  }
  console.log('✅ Test 1 Passed: Version 2 schema initialized with all 12 cache tables.');

  // Test 2: Column schema verification (plan in workspaces, source in contacts)
  console.log('\n--- [Test 2] Column Schema Verification (plan & source) ---');
  const wsCols = (memoryDb.pragma('table_info(workspaces)') as any[]).map((c) => c.name);
  assert.ok(wsCols.includes('plan'), 'workspaces table must contain plan column');
  assert.ok(wsCols.includes('ownerId'), 'workspaces table must contain ownerId column');

  const contactCols = (memoryDb.pragma('table_info(contacts)') as any[]).map((c) => c.name);
  assert.ok(contactCols.includes('source'), 'contacts table must contain source column');
  assert.ok(!contactCols.includes('sourcePlatform'), 'contacts table must not contain deprecated sourcePlatform column');
  memoryDb.close();
  console.log('✅ Test 2 Passed: Workspaces and Contacts columns match canonical schema.');

  // Test 3: Legacy cache detection & safe migration
  console.log('\n--- [Test 3] Legacy Cache State Detection & Schema Migration ---');
  const legacyDbFile = path.join(TEMP_DIR, `leadforge_legacy_test_${Date.now()}.db`);
  const legacyDb = new Database(legacyDbFile);
  // Create old v1 table missing plan column
  legacyDb.prepare(`
    CREATE TABLE workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT,
      ownerId TEXT,
      settings TEXT,
      createdAt DATETIME,
      updatedAt DATETIME
    )
  `).run();
  legacyDb.prepare(`CREATE TABLE cache_metadata (key TEXT PRIMARY KEY, value TEXT)`).run();
  legacyDb.prepare(`INSERT INTO cache_metadata (key, value) VALUES ('schema_version', '1')`).run();
  legacyDb.close();

  const state = detectCacheState(legacyDbFile);
  assert.strictEqual(state, 'LEGACY', 'Legacy database must be detected as LEGACY state');

  const upgradedDb = new Database(legacyDbFile);
  ensureCleanCache(upgradedDb);
  const upgradedCols = (upgradedDb.pragma('table_info(workspaces)') as any[]).map((c) => c.name);
  assert.ok(upgradedCols.includes('plan'), 'ensureCleanCache must add missing plan column on upgrade');
  upgradedDb.close();
  console.log('✅ Test 3 Passed: Legacy cache correctly classified and upgraded.');

  // Test 4: Workspace repository CRUD with plan field
  console.log('\n--- [Test 4] LocalWorkspaceRepository CRUD with plan Field ---');
  const globalDb = getDatabase();
  ensureCleanCache(globalDb);

  const testWs = {
    id: 'ws-cache-test-' + Date.now(),
    name: 'Cache Test Workspace',
    slug: 'cache-test',
    ownerId: 'usr-owner-123',
    plan: 'growth',
    settings: { defaultTimezone: 'America/New_York' },
    members: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await LocalWorkspaceRepository.save(testWs as any);
  const retrieved = await LocalWorkspaceRepository.findById(testWs.id);
  assert.ok(retrieved, 'Saved workspace must be retrieved');
  assert.strictEqual(retrieved.plan, 'growth', 'Workspace plan must match saved value');
  assert.strictEqual(retrieved.ownerId, 'usr-owner-123');

  await LocalWorkspaceRepository.saveMany([
    {
      ...testWs,
      id: testWs.id + '-bulk-1',
      plan: 'enterprise'
    } as any,
    {
      ...testWs,
      id: testWs.id + '-bulk-2',
      plan: 'free'
    } as any
  ]);

  const allWorkspaces = await LocalWorkspaceRepository.findMany();
  assert.ok(allWorkspaces.length >= 3);
  const enterpriseWs = allWorkspaces.find((w) => w.id === testWs.id + '-bulk-1');
  assert.strictEqual(enterpriseWs?.plan, 'enterprise');

  await LocalWorkspaceRepository.delete(testWs.id);
  await LocalWorkspaceRepository.delete(testWs.id + '-bulk-1');
  await LocalWorkspaceRepository.delete(testWs.id + '-bulk-2');
  console.log('✅ Test 4 Passed: LocalWorkspaceRepository handles plan column without SqliteError.');

  // Test 5: Workspace cache reset & backup archiving
  console.log('\n--- [Test 5] Workspace Cache Reset & Backup Archive File Creation ---');
  const resetWsId = 'ws-reset-audit-' + Date.now();
  const wsDb = getDatabase(resetWsId);
  initCacheSchema(wsDb);
  wsDb.prepare("INSERT INTO companies (id, workspaceId, name) VALUES ('comp-1', ?, 'Acme Inc')").run(resetWsId);
  closeDatabase(resetWsId);

  const resetDb = resetWorkspaceCache(resetWsId, 'reliability_archive');
  const remainingCompanies = resetDb.prepare('SELECT COUNT(*) as count FROM companies WHERE workspaceId = ?').get(resetWsId) as any;
  assert.strictEqual(remainingCompanies.count, 0, 'Reset workspace cache must start fresh and empty');
  closeDatabase(resetWsId);

  const filesInDir = fs.readdirSync(TEMP_DIR);
  const archiveFile = filesInDir.find((f) => f.includes(`leadforge_${resetWsId}.db.reliability_archive`));
  assert.ok(archiveFile, 'Backup archive file (.bak) must be created on workspace reset');
  console.log(`✅ Test 5 Passed: Backup created successfully (${archiveFile}).`);

  console.log('\n========================================================================');
  console.log(' ALL 5 CACHE CONTRACT & RELIABILITY TESTS PASSED');
  console.log('========================================================================');
}

run().catch((err) => {
  console.error('❌ Cache Contract Verification Failed:', err);
  process.exit(1);
});
