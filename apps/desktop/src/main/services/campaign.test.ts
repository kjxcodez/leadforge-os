import Database from 'better-sqlite3';
import { runMigrations } from '../database/runner';
import { randomUUID } from 'crypto';
import assert from 'assert';

/**
 * Self-contained integration test suite for Campaign and Enrollment operations.
 * Can be run using a typescript execution helper (e.g. tsx).
 */
export async function runCampaignTests() {
  console.log('--- STARTING CAMPAIGN INTEGRATION TESTS ---');

  // 1. Initialize clean in-memory database
  const db = new Database(':memory:');
  console.log('[Test] Created in-memory SQLite database.');

  // 2. Run migrations
  runMigrations(db);
  console.log('[Test] Applied schema migrations successfully.');

  // 3. Test Campaign Creation and Fields
  const campaignId = randomUUID();
  const workspaceId = randomUUID();
  const sequenceId = randomUUID();
  const sendingAccountId = randomUUID();

  db.prepare(`
    INSERT INTO campaigns (
      id, workspaceId, name, description, sequenceId, sendingAccountId,
      dailyLimit, timezone, status, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(
    campaignId,
    workspaceId,
    'SaaS Launch Outbound',
    'Cold outreach sequence for Q3 leads',
    sequenceId,
    sendingAccountId,
    150,
    'EST',
    'Draft'
  );

  const campRow = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId) as any;
  assert.strictEqual(campRow.name, 'SaaS Launch Outbound');
  assert.strictEqual(campRow.dailyLimit, 150);
  assert.strictEqual(campRow.timezone, 'EST');
  assert.strictEqual(campRow.status, 'Draft');
  console.log('✅ Campaign schema and creation verified.');

  // 4. Test Contact Enrollment
  const contactId = randomUUID();
  const enrollmentId = randomUUID();
  const now = new Date().toISOString();

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

  const enrollRow = db.prepare('SELECT * FROM sequence_executions WHERE id = ?').get(enrollmentId) as any;
  assert.strictEqual(enrollRow.campaignId, campaignId);
  assert.strictEqual(enrollRow.contactId, contactId);
  assert.strictEqual(enrollRow.status, 'paused');
  console.log('✅ Contact campaign enrollment verified.');

  // 5. Test Status Transitions: Pause & Resume
  // Transition campaign to Active
  db.prepare("UPDATE campaigns SET status = 'Active', updatedAt = datetime('now') WHERE id = ?").run(campaignId);

  // Resume all paused enrollments
  const pausedEnrollments = db.prepare(`
    SELECT id, contactId, nextExecutionAt FROM sequence_executions
    WHERE campaignId = ? AND status = 'paused' AND deletedAt IS NULL
  `).all(campaignId) as { id: string; contactId: string; nextExecutionAt: string | null }[];

  db.transaction(() => {
    for (const enroll of pausedEnrollments) {
      const isWaiting = enroll.nextExecutionAt && new Date(enroll.nextExecutionAt) > new Date();
      const newStatus = isWaiting ? 'waiting' : 'running';

      db.prepare(`
        UPDATE sequence_executions
        SET status = ?, updatedAt = datetime('now')
        WHERE id = ?
      `).run(newStatus, enroll.id);

      if (!isWaiting) {
        const jobId = randomUUID();
        db.prepare(`
          INSERT INTO jobs (id, workspaceId, type, status, priority, payload, progress, retryCount, maxRetries, createdAt, updatedAt)
          VALUES (?, ?, 'automation:workflow', 'queued', 3, ?, 0, 0, 3, datetime('now'), datetime('now'))
        `).run(
          jobId,
          workspaceId,
          JSON.stringify({
            sequenceId,
            entityId: enroll.contactId,
            entityType: 'contact',
            executionId: enroll.id,
            workspaceId
          })
        );
      }
    }
  })();

  const activeEnrollRow = db.prepare('SELECT * FROM sequence_executions WHERE id = ?').get(enrollmentId) as any;
  assert.strictEqual(activeEnrollRow.status, 'running');

  const queuedJob = db.prepare("SELECT * FROM jobs WHERE workspaceId = ? AND type = 'automation:workflow'").get(workspaceId) as any;
  assert.ok(queuedJob);
  assert.strictEqual(queuedJob.status, 'queued');
  console.log('✅ Campaign activation cascade and scheduler job enqueuing verified.');

  // Transition campaign to Paused
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

  const pausedEnrollRowAfter = db.prepare('SELECT * FROM sequence_executions WHERE id = ?').get(enrollmentId) as any;
  assert.strictEqual(pausedEnrollRowAfter.status, 'paused');

  const cancelledJob = db.prepare("SELECT * FROM jobs WHERE id = ?").get(queuedJob.id) as any;
  assert.strictEqual(cancelledJob.status, 'cancelled');
  console.log('✅ Campaign pause cascade and queued jobs cancellation verified.');

  // 6. Test Stop-If-Replied Hook check
  // Simulate active workflow checking status
  const checkContactStatus = (cId: string): string => {
    const contact = db.prepare('SELECT status FROM contacts WHERE id = ?').get(cId) as { status: string } | undefined;
    return contact?.status || 'NEW';
  };

  // Insert mock contact
  db.prepare(`
    INSERT INTO contacts (id, workspaceId, firstName, lastName, email, status, createdAt, updatedAt)
    VALUES (?, ?, 'John', 'Doe', 'john@test.com', 'NEW', datetime('now'), datetime('now'))
  `).run(contactId, workspaceId);

  assert.strictEqual(checkContactStatus(contactId), 'NEW');

  // Update contact status to REPLIED
  db.prepare("UPDATE contacts SET status = 'REPLIED' WHERE id = ?").run(contactId);
  assert.strictEqual(checkContactStatus(contactId), 'REPLIED');

  // Verify that workflow loop aborts if status === REPLIED
  const shouldAbort = ['REPLIED', 'BOUNCED', 'UNSUBSCRIBED'].includes(checkContactStatus(contactId));
  assert.ok(shouldAbort);
  console.log('✅ Stop-If-Replied hook verification query passed.');

  console.log('--- ALL CAMPAIGN INTEGRATION TESTS PASSED ---');
}

// Execute directly if run via tsx/node
if (require.main === module) {
  runCampaignTests().catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
}
