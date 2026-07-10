import { db } from "../db/connection/mongoose.js";
import { UserModel, WorkspaceModel, CompanyModel, ContactModel } from "../db/index.js";
import { CompanyService } from "../services/company/company.service.js";
import { runInTransaction } from "../db/connection/transaction.js";

async function run() {
  console.log("🚀 Starting Database Layer verification...");
  await db.connect();

  const workspaceId = "test-workspace-123";

  // 1. Clear previous test records
  console.log("🧹 Cleaning up old test data...");
  await CompanyModel.deleteMany({ workspaceId });
  await ContactModel.deleteMany({ workspaceId });

  // 2. Instantiate Service
  const companyService = new CompanyService(workspaceId);

  // 3. Test Creation
  console.log("📝 Creating test company...");
  const company = await companyService.createCompany({
    name: "Acme Corp",
    domain: "acme.com",
    industry: "SaaS",
    size: "11-50",
  });
  const companyId = company._id.toString();
  console.log("✅ Company created successfully:", company.name, `(ID: ${companyId})`);

  // 4. Test Workspace Isolation
  console.log("🛡️ Testing workspace isolation...");
  const otherService = new CompanyService("other-workspace-456");
  const found = await otherService.getCompanyById(companyId).catch(() => null);
  if (found) {
    throw new Error("❌ FAIL: Workspace isolation bypassed!");
  }
  console.log("✅ PASS: Workspace isolation works!");

  // 5. Test Transactions
  console.log("🔄 Testing transactional rollback...");
  try {
    await runInTransaction(async (session) => {
      // Create first contact
      const contactModel = new ContactModel({
        workspaceId,
        firstName: "John",
        lastName: "Doe",
        phone: "+12345678",
        status: "NEW",
      });
      await contactModel.save({ session });

      // Trigger error to cause rollback
      throw new Error("Simulated rollback error");
    });
  } catch (error: any) {
    console.log("ℹ️ Transaction error caught (expected):", error.message);
  }

  // Ensure contact was NOT created
  const contactCount = await ContactModel.countDocuments({ workspaceId });
  if (contactCount > 0) {
    throw new Error("❌ FAIL: Transaction did not roll back!");
  }
  console.log("✅ PASS: Transaction rollback successful!");

  await db.disconnect();
  console.log("🏁 Database Layer verification completed successfully!");
}

run().catch((err) => {
  console.error("❌ Verification failed:", err);
  process.exit(1);
});
