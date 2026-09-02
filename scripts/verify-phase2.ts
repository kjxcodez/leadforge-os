import { generateEntityId } from '@leadforge/schema';
import {
  JobModel,
  SystemLogModel,
  AutomationLockModel,
  CompanyIntelligenceModel,
  WebsiteIntelligenceModel,
  ContactIntelligenceModel,
  OpportunityScoreModel,
  AuditLogModel,
  WorkspaceMemoryModel,
  PageCrawlModel,
  IntelligenceSourceModel,
  IntelligenceEvidenceModel,
  IntelligenceClaimModel,
  IntelligenceInferenceModel,
  EmailDeliveryModel,
  CompanyModel,
  ContactModel,
  CampaignModel,
  WorkspaceModel,
  UserModel
} from '../apps/api/src/db/models/index.js';
import { BaseRepository } from '../apps/api/src/repositories/base/base.repository.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

console.log('--- RUNNING PHASE 2 MODEL EXPANSION & HARDENING VERIFICATION ---\n');

// -----------------------------------------------------------------------------
// T2.1 & T2.4: Model Instantiation & Canonical String _id on New Models
// -----------------------------------------------------------------------------
console.log('--- Testing New Models Instantiation & String _id ---');

const wsId = generateEntityId();

// 1. JobModel
const job = new JobModel({
  workspaceId: wsId,
  type: 'maps-scraper',
  status: 'queued',
  priority: 3
});
assert(typeof job._id === 'string', 'JobModel._id is type string');
assert(uuidRegex.test(job._id), `JobModel._id is valid UUID v4 (${job._id})`);

// 2. SystemLogModel
const sysLog = new SystemLogModel({
  workspaceId: wsId,
  severity: 'warn',
  task: 'maps-scraper',
  message: 'Rate limit backoff initiated'
});
assert(typeof sysLog._id === 'string', 'SystemLogModel._id is type string');
assert(uuidRegex.test(sysLog._id), 'SystemLogModel._id is valid UUID v4');

// 3. AutomationLockModel
const lockKey = `${wsId}:seq-123:contact-456`;
const lock = new AutomationLockModel({
  _id: lockKey,
  workspaceId: wsId,
  sequenceId: 'seq-123',
  entityId: 'contact-456',
  ownerId: 'worker-pid-9901',
  expiresAt: new Date(Date.now() + 60000)
});
assert(typeof lock._id === 'string', 'AutomationLockModel._id is type string');
assert(lock._id === lockKey, 'AutomationLock preserves composite string _id');

// 4. CompanyIntelligenceModel
const compIntel = new CompanyIntelligenceModel({
  workspaceId: wsId,
  companyId: generateEntityId(),
  summary: 'Enterprise SaaS provider',
  techStack: ['TypeScript', 'MongoDB'],
  leadConfidence: 'HIGH'
});
assert(typeof compIntel._id === 'string', 'CompanyIntelligenceModel._id is type string');
assert(uuidRegex.test(compIntel._id), 'CompanyIntelligenceModel._id is valid UUID v4');

// 5. WebsiteIntelligenceModel
const webIntel = new WebsiteIntelligenceModel({
  workspaceId: wsId,
  companyId: generateEntityId(),
  brandVoice: 'Professional, Technical',
  buyingSignals: ['Hiring engineers', 'SOC2 certified']
});
assert(typeof webIntel._id === 'string', 'WebsiteIntelligenceModel._id is type string');
assert(uuidRegex.test(webIntel._id), 'WebsiteIntelligenceModel._id is valid UUID v4');

// 6. ContactIntelligenceModel
const contactIntel = new ContactIntelligenceModel({
  workspaceId: wsId,
  contactId: generateEntityId(),
  decisionMakerScore: 0.95,
  seniority: 'C_LEVEL'
});
assert(typeof contactIntel._id === 'string', 'ContactIntelligenceModel._id is type string');
assert(uuidRegex.test(contactIntel._id), 'ContactIntelligenceModel._id is valid UUID v4');

