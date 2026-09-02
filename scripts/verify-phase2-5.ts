import { MongoClient, ObjectId, type Db } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { runMigration } from './migrate-mongo-objectids.js';
import { verifyMongoStringIds } from './verify-mongo-string-ids.js';

dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/leadforge-os';
const TEST_DB_NAME = 'leadforge-test-synthetic-phase2-5';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

async function runPhase25Tests() {
  console.log(`\n===============================================================`);
  console.log(`PHASE 2.5 INTEGRATION & SAFETY TEST SUITE (T2.5.1 - T2.5.10)`);
  console.log(`Database: ${TEST_DB_NAME}`);
  console.log(`===============================================================\n`);

  const client = new MongoClient(uri);
  await client.connect();
  const testDb = client.db(TEST_DB_NAME);

  // Clean test database
  await testDb.dropDatabase();
  console.log('Cleaned synthetic test database.\n');

  // Seed Synthetic Test Data
  console.log('--- Seeding Synthetic Test Database ---');
  const legacyCompanyOid = new ObjectId('507f1f77bcf86cd799439011');
  const modernCompanyStrId = 'c0a80101-0000-4000-8000-000000000001';

  const legacyWorkspaceOid = new ObjectId('507f191e810c19729de860ea');

  const legacyContactOid = new ObjectId('507f191e810c19729de860eb');
  const modernContactStrId = 'c0a80101-0000-4000-8000-000000000002';

  const legacyJobOid = new ObjectId('507f191e810c19729de860ec');
  const legacySeqExecOid = new ObjectId('507f191e810c19729de860ed');

  // 1. Workspaces
  await testDb.collection('workspaces').insertOne({
    _id: legacyWorkspaceOid,
    name: 'Legacy Workspace',
    slug: 'legacy-ws'
  });

  // 2. Companies
  await testDb.collection('companies').insertMany([
    {
      _id: legacyCompanyOid,
      workspaceId: legacyWorkspaceOid,
      name: 'Legacy Corp',
      domain: 'legacy.com',
      employeeCount: 150
    },
    {
      _id: modernCompanyStrId,
      workspaceId: legacyWorkspaceOid.toHexString(),
      name: 'Modern SaaS',
      domain: 'modern.com',
      employeeCount: 25
    }
  ]);

  // 3. Contacts (mixed: foreign key companyId as ObjectId and String)
  await testDb.collection('contacts').insertMany([
    {
      _id: legacyContactOid,
      workspaceId: legacyWorkspaceOid,
      companyId: legacyCompanyOid, // ObjectId FK
      firstName: 'Legacy',
      lastName: 'Contact',
      email: 'legacy@legacy.com'
    },
    {
      _id: modernContactStrId,
      workspaceId: legacyWorkspaceOid.toHexString(),
      companyId: modernCompanyStrId, // String FK
      firstName: 'Modern',
      lastName: 'Contact',
      email: 'modern@modern.com'
    }
  ]);

  // 4. Jobs & Sequence Executions
  await testDb.collection('jobs').insertOne({
    _id: legacyJobOid,
    workspaceId: legacyWorkspaceOid,
    type: 'enrichment',
    status: 'completed'
  });

  await testDb.collection('sequenceexecutions').insertOne({
    _id: legacySeqExecOid,
    workspaceId: legacyWorkspaceOid,
    parentJobId: legacyJobOid, // ObjectId FK
    contactId: legacyContactOid, // ObjectId FK
    companyId: legacyCompanyOid, // ObjectId FK
    status: 'COMPLETED'
  });

  // 5. Audiences with Array references
  await testDb.collection('audiences').insertOne({
    _id: new ObjectId('507f191e810c19729de860ee'),
    workspaceId: legacyWorkspaceOid,
    name: 'Test Audience',
    staticMemberIds: [legacyContactOid, modernContactStrId] // Array of mixed IDs
  });

  // 6. Intelligence Claims with Array evidence references
  const legacyEvidenceOid = new ObjectId('507f191e810c19729de860ef');
  await testDb.collection('intelligenceclaims').insertOne({
    _id: new ObjectId('507f191e810c19729de860f0'),
    workspaceId: legacyWorkspaceOid,
    companyId: legacyCompanyOid,
    evidenceIds: [legacyEvidenceOid]
  });

  console.log('Seeding complete.\n');

  // ---------------------------------------------------------------------------
  // T2.5.1: ObjectId Detection
  // ---------------------------------------------------------------------------
  console.log('--- T2.5.1: ObjectId Detection ---');
  const dryRunReport = await runMigration(testDb, { execute: false });
  assert(dryRunReport.mode === 'DRY_RUN', 'Migration default is DRY RUN');
  assert(dryRunReport.objectIdDocumentsFound === 7, `Correctly detected exactly 7 ObjectId documents (found ${dryRunReport.objectIdDocumentsFound})`);
  assert(dryRunReport.stringDocumentsFound === 2, `Correctly detected exactly 2 existing String documents (found ${dryRunReport.stringDocumentsFound})`);

  // Verify dry run performed NO mutations
  const postDryRunOidCount = await testDb.collection('companies').countDocuments({ _id: { $type: 'objectId' } });
  assert(postDryRunOidCount === 1, 'Dry run performed ZERO mutations on collection');

  // ---------------------------------------------------------------------------
  // T2.5.7: Collision Detection & Safety Abort
  // ---------------------------------------------------------------------------
  console.log('\n--- T2.5.7: Collision Detection & Safety Abort ---');
  // Inject adversarial collision: an ObjectId whose hex is already in the collection as a string!
  const collidingOid = new ObjectId('507f191e810c19729de860fa');
  const collidingStr = collidingOid.toHexString();
  await testDb.collection('companies').insertOne({
    _id: collidingStr,
    workspaceId: 'ws-1',
    name: 'Existing String Record'
  });
  await testDb.collection('companies').insertOne({
    _id: collidingOid,
    workspaceId: 'ws-1',
    name: 'Colliding ObjectId Record'
  });

  let collisionCaught = false;
  try {
    await runMigration(testDb, { execute: false });
  } catch (err: any) {
    collisionCaught = true;
    assert(err.message.includes('identity collisions'), 'Collision guard aborted execution safely');
  }
  assert(collisionCaught, 'Migration safely stopped before execution when collision was present');

  // Remove adversarial collision records to proceed with valid migration tests
  await testDb.collection('companies').deleteOne({ _id: collidingStr });
  await testDb.collection('companies').deleteOne({ _id: collidingOid });

  // ---------------------------------------------------------------------------
  // T2.5.2 & T2.5.3 & T2.5.4 & T2.5.5 & T2.5.6: Controlled Execution
  // ---------------------------------------------------------------------------
  console.log('\n--- T2.5.2 - T2.5.6: Controlled Clone-and-Swap Execution ---');
  const execReport = await runMigration(testDb, { execute: true, backupConfirmed: true });
  assert(execReport.mode === 'EXECUTE', 'Execution executed with explicit confirmation');
  assert(execReport.documentsConverted === 7, `Converted all 7 ObjectId documents (converted ${execReport.documentsConverted})`);

  // T2.5.2: ObjectId -> String exact value preservation
  const migratedCompany = await testDb.collection('companies').findOne({ _id: legacyCompanyOid.toHexString() });
  assert(!!migratedCompany, 'Migrated company exists with exact hex string _id');
  assert(typeof migratedCompany!._id === 'string', 'Migrated company _id is type string');
  assert(migratedCompany!.name === 'Legacy Corp', 'Migrated company preserved document attributes');
  assert(migratedCompany!.employeeCount === 150, 'Migrated company preserved numeric attributes');

  // T2.5.3: String ID preservation (modern company was untouched)
  const untouchedCompany = await testDb.collection('companies').findOne({ _id: modernCompanyStrId });
  assert(!!untouchedCompany, 'Existing string ID document preserved untouched');
  assert(untouchedCompany!.name === 'Modern SaaS', 'Existing string document content intact');

  // T2.5.4: Foreign-Key Rewrite
  const migratedContact = await testDb.collection('contacts').findOne({ _id: legacyContactOid.toHexString() });
  assert(!!migratedContact, 'Migrated contact exists');
  assert(migratedContact!.companyId === legacyCompanyOid.toHexString(), 'Foreign key companyId successfully rewritten to String');
  assert(migratedContact!.workspaceId === legacyWorkspaceOid.toHexString(), 'Foreign key workspaceId successfully rewritten to String');

  const migratedSeqExec = await testDb.collection('sequenceexecutions').findOne({ _id: legacySeqExecOid.toHexString() });
  assert(migratedSeqExec!.parentJobId === legacyJobOid.toHexString(), 'parentJobId rewritten from ObjectId to String');
  assert(migratedSeqExec!.contactId === legacyContactOid.toHexString(), 'contactId rewritten from ObjectId to String');

  // T2.5.6: Array Reference Rewrite
  const migratedAudience = await testDb.collection('audiences').findOne({ name: 'Test Audience' });
  assert(migratedAudience!.staticMemberIds.includes(legacyContactOid.toHexString()), 'Array reference rewritten to string hex');
  assert(migratedAudience!.staticMemberIds.includes(modernContactStrId), 'Array reference preserved existing string');

  // ---------------------------------------------------------------------------
  // T2.5.8: Zero ObjectId Verification
  // ---------------------------------------------------------------------------
  console.log('\n--- T2.5.8: Zero ObjectId Verification ---');
  const verifyResult = await verifyMongoStringIds(testDb);
  assert(verifyResult.success === true, 'Verification suite confirms ZERO ObjectId documents or references remain');

  // ---------------------------------------------------------------------------
  // T2.5.9: Idempotent Rerun
  // ---------------------------------------------------------------------------
  console.log('\n--- T2.5.9: Idempotent Rerun ---');
  const rerunReport = await runMigration(testDb, { execute: true, backupConfirmed: true });
  assert(rerunReport.objectIdDocumentsFound === 0, 'Rerun finds ZERO ObjectId documents');
  assert(rerunReport.documentsConverted === 0, 'Rerun performs ZERO conversions');
  assert(rerunReport.referencesRewritten === 0, 'Rerun performs ZERO reference rewrites');

  // ---------------------------------------------------------------------------
  // T2.5.10: Interrupted Migration Recovery Simulation
  // ---------------------------------------------------------------------------
  console.log('\n--- T2.5.10: Interrupted Migration Recovery ---');
  // Inject a new un-migrated document
  const partialOid = new ObjectId('507f191e810c19729de860fb');
  await testDb.collection('companies').insertOne({
    _id: partialOid,
    workspaceId: legacyWorkspaceOid.toHexString(),
    name: 'Interrupted Company'
  });

  const recoveryReport = await runMigration(testDb, { execute: true, backupConfirmed: true });
  assert(recoveryReport.documentsConverted === 1, 'Restartable migration successfully picked up remaining un-migrated document');
  const recoveredDoc = await testDb.collection('companies').findOne({ _id: partialOid.toHexString() });
  assert(!!recoveredDoc && typeof recoveredDoc._id === 'string', 'Interrupted document successfully converted on resume');

  // Drop synthetic test database
  await testDb.dropDatabase();
  await client.close();

  console.log('\n===============================================================');
  console.log('ALL PHASE 2.5 TESTS (T2.5.1 - T2.5.10) PASSED SUCCESSFULLY! ✅');
  console.log('===============================================================\n');
}

runPhase25Tests().catch(err => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
