import { EmailAccountModel } from "../../db/models/email-account.model.js";
import type { EmailAccountDocument } from "../../db/models/email-account.model.js";
import { EmailTemplateModel } from "../../db/models/email-template.model.js";
import { CampaignModel } from "../../db/models/campaign.model.js";
import { ContactModel } from "../../db/models/contact.model.js";
import { CompanyModel } from "../../db/models/company.model.js";
import { OutreachModel } from "../../db/models/outreach.model.js";
import { ActivityModel } from "../../db/models/activity.model.js";
import { encrypt, decrypt } from "../../utils/encryption.js";
import { GmailSmtpProvider } from "./provider.js";
import mongoose from "mongoose";

const provider = new GmailSmtpProvider();

export class OutreachService {
  constructor(private workspaceId: string) {}

  // ── Email Accounts Management ───────────────────────────────────────────

  /**
   * Verifies SMTPApp Password credentials and encrypts them before saving.
   */
  public async createEmailAccount(data: any): Promise<EmailAccountDocument> {
    // 1. Verify SMTP Connection first
    await provider.testConnection({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: data.email, pass: data.password }
    });

    // 2. Encrypt credential
    const encrypted = encrypt(data.password);

    // 3. Reset other defaults if new isDefault
    if (data.isDefault) {
      await EmailAccountModel.updateMany(
        { workspaceId: this.workspaceId } as any,
        { isDefault: false }
      );
    }

    const account = new EmailAccountModel({
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
      lastVerifiedAt: new Date(),
    });

    await account.save();
    
    // Log activity
    await this.logWorkspaceActivity(`Email Account ${account.email} was successfully connected.`);