// 7. OpportunityScoreModel
const oppScore = new OpportunityScoreModel({
  workspaceId: wsId,
  companyId: generateEntityId(),
  overallScore: 88,
  fitScore: 90,
  intentScore: 85
});
assert(typeof oppScore._id === 'string', 'OpportunityScoreModel._id is type string');
assert(uuidRegex.test(oppScore._id), 'OpportunityScoreModel._id is valid UUID v4');

// 8. AuditLogModel
const auditLog = new AuditLogModel({
  workspaceId: wsId,
  actor: { userId: generateEntityId(), type: 'user' },
  action: 'contact.created',
  entityType: 'Contact',
  entityId: generateEntityId()
});
assert(typeof auditLog._id === 'string', 'AuditLogModel._id is type string');
assert(uuidRegex.test(auditLog._id), 'AuditLogModel._id is valid UUID v4');

// 9. WorkspaceMemoryModel
const wsMemory = new WorkspaceMemoryModel({
  workspaceId: wsId,
  scope: 'scraper_preferences',
  key: 'max_depth',
  value: 3
});
assert(typeof wsMemory._id === 'string', 'WorkspaceMemoryModel._id is type string');
assert(uuidRegex.test(wsMemory._id), 'WorkspaceMemoryModel._id is valid UUID v4');

// 10. PageCrawlModel
const pageCrawl = new PageCrawlModel({
  workspaceId: wsId,
  companyId: generateEntityId(),
  url: 'https://acme.tech/about',
  status: 200,
  contentHash: 'sha256-abc123456',
  rawHtmlLength: 45200
});
assert(typeof pageCrawl._id === 'string', 'PageCrawlModel._id is type string');
assert(uuidRegex.test(pageCrawl._id), 'PageCrawlModel._id is valid UUID v4');

// 11. IntelligenceSourceModel
const intSource = new IntelligenceSourceModel({
  workspaceId: wsId,
  sourceType: 'WEBSITE',
  url: 'https://acme.tech'
});
assert(typeof intSource._id === 'string', 'IntelligenceSourceModel._id is type string');
assert(uuidRegex.test(intSource._id), 'IntelligenceSourceModel._id is valid UUID v4');

// 12. IntelligenceEvidenceModel
const intEvidence = new IntelligenceEvidenceModel({
  workspaceId: wsId,
  companyId: generateEntityId(),
  sourceId: intSource._id,
  evidenceType: 'DOM_EXTRACT',
  key: 'pricing_tier',
  value: '$99/mo'
});
assert(typeof intEvidence._id === 'string', 'IntelligenceEvidenceModel._id is type string');
assert(uuidRegex.test(intEvidence._id), 'IntelligenceEvidenceModel._id is valid UUID v4');

// 13. IntelligenceClaimModel
const intClaim = new IntelligenceClaimModel({
  workspaceId: wsId,
  companyId: generateEntityId(),
  evidenceIds: [intEvidence._id],
  subject: 'Acme Technologies',
  predicate: 'hasPricing',
  objectValue: '$99/mo'
});
assert(typeof intClaim._id === 'string', 'IntelligenceClaimModel._id is type string');
assert(uuidRegex.test(intClaim._id), 'IntelligenceClaimModel._id is valid UUID v4');

// 14. IntelligenceInferenceModel
const intInference = new IntelligenceInferenceModel({
  workspaceId: wsId,
  companyId: generateEntityId(),
  supportingClaimIds: [intClaim._id],
  field: 'idealCustomerTier',
  value: 'SMB',
  reason: 'Affordable self-serve pricing'
});
assert(typeof intInference._id === 'string', 'IntelligenceInferenceModel._id is type string');
assert(uuidRegex.test(intInference._id), 'IntelligenceInferenceModel._id is valid UUID v4');

