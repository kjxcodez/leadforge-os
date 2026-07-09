export { db } from "./connection/mongoose.js";
export { runInTransaction } from "./connection/transaction.js";

// Export models
export { UserModel, type UserDocument } from "./models/user.model.js";
export { WorkspaceModel, type WorkspaceDocument } from "./models/workspace.model.js";
export { CompanyModel, type CompanyDocument } from "./models/company.model.js";
export { ContactModel, type ContactDocument } from "./models/contact.model.js";
export { CampaignModel, type CampaignDocument } from "./models/campaign.model.js";
export { OutreachModel, type OutreachDocument } from "./models/outreach.model.js";