    return account;
  }

  public async listEmailAccounts(): Promise<any[]> {
    const list = await EmailAccountModel.find({
      workspaceId: this.workspaceId,
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
      workspaceId: this.workspaceId,
    } as any);
  }

  public async testConnection(id: string): Promise<boolean> {
    const acc = await EmailAccountModel.findOne({
      _id: id,
      workspaceId: this.workspaceId,
    } as any);

    if (!acc) throw new Error('Email Account not found.');

    const pass = decrypt(acc.encryptedPassword);
    const ok = await provider.testConnection({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: acc.email, pass },
    });

    if (ok) {
      acc.status = 'connected';
      acc.lastVerifiedAt = new Date();
      acc.lastError = null;
    } else {
      acc.status = 'failed';
      acc.lastError = 'SMTP verification failed.';
    }
    await acc.save();

    return ok;
  }

  // ── Email Templates Management ──────────────────────────────────────────

  public async createTemplate(data: any): Promise<any> {
    // Parse out variables dynamically from subject and body
    const bodyVars = (data.body.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || []).map((v: string) => v.replace(/[\{\}]/g, ''));
    const subjectVars = (data.subject.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || []).map((v: string) => v.replace(/[\{\}]/g, ''));
    const variables = Array.from(new Set([...bodyVars, ...subjectVars]));

    const template = new EmailTemplateModel({
      workspaceId: new mongoose.Types.ObjectId(this.workspaceId),
      name: data.name,
      subject: data.subject,
      body: data.body,
      variables,
    });

    await template.save();
    return template;
  }

  public async listTemplates(): Promise<any[]> {
    return EmailTemplateModel.find({
      workspaceId: this.workspaceId,
    } as any).sort({ createdAt: -1 });
  }

  public async deleteTemplate(id: string): Promise<void> {
    await EmailTemplateModel.findOneAndDelete({
      _id: id,
      workspaceId: this.workspaceId,
    } as any);
  }

  /**
   * Renders preview subject and body using a mock contact profile.
   */
  public async previewTemplate(templateId: string, contactId?: string): Promise<any> {
    const template = await EmailTemplateModel.findOne({
      _id: templateId,
      workspaceId: this.workspaceId,
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
      // Fallback fallback profile values
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
      workspaceName: 'Workspace CRM',
    };

    const render = (text: string) => {
      let result = text;
      for (const [key, val] of Object.entries(mergeFields)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
      }
      // Clean up unresolved variables
      return result.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, '');
    };

    return {
      subject: render(template.subject),
      body: render(template.body),
    };
  }

  // ── Campaigns Sequential Send Scheduler ──────────────────────────────────

  /**
   * Triggers background campaign sends sequentially with rate-limit delays.
   */
  public async scheduleCampaign(campaignId: string): Promise<void> {
    const campaign = await CampaignModel.findOne({
      _id: campaignId,
      workspaceId: this.workspaceId,
    } as any);

    if (!campaign) throw new Error('Campaign not found.');
    campaign.status = 'ACTIVE';
    await campaign.save();

    // Trigger run sequence in background non-blocking thread
    this.runCampaignSendLoop(campaign._id.toString()).catch((err) => {
      console.error(`[OutreachService] Campaign ${campaign._id.toString()} execution loop failure:`, err);
    });
  }

  private async runCampaignSendLoop(campaignId: string): Promise<void> {
    const campaign = await CampaignModel.findById(campaignId);
    if (!campaign || campaign.status !== 'ACTIVE') return;

    // 1. Resolve workspace SMTP accounts (default or first connected)
    const account = await EmailAccountModel.findOne({
      workspaceId: campaign.workspaceId.toString(),
      status: 'connected',
    } as any);

    if (!account) {
      campaign.status = 'DRAFT';
      await campaign.save();
      await this.logWorkspaceActivity(`Outreach Failed: No connected email account for workspace.`);
      return;
    }

    // 2. Resolve template (first step)
    const step = campaign.steps[0];
    if (!step) {
      campaign.status = 'COMPLETED';
      await campaign.save();
      return;
    }

    const template = await EmailTemplateModel.findById(step.templateId);
    if (!template) {
      campaign.status = 'DRAFT';
      await campaign.save();
      return;
    }

    // 3. Load contacts inside active workspace
    const contacts = await ContactModel.find({
      workspaceId: campaign.workspaceId.toString(),
      email: { $ne: '' },
    } as any);

    if (contacts.length === 0) {
      campaign.status = 'COMPLETED';
      await campaign.save();
      return;
    }

    const pass = decrypt(account.encryptedPassword);
    const smtpConfig = {
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: account.email, pass },
    };

    // Sequential queue loop
    for (const c of contacts) {
      // Re-fetch campaign state before sending (support Pause/Cancel during execution)
      const currentCamp = await CampaignModel.findById(campaignId);
      if (!currentCamp || currentCamp.status !== 'ACTIVE') {
        return; // Aborted
      }

      // Check if contact has already been emailed by this campaign
      const existing = await OutreachModel.findOne({
        campaignId: campaign._id.toString(),
        contactId: c._id.toString(),
      } as any);

      if (existing) continue; // Skip already emailed contacts

      // Render merge fields
      const rendered = await this.previewTemplate(template._id.toString(), c._id.toString());

      // Create pending outreach record
      const log = new OutreachModel({
        workspaceId: campaign.workspaceId.toString(),
        campaignId: campaign._id.toString(),
        companyId: c.companyId ? c.companyId.toString() : null,
        contactId: c._id.toString(),
        provider: 'email',
        status: 'pending',
        attempts: 1,
        lastSentAt: new Date(),
        messageDetails: {
          messageId: '',
          subject: rendered.subject,
          body: rendered.body,
        },
      });
      await log.save();

      try {
        const sendResult = await provider.sendEmail(
          smtpConfig,
          c.email || '',
          rendered.subject,
          rendered.body
        );

        log.status = 'sent';
        log.messageDetails = {
          messageId: sendResult.messageId,
          subject: rendered.subject,
          body: rendered.body,
        };
        await log.save();

        // Increment sent statistics
        await EmailAccountModel.findByIdAndUpdate(account._id, {
          $inc: { dailySent: 1, hourlySent: 1 },
        });

      } catch (err: any) {
        console.error(`[OutreachService] Failed sending to contact ${c.email}:`, err);
        log.status = 'failed';
        await log.save();
      }

      // Delay sequence send (delay 2 seconds between sequential emails for MVP limits safety)
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Complete campaign
    campaign.status = 'COMPLETED';
    await campaign.save();

    await this.logWorkspaceActivity(`Outreach Campaign ${campaign.name} successfully finished sending.`);
  }

  private async logWorkspaceActivity(content: string): Promise<void> {
    const act = new ActivityModel({
      workspaceId: new mongoose.Types.ObjectId(this.workspaceId),
      type: 'campaign_created',
      content,
    });
    await act.save();
  }
}
