import Database from 'better-sqlite3';
import { initCacheSchema, CACHE_TABLES, CACHE_SCHEMA_VERSION } from '../database/cache-schema';
import assert from 'assert';

export async function runFreshDatabaseTest() {
  console.log('--- TESTING FRESH DATABASE LIFECYCLE ---');
  const db = new Database(':memory:');
  
  // Run clean cache schema initialization
  initCacheSchema(db);

  // Check cache_metadata table
  const versionRow = db.prepare("SELECT value FROM cache_metadata WHERE key = 'schema_version'").get() as { value: string };
  assert.strictEqual(Number(versionRow.value), CACHE_SCHEMA_VERSION, `Cache schema version must be ${CACHE_SCHEMA_VERSION}`);

  // Check essential cache tables
  for (const table of CACHE_TABLES) {
    const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table);
    assert.ok(exists, `Table "${table}" must exist in fresh cache database`);
  }

  // Ensure NO legacy migration or sync infrastructure tables exist
  const legacyTables = ['_migrations', 'sync_queue', 'sync_metadata', 'sync_dead_letter'];
  for (const table of legacyTables) {
    const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table);
    assert.ok(!exists, `Legacy table "${table}" must NOT exist in fresh cache database`);
  }

  // Check idempotency: running initCacheSchema a second time must be a clean no-op
  initCacheSchema(db);
  const versionRow2 = db.prepare("SELECT value FROM cache_metadata WHERE key = 'schema_version'").get() as { value: string };
  assert.strictEqual(Number(versionRow2.value), CACHE_SCHEMA_VERSION, 'Re-running initCacheSchema must preserve cache metadata');

  console.log('✅ Fresh database initialization, cache tables, and idempotency verified.');
}

if (require.main === module) {
  runFreshDatabaseTest().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
