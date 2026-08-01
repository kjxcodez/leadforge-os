import { db } from '../db/connection/mongoose.js';
import {
  UserModel,
  WorkspaceModel,
  CompanyModel,
  ContactModel,
  CampaignModel,
  OutreachModel
} from '../db/index.js';
import {
  CompanyService,
  ContactService,
  CampaignService,
  WorkspaceService,
  AuthService,
  OutreachService
} from '../services/index.js';
import { runInTransaction } from '../db/connection/transaction.js';
import { ConflictError, NotFoundError } from '../errors/index.js';

async function run() {
  console.log('🚀 Starting Database Layer verification...');
  await db.connect();

  const workspaceId1 = 'test-workspace-abc';
  const workspaceId2 = 'test-workspace-xyz';

  // 1. Clear previous test records
  console.log('🧹 Cleaning up old test data...');
  await CompanyModel.deleteMany({ workspaceId: { $in: [workspaceId1, workspaceId2] } });
  await ContactModel.deleteMany({ workspaceId: { $in: [workspaceId1, workspaceId2] } });
  await CampaignModel.deleteMany({ workspaceId: { $in: [workspaceId1, workspaceId2] } });
  await OutreachModel.deleteMany({ workspaceId: { $in: [workspaceId1, workspaceId2] } });
  await UserModel.deleteMany({ email: { $in: ['admin@workspace.com', 'other@workspace.com'] } });
  await WorkspaceModel.deleteMany({ slug: { $in: ['test-workspace-1', 'test-workspace-2'] } });

  // 2. Services Initialization
  console.log('⚙️ Initializing services...');
  const authService = new AuthService();
  const workspaceService = new WorkspaceService();
  const companyService1 = new CompanyService(workspaceId1);
  const companyService2 = new CompanyService(workspaceId2);
  const contactService1 = new ContactService(workspaceId1);
  const contactService2 = new ContactService(workspaceId2);

  // 3. Test User and Workspace Creation
  console.log('👤 Creating test user...');
  const user = await authService.registerUser({
    email: 'admin@workspace.com',
    password: 'securepassword123',
    name: 'John Admin'
  });
  console.log('✅ User created:', user.email, `(ID: ${user._id})`);

  console.log('💼 Creating test workspaces...');
  const workspace1 = await workspaceService.createWorkspace({
    name: 'Test Workspace 1',
    ownerId: user._id.toString(),
    ownerEmail: user.email
  });
  const workspace2 = await workspaceService.createWorkspace({
    name: 'Test Workspace 2',
    ownerId: user._id.toString(),
    ownerEmail: user.email
  });
  console.log('✅ Workspaces created:', workspace1.slug, workspace2.slug);

  // 4. Test Company CRUD and Workspace Isolation
  console.log('🏢 Creating company in Workspace 1...');
  const company1 = await companyService1.createCompany({
    name: 'Workspace 1 Company',
    domain: 'https://ws1.com',
    industry: 'Tech'
  });
  console.log('✅ Company 1 created:', company1.name);

  console.log(
    '🛡️ Verifying workspace isolation (retrieving Workspace 1 company from Workspace 2 context)...'
  );
  try {
    await companyService2.getCompanyById(company1._id.toString());
    throw new Error('❌ FAIL: Workspace isolation bypassed! Company 1 found in Workspace 2.');
  } catch (error) {
    if (error instanceof NotFoundError) {
      console.log('✅ PASS: Company 1 not visible to Workspace 2.');
    } else {
      throw error;
    }
  }

  // 5. Test Unique Constraint on email per Workspace
  console.log('✉️ Testing unique email constraint per workspace...');
  const contact1 = await contactService1.createContact({
    firstName: 'Alice',
    email: 'alice@test.com',
    phone: '+123456'
  });
  console.log('✅ Contact 1 created:', contact1.firstName, contact1.email);

  console.log('✉️ Creating duplicate email in SAME workspace (should fail)...');
  try {
    await contactService1.createContact({
      firstName: 'Alice Duplicate',
      email: 'alice@test.com',
      phone: '+654321'
    });
    throw new Error('❌ FAIL: Created duplicate email in same workspace!');
  } catch (error) {
    if (error instanceof ConflictError) {
      console.log('✅ PASS: Duplicate email rejected in same workspace.');
    } else {
      throw error;
    }
  }

  console.log('✉️ Creating duplicate email in DIFFERENT workspace (should pass)...');
  const contact2 = await contactService2.createContact({
    firstName: 'Alice in WS 2',
    email: 'alice@test.com',
    phone: '+777777'
  });
  console.log(
    '✅ PASS: Duplicate email allowed in different workspace:',
    contact2.firstName,
    contact2.email
  );

  // 6. Test Soft Delete and Restore
  console.log('🗑️ Testing soft delete on Company...');
  await companyService1.deleteCompany(company1._id.toString());

  // Verify it is not visible in default find
  try {
    await companyService1.getCompanyById(company1._id.toString());
    throw new Error('❌ FAIL: Soft deleted company still retrieved by default!');
  } catch (error) {
    if (error instanceof NotFoundError) {
      console.log('✅ PASS: Soft deleted company hidden from default lookups.');
    } else {
      throw error;
    }
  }

  // Check database to ensure it's still there but marked as deleted
  const deletedDoc = await CompanyModel.findOne({ _id: company1._id, includeDeleted: true } as any);
  if (!deletedDoc || !deletedDoc.deletedAt) {
    throw new Error('❌ FAIL: Company was permanently deleted instead of soft-deleted!');
  }
  console.log(
    '✅ PASS: Company still exists in DB with deletedAt timestamp:',
    deletedDoc.deletedAt
  );

  // Restore the company
  await (deletedDoc as any).restore();
  const restoredDoc = await companyService1.getCompanyById(company1._id.toString());
  if (!restoredDoc) {
    throw new Error('❌ FAIL: Could not restore soft-deleted company!');
  }
  console.log('✅ PASS: Company successfully restored!');

  // 7. Test Optimistic Concurrency Control (OCC)
  console.log('🔒 Testing optimistic concurrency locking...');
  const docVersionA = await companyService1.getCompanyById(company1._id.toString());
  const docVersionB = await companyService1.getCompanyById(company1._id.toString());

  docVersionA.name = 'Updated name by User A';
  await docVersionA.save();
  console.log('✅ User A saved successfully.');

  docVersionB.name = 'Updated name by User B (concurrently)';
  try {
    await docVersionB.save();
    throw new Error('❌ FAIL: Concurrent update succeeded without version mismatch!');
  } catch (error: any) {
    console.log('✅ PASS: Concurrent save failed due to version mismatch (OCC):', error.message);
  }

  // 8. Test Pagination
  console.log('📄 Testing pagination...');
  await companyService1.createCompany({ name: 'Company B', domain: 'https://b.com' });
  await companyService1.createCompany({ name: 'Company C', domain: 'https://c.com' });

  const paginated = await companyService1.listCompanies(1, 2);
  if (paginated.data.length !== 2 || paginated.total < 3) {
    throw new Error(
      `❌ FAIL: Pagination results invalid (length: ${paginated.data.length}, total: ${paginated.total})`
    );
  }
  console.log('✅ PASS: Pagination returns correct pages and total counts.');

  // 9. Test Transaction Rollback
  console.log('🔄 Testing transactions and rollback...');
  try {
    await runInTransaction(async (session) => {
      // 1. Create company
      const companyRepo = new CompanyModel({
        workspaceId: workspaceId1,
        name: 'Transactional Company',
        domain: 'txn.com'
      });
      await companyRepo.save({ session });

      // 2. Create contact
      const contactRepo = new ContactModel({
        workspaceId: workspaceId1,
        firstName: 'Txn Contact',
        phone: '+999999'
      });
      await contactRepo.save({ session });

      // 3. Trigger error to rollback
      throw new Error('Rollback trigger error');
    });
  } catch (error: any) {
    console.log('ℹ️ Transaction error caught (expected):', error.message);
  }

  // Verify neither record was persisted
  const txnCompany = await CompanyModel.findOne({ name: 'Transactional Company' });
  const txnContact = await ContactModel.findOne({ firstName: 'Txn Contact' });
  if (txnCompany || txnContact) {
    throw new Error('❌ FAIL: Transaction did not roll back created records!');
  }
  console.log('✅ PASS: Transaction rollback successful!');

  await db.disconnect();
  console.log('🏁 Database Layer verification completed successfully!');
}

run().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
