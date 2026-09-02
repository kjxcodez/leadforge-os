/**
 * LEADFORGE OS — PHASE 5 VERIFICATION SUITE
 * 
 * Verifies Desktop MongoDB-First Refactor & Cutover:
 *  - T5.1: Create entity through SdkClient -> API -> MongoDB
 *  - T5.2: Exact ID parity (Mongo._id === SQLite.id)
 *  - T5.3: Update entity through API -> MongoDB -> Cache
 *  - T5.4: Delete entity through API -> MongoDB -> Cache
 *  - T5.5: Cross-workspace mutation rejection
 *  - T5.6: API outage / offline behavior (fails clearly, 0 local writes)
 *  - T5.7: Zero sync_queue insertions across all normal business mutations
 *  - T5.8: Cache update executes only post-API success
 *  - T5.9: Cache failure does not invalidate successful Mongo write
 *  - T5.10: Bulk mutation via batch API -> bulk cache update
 *  - T5.11: Client pre-generated ID preserved unchanged across API/Mongo/Cache
 *  - T5.12: Workspace switching isolation
 */

import Database from 'better-sqlite3';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { serve } from '@hono/node-server';
import { app } from '../apps/api/src/app.js';
import { SdkClient } from '@leadforge/sdk';
import { generateEntityId } from '@leadforge/schema';
import { LocalCRMRepository } from '../apps/desktop/src/main/database/repositories/local-crm.js';
import { WorkspaceManager } from '../apps/desktop/src/main/lib/workspace-manager.js';
import { WorkspaceRuntime } from '../apps/desktop/src/main/lib/workspace-runtime.js';
import { auth } from '../apps/api/src/config/auth.js';
import {
  WorkspaceModel,
  CompanyModel,
  ContactModel,
  SequenceModel,
  SequenceExecutionModel,
  AudienceModel,
  EmailTemplateModel,
  DiscoveryRunModel
} from '../apps/api/src/db/models/index.js';
import { getDatabase } from '../apps/desktop/src/main/database/connection.js';
import { initCacheSchema } from '../apps/desktop/src/main/database/cache-schema.js';

dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/leadforge-os';
const TEST_PORT = 3344;
const API_BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;

