import {
  generateEntityId,
  isValidEntityId,
  entityIdField,
  entityIdFieldNullable,
  jobSchema,
  automationLockSchema,
  emailDeliverySchema,
  companyIntelligenceSchema,
  companySchema,
  contactSchema,
  createCompanyDtoSchema,
  createContactDtoSchema
} from '@leadforge/schema';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

console.log('--- RUNNING PHASE 1 IDENTITY & SHARED SCHEMA VERIFICATION ---\n');

// 1. Test canonical ID generation
const id1 = generateEntityId();
const id2 = generateEntityId();
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

assert(uuidRegex.test(id1), `Generated ID 1 is standard UUID v4 (${id1})`);
assert(uuidRegex.test(id2), `Generated ID 2 is standard UUID v4 (${id2})`);
assert(id1 !== id2, 'Successive calls produce unique IDs');

// 2. Test isValidEntityId
assert(isValidEntityId(id1), 'isValidEntityId accepts UUID');
assert(!isValidEntityId(''), 'isValidEntityId rejects empty string');
assert(!isValidEntityId('   '), 'isValidEntityId rejects whitespace');
assert(!isValidEntityId(null), 'isValidEntityId rejects null');
assert(!isValidEntityId(undefined), 'isValidEntityId rejects undefined');
assert(!isValidEntityId(12345), 'isValidEntityId rejects numbers');
assert(!isValidEntityId('a'.repeat(129)), 'isValidEntityId rejects strings > 128 chars');

// 3. Test entityIdField validation
const validParsed = entityIdField.safeParse(id1);
assert(validParsed.success, 'entityIdField parses valid string ID');

const emptyParsed = entityIdField.safeParse('');
assert(!emptyParsed.success, 'entityIdField rejects empty string');

const nullParsed = entityIdFieldNullable.safeParse('');
assert(nullParsed.success && (nullParsed.data === null || nullParsed.data === undefined), 'entityIdFieldNullable coerces empty string to null');

// 4. Test Company & Contact Schemas with canonical IDs
const companyId = generateEntityId();
const workspaceId = generateEntityId();

const companyResult = companySchema.safeParse({
  id: companyId,
  workspaceId: workspaceId,
  name: 'Acme Technologies',
  domain: 'acme.tech',
  status: 'LEAD',
  tags: ['b2b', 'saas'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});
assert(companyResult.success, 'companySchema accepts document with string UUID and ISO date strings');
if (companyResult.success) {
  assert(typeof companyResult.data.id === 'string', 'company.id is guaranteed string');
  assert(companyResult.data.id === companyId, 'company.id matches generated ID exactly');
}

const contactId = generateEntityId();
const contactResult = contactSchema.safeParse({
  id: contactId,
  workspaceId: workspaceId,
  companyId: companyId,
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@acme.tech',
  status: 'NEW',
  lastContactedAt: new Date().toISOString(),
  createdAt: new Date(),
  updatedAt: new Date()
});
assert(contactResult.success, 'contactSchema accepts document with canonical IDs and lastContactedAt');

// 5. Test Job Schema
const jobId = generateEntityId();
const jobResult = jobSchema.safeParse({
  id: jobId,
  workspaceId: workspaceId,
  type: 'maps-scraper',
  status: 'queued',
  priority: 5,
  payload: { query: 'dentists', city: 'Austin' },
  progress: 0,
  retryCount: 0,
  maxRetries: 3,
  createdAt: new Date(),
  updatedAt: new Date()
});
assert(jobResult.success, 'jobSchema accepts valid job with string ID');

// 6. Test AutomationLock Schema
const lockResult = automationLockSchema.safeParse({
  id: `${workspaceId}:seq-123:contact-456`,
  workspaceId: workspaceId,
  sequenceId: 'seq-123',
  entityId: 'contact-456',
  ownerId: 'worker-pid-8812',
  lockedAt: new Date(),
  expiresAt: new Date(Date.now() + 60000)
});
assert(lockResult.success, 'automationLockSchema accepts valid lock with composite ID');

// 7. Test EmailDelivery Schema
const deliveryId = generateEntityId();
const deliveryResult = emailDeliverySchema.safeParse({
  id: deliveryId,
  workspaceId: workspaceId,
  campaignId: null,
  sequenceId: generateEntityId(),
  executionId: generateEntityId(),
  stepIndex: 0,
  contactId: contactId,
  companyId: companyId,
  accountId: generateEntityId(),
  senderEmail: 'sender@leadforge.io',
  recipientEmail: 'jane@acme.tech',
  subject: 'Hello Jane',
  status: 'SENDING',
  idempotencyKey: `email:seq:${contactId}:step:0`,
  createdAt: new Date(),
  updatedAt: new Date()
});
assert(deliveryResult.success, 'emailDeliverySchema accepts delivery record with idempotency key');

// 8. Test CompanyIntelligence Schema
const intelId = generateEntityId();
const intelResult = companyIntelligenceSchema.safeParse({
  id: intelId,
  workspaceId: workspaceId,
  companyId: companyId,
  summary: 'A high-growth B2B enterprise',
  techStack: ['React', 'Next.js', 'MongoDB'],
  leadConfidence: 'HIGH',
  createdAt: new Date(),
  updatedAt: new Date()
});
assert(intelResult.success, 'companyIntelligenceSchema accepts intelligence record');

// 9. Test DTO ID Pre-Generation support
const clientPreGenId = generateEntityId();
const dtoCompany = createCompanyDtoSchema.safeParse({
  id: clientPreGenId,
  name: 'PreGen Corp',
  domain: 'pregen.io'
});
assert(dtoCompany.success && dtoCompany.data.id === clientPreGenId, 'createCompanyDtoSchema preserves client-pregenerated ID');

const dtoContact = createContactDtoSchema.safeParse({
  id: clientPreGenId,
  companyId: companyId,
  firstName: 'John'
});
assert(dtoContact.success && dtoContact.data.id === clientPreGenId, 'createContactDtoSchema preserves client-pregenerated ID');

console.log('\n--- ALL PHASE 1 VERIFICATION TESTS PASSED SUCCESSFULLY! ---');
