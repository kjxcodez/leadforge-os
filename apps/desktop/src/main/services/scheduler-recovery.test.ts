import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import assert from 'assert';

console.log('--- Testing Scheduler WAITING Execution Recovery (Invariants 11 & 12) ---');

const db = new Database(':memory:');
const workspaceId = randomUUID();

// Create schema matching LeadForge OS sequence_executions
db.exec(`
  CREATE TABLE sequence_executions (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL,
    sequenceId TEXT NOT NULL,
    contactId TEXT NOT NULL,
    campaignId TEXT,
    currentStep INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'WAITING',
    nextExecutionAt TEXT,
    deletedAt TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const execDueId = randomUUID();
const execFutureId = randomUUID();

// Insert two executions: one due in past, one in future
db.prepare(`
  INSERT INTO sequence_executions (id, workspaceId, sequenceId, contactId, campaignId, status, nextExecutionAt)
  VALUES (?, ?, 'seq-1', 'contact-1', 'camp-1', 'WAITING', datetime('now', '-10 seconds'))
`).run(execDueId, workspaceId);

db.prepare(`
  INSERT INTO sequence_executions (id, workspaceId, sequenceId, contactId, campaignId, status, nextExecutionAt)
  VALUES (?, ?, 'seq-2', 'contact-2', 'camp-1', 'WAITING', datetime('now', '+300 seconds'))
`).run(execFutureId, workspaceId);

// 1. Invariant 11: Scan for due executions
const dueExecutions = db.prepare(`
  SELECT id, sequenceId, contactId, campaignId
  FROM sequence_executions
  WHERE workspaceId = ?
    AND UPPER(status) = 'WAITING'
    AND nextExecutionAt IS NOT NULL
    AND nextExecutionAt <= datetime('now')
    AND deletedAt IS NULL
  LIMIT 20
`).all(workspaceId) as Array<{ id: string; sequenceId: string; contactId: string }>;

assert.strictEqual(dueExecutions.length, 1, 'Expected exactly 1 due execution');
assert.strictEqual(dueExecutions[0]!.id, execDueId, 'Expected due execution ID match');
console.log('✅ Invariant 11: Correctly identified only due WAITING execution');

// 2. Invariant 12: Atomic Claim (Compare-and-Swap)
// Worker 1 claims:
const claimResult1 = db.prepare(`
  UPDATE sequence_executions
  SET status = 'RUNNING', updatedAt = datetime('now')
  WHERE id = ? AND UPPER(status) = 'WAITING'
`).run(execDueId);

assert.strictEqual(claimResult1.changes, 1, 'Worker 1 claim must return changes === 1');
console.log('✅ Invariant 12a: Worker 1 claimed due execution atomically');

// Worker 2 attempts concurrent claim on same execution:
const claimResult2 = db.prepare(`
  UPDATE sequence_executions
  SET status = 'RUNNING', updatedAt = datetime('now')
  WHERE id = ? AND UPPER(status) = 'WAITING'
`).run(execDueId);

assert.strictEqual(claimResult2.changes, 0, 'Worker 2 double claim must be rejected with changes === 0');
console.log('✅ Invariant 12b: Worker 2 rejected with 0 changes (double recovery impossible)');

// 3. Confirm execution status is now RUNNING
const finalRow = db.prepare('SELECT status FROM sequence_executions WHERE id = ?').get(execDueId) as any;
assert.strictEqual(finalRow.status, 'RUNNING', 'Final execution status must be RUNNING');
console.log('✅ Execution successfully transitioned to RUNNING');

db.close();
console.log('ALL SCHEDULER RECOVERY INVARIANTS PASSED!');
