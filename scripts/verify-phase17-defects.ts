import * as path from 'path';
import assert from 'assert';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import {
  CampaignModel,
  SequenceModel,
  SequenceExecutionModel,
  CompanyModel,
  ContactModel,
  DiscoveryRunModel,
  CompanyDiscoveryRunModel,
  JobModel
} from '../apps/api/src/db/models/index.js';
import { CampaignService } from '../apps/api/src/services/campaign/campaign.service.js';
import { AutomationService } from '../apps/api/src/services/automation/automation.service.js';
import { DiscoveryRunService } from '../apps/api/src/services/discovery-run/discovery-run.service.js';
import { generateEntityId, CompanyStatus, ContactStatus } from '@leadforge/schema';

dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/leadforge-os';

async function run() {
  console.log('========================================================================');
  console.log(' LeadForge OS — Defect Recovery & Pipeline Integration Verification');
  console.log('========================================================================\n');

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGODB_URI);
  }

  const testWsId = 'ws-defect-verify-' + Date.now();

  try {
    // -------------------------------------------------------------------------
    // Test 1: Campaign Creation with sequenceId & Metadata
    // -------------------------------------------------------------------------
    console.log('--- [Test 1] Campaign Creation with sequenceId, dailyLimit & timezone ---');
    const campaignService = new CampaignService(testWsId);
    const testSequenceId = 'seq-test-' + Date.now();

    const createdCampaign = await campaignService.createCampaign({
      name: 'HVAC Outreach Q3',
      sequenceId: testSequenceId,
      status: 'ACTIVE' as any,
      timezone: 'America/New_York',
      dailyLimit: 75,
      steps: []
    });

    assert.ok(createdCampaign.id, 'Campaign must be created with valid ID');
    assert.strictEqual(createdCampaign.sequenceId, testSequenceId, 'Campaign must persist sequenceId');
    assert.strictEqual(createdCampaign.status, 'ACTIVE', 'Campaign status must be uppercase ACTIVE');
    assert.strictEqual(createdCampaign.timezone, 'America/New_York', 'Campaign must persist timezone');
    assert.strictEqual(createdCampaign.dailyLimit, 75, 'Campaign must persist dailyLimit');
    console.log('✅ Test 1 Passed: Campaign created with sequenceId and metadata preserved in MongoDB.');

    // -------------------------------------------------------------------------
    // Test 2: Sequence Execution Creation (campaigns:enroll flow)
    // -------------------------------------------------------------------------
    console.log('\n--- [Test 2] Sequence Execution Creation (campaigns:enroll payload) ---');
    const autoService = new AutomationService(testWsId);
    const testContactId = 'ct-test-' + Date.now();

    const createdExec = await autoService.createExecution({
      sequenceId: createdCampaign.sequenceId!,
      campaignId: createdCampaign.id,
      contactId: testContactId,
      status: 'running',
      startedAt: new Date().toISOString()
    });

    assert.ok(createdExec.id, 'Execution must be created successfully');
    assert.strictEqual(createdExec.sequenceId, testSequenceId, 'Execution must have sequenceId matching campaign');
    assert.strictEqual(createdExec.campaignId, createdCampaign.id, 'Execution must be linked to campaignId');
    console.log('✅ Test 2 Passed: Execution created with sequenceId from campaign without validation error.');

    // -------------------------------------------------------------------------
    // Test 3: Discovery Provenance & Company Links API Service
    // -------------------------------------------------------------------------
    console.log('\n--- [Test 3] DiscoveryRunService: Provenance Linking & Company Fetching ---');
    const discService = new DiscoveryRunService(testWsId);
    const createdRun = await discService.createRun({
      workspaceId: testWsId,
      name: 'HVAC Contractors Florida',
      query: 'hvac contractors',
      state: 'Florida',
      country: 'United States',
      provider: 'google_maps',
      status: 'completed',
      resultCount: 2
    });

    const company1 = await CompanyModel.create({
      workspaceId: testWsId,
      name: 'United Mechanical FL',
      domain: 'unitedmech.com',
      location: 'Tampa, Florida, United States',
      status: CompanyStatus.LEAD
    });

    const company2 = await CompanyModel.create({
      workspaceId: testWsId,
      name: 'All Weather Air FL',
      domain: 'allweatherair.com',
      location: 'Miami, Florida, United States',
      status: CompanyStatus.LEAD
    });

    await discService.recordCompanyProvenance(company1.id, createdRun.id);
    await discService.recordCompanyProvenance(company2.id, createdRun.id);

    const linkedCompanyIds = await discService.listCompaniesForRun(createdRun.id);
    assert.strictEqual(linkedCompanyIds.length, 2, 'Must have 2 linked company IDs');
    assert.ok(linkedCompanyIds.includes(company1.id));
    assert.ok(linkedCompanyIds.includes(company2.id));

    const linkedCompanies = await discService.getCompaniesForRun(createdRun.id);
    assert.strictEqual(linkedCompanies.length, 2, 'Must return 2 hydrated company objects');
    assert.ok(linkedCompanies.some((c) => c.name === 'United Mechanical FL'));
    assert.ok(linkedCompanies.some((c) => c.name === 'All Weather Air FL'));
    console.log('✅ Test 3 Passed: Discovery provenance linked and company retrieval verified.');

    // -------------------------------------------------------------------------
    // Test 4: Contact Source Attribution & Filtering
    // -------------------------------------------------------------------------
    console.log('\n--- [Test 4] Contact Source Attribution (google_maps & web_crawler) ---');
    const contactMaps = await ContactModel.create({
      workspaceId: testWsId,
      companyId: company1.id,
      firstName: 'United Mechanical Primary',
      phone: '+18135550100',
      source: 'google_maps',
      status: ContactStatus.NEW
    });

    const contactCrawler = await ContactModel.create({
      workspaceId: testWsId,
      companyId: company1.id,
      firstName: 'John',
      lastName: 'Doe',
      email: 'johndoe@unitedmech.com',
      source: 'web_crawler',
      status: ContactStatus.NEW
    });

    assert.strictEqual(contactMaps.source, 'google_maps', 'Maps contact must have source google_maps');
    assert.strictEqual(contactCrawler.source, 'web_crawler', 'Crawler contact must have source web_crawler');

    const mapsContacts = await ContactModel.find({ workspaceId: testWsId, source: 'google_maps' });
    const crawlerContacts = await ContactModel.find({ workspaceId: testWsId, source: 'web_crawler' });
    assert.strictEqual(mapsContacts.length, 1);
    assert.strictEqual(crawlerContacts.length, 1);
    console.log('✅ Test 4 Passed: Contact source attribution and queries succeed.');

    // -------------------------------------------------------------------------
    // Test 5: Email Delivery State Machine (FAILED to SENDING Retry)
    // -------------------------------------------------------------------------
    console.log('\n--- [Test 5] Email Delivery State Machine: FAILED to SENDING Retry ---');
    const { EmailDeliveryRepository } = await import('../apps/api/src/repositories/email-delivery/email-delivery.repository.js');
    const { EmailDeliveryModel } = await import('../apps/api/src/db/models/email-delivery.model.js');
    const deliveryRepo = new EmailDeliveryRepository(testWsId);
    const testIdempotencyKey = 'idemp-test-' + Date.now();

    // Initial reservation
    const res1 = await deliveryRepo.reserveDelivery({
      workspaceId: testWsId,
      accountId: 'acc-1',
      sequenceId: 'seq-1',
      executionId: 'exec-1',
      stepIndex: 0,
      contactId: 'ct-1',
      senderEmail: 'sender@example.com',
      recipientEmail: 'recipient@example.com',
      subject: 'Test Subject',
      idempotencyKey: testIdempotencyKey
    } as any);
    assert.strictEqual(res1.delivery.status, 'SENDING');

    // Transition to FAILED
    await deliveryRepo.failDelivery(res1.delivery._id.toString(), 'Temporary SMTP connection reset');
    const failedDoc = await EmailDeliveryModel.findById(res1.delivery._id);
    assert.strictEqual(failedDoc?.status, 'FAILED');

    // Retry reservation with same idempotency key
    const resRetry = await deliveryRepo.reserveDelivery({
      workspaceId: testWsId,
      accountId: 'acc-1',
      sequenceId: 'seq-1',
      executionId: 'exec-1',
      stepIndex: 0,
      contactId: 'ct-1',
      senderEmail: 'sender@example.com',
      recipientEmail: 'recipient@example.com',
      subject: 'Test Subject',
      idempotencyKey: testIdempotencyKey
    } as any);
    assert.strictEqual(resRetry.delivery.status, 'SENDING', 'Must transition back to SENDING on retry');
    assert.strictEqual(resRetry.isAlreadySent, false);
    console.log('✅ Test 5 Passed: Delivery state machine successfully transitions from FAILED to SENDING on retry.');

    console.log('\n========================================================================');
    console.log(' ALL 5 DEFECT RECOVERY TESTS PASSED SUCCESSFULLY! (100% RELIABLE)');
    console.log('========================================================================\n');
  } finally {
    // Clean up test workspace data
    await CampaignModel.deleteMany({ workspaceId: testWsId });
    await SequenceExecutionModel.deleteMany({ workspaceId: testWsId });
    await DiscoveryRunModel.deleteMany({ workspaceId: testWsId });
    await CompanyDiscoveryRunModel.deleteMany({ workspaceId: testWsId });
    await CompanyModel.deleteMany({ workspaceId: testWsId });
    await ContactModel.deleteMany({ workspaceId: testWsId });
    const { EmailDeliveryModel } = await import('../apps/api/src/db/models/email-delivery.model.js');
    await EmailDeliveryModel.deleteMany({ workspaceId: testWsId });
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
