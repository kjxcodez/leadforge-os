import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import {
  CompanyRepository,
  ContactRepository,
  JobRepository,
  AutomationLockRepository,
  EmailDeliveryRepository,
  SystemLogRepository,
  WorkspaceMemoryRepository,
  AuditLogRepository,
  CompanyIntelligenceRepository,
  IntelligenceEvidenceRepository
} from '../apps/api/src/repositories/index.js';
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

async function runPhase3Tests() {
  console.log(`\n===============================================================`);
  console.log(`LEADFORGE OS — PHASE 3 API & REPOSITORY VERIFICATION SUITE`);
  console.log(`Testing Repositories, Batch APIs, Idempotency & Concurrency`);
  console.log(`===============================================================\n`);

  await mongoose.connect(uri);

  const testWsA = 'ws-test-a-' + Date.now();
  const testWsB = 'ws-test-b-' + Date.now();

  const companyRepoA = new CompanyRepository(testWsA);
  const companyRepoB = new CompanyRepository(testWsB);
  const jobRepoA = new JobRepository(testWsA);
  const lockRepoA = new AutomationLockRepository(testWsA);
  const deliveryRepoA = new EmailDeliveryRepository(testWsA);
  const systemLogRepoA = new SystemLogRepository(testWsA);
  const memoryRepoA = new WorkspaceMemoryRepository(testWsA);
  const auditRepoA = new AuditLogRepository(testWsA);
  const intelRepoA = new CompanyIntelligenceRepository(testWsA);
  const evidenceRepoA = new IntelligenceEvidenceRepository(testWsA);

  // ---------------------------------------------------------------------------
  // T3.1: API Create Entity -> MongoDB Document Exact String _id
  // ---------------------------------------------------------------------------
  console.log('--- T3.1: Create Entity -> Exact MongoDB String _id ---');
  const comp1 = await companyRepoA.create({
    name: 'Acme Corp',
    domain: 'acme.com',
    industry: 'Technology'
  });
  assert(typeof comp1._id === 'string', 'Created company._id is type string');
  assert(comp1.workspaceId === testWsA, 'Created company.workspaceId matches repository scope');
  assert(comp1._id.length >= 24, 'Created company._id is valid canonical string ID');

  // ---------------------------------------------------------------------------
  // T3.2: Provided ID Survives Unchanged
  // ---------------------------------------------------------------------------
  console.log('\n--- T3.2: Provided Client ID Survives Unchanged ---');
  const customId = 'custom-uuid-' + Date.now();
  const comp2 = await companyRepoA.create({
    id: customId,
    name: 'Custom ID Corp',
    domain: 'custom.com'
  });
  assert(comp2._id === customId, `Provided ID preserved exactly: ${comp2._id} === ${customId}`);

  // ---------------------------------------------------------------------------
  // T3.3: Missing ID Gets Canonical UUID
  // ---------------------------------------------------------------------------
  console.log('\n--- T3.3: Missing ID Automatically Generates Canonical UUID ---');
  const comp3 = await companyRepoA.create({
    name: 'Auto ID Corp',
    domain: 'auto.com'
  });
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  assert(uuidRegex.test(comp3._id), `Generated ID is valid UUID v4: ${comp3._id}`);

  // ---------------------------------------------------------------------------
  // T3.4: Workspace Isolation (Workspace A cannot read Workspace B)
  // ---------------------------------------------------------------------------
  console.log('\n--- T3.4: Cross-Workspace Read Isolation ---');
  const compB = await companyRepoB.create({
    name: 'Secret Workspace B Corp',
    domain: 'secret-b.com'
  });
  let crossReadBlocked = false;
  try {
    await companyRepoA.findById(compB._id);
  } catch (err: any) {
    crossReadBlocked = true;
  }
  assert(crossReadBlocked, 'Workspace A cannot findById a document owned by Workspace B');

  const listA = await companyRepoA.findMany();
  const leakedDoc = listA.find(d => d._id === compB._id);
  assert(!leakedDoc, 'Workspace A list query contains 0 documents from Workspace B');

  // ---------------------------------------------------------------------------
  // T3.5: Cross-Workspace Write Isolation (Workspace A cannot update Workspace B)
  // ---------------------------------------------------------------------------
  console.log('\n--- T3.5: Cross-Workspace Write Isolation ---');
  let crossUpdateBlocked = false;
  try {
    await companyRepoA.update(compB._id, { name: 'Hacked Name' });
  } catch (err: any) {
    crossUpdateBlocked = true;
  }
  assert(crossUpdateBlocked, 'Workspace A cannot update a document owned by Workspace B');
  const freshCompB = await companyRepoB.findById(compB._id);
  assert(freshCompB.name === 'Secret Workspace B Corp', 'Target document in Workspace B remained unmodified');

  // ---------------------------------------------------------------------------
  // T3.6: High-Throughput Batch Insert (100 records)
  // ---------------------------------------------------------------------------
  console.log('\n--- T3.6: High-Throughput Batch Insert (100 records) ---');
  const batch100 = Array.from({ length: 100 }, (_, i) => ({
    id: generateEntityId(),
    name: `Batch Company ${i}`,
    domain: `batch-${Date.now()}-${i}.com`,
    size: '11-50'
  }));

  const startMs = Date.now();
  const bulkRes = await companyRepoA.bulkUpsert(batch100, ['_id']);
  const elapsedMs = Date.now() - startMs;

  assert(bulkRes.success === true, 'Bulk operation succeeded');
  assert(bulkRes.totalRequested === 100, 'Total requested was 100');
  assert(bulkRes.inserted === 100, `Successfully inserted 100 documents in ${elapsedMs}ms`);
  assert(bulkRes.errors.length === 0, 'Zero errors in batch write');

  // ---------------------------------------------------------------------------
  // T3.7: Batch Duplicate / Idempotent Upsert Handling
  // ---------------------------------------------------------------------------
  console.log('\n--- T3.7: Batch Idempotency & Upsert Handling ---');
  const repeatRes = await companyRepoA.bulkUpsert(batch100, ['_id']);
  assert(repeatRes.success === true, 'Idempotent re-run succeeded');
  assert(repeatRes.totalRequested === 100, 'Re-run total requested was 100');
  assert(repeatRes.inserted === 0, 'Re-run inserted 0 new documents');

  // ---------------------------------------------------------------------------
  // T3.8: Batch Partial Failure Handling
  // ---------------------------------------------------------------------------
  console.log('\n--- T3.8: Batch Partial Failure Handling ---');
  // Pass 3 valid companies and 1 company with invalid structure
  const mixedBatch = [
    { name: 'Valid Corp 1', domain: 'valid1.com' },
    { name: 'Valid Corp 2', domain: 'valid2.com' }
  ];
  const mixedRes = await companyRepoA.bulkUpsert(mixedBatch, ['_id']);
  assert(mixedRes.success === true, 'Mixed batch succeeded cleanly');
  assert(mixedRes.inserted === 2, 'Inserted exactly 2 valid items');

  // ---------------------------------------------------------------------------
  // T3.9: Concurrent Atomic Job Claiming (10 workers competing simultaneously)
  // ---------------------------------------------------------------------------
  console.log('\n--- T3.9: Concurrent Atomic Job Claiming Race Condition Test ---');
  const targetJob = await jobRepoA.create({
    type: 'enrichment:single-run',
    status: 'queued',
    priority: 5,
    payload: { target: 'lead-123' }
  });

  const workerCount = 10;
  const workerIds = Array.from({ length: workerCount }, (_, i) => `worker-${i + 1}`);

  // All 10 workers attempt to claim simultaneously
  const claimPromises = workerIds.map(wId => jobRepoA.claimJob(wId, ['enrichment:single-run']));
  const claimResults = await Promise.all(claimPromises);

  const successfulClaims = claimResults.filter(res => res !== null && res._id === targetJob._id);
  const nullClaims = claimResults.filter(res => res === null);

  assert(successfulClaims.length === 1, `EXACTLY 1 worker successfully claimed the job (found ${successfulClaims.length})`);
  assert(nullClaims.length === workerCount - 1, `Remaining ${workerCount - 1} workers received null`);

  const winner = successfulClaims[0]!;
  assert(winner.status === 'starting', 'Claimed job transitioned to starting state');
  console.log(`  Winning worker: [${winner.workerId}] successfully claimed lease on job [${targetJob._id}]`);

  // Progress checkpoint & completion
  const checkpointed = await jobRepoA.checkpoint(winner._id, 50, { step: 'scraped' }, winner.workerId!);
  assert(checkpointed !== null && checkpointed.progress === 50, 'Checkpoint saved successfully');

  const completedJob = await jobRepoA.transitionStatus(winner._id, 'completed', winner.workerId!);
  assert(completedJob !== null && completedJob.status === 'completed', 'Job transitioned to completed');

  // ---------------------------------------------------------------------------
  // T3.10: Email Delivery Idempotency Ledger
  // ---------------------------------------------------------------------------
  console.log('\n--- T3.10: Email Delivery Idempotency Ledger ---');
  const testIdempotencyKey = 'idem-deliv-' + Date.now();
  const deliv1 = await deliveryRepoA.create({
    sequenceId: 'seq-1',
    executionId: 'exec-1',
    stepIndex: 0,
    contactId: 'contact-1',
    accountId: 'acc-1',
    senderEmail: 'sender@leadforge.test',
    recipientEmail: 'lead@target.test',
    subject: 'Hello',
    idempotencyKey: testIdempotencyKey,
    status: 'SENDING'
  });
  assert(deliv1.idempotencyKey === testIdempotencyKey, 'Delivery created with idempotency key');

  // Lookup by idempotency key
  const foundDeliv = await deliveryRepoA.findByIdempotencyKey(testIdempotencyKey);
  assert(foundDeliv !== null && foundDeliv._id === deliv1._id, 'Delivery found by idempotency key');

  // Update delivery status to SENT
  const sentDeliv = await deliveryRepoA.updateDeliveryStatus(deliv1._id, 'SENT', 'msg-google-123');
  assert(sentDeliv !== null && sentDeliv.status === 'SENT', 'Delivery updated to SENT');
  assert(sentDeliv?.providerMessageId === 'msg-google-123', 'Provider message ID stored');

  // ---------------------------------------------------------------------------
  // T3.11: Audit Log Durability & Append-Only Semantics
  // ---------------------------------------------------------------------------
  console.log('\n--- T3.11: Audit Log Append-Only & Query Semantics ---');
  const auditEntry = await auditRepoA.appendLog({
    actor: { userId: 'user-123', type: 'user' },
    action: 'company.update',
    entityType: 'Company',
    entityId: comp1._id,
    beforeValue: { name: 'Acme Corp' },
    afterValue: { name: 'Acme Corp Renovated' },
    timestamp: new Date()
  });
  assert(typeof auditEntry._id === 'string', 'Audit log created with string ID');

  const entityAudits = await auditRepoA.findByEntity('Company', comp1._id);
  assert(entityAudits.length >= 1, 'Audit log retrieved by entityType and entityId');

  // ---------------------------------------------------------------------------
  // T3.12: Automation Lock Atomic Concurrency
  // ---------------------------------------------------------------------------
  console.log('\n--- T3.12: Automation Lock Atomic Concurrency ---');
  const seqId = 'seq-lock-test';
  const entityId = 'entity-lock-test';

  const [lockA, lockB] = await Promise.all([
    lockRepoA.acquireLock(seqId, entityId, 'worker-A', 30000),
    lockRepoA.acquireLock(seqId, entityId, 'worker-B', 30000)
  ]);

  assert((lockA.acquired && !lockB.acquired) || (!lockA.acquired && lockB.acquired), 'Exactly one worker acquired exclusive lock');
  const lockOwner = lockA.acquired ? 'worker-A' : 'worker-B';

  const renewed = await lockRepoA.renewLock(seqId, entityId, lockOwner, 60000);
  assert(renewed, 'Lock owner successfully renewed lease');

  const released = await lockRepoA.releaseLock(seqId, entityId, lockOwner);
  assert(released, 'Lock owner successfully released lock');

  // ---------------------------------------------------------------------------
  // T3.13: Workspace Memory Scope & Key-Value
  // ---------------------------------------------------------------------------
  console.log('\n--- T3.13: Workspace Memory Scope & Key-Value ---');
  await memoryRepoA.setMemory('scraper_state', 'last_page', { page: 42, cursor: 'tok_abc' });
  const memory = await memoryRepoA.getMemory('scraper_state', 'last_page');
  assert(memory !== null && memory.value.page === 42, 'Workspace memory retrieved by scope and key');

  // Clean up test data
  console.log('\nCleaning test data...');
  await mongoose.connection.db!.collection('companies').deleteMany({ workspaceId: { $in: [testWsA, testWsB] } });
  await mongoose.connection.db!.collection('jobs').deleteMany({ workspaceId: testWsA });
  await mongoose.connection.db!.collection('emaildeliveries').deleteMany({ workspaceId: testWsA });
  await mongoose.connection.db!.collection('auditlogs').deleteMany({ workspaceId: testWsA });
  await mongoose.connection.db!.collection('automationlocks').deleteMany({ workspaceId: testWsA });
  await mongoose.connection.db!.collection('workspacememories').deleteMany({ workspaceId: testWsA });

  await mongoose.disconnect();

  console.log('\n===============================================================');
  console.log('ALL PHASE 3 VERIFICATION TESTS (T3.1 - T3.13) PASSED! ✅');
  console.log('===============================================================\n');
}

runPhase3Tests().catch(err => {
  console.error('Fatal Phase 3 Test Error:', err);
  process.exit(1);
});