// 15. EmailDeliveryModel
const emailDelivery = new EmailDeliveryModel({
  workspaceId: wsId,
  sequenceId: generateEntityId(),
  executionId: generateEntityId(),
  stepIndex: 0,
  contactId: generateEntityId(),
  accountId: generateEntityId(),
  senderEmail: 'sales@leadforge.io',
  recipientEmail: 'target@corp.com',
  subject: 'Partnership Inquiry',
  idempotencyKey: `email:seq:${wsId}:step:0`
});
assert(typeof emailDelivery._id === 'string', 'EmailDeliveryModel._id is type string');
assert(uuidRegex.test(emailDelivery._id), 'EmailDeliveryModel._id is valid UUID v4');

// -----------------------------------------------------------------------------
// T2.2: ID Pre-Generation Preservation
// -----------------------------------------------------------------------------
console.log('\n--- Testing Pre-Generated ID Preservation ---');
const customPreGenId = generateEntityId();
const preGenCompany = new CompanyModel({
  _id: customPreGenId,
  workspaceId: wsId,
  name: 'PreGen Enterprise'
});
assert(preGenCompany._id === customPreGenId, 'CompanyModel preserves pre-generated _id');

const preGenContact = new ContactModel({
  _id: customPreGenId,
  workspaceId: wsId,
  firstName: 'PreGen',
  status: 'NEW'
});
assert(preGenContact._id === customPreGenId, 'ContactModel preserves pre-generated _id');

const preGenWorkspace = new WorkspaceModel({
  _id: customPreGenId,
  name: 'PreGen Workspace',
  slug: `pregen-ws-${Date.now()}`,
  ownerId: generateEntityId()
});
assert(preGenWorkspace._id === customPreGenId, 'WorkspaceModel preserves pre-generated _id');

const preGenUser = new UserModel({
  _id: customPreGenId,
  email: `pregen-${Date.now()}@leadforge.io`,
  name: 'PreGen User',
  displayName: 'PreGen User',
  role: 'MEMBER'
});
assert(preGenUser._id === customPreGenId, 'UserModel preserves pre-generated _id');

// -----------------------------------------------------------------------------
// T2.5: Workspace Scoping Validation
// -----------------------------------------------------------------------------
console.log('\n--- Testing Workspace Scoping Validation ---');
const invalidJob = new JobModel({
  type: 'crawler'
  // missing workspaceId
});
const validationErr = invalidJob.validateSync();
assert(!!validationErr?.errors['workspaceId'], 'JobModel strictly enforces required workspaceId');

const invalidDelivery = new EmailDeliveryModel({
  senderEmail: 'test@example.com'
  // missing workspaceId
});
const deliveryErr = invalidDelivery.validateSync();
assert(!!deliveryErr?.errors['workspaceId'], 'EmailDeliveryModel strictly enforces required workspaceId');

// -----------------------------------------------------------------------------
// T2.6 & T2.7: Schema Index Specifications & TTL Policies
// -----------------------------------------------------------------------------
console.log('\n--- Testing Index & TTL Declarations ---');

// SystemLog TTL: exactly 14 days (1,209,600s) on createdAt
const sysLogIndexes = SystemLogModel.schema.indexes();
const sysLogTTL = sysLogIndexes.find(([fields, opts]) => fields.createdAt === 1 && opts?.expireAfterSeconds === 1209600);
assert(!!sysLogTTL, 'SystemLogModel declares 14-day TTL index on createdAt');

// AutomationLock TTL: 0s on expiresAt
const lockIndexes = AutomationLockModel.schema.indexes();
const lockTTL = lockIndexes.find(([fields, opts]) => fields.expiresAt === 1 && opts?.expireAfterSeconds === 0);
assert(!!lockTTL, 'AutomationLockModel declares 0s TTL index on expiresAt');

// EmailDelivery: unique index on (workspaceId, idempotencyKey), ZERO TTL
const deliveryIndexes = EmailDeliveryModel.schema.indexes();
const deliveryUnique = deliveryIndexes.find(([fields, opts]) => fields.workspaceId === 1 && fields.idempotencyKey === 1 && opts?.unique === true);
assert(!!deliveryUnique, 'EmailDeliveryModel declares unique compound index on (workspaceId, idempotencyKey)');

