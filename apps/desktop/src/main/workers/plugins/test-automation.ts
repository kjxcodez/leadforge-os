import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { ActionRegistry } from './automation';
import { AutomationTriggerEvaluator } from '../../services/automation-trigger';
import { LocalEventBus } from '../../lib/event-bus';

async function runTests() {
  console.log('--- STARTING AUTOMATION INTEGRATION TESTS ---');

  // Create an in-memory SQLite database
  const db = new Database(':memory:');

  // Set up schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS sequences (
      id TEXT PRIMARY KEY,
      workspaceId TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL,
      trigger TEXT NOT NULL,
      steps TEXT NOT NULL,
      createdAt DATETIME,
      updatedAt DATETIME,
      deletedAt DATETIME DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS sequence_executions (
      id TEXT PRIMARY KEY,
      sequenceId TEXT NOT NULL,
      workspaceId TEXT NOT NULL,
      companyId TEXT,
      contactId TEXT,
      currentStep INTEGER DEFAULT 0,
      currentStepName TEXT,
      status TEXT NOT NULL,
      startedAt DATETIME,
      completedAt DATETIME,
      nextExecutionAt DATETIME,
      logs TEXT,
      emailsSent INTEGER DEFAULT 0,
      replies INTEGER DEFAULT 0,
      failures INTEGER DEFAULT 0,
      createdAt DATETIME,
      updatedAt DATETIME,
      deletedAt DATETIME DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      workspaceId TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      priority INTEGER DEFAULT 1,
      payload TEXT,
      progress INTEGER DEFAULT 0,
      retryCount INTEGER DEFAULT 0,
      maxRetries INTEGER DEFAULT 3,
      createdAt DATETIME,
      updatedAt DATETIME
    );

    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      workspaceId TEXT NOT NULL,
      name TEXT NOT NULL,
      domain TEXT,
      industry TEXT,
      size TEXT,
      createdAt DATETIME,
      updatedAt DATETIME,
      deletedAt DATETIME DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      workspaceId TEXT NOT NULL,
      companyId TEXT,
      firstName TEXT,
      lastName TEXT,
      email TEXT,
      phone TEXT,
      status TEXT,
      createdAt DATETIME,
      updatedAt DATETIME,
      deletedAt DATETIME DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      workspaceId TEXT NOT NULL,
      name TEXT NOT NULL,
      subject TEXT,
      body TEXT,
      status TEXT,
      sequenceId TEXT,
      createdAt DATETIME,
      updatedAt DATETIME,
      deletedAt DATETIME DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS opportunity_scores (
      companyId TEXT PRIMARY KEY,
      overallScore REAL,
      fitScore REAL,
      sizeScore REAL,
      intentScore REAL,
      urgencyScore REAL,
      explanation TEXT
    );

    CREATE TABLE IF NOT EXISTS company_intelligence (
      companyId TEXT PRIMARY KEY,
      summary TEXT,
      openingLine TEXT,
      techStack TEXT
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      workspaceId TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT,
      isRead INTEGER DEFAULT 0,
      createdAt DATETIME,
      updatedAt DATETIME
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT,
      value TEXT,
      workspaceId TEXT,
      PRIMARY KEY (key, workspaceId)
    );
  `);

  const workspaceId = 'test_ws';

  // Seed default data
  db.prepare(
    `
    INSERT INTO settings (key, value, workspaceId) VALUES ('openrouter_key', 'sk-test-key', ?)
  `
  ).run(workspaceId);

  db.prepare(
    `
    INSERT INTO companies (id, workspaceId, name, domain, industry, size, createdAt, updatedAt)
    VALUES ('comp_1', ?, 'Google', 'google.com', 'Technology', '10000', datetime('now'), datetime('now'))
  `
  ).run(workspaceId);

  db.prepare(
    `
    INSERT INTO opportunity_scores (companyId, overallScore, fitScore, sizeScore, intentScore, urgencyScore)
    VALUES ('comp_1', 85, 90, 80, 85, 90)
  `
  ).run();

  db.prepare(
    `
    INSERT INTO campaigns (id, workspaceId, name, subject, body, status, sequenceId, createdAt, updatedAt)
    VALUES ('camp_1', ?, 'Outreach Campaign', 'Hello', 'Body', 'Active', 'seq_1', datetime('now'), datetime('now'))
  `
  ).run(workspaceId);

  // Setup EventBus and Evaluator
  const eventBus = new LocalEventBus(workspaceId);
  const evaluator = new AutomationTriggerEvaluator(workspaceId, db, eventBus);
  evaluator.start();

  console.log('1. Testing Trigger Condition Evaluation: LEAD_SCORE_CHANGED >= 75');
  db.prepare(
    `
    INSERT INTO sequences (id, workspaceId, name, status, trigger, steps, createdAt, updatedAt)
    VALUES ('seq_1', ?, 'Lead Score Filter', 'active', ?, '[]', datetime('now'), datetime('now'))
  `
  ).run(
    workspaceId,
    JSON.stringify({
      type: 'LEAD_SCORE_CHANGED',
      conditions: [{ field: 'leadScore', op: '>=', value: 75 }]
    })
  );

  // Publish event: LEAD_SCORE_CHANGED for comp_1
  eventBus.publish('crm:updated', {
    workspaceId,
    payload: {
      entityId: 'comp_1',
      entityType: 'company',
      changeType: 'score'
    },
    timestamp: new Date().toISOString()
  });

  // Verify that an automation:workflow job was queued in jobs table
  const job = db.prepare("SELECT * FROM jobs WHERE type = 'automation:workflow'").get() as any;
  if (job) {
    console.log('✅ Success: job queued after trigger condition matched.');
  } else {
    throw new Error('FAIL: Job was not queued!');
  }

  // Clear jobs
  db.prepare('DELETE FROM jobs').run();

  console.log('2. Testing ActionRegistry.RUN_DISCOVERY execution');
  const contextMock: any = {
    payload: {},
    emitLog: (msg: string, severity: string) => {
      console.log(`   [Worker Log] [${severity}] ${msg}`);
    }
  };

  await ActionRegistry.RUN_DISCOVERY!.execute(
    db,
    'entity_1',
    workspaceId,
    'seq_1',
    { type: 'RUN_DISCOVERY', config: { query: 'cafes in Paris', limit: 10 } },
    contextMock,
    { variables: {} } as any,
    new Map()
  );

  const discoveryJob = db.prepare("SELECT * FROM jobs WHERE type = 'scraper:maps'").get() as any;
  if (discoveryJob && JSON.parse(discoveryJob.payload).query === 'cafes in Paris') {
    console.log('✅ Success: RUN_DISCOVERY action inserted map scraper job successfully.');
  } else {
    throw new Error('FAIL: RUN_DISCOVERY did not insert job!');
  }

  console.log('3. Testing ActionRegistry.ENROLL_CONTACT execution');
  db.prepare(
    `
    INSERT INTO contacts (id, workspaceId, companyId, firstName, lastName, email, status, createdAt, updatedAt)
    VALUES ('contact_1', ?, 'comp_1', 'John', 'Doe', 'john@google.com', 'active', datetime('now'), datetime('now'))
  `
  ).run(workspaceId);

  await ActionRegistry.ENROLL_CONTACT!.execute(
    db,
    'contact_1',
    workspaceId,
    'seq_1',
    { type: 'ENROLL_CONTACT', config: { campaignId: 'camp_1' } },
    contextMock,
    { variables: {} } as any,
    new Map()
  );

  const enrollment = db
    .prepare("SELECT * FROM sequence_executions WHERE contactId = 'contact_1'")
    .get() as any;
  if (enrollment && enrollment.campaignId === 'camp_1') {
    console.log('✅ Success: ENROLL_CONTACT enrolled contact in campaign successfully.');
  } else {
    throw new Error('FAIL: ENROLL_CONTACT did not enroll contact!');
  }

  console.log('4. Testing ActionRegistry.SEND_NOTIFICATION execution');
  await ActionRegistry.SEND_NOTIFICATION!.execute(
    db,
    'contact_1',
    workspaceId,
    'seq_1',
    {
      type: 'SEND_NOTIFICATION',
      config: { message: 'Workflow notification sent!', type: 'success' }
    },
    contextMock,
    { variables: {} } as any,
    new Map()
  );

  const notification = db.prepare('SELECT * FROM notifications').get() as any;
  if (notification && notification.message === 'Workflow notification sent!') {
    console.log('✅ Success: SEND_NOTIFICATION inserted notification successfully.');
  } else {
    throw new Error('FAIL: SEND_NOTIFICATION did not insert notification!');
  }

  evaluator.stop();
  console.log('--- ALL AUTOMATION INTEGRATION TESTS COMPLETED SUCCESSFULLY ---');
}

runTests().catch((err) => {
  console.error('❌ Test execution failed:', err);
  process.exit(1);
});
