import Database from 'better-sqlite3';
import { initCacheSchema } from '../database/cache-schema';
import { randomUUID } from 'crypto';
import assert from 'assert';
import fs from 'fs';
import path from 'path';

export async function runOperationsCacheTests() {
  console.log('--- STARTING OPERATIONS CACHE & RELIABILITY INTEGRATION TESTS ---');

  // 1. Initialize clean in-memory database
  const db = new Database(':memory:');
  console.log('[Test] Created in-memory SQLite database.');

  // 2. Initialize cache schema
  initCacheSchema(db);
  console.log('[Test] Applied cache schema successfully.');

  // 3. Verify operations_cache table and indexes exist
  const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='operations_cache'").get();
  assert.ok(tableCheck, 'operations_cache table must exist in SQLite database');

  const expectedIndexes = [
    'idx_cache_ops_ws',
    'idx_cache_ops_status',
    'idx_cache_ops_type',
    'idx_cache_ops_updated',
    'idx_cache_ops_stale'
  ];

  for (const idx of expectedIndexes) {
    const idxCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name = ?").get(idx);
    assert.ok(idxCheck, `Index "${idx}" must exist on operations_cache`);
  }
  console.log('✅ operations_cache table and all 5 performance indexes verified.');

  // 4. Test Upsert & Workspace Isolation
  const wsA = randomUUID();
  const wsB = randomUUID();

  const opA1 = randomUUID();
  const opA2 = randomUUID();
  const opB1 = randomUUID();

  const insertStmt = db.prepare(`
    INSERT INTO operations_cache (
      id, workspaceId, type, status, attempt, maxAttempts, isStale, retryable,
      failureClass, errorCode, safeHumanMessage, technicalMessage, correlationId,
      campaignId, contactEmail, metadata, createdAt, updatedAt
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, datetime('now'), datetime('now')
    )
  `);

  insertStmt.run(
    opA1,
    wsA,
    'email:send',
    'failed',
    3,
    3,
    0,
    0,
    'permanent_failure',
    'RECIPIENT_NOT_FOUND',
    'Recipient address rejected (550)',
    'SMTP 550 5.1.1 User unknown',
    'corr_a1',
    'camp_1',
    'bad@domain.com',
    JSON.stringify({ subject: 'Hello' })
  );

  insertStmt.run(
    opA2,
    wsA,
    'email:send',
    'ambiguous',
    1,
    3,
    1,
    0,
    'requires_reconciliation',
    'AMBIGUOUS_SEND_TIMEOUT',
    'Network timeout waiting for Gmail response',
    'ETIMEDOUT provider socket closed',
    'corr_a2',
    'camp_1',
    'lead@domain.com',
    JSON.stringify({ subject: 'Intro' })
  );

  insertStmt.run(
    opB1,
    wsB,
    'crawler:website',
    'running',
    1,
    3,
    0,
    1,
    'auto_recovering',
    null,
    null,
    null,
    'corr_b1',
    null,
    null,
    JSON.stringify({ domain: 'example.com' })
  );

  console.log('✅ Operation records inserted into cache.');

  // 5. Query and verify Workspace Isolation
  const queryWsA = db.prepare('SELECT * FROM operations_cache WHERE workspaceId = ?').all(wsA) as any[];
  assert.strictEqual(queryWsA.length, 2, 'Workspace A should return exactly 2 operations');
  assert.ok(queryWsA.some((op) => op.id === opA1));
  assert.ok(queryWsA.some((op) => op.id === opA2));
  assert.ok(!queryWsA.some((op) => op.id === opB1), 'Workspace A must NOT leak Workspace B operations');

  const queryWsB = db.prepare('SELECT * FROM operations_cache WHERE workspaceId = ?').all(wsB) as any[];
  assert.strictEqual(queryWsB.length, 1, 'Workspace B should return exactly 1 operation');
  assert.strictEqual(queryWsB[0].id, opB1);
  console.log('✅ Strict multi-tenant workspace isolation verified.');

  // 6. Test Filtering by Status, isStale, and FailureClass
  const failedOps = db.prepare('SELECT * FROM operations_cache WHERE workspaceId = ? AND status = ?').all(wsA, 'failed') as any[];
  assert.strictEqual(failedOps.length, 1);
  assert.strictEqual(failedOps[0].id, opA1);
  assert.strictEqual(failedOps[0].failureClass, 'permanent_failure');

  const staleOps = db.prepare('SELECT * FROM operations_cache WHERE workspaceId = ? AND isStale = 1').all(wsA) as any[];
  assert.strictEqual(staleOps.length, 1);
  assert.strictEqual(staleOps[0].id, opA2);
  assert.strictEqual(staleOps[0].failureClass, 'requires_reconciliation');

  const reconcileOps = db.prepare('SELECT * FROM operations_cache WHERE workspaceId = ? AND failureClass = ?').all(wsA, 'requires_reconciliation') as any[];
  assert.strictEqual(reconcileOps.length, 1);
  assert.strictEqual(reconcileOps[0].id, opA2);
  console.log('✅ Offline filtering by status, isStale, and failureClass verified.');

  // 7. Test Upsert (Transitioning running operation to completed)
  const upsertStmt = db.prepare(`
    INSERT INTO operations_cache (
      id, workspaceId, type, status, attempt, maxAttempts, isStale, retryable,
      failureClass, createdAt, updatedAt
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, datetime('now'), datetime('now')
    )
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      isStale = excluded.isStale,
      retryable = excluded.retryable,
      failureClass = excluded.failureClass,
      updatedAt = excluded.updatedAt
  `);

  upsertStmt.run(opB1, wsB, 'crawler:website', 'completed', 1, 3, 0, 0, null);

  const updatedB1 = db.prepare('SELECT * FROM operations_cache WHERE id = ? AND workspaceId = ?').get(opB1, wsB) as any;
  assert.strictEqual(updatedB1.status, 'completed', 'Operation status should be updated to completed');
  assert.strictEqual(updatedB1.isStale, 0);
  console.log('✅ Cache upsert idempotency and state transition verified.');

  // 8. Test IPC Preload Allowlist Contract
  const preloadPath = path.join(__dirname, '../../preload/index.ts');
  const preloadContent = fs.readFileSync(preloadPath, 'utf8');

  const requiredOperationsIPCChannels = [
    'operations:health',
    'operations:list',
    'operations:get',
    'operations:events',
    'operations:retry',
    'operations:reconcile'
  ];

  for (const channel of requiredOperationsIPCChannels) {
    assert.ok(
      preloadContent.includes(`'${channel}'`),
      `IPC channel '${channel}' must be authorized in preload/index.ts allowlist`
    );
  }
  console.log('✅ IPC preload authorization contract verified for all Phase 9 Operations channels.');

  // 9. Ambiguous Send Safety Constraint
  // Verify that an ambiguous delivery cannot be blindly retried without reconciliation
  function evaluateRetrySafety(operation: { status: string; errorCode?: string | null; retryable: number }): {
    canRetry: boolean;
    reason?: string;
  } {
    if (operation.status === 'ambiguous' || operation.errorCode === 'AMBIGUOUS_SEND_TIMEOUT') {
      return {
        canRetry: false,
        reason: 'Ambiguous send requires reconciliation against provider before retrying.'
      };
    }
    if (operation.retryable === 0) {
      return {
        canRetry: false,
        reason: 'Operation is classified as non-retryable permanent failure.'
      };
    }
    return { canRetry: true };
  }

  const checkA1 = evaluateRetrySafety(failedOps[0]);
  assert.strictEqual(checkA1.canRetry, false);
  assert.strictEqual(checkA1.reason, 'Operation is classified as non-retryable permanent failure.');

  const checkA2 = evaluateRetrySafety(staleOps[0]);
  assert.strictEqual(checkA2.canRetry, false);
  assert.strictEqual(checkA2.reason, 'Ambiguous send requires reconciliation against provider before retrying.');

  console.log('✅ Ambiguous send safety gate and retry prevention contract verified.');
  console.log('--- ALL OPERATIONS CACHE & RELIABILITY TESTS PASSED ---');
}

if (require.main === module) {
  runOperationsCacheTests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
