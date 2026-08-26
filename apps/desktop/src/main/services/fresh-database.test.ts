import Database from 'better-sqlite3';
import { runMigrations } from '../database/runner';
import assert from 'assert';

export async function runFreshDatabaseTest() {
  console.log('--- TESTING FRESH DATABASE LIFECYCLE ---');
  const db = new Database(':memory:');
  
  // Run all migrations
  runMigrations(db);

  // Check _migrations table count
  const countRow = db.prepare('SELECT count(*) as count FROM _migrations').get() as { count: number };
  assert.strictEqual(countRow.count, 32, 'Total applied migrations in _migrations must be 32 (migrations 001 through 033 with 022 omitted in history)');

  // Check final migration in _migrations table
  const migrationRow = db.prepare('SELECT name FROM _migrations ORDER BY id DESC LIMIT 1').get() as { name: string };
  assert.ok(migrationRow.name.startsWith('033'), 'Final recorded migration in _migrations must be 033');

  // Check essential tables
  const expectedTables = [
    '_migrations',
    'companies',
    'contacts',
    'campaigns',
    'sequences',
    'sequence_executions',
    'email_accounts',
    'email_deliveries',
    'templates',
    'audiences',
    'discovery_runs',
    'jobs',
    'sync_queue'
  ];

  for (const table of expectedTables) {
    const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table);
    assert.ok(exists, `Table "${table}" must exist in freshly migrated database`);
  }

  // Check idempotency: running migrations a second time must be a clean no-op
  runMigrations(db);
  const countRow2 = db.prepare('SELECT count(*) as count FROM _migrations').get() as { count: number };
  assert.strictEqual(countRow2.count, 32, 'Re-running migrations must keep total applied migrations at 32');

  // Verify default workflow presets seeded into sequences table
  const presets = db.prepare("SELECT id, name FROM sequences WHERE id LIKE 'preset_%'").all() as any[];
  assert.ok(presets.length >= 3, 'Default workflow presets must be seeded into sequences table');

  console.log('✅ Fresh database initialization, 32 migrations, and idempotency verified.');
}

if (require.main === module) {
  runFreshDatabaseTest().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
