import Database from 'better-sqlite3';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { SQLiteToMongoMigrator } from './migrate-sqlite-to-mongo.js';
import { verifySQLiteMongoMigration } from './verify-sqlite-mongo-migration.js';
import { inspectSQLiteDatabase, createDatabaseBackup } from './sqlite-discovery.js';
import { generateEntityId } from '@leadforge/schema';

dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/leadforge-os';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

async function runPhase4Tests() {
  console.log(`\n===============================================================`);
  console.log(`LEADFORGE OS — PHASE 4 DATA INTEGRITY & MIGRATION TEST SUITE`);
  console.log(`Testing Discovery, Reconciliation, Foreign Keys, Quarantine & Idempotency`);
  console.log(`===============================================================\n`);

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
  const mongoDb = mongoose.connection.db!;

  const testWsId = 'ws-test-mig-' + Date.now();
  const tempDir = path.resolve(process.cwd(), 'report/temp-phase4');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const testDbPath = path.join(tempDir, `leadforge_${testWsId}.db`);
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  console.log(`Creating synthetic SQLite fixture at: ${testDbPath}...`);
  const sqlite = new Database(testDbPath);

  // Initialize SQLite Schema
  sqlite.exec(`
    CREATE TABLE workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT,
      ownerId TEXT NOT NULL,
      settings TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE companies (
      id TEXT PRIMARY KEY,
      workspaceId TEXT NOT NULL,
      name TEXT NOT NULL,
      domain TEXT,
      industry TEXT,
      size TEXT,
      tags TEXT,
      customFields TEXT,
      isDeleted INTEGER DEFAULT 0,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE contacts (
      id TEXT PRIMARY KEY,
      workspaceId TEXT NOT NULL,
      companyId TEXT,
      firstName TEXT,
      lastName TEXT,
      email TEXT,
      title TEXT,
      tags TEXT,
      customFields TEXT,
      isDecisionMaker INTEGER DEFAULT 0,
      score INTEGER,
      status TEXT,
      notes TEXT,
      lastContactedAt TEXT,
      isDeleted INTEGER DEFAULT 0,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE sequences (
      id TEXT PRIMARY KEY,
      workspaceId TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT,
      steps TEXT,
      settings TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE sequence_executions (
      id TEXT PRIMARY KEY,
      workspaceId TEXT NOT NULL,
      sequenceId TEXT NOT NULL,
      campaignId TEXT,
      contactId TEXT NOT NULL,
      companyId TEXT,
      status TEXT,
      currentStep INTEGER DEFAULT 0,
      variables TEXT,
      logs TEXT,
      parentJobId TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE sequence_logs (
      id TEXT PRIMARY KEY,
      workspaceId TEXT NOT NULL,
      executionId TEXT NOT NULL,
      stepIndex INTEGER DEFAULT 0,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      payload TEXT,
      createdAt TEXT
    );

    CREATE TABLE audiences (
      id TEXT PRIMARY KEY,
      workspaceId TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT,
      filterDefinition TEXT,
      staticMemberIds TEXT,
      memberCount INTEGER DEFAULT 0,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE jobs (
      id TEXT PRIMARY KEY,
      workspaceId TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      priority INTEGER DEFAULT 0,
      payload TEXT,
      progress INTEGER DEFAULT 0,
      retryCount INTEGER DEFAULT 0,
      maxRetries INTEGER DEFAULT 3,
      checkpointData TEXT,
      idempotencyKey TEXT,
      workerId TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE email_deliveries (
      id TEXT PRIMARY KEY,
      workspaceId TEXT NOT NULL,
      sequenceId TEXT,
      contactId TEXT,
      companyId TEXT,
      senderEmail TEXT,
      recipientEmail TEXT,
      subject TEXT,
      status TEXT,
      providerMessageId TEXT,
      idempotencyKey TEXT NOT NULL,
      sentAt TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE intelligence_sources (
      id TEXT PRIMARY KEY,
      workspaceId TEXT NOT NULL,
      companyId TEXT NOT NULL,
      sourceType TEXT NOT NULL,
      url TEXT,
      title TEXT,
      fetchedAt TEXT,
      metadata TEXT,
      createdAt TEXT
    );

    CREATE TABLE intelligence_evidence (
      id TEXT PRIMARY KEY,
      workspaceId TEXT NOT NULL,
      companyId TEXT NOT NULL,
      sourceId TEXT NOT NULL,
      factType TEXT NOT NULL,
      factValue TEXT NOT NULL,
      rawExcerpt TEXT,
      confidence REAL DEFAULT 0.9,
      createdAt TEXT
    );

    CREATE TABLE intelligence_claims (
      id TEXT PRIMARY KEY,
      workspaceId TEXT NOT NULL,
      companyId TEXT NOT NULL,
      evidenceIds TEXT,
      claimText TEXT NOT NULL,
      claimCategory TEXT,
      confidence REAL DEFAULT 0.9,
      createdAt TEXT
    );

    CREATE TABLE audit_logs (
      id TEXT PRIMARY KEY,
      workspaceId TEXT NOT NULL,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      entityType TEXT NOT NULL,
      entityId TEXT NOT NULL,
      beforeValue TEXT,
      afterValue TEXT,
      timestamp TEXT
    );

    CREATE TABLE sync_queue (
      id TEXT PRIMARY KEY,
      entityType TEXT NOT NULL,
      entityId TEXT NOT NULL,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      payload TEXT,
      createdAt TEXT
    );
  `);

  // Seed Synthetic Records
  const companyId1 = generateEntityId();
  const companyId2 = generateEntityId();
  const contactId1 = generateEntityId();
  const contactId2 = generateEntityId();
  const sequenceId1 = generateEntityId();
  const executionId1 = generateEntityId();
  const sourceId1 = generateEntityId();
  const evidenceId1 = generateEntityId();
  const claimId1 = generateEntityId();
  const jobId1 = generateEntityId();
  const delivId1 = generateEntityId();
  const delivIdemKey = 'idem-key-' + Date.now();

  const nowIso = new Date().toISOString();
  const olderIso = new Date(Date.now() - 3600000).toISOString();

  // 1. Workspace
  sqlite.prepare(`INSERT INTO workspaces (id, name, slug, ownerId, settings, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    testWsId, 'Test Fixture Workspace', 'fixture-ws', 'user-owner-1', JSON.stringify({ theme: 'dark' }), nowIso, nowIso
  );

  // 2. Companies
  sqlite.prepare(`INSERT INTO companies (id, workspaceId, name, domain, industry, size, tags, isDeleted, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    companyId1, testWsId, 'Fixture Corp 1', 'fixture1.com', 'Technology', '11-50', JSON.stringify(['saas', 'b2b']), 0, nowIso, nowIso
  );
  sqlite.prepare(`INSERT INTO companies (id, workspaceId, name, domain, industry, size, tags, isDeleted, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    companyId2, testWsId, 'Fixture Corp 2 (Pending Sync)', 'fixture2.com', 'Healthcare', '51-200', JSON.stringify(['health']), 0, nowIso, nowIso
  );

  // 3. Contacts
  sqlite.prepare(`INSERT INTO contacts (id, workspaceId, companyId, firstName, lastName, email, title, tags, isDecisionMaker, score, status, notes, isDeleted, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    contactId1, testWsId, companyId1, 'Alice', 'Smith', 'alice@fixture1.com', 'CTO', JSON.stringify(['vip']), 1, 95, 'CONTACTED', 'Key champion', 0, nowIso, nowIso
  );
  sqlite.prepare(`INSERT INTO contacts (id, workspaceId, companyId, firstName, lastName, email, title, tags, isDecisionMaker, score, status, notes, isDeleted, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    contactId2, testWsId, companyId2, 'Bob', 'Jones', 'bob@fixture2.com', 'VP Sales', JSON.stringify(['exec']), 1, 80, 'UNCONTACTED', '', 0, nowIso, nowIso
  );

  // 4. Broken FK Contact (pointing to non-existent company)
  const brokenContactId = generateEntityId();
  const nonExistentCompanyId = 'comp-missing-' + Date.now();
  sqlite.prepare(`INSERT INTO contacts (id, workspaceId, companyId, firstName, lastName, email, title, isDeleted, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    brokenContactId, testWsId, nonExistentCompanyId, 'Orphan', 'Contact', 'orphan@test.com', 'Tester', 0, nowIso, nowIso
  );

  // 5. Sequence & Execution
  sqlite.prepare(`INSERT INTO sequences (id, workspaceId, name, status, steps, settings, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    sequenceId1, testWsId, 'Outreach Sequence 1', 'ACTIVE', JSON.stringify([{ step: 1, type: 'EMAIL' }]), JSON.stringify({ delayDays: 2 }), nowIso, nowIso
  );

  sqlite.prepare(`INSERT INTO sequence_executions (id, workspaceId, sequenceId, contactId, companyId, status, currentStep, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    executionId1, testWsId, sequenceId1, contactId1, companyId1, 'ACTIVE', 1, nowIso, nowIso
  );

  sqlite.prepare(`INSERT INTO sequence_logs (id, workspaceId, executionId, stepIndex, action, status, payload, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    generateEntityId(), testWsId, executionId1, 1, 'SEND_EMAIL', 'COMPLETED', JSON.stringify({ templateId: 'tpl-1' }), nowIso
  );

  // 6. Audience
  sqlite.prepare(`INSERT INTO audiences (id, workspaceId, name, type, staticMemberIds, memberCount, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    generateEntityId(), testWsId, 'VIP Audience', 'STATIC', JSON.stringify([contactId1, contactId2]), 2, nowIso, nowIso
  );

  // 7. Job
  sqlite.prepare(`INSERT INTO jobs (id, workspaceId, type, status, priority, payload, progress, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    jobId1, testWsId, 'enrichment:single-run', 'completed', 5, JSON.stringify({ target: contactId1 }), 100, nowIso, nowIso
  );

  // 8. Email Delivery
  sqlite.prepare(`INSERT INTO email_deliveries (id, workspaceId, sequenceId, contactId, companyId, senderEmail, recipientEmail, subject, status, idempotencyKey, sentAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    delivId1, testWsId, sequenceId1, contactId1, companyId1, 'sender@leadforge.test', 'alice@fixture1.com', 'Demo Invite', 'SENT', delivIdemKey, nowIso, nowIso, nowIso
  );

  // 9. Intelligence Provenance
  sqlite.prepare(`INSERT INTO intelligence_sources (id, workspaceId, companyId, sourceType, url, title, fetchedAt, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    sourceId1, testWsId, companyId1, 'WEBSITE', 'https://fixture1.com', 'Homepage', nowIso, nowIso
  );
  sqlite.prepare(`INSERT INTO intelligence_evidence (id, workspaceId, companyId, sourceId, factType, factValue, rawExcerpt, confidence, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    evidenceId1, testWsId, companyId1, sourceId1, 'PRODUCT', 'SaaS Platform', 'We build enterprise software', 0.95, nowIso
  );
  sqlite.prepare(`INSERT INTO intelligence_claims (id, workspaceId, companyId, evidenceIds, claimText, claimCategory, confidence, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    claimId1, testWsId, companyId1, JSON.stringify([evidenceId1]), 'Enterprise SaaS provider', 'OFFERING', 0.95, nowIso
  );

  // 10. Audit Log
  sqlite.prepare(`INSERT INTO audit_logs (id, workspaceId, actor, action, entityType, entityId, beforeValue, afterValue, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    generateEntityId(), testWsId, JSON.stringify({ type: 'user', userId: 'user-1' }), 'company.create', 'Company', companyId1, null, JSON.stringify({ name: 'Fixture Corp 1' }), nowIso
  );

  // 11. Pending Sync Record for companyId2
  sqlite.prepare(`INSERT INTO sync_queue (id, entityType, entityId, action, status, payload, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    generateEntityId(), 'Company', companyId2, 'update', 'pending', JSON.stringify({ name: 'Fixture Corp 2 (Pending Sync Updated)' }), nowIso
  );

  sqlite.close();

  // ---------------------------------------------------------------------------
  // Pre-seed MongoDB with an older version of companyId2 and a Mongo-only company
  // ---------------------------------------------------------------------------
  await mongoDb.collection('companies').insertOne({
    _id: companyId2,
    workspaceId: testWsId,
    name: 'Fixture Corp 2 (Old Mongo Version)',
    domain: 'fixture2.com',
    updatedAt: new Date(Date.now() - 7200000)
  });

  const mongoOnlyCompanyId = generateEntityId();
  await mongoDb.collection('companies').insertOne({
    _id: mongoOnlyCompanyId,
    workspaceId: testWsId,
    name: 'Remote-Only Corp',
    domain: 'remote-only.com',
    updatedAt: new Date()
  });

  // ---------------------------------------------------------------------------
  // T4.1: SQLite Discovery
  // ---------------------------------------------------------------------------
  console.log('\n--- T4.1: SQLite Database Discovery ---');
  const dbInfo = inspectSQLiteDatabase(testDbPath);
  assert(dbInfo.isAccessible === true, 'SQLite database is accessible');
  assert(dbInfo.isCorrupt === false, 'SQLite database passed integrity check');
  assert(dbInfo.workspaceId === testWsId, `Extracted workspace ID matches: ${dbInfo.workspaceId}`);
  assert(dbInfo.pendingSyncCount === 1, 'Detected 1 pending sync item in sync_queue');
  assert(dbInfo.tables.length >= 10, `Discovered ${dbInfo.tables.length} tables in SQLite`);

  // ---------------------------------------------------------------------------
  // T4.2: Snapshot & Backup Safety
  // ---------------------------------------------------------------------------
  console.log('\n--- T4.2: SQLite Snapshot / Backup Safety ---');
  const backupPath = createDatabaseBackup(testDbPath, tempDir);
  assert(fs.existsSync(backupPath), `Created backup file at ${backupPath}`);
  assert(fs.existsSync(testDbPath), 'Original SQLite database remains untouched');
  const originalSize = fs.statSync(testDbPath).size;
  const backupSize = fs.statSync(backupPath).size;
  assert(backupSize === originalSize, 'Backup file size matches original SQLite file exactly');

  // ---------------------------------------------------------------------------
  // Dry Run Migration
  // ---------------------------------------------------------------------------
  console.log('\n--- Executing Migration in DRY RUN Mode ---');
  const dryRunMigrator = new SQLiteToMongoMigrator({
    mode: 'dry-run',
    databasePath: testDbPath,
    workspaceId: testWsId,
    outputDir: tempDir
  });
  const dryRunResult = await dryRunMigrator.run();
  assert(dryRunResult.results.length === 1, 'Dry run processed 1 workspace');
  assert(dryRunResult.results[0]!.totalInserted > 0, 'Dry run detected records to insert');

  // Verify MongoDB was NOT modified during dry run
  const mongoCountAfterDryRun = await mongoDb.collection('companies').countDocuments({ workspaceId: testWsId });
  assert(mongoCountAfterDryRun === 2, 'Dry run did NOT mutate MongoDB collections');

  // ---------------------------------------------------------------------------
  // Execute Migration
  // ---------------------------------------------------------------------------
  console.log('\n--- Executing Migration in EXECUTE Mode ---');
  const executeMigrator = new SQLiteToMongoMigrator({
    mode: 'execute',
    databasePath: testDbPath,
    workspaceId: testWsId,
    backupConfirmed: true,
    outputDir: tempDir
  });
  const executeResult = await executeMigrator.run();
  const wsRes = executeResult.results[0]!;

  // ---------------------------------------------------------------------------
  // T4.3: Clean Record Migration & 100% Exact ID Parity
  // ---------------------------------------------------------------------------
  console.log('\n--- T4.3: Clean Record Migration & ID Parity ---');
  const comp1InMongo = await mongoDb.collection('companies').findOne({ _id: companyId1 });
  assert(comp1InMongo !== null, 'Company 1 found in MongoDB');
  assert(comp1InMongo!._id === companyId1, `Exact ID preserved: ${comp1InMongo!._id} === ${companyId1}`);
  assert(typeof comp1InMongo!._id === 'string', 'Company 1 _id is string');
  assert(comp1InMongo!.name === 'Fixture Corp 1', 'Company name preserved');

  // ---------------------------------------------------------------------------
  // T4.4 & T4.5: Same-ID Reconciliation & Pending Sync Handling
  // ---------------------------------------------------------------------------
  console.log('\n--- T4.4 & T4.5: Pending-Sync & Timestamp Reconciliation ---');
  const comp2InMongo = await mongoDb.collection('companies').findOne({ _id: companyId2 });
  assert(comp2InMongo !== null, 'Company 2 found in MongoDB');
  assert(comp2InMongo!.name === 'Fixture Corp 2 (Pending Sync)', 'Pending sync local changes overwritten older Mongo version');
  assert(wsRes.totalUpdated >= 1, 'Recorded at least 1 updated record in statistics');

  // Remote-only record preserved
  const remoteOnlyInMongo = await mongoDb.collection('companies').findOne({ _id: mongoOnlyCompanyId });
  assert(remoteOnlyInMongo !== null, 'Remote-only MongoDB document was preserved untouched');

  // ---------------------------------------------------------------------------
  // T4.7: Foreign Key Referential Integrity
  // ---------------------------------------------------------------------------
  console.log('\n--- T4.7: Foreign Key Referential Integrity ---');
  const contact1InMongo = await mongoDb.collection('contacts').findOne({ _id: contactId1 });
  assert(contact1InMongo !== null, 'Contact 1 migrated to MongoDB');
  assert(contact1InMongo!.companyId === companyId1, 'Contact companyId points to exact migrated company._id');

  const execInMongo = await mongoDb.collection('sequenceexecutions').findOne({ _id: executionId1 });
  assert(execInMongo !== null, 'Sequence execution migrated to MongoDB');
  assert(execInMongo!.sequenceId === sequenceId1, 'Execution sequenceId points to sequence._id');
  assert(execInMongo!.contactId === contactId1, 'Execution contactId points to contact._id');

  const claimInMongo = await mongoDb.collection('intelligenceclaims').findOne({ _id: claimId1 });
  assert(claimInMongo !== null, 'Intelligence claim migrated to MongoDB');
  assert(Array.isArray(claimInMongo!.evidenceIds) && claimInMongo!.evidenceIds.includes(evidenceId1), 'Claim evidenceIds contains exact evidence._id');

  // ---------------------------------------------------------------------------
  // T4.8 & T4.9: JSON Transformation & Type Normalization
  // ---------------------------------------------------------------------------
  console.log('\n--- T4.8 & T4.9: JSON Transformation & Date Normalization ---');
  assert(Array.isArray(comp1InMongo!.tags) && comp1InMongo!.tags[0] === 'saas', 'Tags JSON string converted to string array');
  assert(Array.isArray(contact1InMongo!.tags) && contact1InMongo!.tags[0] === 'vip', 'Contact tags converted to array');
  assert(typeof contact1InMongo!.isDecisionMaker === 'boolean' && contact1InMongo!.isDecisionMaker === true, 'SQLite INTEGER boolean converted to JS boolean');
  assert(contact1InMongo!.createdAt instanceof Date, 'CreatedAt converted to JS Date');

  // Nullable broken foreign key handling (brokenContact.companyId set to null or quarantined)
  const brokenContactInMongo = await mongoDb.collection('contacts').findOne({ _id: brokenContactId });
  assert(brokenContactInMongo !== null, 'Broken contact migrated safely with nullable FK normalized');
  assert(brokenContactInMongo!.companyId === null, 'Non-existent companyId normalized to null');

  // ---------------------------------------------------------------------------
  // T4.10: Job Migration
  // ---------------------------------------------------------------------------
  console.log('\n--- T4.10: Job Migration ---');
  const jobInMongo = await mongoDb.collection('jobs').findOne({ _id: jobId1 });
  assert(jobInMongo !== null, 'Job migrated to MongoDB');
  assert(jobInMongo!.status === 'completed', 'Job status preserved');
  assert(jobInMongo!.payload.target === contactId1, 'Job payload JSON preserved');

  // ---------------------------------------------------------------------------
  // T4.11 & T4.12: Audit Log & Email Delivery Ledger Migration
  // ---------------------------------------------------------------------------
  console.log('\n--- T4.11 & T4.12: Audit Log & Delivery Ledger ---');
  const delivInMongo = await mongoDb.collection('emaildeliveries').findOne({ _id: delivId1 });
  assert(delivInMongo !== null, 'Delivery record migrated to MongoDB');
  assert(delivInMongo!.idempotencyKey === delivIdemKey, 'Delivery idempotency key preserved');
  assert(delivInMongo!.status === 'SENT', 'Delivery status SENT preserved');

  const auditsInMongo = await mongoDb.collection('auditlogs').find({ workspaceId: testWsId }).toArray();
  assert(auditsInMongo.length >= 1, 'Audit log records migrated to MongoDB');
  assert(typeof auditsInMongo[0]!._id === 'string', 'Audit log has canonical string _id');

  // ---------------------------------------------------------------------------
  // T4.14: Idempotent Rerun (0 duplicates on second execution)
  // ---------------------------------------------------------------------------
  console.log('\n--- T4.14: Idempotent Rerun ---');
  const rerunResult = await executeMigrator.run();
  const rerunWsRes = rerunResult.results[0]!;
  assert(rerunWsRes.totalInserted === 0, `Rerun inserted 0 new records (found ${rerunWsRes.totalInserted})`);
  assert(rerunWsRes.totalPreserved > 0, `Rerun preserved ${rerunWsRes.totalPreserved} existing records`);

  // ---------------------------------------------------------------------------
  // T4.16: Zero-Loss Full Verification Gate
  // ---------------------------------------------------------------------------
  console.log('\n--- T4.16: Migration Verification Gate ---');
  const verifReport = await verifySQLiteMongoMigration(testDbPath, testWsId);
  assert(verifReport.overallStatus === 'PASS', 'verifySQLiteMongoMigration returned PASS');
  assert(verifReport.missingInMongo === 0, 'Zero missing records in MongoDB');
  assert(verifReport.objectIdViolations === 0, 'Zero BSON ObjectIds in migrated domain documents');
  assert(verifReport.dataMismatches === 0, 'Zero data mismatches');

  // Clean up synthetic test data
  console.log('\nCleaning up synthetic test fixtures...');
  await mongoDb.collection('workspaces').deleteOne({ _id: testWsId });
  await mongoDb.collection('companies').deleteMany({ workspaceId: testWsId });
  await mongoDb.collection('contacts').deleteMany({ workspaceId: testWsId });
  await mongoDb.collection('sequences').deleteMany({ workspaceId: testWsId });
  await mongoDb.collection('sequenceexecutions').deleteMany({ workspaceId: testWsId });
  await mongoDb.collection('sequencelogs').deleteMany({ workspaceId: testWsId });
  await mongoDb.collection('audiences').deleteMany({ workspaceId: testWsId });
  await mongoDb.collection('jobs').deleteMany({ workspaceId: testWsId });
  await mongoDb.collection('emaildeliveries').deleteMany({ workspaceId: testWsId });
  await mongoDb.collection('intelligencesources').deleteMany({ workspaceId: testWsId });
  await mongoDb.collection('intelligenceevidences').deleteMany({ workspaceId: testWsId });
  await mongoDb.collection('intelligenceclaims').deleteMany({ workspaceId: testWsId });
  await mongoDb.collection('auditlogs').deleteMany({ workspaceId: testWsId });

  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  await mongoose.disconnect();

  console.log('\n===============================================================');
  console.log('ALL PHASE 4 TESTS (T4.1 - T4.16) PASSED SUCCESSFULLY! ✅');
  console.log('===============================================================\n');
}

runPhase4Tests().catch(err => {
  console.error('Fatal Phase 4 Test Error:', err);
  process.exit(1);
});
