/**
 * LEADFORGE OS — PHASE 6 VERIFICATION SUITE
 * 
 * Verifies Disposable SQLite Cache Cleanup & Simplification:
 *  - T6.1: Fresh Cache Initialization (creates cache schema directly)
 *  - T6.2: No Sync Tables (no sync_queue, sync_metadata, sync_dead_letter)
 *  - T6.3: No Sync Columns (no syncStatus, version columns in cache tables)
 *  - T6.4: Exact ID Parity (API.id === Mongo._id === SQLite.id)
 *  - T6.5: Full Cache Hydration from API -> MongoDB
 *  - T6.6: Paginated Hydration for Large Datasets
 *  - T6.7: Cache Reset & Rebuild (Deleting SQLite causes zero data loss)
 *  - T6.8: Cache Corruption Recovery
 *  - T6.9: Workspace Isolation
 *  - T6.10: Authoritative API Mutation -> Cache Update
 *  - T6.11: Cache Failure Isolation (Mongo write unaffected by cache error)
 *  - T6.12: No Authoritative Local Mutation (No sync_queue staging)
 *  - T6.13: Legacy DB Coexistence / Conversion
 *  - T6.14: Restart Persistence & Rehydration
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
import { auth } from '../apps/api/src/config/auth.js';
import { initCacheSchema, CACHE_TABLES } from '../apps/desktop/src/main/database/cache-schema.js';
import { LocalCRMRepository, CacheRepository } from '../apps/desktop/src/main/database/repositories/local-crm.js';
import { CacheHydrator } from '../apps/desktop/src/main/services/cache-hydrator.js';
import { getDatabase, closeDatabase } from '../apps/desktop/src/main/database/connection.js';
import {
  WorkspaceModel,
  CompanyModel,
  ContactModel,
  CampaignModel,
  SequenceModel,
  SequenceExecutionModel,
  EmailTemplateModel,
  EmailAccountModel,
  AudienceModel,
  DiscoveryRunModel
} from '../apps/api/src/db/models/index.js';

dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/leadforge-os';
const TEST_PORT = 3355;
const API_BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;

const TEMP_DIR = path.resolve(process.cwd(), 'report/temp-phase6');

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASS: ${message}`);
}

async function runPhase6Verification() {
  console.log('===============================================================');
  console.log('LEADFORGE OS — PHASE 6 CACHE CLEANUP VERIFICATION SUITE');
  console.log('Testing Disposable SQLite Cache, Hydration, & Rebuild Safety');
  console.log('===============================================================\n');

  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  // Start in-process API test server
  const server = serve({
    fetch: app.fetch,
    port: TEST_PORT
  });
  console.log(`> In-process Test API Server listening on port ${TEST_PORT}\n`);

  // Connect Mongoose to test database
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGODB_URI);
  }

  const workspaceIdA = `ws-phase6-a-${Date.now()}`;
  const workspaceIdB = `ws-phase6-b-${Date.now()}`;

  const emailA = `user-a-${Date.now()}@example.com`;
  const emailB = `user-b-${Date.now()}@example.com`;

  // Seed BetterAuth users & sessions
  const signUpResA = await auth.api.signUpEmail({
    body: { email: emailA, password: 'Password123!', name: 'User A' }
  });
  const signUpResB = await auth.api.signUpEmail({
    body: { email: emailB, password: 'Password123!', name: 'User B' }
  });

  const testUserIdA = signUpResA.user.id;
  const testUserIdB = signUpResB.user.id;
  const testTokenA = signUpResA.token;
  const testTokenB = signUpResB.token;

  // Seed Workspace records in MongoDB
  await WorkspaceModel.create({
    _id: workspaceIdA,
    name: 'Workspace A (Phase 6)',
    slug: `ws-phase6-a-${Date.now()}`,
    ownerId: testUserIdA,
    members: [{ userId: testUserIdA, email: emailA, role: 'OWNER', status: 'ACTIVE' }]
  });

  await WorkspaceModel.create({
    _id: workspaceIdB,
    name: 'Workspace B (Phase 6)',
    slug: `ws-phase6-b-${Date.now()}`,
    ownerId: testUserIdB,
    members: [{ userId: testUserIdB, email: emailB, role: 'OWNER', status: 'ACTIVE' }]
  });

  // Configure SQLite environment
  process.env.WORKSPACES_DB_DIR = TEMP_DIR;
  const dbPathA = path.join(TEMP_DIR, `leadforge_${workspaceIdA}.db`);
  const dbPathB = path.join(TEMP_DIR, `leadforge_${workspaceIdB}.db`);

  // Initialize SDK instances
  const sdkA = new SdkClient({
    baseUrl: API_BASE_URL,
    token: testTokenA,
    customHeaders: { 'x-workspace-id': workspaceIdA }
  });

  const sdkB = new SdkClient({
    baseUrl: API_BASE_URL,
    token: testTokenB,
    customHeaders: { 'x-workspace-id': workspaceIdB }
  });

  try {
    // --- T6.1: Fresh Cache Initialization ---
    console.log('--- T6.1: Fresh Cache Initialization ---');
    const freshDbPath = path.join(TEMP_DIR, `fresh_test_${Date.now()}.db`);
    const freshDb = new Database(freshDbPath);
    initCacheSchema(freshDb);

    const tablesInFreshDb = (
      freshDb.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all() as Array<{ name: string }>
    ).map((r) => r.name);

    for (const expectedTable of CACHE_TABLES) {
      assert(
        tablesInFreshDb.includes(expectedTable),
        `Cache table "${expectedTable}" exists in freshly initialized database`
      );
    }

    // --- T6.2: No Sync Tables in Fresh Schema ---
    console.log('\n--- T6.2: Zero Sync Tables in Fresh Schema ---');
    assert(!tablesInFreshDb.includes('sync_queue'), 'sync_queue is NOT in fresh cache schema');
    assert(!tablesInFreshDb.includes('sync_metadata'), 'sync_metadata is NOT in fresh cache schema');
    assert(!tablesInFreshDb.includes('sync_dead_letter'), 'sync_dead_letter is NOT in fresh cache schema');

    // --- T6.3: No Sync Columns in Cache Tables ---
    console.log('\n--- T6.3: Zero Sync Columns in Cache Tables ---');
    for (const table of ['companies', 'contacts', 'campaigns', 'sequences', 'templates', 'audiences']) {
      const columns = (freshDb.pragma(`table_info(${table})`) as Array<{ name: string }>).map((c) => c.name);
      assert(!columns.includes('syncStatus'), `Table "${table}" has NO syncStatus column`);
      assert(!columns.includes('version'), `Table "${table}" has NO sync version column`);
    }

    freshDb.close();
    if (fs.existsSync(freshDbPath)) fs.unlinkSync(freshDbPath);

    // --- T6.4 & T6.5: Full Cache Hydration from API -> MongoDB ---
    console.log('\n--- T6.4 & T6.5: Exact ID Parity & Full Cache Hydration ---');
    // Seed rich business datasets in MongoDB for Workspace A
    const comp1 = await CompanyModel.create({
      _id: generateEntityId(),
      workspaceId: workspaceIdA,
      name: 'Alpha Corp',
      domain: 'alphacorp.com',
      industry: 'Technology',
      tags: ['enterprise']
    });

    const cont1 = await ContactModel.create({
      _id: generateEntityId(),
      workspaceId: workspaceIdA,
      companyId: comp1._id,
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@alphacorp.com',
      title: 'VP Engineering'
    });

    const seq1 = await SequenceModel.create({
      _id: generateEntityId(),
      workspaceId: workspaceIdA,
      name: 'Cold Outreach Sequence',
      trigger: { type: 'MANUAL', config: {} },
      steps: [{ id: 'step-1', type: 'email', config: { name: 'Intro Email' } }]
    });

    const camp1 = await CampaignModel.create({
      _id: generateEntityId(),
      workspaceId: workspaceIdA,
      sequenceId: seq1._id,
      name: 'Q3 Enterprise Campaign',
      status: 'ACTIVE'
    });

    const tmpl1 = await EmailTemplateModel.create({
      _id: generateEntityId(),
      workspaceId: workspaceIdA,
      name: 'Introduction Template',
      subject: 'Quick question regarding {{company}}',
      body: 'Hello {{firstName}}, wanted to connect!'
    });

    const aud1 = await AudienceModel.create({
      _id: generateEntityId(),
      workspaceId: workspaceIdA,
      name: 'Tech Executives',
      type: 'STATIC',
      staticMemberIds: [cont1._id]
    });

    // Run cache hydration
    const hydrationRes = await CacheHydrator.hydrateWorkspaceCache(workspaceIdA, sdkA);
    assert(hydrationRes.success === true, 'Cache hydration completed successfully');
    assert(hydrationRes.recordsHydrated.companies >= 1, 'Hydrated at least 1 company');
    assert(hydrationRes.recordsHydrated.contacts >= 1, 'Hydrated at least 1 contact');
    assert(hydrationRes.recordsHydrated.campaigns >= 1, 'Hydrated at least 1 campaign');
    assert(hydrationRes.recordsHydrated.sequences >= 1, 'Hydrated at least 1 sequence');
    assert(hydrationRes.recordsHydrated.templates >= 1, 'Hydrated at least 1 template');
    assert(hydrationRes.recordsHydrated.audiences >= 1, 'Hydrated at least 1 audience');

    // Verify exact ID parity in SQLite cache
    const cachedComp = await LocalCRMRepository.findById('companies', workspaceIdA, comp1._id);
    assert(!!cachedComp, 'Company found in SQLite cache');
    assert(cachedComp.id === comp1._id, `Exact ID parity: SQLite.id === Mongo._id (${cachedComp.id} === ${comp1._id})`);
    assert(cachedComp.name === 'Alpha Corp', 'Cached company name matches');
    assert(Array.isArray(cachedComp.tags), 'Cached company tags parsed as array');

    const cachedCont = await LocalCRMRepository.findById('contacts', workspaceIdA, cont1._id);
    assert(!!cachedCont, 'Contact found in SQLite cache');
    assert(cachedCont.id === cont1._id, `Exact ID parity: SQLite.id === Mongo._id (${cachedCont.id} === ${cont1._id})`);
    assert(cachedCont.companyId === comp1._id, 'Cached foreign key companyId matches');

    // --- T6.6: Paginated Hydration for Large Datasets ---
    console.log('\n--- T6.6: Paginated Hydration for Large Datasets ---');
    const bulkContacts: any[] = [];
    for (let i = 0; i < 250; i++) {
      bulkContacts.push({
        _id: generateEntityId(),
        workspaceId: workspaceIdA,
        companyId: comp1._id,
        firstName: `Contact${i + 1}`,
        lastName: 'Test',
        email: `contact${i + 1}@alphacorp.com`
      });
    }
    await ContactModel.insertMany(bulkContacts);

    const paginatedHydration = await CacheHydrator.hydrateWorkspaceCache(workspaceIdA, sdkA);
    assert(paginatedHydration.success === true, 'Paginated hydration succeeded');
    assert(paginatedHydration.recordsHydrated.contacts >= 251, `Hydrated all 251 contacts (got ${paginatedHydration.recordsHydrated.contacts})`);

    const cachedContacts = await LocalCRMRepository.findMany('contacts', workspaceIdA);
    assert(cachedContacts.length >= 251, `SQLite cache contains all ${cachedContacts.length} contacts`);

    // --- T6.7: Cache Reset & Rebuild (Zero Data Loss on Deletion) ---
    console.log('\n--- T6.7: Cache Reset & Rebuild (Deleting SQLite causes ZERO data loss) ---');
    closeDatabase(workspaceIdA);

    // Completely delete the SQLite database file
    if (fs.existsSync(dbPathA)) {
      fs.unlinkSync(dbPathA);
      console.log(`[Test] Deleted SQLite file: ${dbPathA}`);
    }
    assert(!fs.existsSync(dbPathA), 'SQLite cache file was deleted from disk');

    // Rebuild cache exclusively from MongoDB via SdkClient
    const rebuildRes = await CacheHydrator.hydrateWorkspaceCache(workspaceIdA, sdkA);
    assert(rebuildRes.success === true, 'Cache rebuild succeeded on fresh file');

    // Verify all business records were fully restored
    const restoredComp = await LocalCRMRepository.findById('companies', workspaceIdA, comp1._id);
    assert(!!restoredComp, 'Company fully restored in rebuilt cache');
    assert(restoredComp.name === 'Alpha Corp', 'Restored company data is identical');

    const restoredContacts = await LocalCRMRepository.findMany('contacts', workspaceIdA);
    assert(restoredContacts.length >= 251, `All ${restoredContacts.length} contacts restored with zero data loss`);

    // --- T6.8: Cache Corruption Recovery ---
    console.log('\n--- T6.8: Cache Corruption Recovery ---');
    // Simulate corrupt table by writing garbage
    const dbCorrupt = getDatabase(workspaceIdA);
    try {
      dbCorrupt.prepare('DROP TABLE companies').run();
    } catch {}

    // Verify recovery via resetAndRehydrate
    const recoveryRes = await CacheHydrator.resetAndRehydrateWorkspaceCache(workspaceIdA, sdkA);
    assert(recoveryRes.success === true, 'Corruption recovery and rehydration succeeded');

    const recoveredComp = await LocalCRMRepository.findById('companies', workspaceIdA, comp1._id);
    assert(!!recoveredComp, 'Recovered company exists after corruption recovery');

    // --- T6.9: Workspace Isolation ---
    console.log('\n--- T6.9: Workspace Isolation ---');
    // Create company in Workspace B
    const compB = await CompanyModel.create({
      _id: generateEntityId(),
      workspaceId: workspaceIdB,
      name: 'Beta Global Inc',
      domain: 'betaglobal.com'
    });

    await CacheHydrator.hydrateWorkspaceCache(workspaceIdB, sdkB);

    const wsACache = await LocalCRMRepository.findMany('companies', workspaceIdA);
    const wsBCache = await LocalCRMRepository.findMany('companies', workspaceIdB);

    assert(wsACache.some((c) => c.id === comp1._id), 'Workspace A cache contains Alpha Corp');
    assert(!wsACache.some((c) => c.id === compB._id), 'Workspace A cache does NOT contain Beta Global');
    assert(wsBCache.some((c) => c.id === compB._id), 'Workspace B cache contains Beta Global');
    assert(!wsBCache.some((c) => c.id === comp1._id), 'Workspace B cache does NOT contain Alpha Corp');

    // --- T6.10: Authoritative Mutation -> Cache Update ---
    console.log('\n--- T6.10: Authoritative Mutation -> Cache Update ---');
    const updatePayload = { name: 'Alpha Corporation International' };
    const updatedFromApi = await sdkA.companies.update(comp1._id, updatePayload);
    await LocalCRMRepository.saveFromServer('companies', updatedFromApi);

    const cachedAfterUpdate = await LocalCRMRepository.findById('companies', workspaceIdA, comp1._id);
    assert(cachedAfterUpdate.name === 'Alpha Corporation International', 'Cache reflects authoritative updated name');

    // --- T6.11: Cache Failure Isolation ---
    console.log('\n--- T6.11: Cache Failure Isolation ---');
    const newCompFromApi = await sdkA.companies.create({
      workspaceId: workspaceIdA,
      name: 'Resilience Test Ltd'
    });
    assert(!!newCompFromApi.id, 'API created company successfully');

    // Attempt cache save into invalid table
    await LocalCRMRepository.saveFromServer('invalid_nonexistent_table_xyz', newCompFromApi);

    // Verify MongoDB document is intact
    const mongoDoc = await CompanyModel.findOne({ _id: newCompFromApi.id }).lean();
    assert(!!mongoDoc, 'MongoDB document intact despite cache failure');

    // --- T6.12: No Authoritative Local Mutation ---
    console.log('\n--- T6.12: No Authoritative Local Mutation ---');
    const dbCheck = getDatabase(workspaceIdA);
    const hasSyncQueue = dbCheck
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='sync_queue'`)
      .get();
    assert(!hasSyncQueue, 'Zero sync_queue table exists for local mutation staging');

    // --- T6.13: Legacy DB Handling ---
    console.log('\n--- T6.13: Legacy DB Handling ---');
    const legacyPath = path.join(TEMP_DIR, `legacy_db_${Date.now()}.db`);
    const legacyDb = new Database(legacyPath);
    legacyDb.prepare(`CREATE TABLE IF NOT EXISTS legacy_dummy (id TEXT PRIMARY KEY)`).run();
    initCacheSchema(legacyDb);

    const legacyTables = (
      legacyDb.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all() as Array<{ name: string }>
    ).map((r) => r.name);

    assert(legacyTables.includes('companies'), 'Legacy database converted to support cache tables');
    assert(legacyTables.includes('cache_metadata'), 'Legacy database contains cache_metadata');
    legacyDb.close();
    if (fs.existsSync(legacyPath)) fs.unlinkSync(legacyPath);

    // --- T6.14: Restart Persistence & Rehydration ---
    console.log('\n--- T6.14: Restart Persistence & Rehydration ---');
    closeDatabase(workspaceIdA);
    const dbReopen = getDatabase(workspaceIdA);
    const countAfterReopen = dbReopen.prepare('SELECT COUNT(*) as count FROM companies').get() as { count: number };
    assert(countAfterReopen.count > 0, `Cached records persisted across restart (found ${countAfterReopen.count})`);

    console.log('\n===============================================================');
    console.log('ALL PHASE 6 TESTS (T6.1 - T6.14) PASSED SUCCESSFULLY! ✅');
    console.log('===============================================================\n');
  } finally {
    // Cleanup synthetic fixtures
    closeDatabase(workspaceIdA);
    closeDatabase(workspaceIdB);

    try {
      await WorkspaceModel.deleteMany({ _id: { $in: [workspaceIdA, workspaceIdB] } });
      await mongoose.connection.collection('user').deleteMany({ id: { $in: [testUserIdA, testUserIdB] } });
      await mongoose.connection.collection('session').deleteMany({ userId: { $in: [testUserIdA, testUserIdB] } });
      await CompanyModel.deleteMany({ workspaceId: { $in: [workspaceIdA, workspaceIdB] } });
      await ContactModel.deleteMany({ workspaceId: { $in: [workspaceIdA, workspaceIdB] } });
      await CampaignModel.deleteMany({ workspaceId: { $in: [workspaceIdA, workspaceIdB] } });
      await SequenceModel.deleteMany({ workspaceId: { $in: [workspaceIdA, workspaceIdB] } });
      await SequenceExecutionModel.deleteMany({ workspaceId: { $in: [workspaceIdA, workspaceIdB] } });
      await EmailTemplateModel.deleteMany({ workspaceId: { $in: [workspaceIdA, workspaceIdB] } });
      await EmailAccountModel.deleteMany({ workspaceId: { $in: [workspaceIdA, workspaceIdB] } });
      await AudienceModel.deleteMany({ workspaceId: { $in: [workspaceIdA, workspaceIdB] } });
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

runPhase6Verification()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Phase 6 Verification Failed:', err);
    process.exit(1);
  });