const deliveryTTL = deliveryIndexes.find(([_, opts]) => opts && 'expireAfterSeconds' in opts);
assert(!deliveryTTL, 'EmailDeliveryModel has ZERO TTL index (permanent ledger)');

// AuditLog: ZERO TTL
const auditIndexes = AuditLogModel.schema.indexes();
const auditTTL = auditIndexes.find(([_, opts]) => opts && 'expireAfterSeconds' in opts);
assert(!auditTTL, 'AuditLogModel has ZERO TTL index (permanent audit trail)');

// Job: claim index on (workspaceId, status, priority: -1, createdAt: 1)
const jobIndexes = JobModel.schema.indexes();
const jobClaimIndex = jobIndexes.find(([fields]) => fields.workspaceId === 1 && fields.status === 1 && fields.priority === -1 && fields.createdAt === 1);
assert(!!jobClaimIndex, 'JobModel declares atomic worker claim compound index');

// -----------------------------------------------------------------------------
// T2.3: BaseRepository Hardening Assertions
// -----------------------------------------------------------------------------
async function main() {
  console.log('\n--- Testing BaseRepository Canonical Identity Logic ---');

  // Mock model to test BaseRepository without live database
  class MockDocument {
    public _id: string;
    public workspaceId?: string;
    constructor(public data: any) {
      this._id = data._id;
      this.workspaceId = data.workspaceId;
    }
    async save() { return this; }
  }

  const mockModel: any = function (payload: any) {
    return new MockDocument(payload);
  };
  mockModel.insertMany = async (items: any[]) => items.map(item => new MockDocument(item));
  mockModel.findOneAndUpdate = async (filter: any, update: any) => ({ ...filter, ...update.$set });

  const repo = new BaseRepository<any>(mockModel, wsId);

  // 1. Create without ID -> receives generated UUID string
  const createdNoId: any = await repo.create({ name: 'Auto ID Item' });
  assert(typeof createdNoId._id === 'string', 'BaseRepository.create generates string _id when none provided');
  assert(uuidRegex.test(createdNoId._id), 'BaseRepository.create generates standard UUID v4');
  assert(createdNoId.workspaceId === wsId, 'BaseRepository.create injects repository workspaceId');

  // 2. Create with ID -> preserves provided ID exactly
  const preId = generateEntityId();
  const createdWithId: any = await repo.create({ id: preId, name: 'Pre-supplied ID Item' });
  assert(createdWithId._id === preId, 'BaseRepository.create preserves supplied id into _id');

  // 3. CreateMany -> all items receive string _id
  const preId2 = generateEntityId();
  const createdBatch: any = await repo.createMany([
    { name: 'Batch item 1' },
    { id: preId2, name: 'Batch item 2' }
  ]);
  assert(createdBatch.length === 2, 'BaseRepository.createMany returns all items');
  assert(uuidRegex.test(createdBatch[0]._id), 'Batch item 1 generated UUID _id');
  assert(createdBatch[1]._id === preId2, 'Batch item 2 preserved supplied id');

  // 4. Update -> cannot override document identity
  const updatedDoc: any = await repo.update(preId, {
    name: 'Updated Name',
    _id: 'malicious-override-attempt',
    id: 'malicious-override-attempt-2'
  });
  assert(updatedDoc.name === 'Updated Name', 'BaseRepository.update updates mutable fields');
  assert(updatedDoc._id === preId, 'BaseRepository.update protects _id from mutation');
  assert(!updatedDoc.id || updatedDoc.id !== 'malicious-override-attempt-2', 'BaseRepository.update strips id from update payload');

  console.log('\n--- ALL PHASE 2 VERIFICATION TESTS PASSED SUCCESSFULLY! ---');
}

main().catch((err) => {
  console.error('Fatal error in verify-phase2:', err);
  process.exit(1);
});

