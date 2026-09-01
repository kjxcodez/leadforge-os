import assert from 'assert';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { getDatabase, closeDatabase } from '../database/connection';

export async function runFreshDatabaseAllQueriesTest() {
  console.log('--- TESTING FRESH DATABASE ALL 15 PRODUCTION QUERIES LIFECYCLE (WP1) ---');
  const tempDir = mkdtempSync(join(tmpdir(), 'leadforge-test-wp1-'));
  const originalEnv = process.env.WORKSPACES_DB_DIR;
  process.env.WORKSPACES_DB_DIR = tempDir;

  try {
    const wsId = 'test-workspace-' + Math.random().toString(36).substring(2, 9);

    // Call getDatabase directly WITHOUT manual initCacheSchema
    const db = getDatabase(wsId);
    assert.ok(db, 'getDatabase(workspaceId) must return a valid Database instance');

    // Query 1: Dashboard companies count
    const q1 = db.prepare('SELECT COUNT(*) as count FROM companies WHERE workspaceId = ? AND deletedAt IS NULL').get(wsId) as any;
    assert.strictEqual(q1.count, 0, 'Query 1 (companies count) must return 0');

    // Query 2: Dashboard contacts count
    const q2 = db.prepare('SELECT COUNT(*) as count FROM contacts WHERE workspaceId = ? AND deletedAt IS NULL').get(wsId) as any;
    assert.strictEqual(q2.count, 0, 'Query 2 (contacts count) must return 0');

    // Query 3: Dashboard campaigns count
    const q3 = db.prepare('SELECT COUNT(*) as count FROM campaigns WHERE workspaceId = ? AND deletedAt IS NULL').get(wsId) as any;
    assert.strictEqual(q3.count, 0, 'Query 3 (campaigns count) must return 0');

    // Query 4: Dashboard sequence executions aggregate
    const q4 = db.prepare(`
      SELECT
        SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) as waiting,
        SUM(CASE WHEN status IN ('running', 'queued', 'starting') THEN 1 ELSE 0 END) as running,
        SUM(CASE WHEN status IN ('replied', 'REPLIED') THEN 1 ELSE 0 END) as replied,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) as paused,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM sequence_executions
      WHERE workspaceId = ? AND deletedAt IS NULL
    `).get(wsId) as any;
    assert.strictEqual(Number(q4?.running) || 0, 0, 'Query 4 (sequence_executions aggregate) must return running: 0');

    // Query 5: Primary email account status
    const q5 = db.prepare('SELECT status FROM email_accounts WHERE workspaceId = ? AND deletedAt IS NULL ORDER BY createdAt ASC LIMIT 1').get(wsId);
    assert.strictEqual(q5, undefined, 'Query 5 (email_accounts status) must return undefined for empty DB');

    // Query 6: Daily contacts chart data
    const q6 = db.prepare('SELECT date(createdAt) as day, COUNT(*) as count FROM contacts WHERE workspaceId = ? AND deletedAt IS NULL AND createdAt >= ? GROUP BY day').all(wsId, '2026-01-01');
    assert.deepStrictEqual(q6, [], 'Query 6 (contacts chart data) must return empty array');

    // Query 7: Daily executions chart data
    const q7 = db.prepare('SELECT date(startedAt) as day, COUNT(*) as count FROM sequence_executions WHERE workspaceId = ? AND startedAt >= ? GROUP BY day').all(wsId, '2026-01-01');
    assert.deepStrictEqual(q7, [], 'Query 7 (executions chart data) must return empty array');

    // Query 8: Companies filtered query
    const q8 = db.prepare('SELECT DISTINCT c.* FROM companies c WHERE c.workspaceId = ? AND c.deletedAt IS NULL ORDER BY c.createdAt DESC').all(wsId);
    assert.deepStrictEqual(q8, [], 'Query 8 (companies list) must return empty array');

    // Query 9: Companies distinct values
    const q9 = db.prepare('SELECT DISTINCT industry FROM companies WHERE workspaceId = ? AND deletedAt IS NULL').all(wsId);
    assert.deepStrictEqual(q9, [], 'Query 9 (companies distinct industry) must return empty array');

    // Query 10: Contacts filtered query
    const q10 = db.prepare('SELECT DISTINCT c.* FROM contacts c WHERE c.workspaceId = ? AND c.deletedAt IS NULL ORDER BY c.createdAt DESC').all(wsId);
    assert.deepStrictEqual(q10, [], 'Query 10 (contacts list) must return empty array');

    // Query 11: Contacts distinct title
    const q11 = db.prepare('SELECT DISTINCT title FROM contacts WHERE workspaceId = ? AND deletedAt IS NULL').all(wsId);
    assert.deepStrictEqual(q11, [], 'Query 11 (contacts distinct title) must return empty array');

    // Query 12: Campaign enrollment count
    const q12 = db.prepare('SELECT COUNT(id) as total FROM sequence_executions WHERE campaignId = ? AND deletedAt IS NULL').get('camp-1') as any;
    assert.strictEqual(q12.total, 0, 'Query 12 (campaign enrollments count) must return total: 0');

    // Query 13: Discovery run companies join
    const q13 = db.prepare(`
      SELECT DISTINCT c.* FROM companies c
      INNER JOIN company_discovery_runs cdr ON c.id = cdr.companyId
      WHERE cdr.workspaceId = ? AND cdr.discoveryRunId = ? AND c.deletedAt IS NULL
      ORDER BY c.createdAt DESC
    `).all(wsId, 'run-1');
    assert.deepStrictEqual(q13, [], 'Query 13 (discovery run companies join) must return empty array');

    // Query 14: Email deliveries table
    const q14 = db.prepare('SELECT * FROM email_deliveries WHERE workspaceId = ?').all(wsId);
    assert.deepStrictEqual(q14, [], 'Query 14 (email_deliveries query) must return empty array');

    // Query 15: Schema version in metadata
    const q15 = db.prepare("SELECT value FROM cache_metadata WHERE key = 'schema_version'").get() as any;
    assert.ok(q15, 'Query 15 (cache_metadata schema_version) must exist');
    assert.ok(Number(q15.value) >= 1, 'Schema version must be at least 1');

    closeDatabase(wsId);
    console.log('✅ ALL 15 PRODUCTION QUERIES PASSED ON FRESH WORKSPACE DB WITHOUT MANUAL INIT.');
  } finally {
    process.env.WORKSPACES_DB_DIR = originalEnv;
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

if (require.main === module) {
  runFreshDatabaseAllQueriesTest().catch((err) => {
    console.error('❌ Fresh database all queries test failed:', err);
    process.exit(1);
  });
}
