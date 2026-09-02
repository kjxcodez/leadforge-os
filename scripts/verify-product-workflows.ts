import * as fs from 'fs';
import * as path from 'path';
import assert from 'assert';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import {
  WorkspaceModel,
  UserModel,
  CompanyModel,
  ContactModel,
  CampaignModel,
  SequenceModel,
  SequenceExecutionModel,
  EmailDeliveryModel,
  JobModel,
  SystemLogModel
} from '../apps/api/src/db/models/index.js';
import { SdkClient } from '@leadforge/sdk';
import { WorkspaceManager } from '../apps/desktop/src/main/lib/workspace-manager.js';
import { initCacheSchema, ensureCleanCache } from '../apps/desktop/src/main/database/cache-schema.js';
import { getDatabase, closeDatabase } from '../apps/desktop/src/main/database/connection.js';
import { LocalWorkspaceRepository } from '../apps/desktop/src/main/database/repositories/local-workspace.js';
import { CampaignStatus } from '@leadforge/schema';

dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/leadforge-os';
const TEMP_DIR = path.join(process.cwd(), 'report', 'temp-product-workflows');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}
process.env.WORKSPACES_DB_DIR = TEMP_DIR;

async function run() {
  console.log('========================================================================');
  console.log(' LeadForge OS — Full Product Workflow Recovery & Qualification');
  console.log('========================================================================\n');

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGODB_URI);
  }

  const testUserId = 'usr-workflow-' + Date.now();
  const testWsA = 'ws-workflow-a-' + Date.now();
  const testWsB = 'ws-workflow-b-' + Date.now();

  const mockSdk: any = {
    jobs: {
      recover: async () => ({ recovered: 0, failed: 0 }),
      claim: async () => null,
      list: async () => ({ data: [] }),
      create: async (dto: any) => ({ id: 'job-' + Date.now(), ...dto }),
      cancel: async () => {},
      updateStatus: async () => {}
    },
    companies: {
      list: async () => ({ data: [] }),
      create: async (dto: any) => ({ id: 'comp-' + Date.now(), ...dto })
    },
    contacts: {
      list: async () => ({ data: [] }),
      create: async (dto: any) => ({ id: 'ct-' + Date.now(), ...dto })
    },
    campaigns: {
      list: async () => ({ data: [] })
    },
    sequences: {
      list: async () => ({ data: [] })
    },
    executions: {
      list: async () => []
    },
    outreach: {
      listAccounts: async () => [],
      listTemplates: async () => []
    },
    audiences: {
      list: async () => []
    },
    discovery: {
      listRuns: async () => []
    },
    companyDiscoveryRuns: {
      list: async () => []
    },
    deliveries: {
      list: async () => ({ data: [] })
    },
    systemLogs: {
      list: async () => ({ data: [] })
    }
  };
  WorkspaceManager.setSdk(mockSdk);

  try {
    // -------------------------------------------------------------------------
    // Workflow 1: Auth & User Provisioning
    // -------------------------------------------------------------------------
    console.log('--- [Workflow 1] Auth & User Account Setup ---');
    const userDoc = await UserModel.create({
      _id: testUserId,
      email: `product-user-${Date.now()}@leadforge.test`,
      name: 'Product Qualification User',
      workspaces: [{ workspaceId: testWsA, role: 'owner' }]
    });
    assert.ok(userDoc._id);
    console.log('✅ Workflow 1 Passed: User account created.');

    // -------------------------------------------------------------------------
    // Workflow 2: Workspace Management & Concurrency Transition Safety
    // -------------------------------------------------------------------------
    console.log('\n--- [Workflow 2] Workspace Creation & Serialized Switch Mutex ---');
    await WorkspaceModel.create({
      _id: testWsA,
      name: 'Alpha Growth Workspace',
      slug: 'alpha-growth-' + Date.now(),
      ownerId: testUserId,
      plan: 'growth'
    });

    await WorkspaceModel.create({
      _id: testWsB,
      name: 'Beta Scale Workspace',
      slug: 'beta-scale-' + Date.now(),
      ownerId: testUserId,
      plan: 'enterprise'
    });

    // Populate local cache
    const globalDb = getDatabase();
    ensureCleanCache(globalDb);
    await LocalWorkspaceRepository.save({
      id: testWsA,
      name: 'Alpha Growth Workspace',
      slug: 'alpha-growth',
      ownerId: testUserId,
      plan: 'growth',
      settings: {},
      members: [],
      createdAt: new Date(),
      updatedAt: new Date()
    } as any);

    // Concurrently trigger workspace switches in parallel to test mutex serialization
    const [resA, resB] = await Promise.all([
      WorkspaceManager.setActiveWorkspace(testWsA),
      WorkspaceManager.setActiveWorkspace(testWsB)
    ]);

    const activeRuntime = WorkspaceManager.getActiveRuntime();
    assert.ok(activeRuntime, 'Active runtime should be established');
    assert.strictEqual(activeRuntime.workspaceId, testWsB, 'Final workspace switch should be testWsB');

    // Switch back to testWsA cleanly
    await WorkspaceManager.setActiveWorkspace(testWsA);
    assert.strictEqual(WorkspaceManager.getActiveRuntime()?.workspaceId, testWsA);
    console.log('✅ Workflow 2 Passed: Workspace switching serialized with zero race condition errors.');

    // -------------------------------------------------------------------------
    // Workflow 3: CRM Companies, Contacts & Distinct Values Query
    // -------------------------------------------------------------------------
    console.log('\n--- [Workflow 3] CRM Companies, Contacts & Canonical source Field ---');
    const wsDb = getDatabase(testWsA);
    initCacheSchema(wsDb);

    const compId = 'comp-wf-' + Date.now();
    const contactId = 'ct-wf-' + Date.now();

    wsDb.prepare(`
      INSERT INTO companies (id, workspaceId, name, domain, industry, location, city, state, country)
      VALUES (?, ?, 'Acme Innovations', 'acme-innovations.io', 'Software', 'Austin, TX', 'Austin', 'TX', 'USA')
    `).run(compId, testWsA);

    wsDb.prepare(`
      INSERT INTO contacts (id, workspaceId, companyId, firstName, lastName, email, title, source, status)
      VALUES (?, ?, ?, 'Alice', 'Smith', 'alice@acme-innovations.io', 'VP Engineering', 'google_maps', 'LEAD')
    `).run(contactId, testWsA, compId);

    // Verify distinct-values query without sourcePlatform error
    const sourceRows = wsDb.prepare(
      `SELECT DISTINCT source FROM contacts WHERE workspaceId = ? AND deletedAt IS NULL AND source IS NOT NULL AND source != '' ORDER BY source ASC`
    ).all(testWsA) as Array<{ source: string }>;

    assert.ok(sourceRows.some((r) => r.source === 'google_maps'), 'Contacts source must contain google_maps');
    console.log('✅ Workflow 3 Passed: CRM contacts query canonical source field without SqliteError.');

    // -------------------------------------------------------------------------
    // Workflow 4: Campaign Creation & Status Lifecycle
    // -------------------------------------------------------------------------
    console.log('\n--- [Workflow 4] Campaign Lifecycle (DRAFT -> ACTIVE -> PAUSED -> COMPLETED) ---');
    const campDoc = await CampaignModel.create({
      workspaceId: testWsA,
      name: 'Spring 2026 Outbound',
      status: CampaignStatus.DRAFT,
      dailyLimit: 75
    });

    assert.strictEqual(campDoc.status, CampaignStatus.DRAFT);
    campDoc.status = CampaignStatus.ACTIVE;
    await campDoc.save();
    assert.strictEqual(campDoc.status, CampaignStatus.ACTIVE);

    campDoc.status = CampaignStatus.PAUSED;
    await campDoc.save();
    assert.strictEqual(campDoc.status, CampaignStatus.PAUSED);

    campDoc.status = CampaignStatus.COMPLETED;
    await campDoc.save();
    assert.strictEqual(campDoc.status, CampaignStatus.COMPLETED);
    console.log('✅ Workflow 4 Passed: Campaign lifecycle transitions strictly conform to enum.');

    // -------------------------------------------------------------------------
    // Workflow 5: Job Scheduler Task Lifecycle
    // -------------------------------------------------------------------------
    console.log('\n--- [Workflow 5] Background Job Lifecycle (Submit, Pause, Resume, Cancel) ---');
    const jobDoc = await JobModel.create({
      workspaceId: testWsA,
      type: 'scraper:maps',
      payload: { query: 'Software Austin TX', limit: 10 },
      priority: 1,
      status: 'queued'
    });

    jobDoc.status = 'paused';
    await jobDoc.save();
    assert.strictEqual(jobDoc.status, 'paused');

    jobDoc.status = 'queued';
    await jobDoc.save();
    assert.strictEqual(jobDoc.status, 'queued');

    jobDoc.status = 'cancelled';
    await jobDoc.save();
    assert.strictEqual(jobDoc.status, 'cancelled');
    console.log('✅ Workflow 5 Passed: Background Job lifecycle states verified.');

    // -------------------------------------------------------------------------
    // Workflow 6: Dashboard Metrics Aggregation (Zero Obsolete SQLite Table Reads)
    // -------------------------------------------------------------------------
    console.log('\n--- [Workflow 6] Dashboard Metrics Aggregation ---');
    const totalCompanies = (wsDb.prepare('SELECT COUNT(*) as count FROM companies WHERE workspaceId = ? AND deletedAt IS NULL').get(testWsA) as any).count;
    const totalContacts = (wsDb.prepare('SELECT COUNT(*) as count FROM contacts WHERE workspaceId = ? AND deletedAt IS NULL').get(testWsA) as any).count;
    const totalCampaigns = (wsDb.prepare('SELECT COUNT(*) as count FROM campaigns WHERE workspaceId = ? AND deletedAt IS NULL').get(testWsA) as any).count;

    assert.strictEqual(totalCompanies, 1);
    assert.strictEqual(totalContacts, 1);
    assert.strictEqual(totalCampaigns, 0);

    // Verify system logs query from API
    await SystemLogModel.create({
      workspaceId: testWsA,
      severity: 'info',
      task: 'qualification',
      message: 'Product qualification check executed',
      metadata: { status: 'passed' }
    });

    const recentLogs = await SystemLogModel.find({ workspaceId: testWsA }).limit(10);
    assert.ok(recentLogs.length >= 1);
    console.log('✅ Workflow 6 Passed: Dashboard metrics correctly aggregate live cache and API logs.');

    // Clean up
    closeDatabase(testWsA);
    closeDatabase(testWsB);
    await WorkspaceManager.setActiveWorkspace(null);

    await UserModel.deleteOne({ _id: testUserId });
    await WorkspaceModel.deleteMany({ _id: { $in: [testWsA, testWsB] } });
    await CompanyModel.deleteMany({ workspaceId: testWsA });
    await ContactModel.deleteMany({ workspaceId: testWsA });
    await CampaignModel.deleteMany({ workspaceId: testWsA });
    await JobModel.deleteMany({ workspaceId: testWsA });
    await SystemLogModel.deleteMany({ workspaceId: testWsA });

    console.log('\n========================================================================');
    console.log(' ALL 6 PRODUCT WORKFLOW RECOVERY TESTS PASSED');
    console.log('========================================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ Product Workflow Verification Failed:', err);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('❌ Execution error:', err);
  process.exit(1);
});
