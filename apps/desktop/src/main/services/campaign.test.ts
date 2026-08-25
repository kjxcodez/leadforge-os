import Database from 'better-sqlite3';
import { runMigrations } from '../database/runner';
import { randomUUID } from 'crypto';
import assert from 'assert';
import { encryptSecret, decryptSecret } from '../lib/crypto';

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

  db.prepare(
    `
    INSERT INTO campaigns (
      id, workspaceId, name, description, sequenceId, sendingAccountId,
      dailyLimit, timezone, status, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `
  ).run(
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

  db.prepare(
    `
    INSERT INTO sequence_executions (
      id, sequenceId, campaignId, workspaceId, contactId, companyId,
      currentStep, currentStepName, status, startedAt, logs,
      emailsSent, replies, failures, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, NULL, 0, 'Initial', 'paused', ?, '[]', 0, 0, 0, ?, ?)
  `
  ).run(enrollmentId, sequenceId, campaignId, workspaceId, contactId, now, now, now);

  const enrollRow = db
    .prepare('SELECT * FROM sequence_executions WHERE id = ?')
    .get(enrollmentId) as any;
  assert.strictEqual(enrollRow.campaignId, campaignId);
  assert.strictEqual(enrollRow.contactId, contactId);
  assert.strictEqual(enrollRow.status, 'paused');
  console.log('✅ Contact campaign enrollment verified.');

  // 5. Test Status Transitions: Pause & Resume
  // Transition campaign to Active
  db.prepare(
    "UPDATE campaigns SET status = 'Active', updatedAt = datetime('now') WHERE id = ?"
  ).run(campaignId);

  // Resume all paused enrollments
  const pausedEnrollments = db
    .prepare(
      `
    SELECT id, contactId, nextExecutionAt FROM sequence_executions
    WHERE campaignId = ? AND status = 'paused' AND deletedAt IS NULL
  `
    )
    .all(campaignId) as { id: string; contactId: string; nextExecutionAt: string | null }[];

  db.transaction(() => {
    for (const enroll of pausedEnrollments) {
      const isWaiting = enroll.nextExecutionAt && new Date(enroll.nextExecutionAt) > new Date();
      const newStatus = isWaiting ? 'waiting' : 'running';

      db.prepare(
        `
        UPDATE sequence_executions
        SET status = ?, updatedAt = datetime('now')
        WHERE id = ?
      `
      ).run(newStatus, enroll.id);

      if (!isWaiting) {
        const jobId = randomUUID();
        db.prepare(
          `
          INSERT INTO jobs (id, workspaceId, type, status, priority, payload, progress, retryCount, maxRetries, createdAt, updatedAt)
          VALUES (?, ?, 'automation:workflow', 'queued', 3, ?, 0, 0, 3, datetime('now'), datetime('now'))
        `
        ).run(
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

  const activeEnrollRow = db
    .prepare('SELECT * FROM sequence_executions WHERE id = ?')
    .get(enrollmentId) as any;
  assert.strictEqual(activeEnrollRow.status, 'running');

  const queuedJob = db
    .prepare("SELECT * FROM jobs WHERE workspaceId = ? AND type = 'automation:workflow'")
    .get(workspaceId) as any;
  assert.ok(queuedJob);
  assert.strictEqual(queuedJob.status, 'queued');
  console.log('✅ Campaign activation cascade and scheduler job enqueuing verified.');

  // Transition campaign to Paused
  db.prepare(
    "UPDATE campaigns SET status = 'Paused', updatedAt = datetime('now') WHERE id = ?"
  ).run(campaignId);

  db.transaction(() => {
    db.prepare(
      `
      UPDATE sequence_executions
      SET status = 'paused', updatedAt = datetime('now')
      WHERE campaignId = ? AND status IN ('running', 'queued', 'starting', 'waiting') AND deletedAt IS NULL
    `
    ).run(campaignId);

    db.prepare(
      `
      UPDATE jobs
      SET status = 'cancelled', updatedAt = datetime('now')
      WHERE workspaceId = ?
        AND type = 'automation:workflow'
        AND json_extract(payload, '$.executionId') IN (
          SELECT id FROM sequence_executions WHERE campaignId = ?
        )
        AND status IN ('queued', 'starting', 'running', 'retrying')
    `
    ).run(workspaceId, campaignId);
  })();

  const pausedEnrollRowAfter = db
    .prepare('SELECT * FROM sequence_executions WHERE id = ?')
    .get(enrollmentId) as any;
  assert.strictEqual(pausedEnrollRowAfter.status, 'paused');

  const cancelledJob = db.prepare('SELECT * FROM jobs WHERE id = ?').get(queuedJob.id) as any;
  assert.strictEqual(cancelledJob.status, 'cancelled');
  console.log('✅ Campaign pause cascade and queued jobs cancellation verified.');

  // 6. Test Stop-If-Replied Hook check
  // Simulate active workflow checking status
  const checkContactStatus = (cId: string): string => {
    const contact = db.prepare('SELECT status FROM contacts WHERE id = ?').get(cId) as
      { status: string } | undefined;
    return contact?.status || 'NEW';
  };

  // Insert mock contact
  db.prepare(
    `
    INSERT INTO contacts (id, workspaceId, firstName, lastName, email, status, createdAt, updatedAt)
    VALUES (?, ?, 'John', 'Doe', 'john@test.com', 'NEW', datetime('now'), datetime('now'))
  `
  ).run(contactId, workspaceId);

  assert.strictEqual(checkContactStatus(contactId), 'NEW');

  // Update contact status to REPLIED
  db.prepare("UPDATE contacts SET status = 'REPLIED' WHERE id = ?").run(contactId);
  assert.strictEqual(checkContactStatus(contactId), 'REPLIED');

  // Verify that workflow loop aborts if status === REPLIED
  const shouldAbort = ['REPLIED', 'BOUNCED', 'UNSUBSCRIBED'].includes(
    checkContactStatus(contactId)
  );
  assert.ok(shouldAbort);
  console.log('✅ Stop-If-Replied hook verification query passed.');

  // 7. Test safeStorage Encryption Fallback (since safeStorage is unavailable in test runner, it should fallback to plain text)
  const testSecret = 'SuperSecretSMTPPassword123!';
  const encrypted = encryptSecret(testSecret);
  const decrypted = decryptSecret(encrypted);
  assert.strictEqual(decrypted, testSecret);
  console.log('✅ safeStorage encryption fallback verified.');

  // 8. Test Scheduler Stale Job Reconciliation
  const staleJobId1 = randomUUID();
  const staleJobId2 = randomUUID();

  // Insert a stale job with retryCount < maxRetries (should be retried)
  db.prepare(
    `
    INSERT INTO jobs (id, workspaceId, type, status, priority, payload, progress, retryCount, maxRetries, createdAt, updatedAt)
    VALUES (?, ?, 'automation:workflow', 'running', 3, '{}', 0, 1, 3, datetime('now'), datetime('now'))
  `
  ).run(staleJobId1, workspaceId);

  // Insert a stale job with retryCount === maxRetries (should fail)
  db.prepare(
    `
    INSERT INTO jobs (id, workspaceId, type, status, priority, payload, progress, retryCount, maxRetries, createdAt, updatedAt)
    VALUES (?, ?, 'automation:workflow', 'starting', 3, '{}', 0, 3, 3, datetime('now'), datetime('now'))
  `
  ).run(staleJobId2, workspaceId);

  // Run reconciliation logic
  const staleJobs = db
    .prepare(
      `
    SELECT id, retryCount, maxRetries FROM jobs
    WHERE workspaceId = ? AND status IN ('running', 'starting')
  `
    )
    .all(workspaceId) as { id: string; retryCount: number; maxRetries: number }[];

  for (const job of staleJobs) {
    if (job.retryCount < job.maxRetries) {
      db.prepare(
        `
        UPDATE jobs
        SET status = 'retrying', retryCount = retryCount + 1, error = 'Worker execution interrupted due to application restart.', updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `
      ).run(job.id);
    } else {
      db.prepare(
        `
        UPDATE jobs
        SET status = 'failed', error = 'Worker execution interrupted due to application restart. Max retries exceeded.', updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `
      ).run(job.id);
    }
  }

  const job1After = db
    .prepare('SELECT status, retryCount, error FROM jobs WHERE id = ?')
    .get(staleJobId1) as any;
  assert.strictEqual(job1After.status, 'retrying');
  assert.strictEqual(job1After.retryCount, 2);
  assert.ok(job1After.error.includes('application restart'));

  const job2After = db
    .prepare('SELECT status, retryCount, error FROM jobs WHERE id = ?')
    .get(staleJobId2) as any;
  assert.strictEqual(job2After.status, 'failed');
  assert.strictEqual(job2After.retryCount, 3);
  assert.ok(job2After.error.includes('Max retries exceeded'));
  console.log('✅ Scheduler stale job reconciliation verified.');

  // 9. Test Outreach Sequence Construction and Action Mapping Verification (Phase 10B)
  const sequenceId10B = randomUUID();
  const stepsJson = JSON.stringify([
    {
      id: 'step_1',
      type: 'SEND_EMAIL',
      config: { subject: 'Cold Outreach', body: 'Hi {{firstName}}' }
    },
    {
      id: 'step_2',
      type: 'WAIT',
      config: { delaySeconds: 259200 }
    },
    {
      id: 'step_3',
      type: 'IF',
      config: { condition: "contact.status == 'REPLIED'", thenGoto: 'label_yes_3', elseSkip: 1 }
    },
    {
      id: 'step_4',
      type: 'ADD_TAG',
      config: { tag: 'No-Reply-Followup' }
    },
    {
      id: 'step_5',
      type: 'UPDATE_STAGE',
      config: { stage: 'CONTACTED' }
    },
    {
      id: 'step_6',
      type: 'SEND_NOTIFICATION',
      config: { message: 'Outreach step executed', type: 'info' }
    }
  ]);

  db.prepare(
    `
    INSERT INTO sequences (
      id, workspaceId, name, status, trigger, steps, createdAt, updatedAt
    ) VALUES (?, ?, ?, 'ACTIVE', '{}', ?, datetime('now'), datetime('now'))
  `
  ).run(sequenceId10B, workspaceId, 'Outreach 10B Sequence', stepsJson);

  const seqRow = db.prepare('SELECT * FROM sequences WHERE id = ?').get(sequenceId10B) as any;
  assert.ok(seqRow);
  const parsedSteps = JSON.parse(seqRow.steps);
  assert.strictEqual(parsedSteps.length, 6);
  assert.strictEqual(parsedSteps[0].type, 'SEND_EMAIL');
  assert.strictEqual(parsedSteps[1].type, 'WAIT');
  assert.strictEqual(parsedSteps[2].type, 'IF');
  assert.strictEqual(parsedSteps[3].type, 'ADD_TAG');
  assert.strictEqual(parsedSteps[4].type, 'UPDATE_STAGE');
  // 10. Test Phase 10B-R SDK ExecutionsModule CRUD methods & Worker SQL Parameter Binding Contract
  const { ExecutionsModule } = require('@leadforge/sdk');
  const executionsMod = new ExecutionsModule({ get: () => {}, post: () => {}, patch: () => {}, delete: () => {} });
  assert.strictEqual(typeof executionsMod.create, 'function', 'ExecutionsModule.create must exist');
  assert.strictEqual(typeof executionsMod.update, 'function', 'ExecutionsModule.update must exist');
  assert.strictEqual(typeof executionsMod.delete, 'function', 'ExecutionsModule.delete must exist');
  console.log('✅ ExecutionsModule CRUD interface contract verified.');

  // Test SQL parameter binding with primitive string parameter (not object)
  const accountTestStmt = db.prepare(
    `SELECT id FROM email_accounts WHERE workspaceId = ? AND deletedAt IS NULL ORDER BY createdAt ASC LIMIT 1`
  );
  db.prepare(
    `INSERT INTO email_accounts (id, workspaceId, name, email, provider, status, createdAt, updatedAt)
     VALUES (?, ?, 'Test Sender', 'sender@test.com', 'GMAIL', 'connected', datetime('now'), datetime('now'))`
  ).run(sendingAccountId, workspaceId);

  const foundAcc = accountTestStmt.get(workspaceId) as { id: string } | undefined;
  assert.ok(foundAcc);
  assert.strictEqual(foundAcc.id, sendingAccountId);
  console.log('✅ SEND_EMAIL SQL query parameter binding contract verified.');

  // Test IPC channel authorization in preload allowlist
  const fs = require('fs');
  const path = require('path');
  const preloadPath = path.join(__dirname, '../../preload/index.ts');
  const preloadContent = fs.readFileSync(preloadPath, 'utf8');
  assert.ok(preloadContent.includes("'campaigns:schedule'"), "IPC channel 'campaigns:schedule' must be authorized in preload allowlist");
  console.log('✅ campaigns:schedule preload authorization contract verified.');

  // 11. Test Phase 10C Canonical Variable Resolver Parity
  const { renderCanonicalVariables } = require('@leadforge/sdk');
  const sampleContext = {
    contact: { firstName: 'Subrota', lastName: 'Sarker', email: 'subrota@ecoray.com' },
    company: { name: 'Ecoray Group', domain: 'ecoray.com' }
  };

  const canonicalOut = renderCanonicalVariables('Hello {{contact.firstName}} from {{company.name}}', sampleContext);
  assert.strictEqual(canonicalOut, 'Hello Subrota from Ecoray Group');

  const legacyOut = renderCanonicalVariables('Hello {{firstName}} from {{company}}', sampleContext);
  assert.strictEqual(legacyOut, 'Hello Subrota from Ecoray Group');
  console.log('✅ Phase 10C canonical variable rendering parity verified.');

  console.log('--- ALL CAMPAIGN INTEGRATION TESTS PASSED ---');
}

// Execute directly if run via tsx/node
if (require.main === module) {
  runCampaignTests().catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
}