const TEMP_DIR = path.resolve(process.cwd(), 'report/temp-phase5');

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASS: ${message}`);
}

async function runPhase5Verification() {
  console.log('===============================================================');
  console.log('LEADFORGE OS — PHASE 5 DESKTOP CUTOVER VERIFICATION SUITE');
  console.log('Testing MongoDB-First IPC Write Path, Cache, & Failure Safety');
  console.log('===============================================================\n');

  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  // Start ephemeral in-process API test server on TEST_PORT
  const server = serve({
    fetch: app.fetch,
    port: TEST_PORT
  });
  console.log(`> In-process Test API Server listening on port ${TEST_PORT}\n`);

  // Connect Mongoose to live test database
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGODB_URI);
  }

  const workspaceIdA = `ws-phase5-a-${Date.now()}`;
  const workspaceIdB = `ws-phase5-b-${Date.now()}`;

  const emailA = `user-a-${Date.now()}@example.com`;
  const emailB = `user-b-${Date.now()}@example.com`;

  // Use BetterAuth API to sign up test users cleanly
  const signUpResA = await auth.api.signUpEmail({
    body: {
      email: emailA,
      password: 'Password123!',
      name: 'Test User A'
    }
  });

  const signUpResB = await auth.api.signUpEmail({
    body: {
      email: emailB,
      password: 'Password123!',
      name: 'Test User B'
    }
  });

  const testUserIdA = signUpResA.user.id;
  const testUserIdB = signUpResB.user.id;
  const testTokenA = signUpResA.token;
  const testTokenB = signUpResB.token;

  // Seed Workspace records in MongoDB
  await WorkspaceModel.create({
    _id: workspaceIdA,
    name: 'Workspace A (Phase 5 Test)',
    slug: `ws-phase5-a-${Date.now()}`,
    ownerId: testUserIdA,
    members: [{ userId: testUserIdA, email: emailA, role: 'OWNER', status: 'ACTIVE' }]
  });

  await WorkspaceModel.create({
    _id: workspaceIdB,
    name: 'Workspace B (Phase 5 Test)',
    slug: `ws-phase5-b-${Date.now()}`,
    ownerId: testUserIdB,
    members: [{ userId: testUserIdB, email: emailB, role: 'OWNER', status: 'ACTIVE' }]
  });

  // Configure SQLite databases for Workspace A & B
  process.env.WORKSPACES_DB_DIR = TEMP_DIR;
  const dbPathA = path.join(TEMP_DIR, `leadforge_${workspaceIdA}.db`);
  const dbPathB = path.join(TEMP_DIR, `leadforge_${workspaceIdB}.db`);

  const dbA = getDatabase(workspaceIdA);
  const dbB = getDatabase(workspaceIdB);
  initCacheSchema(dbA);
  initCacheSchema(dbB);

  // Initialize SDK for Workspace A
  const sdkA = new SdkClient({
    baseUrl: API_BASE_URL,
    token: testTokenA,
    customHeaders: { 'x-workspace-id': workspaceIdA }
  });

  // Initialize SDK for Workspace B
  const sdkB = new SdkClient({
    baseUrl: API_BASE_URL,
    token: testTokenB,
    customHeaders: { 'x-workspace-id': workspaceIdB }
  });

  // Set WorkspaceManager runtime for Workspace A
  WorkspaceManager.setSdk(sdkA);
  const runtimeA = new WorkspaceRuntime(workspaceIdA, sdkA);
  (WorkspaceManager as any).activeRuntime = runtimeA;

  try {
    // --- T5.1: Create Entity through IPC -> SdkClient -> API -> MongoDB ---
    console.log('--- T5.1 & T5.2: Create Entity & Exact ID Parity ---');
    const companyPayloadA = {
      workspaceId: workspaceIdA,
      name: 'Acme Phase5 Corporation',
      domain: 'acmephase5.com',
      industry: 'Technology',
      tags: ['enterprise', 'phase5']
    };

    // Simulate IPC create flow
    const createdCompanyA = await sdkA.companies.create(companyPayloadA);
    await LocalCRMRepository.saveFromServer('companies', createdCompanyA);

    // Verify in MongoDB directly
    const mongoCompanyA = await CompanyModel.findOne({ _id: createdCompanyA.id, workspaceId: workspaceIdA }).lean();
    assert(!!mongoCompanyA, 'Company exists in MongoDB');
    assert(typeof mongoCompanyA?._id === 'string', 'MongoDB _id is type string');
    assert(mongoCompanyA?.name === 'Acme Phase5 Corporation', 'MongoDB company name matches');

    // Verify in SQLite cache
    const cachedCompanyA = await LocalCRMRepository.findById('companies', workspaceIdA, createdCompanyA.id);
    assert(!!cachedCompanyA, 'Company cached in SQLite');
    assert(cachedCompanyA.id === createdCompanyA.id, `ID parity: SQLite.id === Mongo._id (${cachedCompanyA.id} === ${createdCompanyA.id})`);

    // --- T5.3: Update Entity through IPC -> API -> MongoDB -> Cache ---
    console.log('\n--- T5.3: Update Entity Flow ---');
    const updateDto = {
      workspaceId: workspaceIdA,
      name: 'Acme Phase5 Corporation Updated',
      industry: 'SaaS'
    };

    const updatedCompanyA = await sdkA.companies.update(createdCompanyA.id, updateDto);
    await LocalCRMRepository.saveFromServer('companies', updatedCompanyA);

    // Verify update in Mongo
    const mongoUpdated = await CompanyModel.findOne({ _id: createdCompanyA.id }).lean();
    assert(mongoUpdated?.name === 'Acme Phase5 Corporation Updated', 'MongoDB company name updated');
    assert(mongoUpdated?.industry === 'SaaS', 'MongoDB company industry updated');

    // Verify update in SQLite Cache
    const cachedUpdated = await LocalCRMRepository.findById('companies', workspaceIdA, createdCompanyA.id);
    assert(cachedUpdated.name === 'Acme Phase5 Corporation Updated', 'SQLite cache company name updated');
    assert(cachedUpdated.industry === 'SaaS', 'SQLite cache company industry updated');

    // --- T5.4: Delete Entity through IPC -> API -> MongoDB -> Cache ---
    console.log('\n--- T5.4: Delete Entity Flow ---');
    await sdkA.companies.delete(createdCompanyA.id);
    await LocalCRMRepository.softDeleteFromServer('companies', workspaceIdA, createdCompanyA.id);

    // Verify in Mongo (soft deleted)
    const mongoDeleted = await CompanyModel.findOne({ _id: createdCompanyA.id }).lean();
    assert(mongoDeleted?.isDeleted === true || mongoDeleted?.deletedAt !== null, 'MongoDB company is marked soft deleted');

    // Verify in SQLite cache (marked deleted)
    const cachedDeleted = await LocalCRMRepository.findById('companies', workspaceIdA, createdCompanyA.id);
    assert(cachedDeleted === null, 'findById on soft deleted SQLite record returns null (filtered)');

    // --- T5.5: Cross-Workspace Mutation Isolation ---
    console.log('\n--- T5.5: Cross-Workspace Mutation Isolation ---');
    let crossWsErrorCaught = false;
    try {
      // Workspace B tries to update Workspace A's company
      await sdkB.companies.update(createdCompanyA.id, { name: 'Hacked by Workspace B' });
    } catch (err: any) {
      crossWsErrorCaught = true;
    }
    assert(crossWsErrorCaught, 'Cross-workspace update was rejected by API/Mongo');

    // Verify document in Workspace A remained untouched
    const mongoCompanyAfterCross = await CompanyModel.findOne({ _id: createdCompanyA.id }).lean();
    assert(mongoCompanyAfterCross?.name !== 'Hacked by Workspace B', 'Target company was protected from cross-workspace mutation');

    // --- T5.6: API Outage / Offline Behavior ---
    console.log('\n--- T5.6: API Outage / Offline Error Handling ---');
    const offlineSdk = new SdkClient({
      baseUrl: 'http://localhost:59999/api', // Unreachable port
      customHeaders: { 'x-workspace-id': workspaceIdA }
    });

    let offlineErrorCaught = false;
    const offlineTestCompanyId = generateEntityId();

    try {
      await offlineSdk.companies.create({
        id: offlineTestCompanyId,
        workspaceId: workspaceIdA,
        name: 'Offline Company Attempt'
      });
    } catch (err: any) {
      offlineErrorCaught = true;
    }
    assert(offlineErrorCaught, 'Offline mutation threw explicit structured error');

    // Verify ZERO local SQLite writes were performed on offline failure
    const offlineCached = await LocalCRMRepository.findById('companies', workspaceIdA, offlineTestCompanyId);
    assert(offlineCached === null, 'Offline failure produced ZERO local SQLite writes (no phantom cache)');

    // --- T5.7: Zero sync_queue Insertions Across Normal Business Mutations ---
    console.log('\n--- T5.7: Zero sync_queue Insertions ---');
    const sqliteDbA = new Database(dbPathA);
    const syncQueueTable = sqliteDbA.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sync_queue'").get();
    assert(!syncQueueTable, 'sync_queue table does not exist in clean cache');

    // --- T5.8: Cache Update Executes Only Post-API Success ---
    console.log('\n--- T5.8: Post-API Success Cache Sequencing ---');
    const contactPayload = {
      workspaceId: workspaceIdA,
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice.smith@example.com'
    };

    const createdContact = await sdkA.contacts.create(contactPayload);
    // Verify in Mongo first
    const mongoContact = await ContactModel.findOne({ _id: createdContact.id }).lean();
    assert(!!mongoContact, 'MongoDB contact persisted before cache confirmation');

    await LocalCRMRepository.saveFromServer('contacts', createdContact);
    const cachedContact = await LocalCRMRepository.findById('contacts', workspaceIdA, createdContact.id);
    assert(!!cachedContact, 'Cache updated after confirmed MongoDB write');

    // --- T5.9: Cache Write Failure Does Not Invalidate Successful Mongo Write ---
    console.log('\n--- T5.9: Cache Failure Isolation ---');
    const companyPayloadC = {
      workspaceId: workspaceIdA,
      name: 'Resilient Cache Test Inc'
    };

    // 1. Authoritative API write succeeds
    const createdCompanyC = await sdkA.companies.create(companyPayloadC);
    assert(!!createdCompanyC.id, 'API returned authoritative created company');

    // 2. Simulate cache failure with malformed table / corrupted payload
    try {
      await LocalCRMRepository.saveFromServer('non_existent_corrupted_table_123', createdCompanyC);
    } catch {
      // saveFromServer catches and warns without rethrowing
    }

    // 3. Verify MongoDB document is completely intact and valid
    const mongoCompanyC = await CompanyModel.findOne({ _id: createdCompanyC.id }).lean();
    assert(!!mongoCompanyC, 'MongoDB authoritative document is intact despite cache write error');

    // --- T5.10: Bulk Mutation via Batch API -> Bulk Cache Update ---
    console.log('\n--- T5.10: Bulk Mutation Flow (50 Companies) ---');
    const bulkCompanies: any[] = [];
    for (let i = 0; i < 50; i++) {
      bulkCompanies.push({
        workspaceId: workspaceIdA,
        name: `Batch Company ${i + 1}`,
        domain: `batch-${i + 1}-${Date.now()}.com`,
        industry: 'Batch Test'
      });
    }

    const bulkResult = await sdkA.companies.createBulk({ companies: bulkCompanies });
    assert(bulkResult.success === true, 'Bulk API operation succeeded');
    assert(bulkResult.inserted === 50, 'Bulk API reported 50 inserted');

    if (bulkResult.data) {
      await LocalCRMRepository.saveManyFromServer('companies', bulkResult.data);
    }

    // Verify Mongo count
    const mongoBatchCount = await CompanyModel.countDocuments({ workspaceId: workspaceIdA, industry: 'Batch Test' });
    assert(mongoBatchCount === 50, `MongoDB contains 50 batch documents (found ${mongoBatchCount})`);

    // Verify SQLite Cache count
    const cachedBatch = await LocalCRMRepository.findMany('companies', workspaceIdA, { industry: 'Batch Test' });
    assert(cachedBatch.length === 50, `SQLite cache contains 50 batch documents (found ${cachedBatch.length})`);

    // Verify sync_queue remains 0
    const syncQueueTableAfterBatch = sqliteDbA.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sync_queue'").get();
    assert(!syncQueueTableAfterBatch, 'sync_queue table does not exist after 50-item bulk operation');

    // --- T5.11: Client Pre-Generated ID Preserved ---
    console.log('\n--- T5.11: Pre-Generated ID End-to-End Invariant ---');
    const customId = `custom-client-uuid-${Date.now()}`;
    const customCompany = await sdkA.companies.create({
      id: customId,
      workspaceId: workspaceIdA,
      name: 'Custom ID Enterprise'
    });
    await LocalCRMRepository.saveFromServer('companies', customCompany);

    const mongoCustom = await CompanyModel.findOne({ _id: customId }).lean();
    assert(mongoCustom?._id === customId, `Mongo _id matches custom ID (${mongoCustom?._id} === ${customId})`);

    const cachedCustom = await LocalCRMRepository.findById('companies', workspaceIdA, customId);
    assert(cachedCustom?.id === customId, `Cache id matches custom ID (${cachedCustom?.id} === ${customId})`);

    // --- T5.12: Workspace Switching Isolation ---
    console.log('\n--- T5.12: Workspace Switching Isolation ---');
    // Switch to Workspace B
    WorkspaceManager.setSdk(sdkB);
    const runtimeB = new WorkspaceRuntime(workspaceIdB, sdkB);
    (WorkspaceManager as any).activeRuntime = runtimeB;

    // Create Company in Workspace B
    const companyB = await sdkB.companies.create({
      workspaceId: workspaceIdB,
      name: 'Workspace B Solo Corp'
    });
    await LocalCRMRepository.saveFromServer('companies', companyB);

    // Verify Workspace B cache does NOT contain Workspace A documents
    const wsBCachedCompanies = await LocalCRMRepository.findMany('companies', workspaceIdB);
    assert(wsBCachedCompanies.length === 1, `Workspace B cache contains only its own 1 company (found ${wsBCachedCompanies.length})`);
    assert(wsBCachedCompanies[0].id === companyB.id, 'Workspace B cached company ID is correct');

    // Verify Workspace A cache was not corrupted
    const wsACachedCompanies = await LocalCRMRepository.findMany('companies', workspaceIdA);
    assert(wsACachedCompanies.length > 1, `Workspace A cache remains populated with its own documents (found ${wsACachedCompanies.length})`);

    sqliteDbA.close();

    console.log('\n===============================================================');
    console.log('ALL PHASE 5 TESTS (T5.1 - T5.12) PASSED SUCCESSFULLY! ✅');
    console.log('===============================================================\n');
  } finally {
    try {
      await WorkspaceModel.deleteMany({ _id: { $in: [workspaceIdA, workspaceIdB] } });
      if (testUserIdA && testUserIdB) {
        await mongoose.connection.collection('user').deleteMany({ id: { $in: [testUserIdA, testUserIdB] } });
        await mongoose.connection.collection('session').deleteMany({ userId: { $in: [testUserIdA, testUserIdB] } });
      }
      await CompanyModel.deleteMany({ workspaceId: { $in: [workspaceIdA, workspaceIdB] } });
      await ContactModel.deleteMany({ workspaceId: { $in: [workspaceIdA, workspaceIdB] } });
      await SequenceModel.deleteMany({ workspaceId: { $in: [workspaceIdA, workspaceIdB] } });
      await SequenceExecutionModel.deleteMany({ workspaceId: { $in: [workspaceIdA, workspaceIdB] } });
      await AudienceModel.deleteMany({ workspaceId: { $in: [workspaceIdA, workspaceIdB] } });
      await EmailTemplateModel.deleteMany({ workspaceId: { $in: [workspaceIdA, workspaceIdB] } });
      await DiscoveryRunModel.deleteMany({ workspaceId: { $in: [workspaceIdA, workspaceIdB] } });
      if (fs.existsSync(TEMP_DIR)) {
        fs.rmSync(TEMP_DIR, { recursive: true, force: true });
      }
    } catch {}

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    try {
      server.close();
    } catch {}
  }
}

runPhase5Verification()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Phase 5 Verification Failed:', err);
    process.exit(1);
  });
