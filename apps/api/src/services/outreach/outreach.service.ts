import { EmailAccountModel } from '../../db/models/email-account.model.js';
import type { EmailAccountDocument } from '../../db/models/email-account.model.js';
import { EmailTemplateModel } from '../../db/models/email-template.model.js';
import { CampaignModel } from '../../db/models/campaign.model.js';
import { ContactModel } from '../../db/models/contact.model.js';
import { CompanyModel } from '../../db/models/company.model.js';
import { encrypt } from '../../utils/encryption.js';
import mongoose from 'mongoose';

export class OutreachService {
  constructor(private workspaceId: string) {}

  // ── Email Accounts Management ───────────────────────────────────────────

  /**
   * Encrypts SMTP App Password and saves the email account to the workspace database.
   */
  public async createEmailAccount(data: any): Promise<EmailAccountDocument> {
    const rawPassword = data.password || data.smtpPassword || data.imapPassword || '';
    const encrypted = encrypt(rawPassword);

    if (data.isDefault) {
      await EmailAccountModel.updateMany({ workspaceId: this.workspaceId } as any, {
        isDefault: false
      });
    }

    const account = new EmailAccountModel({
      _id: data.id || data._id || undefined,
      workspaceId: this.workspaceId as any,
      name: data.name,
      email: data.email,
      provider: 'gmail_smtp',
      encryptedPassword: encrypted,
      isDefault: !!data.isDefault,
      dailyLimit: data.dailyLimit || 200,
      hourlyLimit: data.hourlyLimit || 50,
      signature: data.signature || '',
      status: 'connected',
      lastVerifiedAt: new Date()
    });

    await account.save();
    return account;
  }

  public async listEmailAccounts(): Promise<any[]> {
    const list = await EmailAccountModel.find({
      workspaceId: this.workspaceId
    } as any).sort({ createdAt: -1 });

    // Sanitize to prevent encrypted credential leakage
    return list.map((acc) => {
      const obj = acc.toObject();
      delete (obj as any).encryptedPassword;
      return obj;
    });
  }

  public async deleteEmailAccount(id: string): Promise<void> {
    await EmailAccountModel.findOneAndDelete({
      _id: id,
      workspaceId: this.workspaceId
    } as any);
  }

  /**
   * Simulates SMTP credential validation.
   */
  public async testConnection(id: string): Promise<boolean> {
    const acc = await EmailAccountModel.findOne({
      _id: id,
      workspaceId: this.workspaceId
    } as any);

    if (!acc) throw new Error('Email Account not found.');

    acc.status = 'connected';
    acc.lastVerifiedAt = new Date();
    acc.lastError = null;
    await acc.save();

    return true;
  }

  // ── Email Templates Management ──────────────────────────────────────────

  public async createTemplate(data: any): Promise<any> {
    const bodyVars = (data.body.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || []).map((v: string) =>
      v.replace(/[\{\}]/g, '')
    );
    const subjectVars = (data.subject.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || []).map((v: string) =>
      v.replace(/[\{\}]/g, '')
    );
    const variables = Array.from(new Set([...bodyVars, ...subjectVars]));

    const template = new EmailTemplateModel({
      _id: data.id || data._id || undefined,
      workspaceId: new mongoose.Types.ObjectId(this.workspaceId),
      name: data.name,
      subject: data.subject,
      body: data.body,
      variables
    });

    await template.save();
    return template;
  }

  public async listTemplates(): Promise<any[]> {
    return EmailTemplateModel.find({
      workspaceId: this.workspaceId
    } as any).sort({ createdAt: -1 });
  }

  public async deleteTemplate(id: string): Promise<void> {
    await EmailTemplateModel.findOneAndDelete({
      _id: id,
      workspaceId: this.workspaceId
    } as any);
  }

  /**
   * Renders preview subject and body using a mock contact profile.
   */
  public async previewTemplate(templateId: string, contactId?: string): Promise<any> {
    const template = await EmailTemplateModel.findOne({
      _id: templateId,
      workspaceId: this.workspaceId
    } as any);
    if (!template) throw new Error('Template not found.');

    let contact: any = null;
    let company: any = null;

    if (contactId) {
      contact = await ContactModel.findById(contactId);
      if (contact && contact.companyId) {
        company = await CompanyModel.findById(contact.companyId);
      }
    } else {
      contact = { firstName: 'John', lastName: 'Doe', email: 'john@example.com' };
      company = { name: 'Acme Corp', website: 'acme.com' };
    }

    const mergeFields = {
      firstName: contact?.firstName || '',
      lastName: contact?.lastName || '',
      email: contact?.email || '',
      company: company?.name || 'Your Company',
      website: company?.website || 'example.com',
      senderName: 'Sales Director',
      workspaceName: 'Workspace CRM'
    };

    const render = (text: string) => {
      let result = text;
      for (const [key, val] of Object.entries(mergeFields)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
      }
      return result.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, '');
    };

    return {
      subject: render(template.subject),
      body: render(template.body)
    };
  }

  // ── Campaigns Sequential Send Scheduler ──────────────────────────────────

  /**
   * Updates the campaign state status to active in MongoDB.
   */
  public async scheduleCampaign(campaignId: string): Promise<void> {
    const campaign = await CampaignModel.findOne({
      _id: campaignId,
      workspaceId: this.workspaceId
    } as any);

    if (!campaign) throw new Error('Campaign not found.');
    campaign.status = 'ACTIVE';
    await campaign.save();
  }
}
