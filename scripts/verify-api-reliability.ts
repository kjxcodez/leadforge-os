import * as path from 'path';
import assert from 'assert';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import {
  WorkspaceModel,
  CompanyModel,
  ContactModel,
  CampaignModel,
  SequenceModel,
  SequenceExecutionModel,
  EmailTemplateModel,
  AutomationLockModel,
  WorkspaceMemoryModel,
  JobModel,
  SystemLogModel
} from '../apps/api/src/db/models/index.js';
import { BaseRepository } from '../apps/api/src/repositories/base/base.repository.js';
import { AutomationLockRepository } from '../apps/api/src/repositories/automation-lock/automation-lock.repository.js';
import { WorkspaceMemoryRepository } from '../apps/api/src/repositories/workspace-memory/workspace-memory.repository.js';
import { AutomationService } from '../apps/api/src/services/automation/automation.service.js';
import { OutreachService } from '../apps/api/src/services/outreach/outreach.service.js';
import { CampaignStatus, JobStatus } from '@leadforge/schema';

dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/leadforge-os';

async function run() {
  console.log('========================================================================');
  console.log(' LeadForge OS — API Forensics & Repository Reliability Verification');
  console.log('========================================================================\n');

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGODB_URI);
  }

  // Intercept warnings to verify zero Mongoose deprecations
  const deprecationWarnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    const text = args.join(' ');
    if (text.toLowerCase().includes('deprecated') || text.toLowerCase().includes('findoneandupdate')) {
      deprecationWarnings.push(text);
    }
    originalWarn(...args);
  };

  const testWsId = 'ws-api-forensics-' + Date.now();

  try {
    // Test 1: BaseRepository update & atomicFindOneAndUpdate (Zero Mongoose Deprecations)
    console.log('--- [Test 1] BaseRepository returnDocument: "after" & Deprecation Check ---');
    const compRepo = new BaseRepository<any>(CompanyModel, testWsId);
    const createdComp = await compRepo.create({
      name: 'Forensics Test Corp',
      domain: 'forensics-test.com',
      industry: 'Technology'
    });

    const updatedComp = await compRepo.update(createdComp.id, {
      name: 'Forensics Test Corp - Updated',
      industry: 'SaaS'
    });

    assert.strictEqual(updatedComp.name, 'Forensics Test Corp - Updated', 'Updated document must reflect changes');
    assert.strictEqual(updatedComp.industry, 'SaaS');

    const atomicUpdated = await compRepo.atomicFindOneAndUpdate(
      { _id: createdComp.id },
      { $set: { location: 'San Francisco, CA' } }
    );
    assert.strictEqual(atomicUpdated?.location, 'San Francisco, CA');
    assert.strictEqual(deprecationWarnings.length, 0, 'Zero Mongoose deprecation warnings must be emitted');
    console.log('✅ Test 1 Passed: BaseRepository executes clean updates without deprecation warnings.');

    // Test 2: AutomationLockRepository Acquire and Renew
    console.log('\n--- [Test 2] AutomationLockRepository Atomic Locking ---');
    const lockRepo = new AutomationLockRepository(testWsId);
    const lock1 = await lockRepo.acquireLock('seq-101', 'contact-202', 'worker-node-1', 30000);
    assert.ok(lock1.acquired, 'Lock should be acquired successfully');

    const lockConflict = await lockRepo.acquireLock('seq-101', 'contact-202', 'worker-node-2', 30000);
    assert.strictEqual(lockConflict.acquired, false, 'Conflicting lock must be rejected');

    const renewed = await lockRepo.renewLock('seq-101', 'contact-202', 'worker-node-1', 60000);
    assert.ok(renewed, 'Owner must be able to renew lock');

    await lockRepo.releaseLock('seq-101', 'contact-202', 'worker-node-1');
    console.log('✅ Test 2 Passed: AutomationLockRepository atomic locking and renewals verified.');

    // Test 3: WorkspaceMemoryRepository Persistence
    console.log('\n--- [Test 3] WorkspaceMemoryRepository Set and Get ---');
    const memoryRepo = new WorkspaceMemoryRepository(testWsId);
    const memDoc = await memoryRepo.setMemory('scraper_state', 'last_query', { q: 'Dentists NY', count: 42 });
    assert.ok(memDoc, 'Memory doc must be returned');
    assert.strictEqual(memDoc.value?.count, 42);

    const fetchedMem = await memoryRepo.getMemory('scraper_state', 'last_query');
    assert.strictEqual(fetchedMem?.value?.q, 'Dentists NY');
    console.log('✅ Test 3 Passed: WorkspaceMemoryRepository persistence verified.');

    // Test 4: AutomationService UpdateSequence & Executions
    console.log('\n--- [Test 4] AutomationService Sequence & Execution Updates ---');
    const autoService = new AutomationService(testWsId);
    const seq = await SequenceModel.create({
      workspaceId: testWsId,
      name: 'API Reliability Sequence',
      trigger: { type: 'manual' },
      steps: [{ id: 'step-1', type: 'EMAIL', templateId: 'tpl-1' }]
    });

    const updatedSeq = await autoService.updateSequence(seq.id, { name: 'API Reliability Sequence - Renamed' });
    assert.strictEqual(updatedSeq.name, 'API Reliability Sequence - Renamed');

    const exec = await autoService.createExecution({
      sequenceId: seq.id,
      campaignId: 'camp-1',
      contactId: 'ct-1',
      status: 'RUNNING'
    });

    const updatedExec = await autoService.updateExecution(exec.id, { status: 'COMPLETED' });
    assert.strictEqual(updatedExec.status, 'COMPLETED');
    console.log('✅ Test 4 Passed: AutomationService sequence and execution management verified.');

    // Test 5: OutreachService UpdateTemplate
    console.log('\n--- [Test 5] OutreachService UpdateTemplate ---');
    const outreachService = new OutreachService(testWsId);
    const tpl = await EmailTemplateModel.create({
      workspaceId: testWsId,
      name: 'Initial Welcome',
      subject: 'Hello {{firstName}}',
      body: 'Welcome aboard!'
    });

    const updatedTpl = await outreachService.updateTemplate(tpl.id, {
      name: 'Welcome Series V2',
      subject: 'Special Welcome {{firstName}}'
    });
    assert.strictEqual(updatedTpl.name, 'Welcome Series V2');
    console.log('✅ Test 5 Passed: OutreachService updateTemplate verified.');

    // Test 6: Campaign Status Contract
    console.log('\n--- [Test 6] CampaignStatus Enum Contract ---');
    const camp = await CampaignModel.create({
      workspaceId: testWsId,
      name: 'Forensics Campaign',
      status: CampaignStatus.DRAFT,
      dailyLimit: 50
    });

    camp.status = CampaignStatus.ACTIVE;
    await camp.save();
    assert.strictEqual(camp.status, 'ACTIVE');

    camp.status = CampaignStatus.PAUSED;
    await camp.save();
    assert.strictEqual(camp.status, 'PAUSED');
    console.log('✅ Test 6 Passed: CampaignStatus conforms strictly to canonical enums.');

    // Test 7: System Logs API
    console.log('\n--- [Test 7] SystemLogs Creation & Query ---');
    const logDoc = await SystemLogModel.create({
      workspaceId: testWsId,
      severity: 'info',
      task: 'discovery',
      message: 'Discovery batch completed',
      metadata: { count: 25, durationMs: 1420 }
    });
    assert.ok(logDoc._id);
    const logs = await SystemLogModel.find({ workspaceId: testWsId });
    assert.ok(logs.length >= 1);
    console.log('✅ Test 7 Passed: SystemLog persistence verified.');

    // Clean up
    await CompanyModel.deleteMany({ workspaceId: testWsId });
    await SequenceModel.deleteMany({ workspaceId: testWsId });
    await SequenceExecutionModel.deleteMany({ workspaceId: testWsId });
    await EmailTemplateModel.deleteMany({ workspaceId: testWsId });
    await CampaignModel.deleteMany({ workspaceId: testWsId });
    await SystemLogModel.deleteMany({ workspaceId: testWsId });
    await AutomationLockModel.deleteMany({ workspaceId: testWsId });
    await WorkspaceMemoryModel.deleteMany({ workspaceId: testWsId });

    assert.strictEqual(deprecationWarnings.length, 0, `Expected 0 Mongoose deprecations, got: ${deprecationWarnings.join(', ')}`);

    console.log('\n========================================================================');
    console.log(' ALL 7 API FORENSIC & RELIABILITY TESTS PASSED (0 DEPRECATION WARNINGS)');
    console.log('========================================================================');
  } finally {
    console.warn = originalWarn;
  }
}

run().catch((err) => {
  console.error('❌ API Reliability Verification Failed:', err);
  process.exit(1);
});
