import { DiscoveryJobModel } from "../../db/models/discovery-job.model.js";
import type { DiscoveryJobDocument } from "../../db/models/discovery-job.model.js";
import { DiscoveryResultModel } from "../../db/models/discovery-result.model.js";
import { CompanyModel } from "../../db/models/company.model.js";
import { ContactModel } from "../../db/models/contact.model.js";
import { ActivityModel } from "../../db/models/activity.model.js";
import { AutomationService } from "../automation/automation.service.js";
import mongoose from "mongoose";

export class DiscoveryService {
  constructor(private workspaceId: string) {}

  /**
   * Creates a new discovery job in the active workspace and triggers background execution.
   */
  public async createJob(name: string, provider: string, query: string): Promise<DiscoveryJobDocument> {
    const job = new DiscoveryJobModel({
      workspaceId: this.workspaceId as any,
      name,
      provider,
      query,
      status: "queued",
      progress: 0,
      statistics: {
        companiesFound: 0,
        contactsFound: 0,
        duplicates: 0,
        imported: 0,
      },
    });

    await job.save();
    
    // Trigger simulation in the background
    this.runJobSimulation(job.id).catch((err) => {
      console.error(`[DiscoveryService] Background job ${job.id} failure:`, err);
    });

    return job;
  }

  /**
   * Retrieves all discovery jobs in the active workspace.
   */
  public async listJobs(page = 1, limit = 100): Promise<{ data: any[]; total: number }> {
    const filter = { workspaceId: this.workspaceId } as any;
    const query = DiscoveryJobModel.find(filter).sort({ createdAt: -1 });
    
    const data = await query.skip((page - 1) * limit).limit(limit);
    const total = await DiscoveryJobModel.countDocuments(filter);

    return { data, total };
  }

  /**
   * Retrieves a discovery job by ID.
   */
  public async getJobById(id: string): Promise<any> {
    return DiscoveryJobModel.findOne({
      _id: id,
      workspaceId: this.workspaceId,
    } as any);
  }

  /**
   * Retrieves scraped results of a discovery job.
   */
  public async getJobResults(jobId: string): Promise<any[]> {
    return DiscoveryResultModel.find({
      jobId: jobId,
      workspaceId: this.workspaceId,
    } as any);
  }

  /**
   * Skips a discovery result.
   */
  public async skipResult(resultId: string): Promise<any> {
    return DiscoveryResultModel.findOneAndUpdate(
      {
        _id: resultId,
        workspaceId: this.workspaceId,
      } as any,
      { status: "skipped" },
      { new: true }
    );
  }

  /**
   * Imports a discovery result into the CRM.
   */
  public async importResult(resultId: string): Promise<any> {
    const result = await DiscoveryResultModel.findOne({
      _id: resultId,
      workspaceId: this.workspaceId,
    } as any);

    if (!result) {
      throw new Error("Discovery result not found.");
    }

    if (result.status === "imported") {
      return result;
    }

    // 1. Create Company in CRM
    const company = new CompanyModel({
      workspaceId: this.workspaceId as any,
      name: result.companyName,
      domain: result.website || "",
      industry: "Discovered",
      status: "LEAD",
      notes: "Imported from Discovery Job.",
    });
    await company.save();

    // 2. Create associated contacts
    const autoService = new AutomationService(this.workspaceId);
    if (result.contacts && result.contacts.length > 0) {
      for (const rawCont of result.contacts) {
        const contact = new ContactModel({
          workspaceId: this.workspaceId as any,
          companyId: company.id,
          firstName: rawCont.firstName,
          lastName: rawCont.lastName || "",
          email: rawCont.email || "",
          phone: rawCont.phone || "",
          title: rawCont.title || "",
          linkedin: rawCont.linkedinUrl || "",
          status: "NEW",
          source: "discovery",
        });
        await contact.save();

        // Trigger contact creation sequence
        await autoService.handleEvent("CONTACT_CREATED", { contactId: contact.id, companyId: company.id });
      }
    }

    // 3. Mark as imported
    result.status = "imported";
    await result.save();

    // Trigger discovery import completed sequence
    await autoService.handleEvent("DISCOVERY_IMPORT_COMPLETED", { companyId: company.id });

    // 4. Update job statistics count
    await DiscoveryJobModel.findByIdAndUpdate(result.jobId, {
      $inc: { "statistics.imported": 1 },
    });

    // 5. Create activity log
    const activity = new ActivityModel({
      workspaceId: this.workspaceId as any,
      type: "company_created",
      content: `Imported Company ${company.name} and ${result.contacts.length} contacts from Discovery.`,
    });
    await activity.save();

    return result;
  }

  /**
   * Simulates the job execution progress in steps, adding results to the DB.
   */
  private async runJobSimulation(jobId: string): Promise<void> {
    const job = await DiscoveryJobModel.findById(jobId);
    if (!job) return;

    job.status = "running";
    job.startedAt = new Date();
    await job.save();

    // Simulating progress states (20%, 40%, 60%, 80%, 100%)
    for (let progress = 20; progress <= 100; progress += 20) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      const currentJob = await DiscoveryJobModel.findById(jobId);
      if (!currentJob || currentJob.status === "cancelled" || currentJob.status === "paused") {
        return; // Aborted
      }

      currentJob.progress = progress;

      // At 60% let's populate mock scraped results!
      if (progress === 60) {
        const mockResults = [
          {
            workspaceId: currentJob.workspaceId,
            jobId: currentJob._id,
            companyName: `${currentJob.query} Tech Corp`,
            website: `http://tech.${currentJob.query.toLowerCase().replace(/\s+/g, "")}.com`,
            email: `info@tech.${currentJob.query.toLowerCase().replace(/\s+/g, "")}.com`,
            linkedinUrl: `linkedin.com/company/tech-${currentJob.query.toLowerCase().replace(/\s+/g, "")}`,
            description: `Innovative solutions in the field of ${currentJob.query}.`,
            status: "pending",
            contacts: [
              {
                firstName: "Alex",
                lastName: "Johnson",
                email: `alex@tech.${currentJob.query.toLowerCase().replace(/\s+/g, "")}.com`,
                title: "CTO",
                linkedinUrl: "linkedin.com/in/alex-johnson",
              },
            ],
          },
          {
            workspaceId: currentJob.workspaceId,
            jobId: currentJob._id,
            companyName: `${currentJob.query} Global`,
            website: `http://global.${currentJob.query.toLowerCase().replace(/\s+/g, "")}.com`,
            email: `contact@global.${currentJob.query.toLowerCase().replace(/\s+/g, "")}.com`,
            linkedinUrl: `linkedin.com/company/global-${currentJob.query.toLowerCase().replace(/\s+/g, "")}`,
            description: `Global consulting and services tailored to ${currentJob.query}.`,
            status: "pending",
            contacts: [
              {
                firstName: "Sarah",
                lastName: "Miller",
                email: `sarah@global.${currentJob.query.toLowerCase().replace(/\s+/g, "")}.com`,
                title: "VP of Growth",
                linkedinUrl: "linkedin.com/in/sarah-miller",
              },
            ],
          },
        ];

        for (const res of mockResults) {
          const doc = new DiscoveryResultModel(res);
          await doc.save();
        }

        currentJob.statistics.companiesFound = 2;
        currentJob.statistics.contactsFound = 2;
      }

      if (progress === 100) {
        currentJob.status = "completed";
        currentJob.finishedAt = new Date();
      }

      await currentJob.save();
    }
  }
}
