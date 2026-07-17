import mongoose from "mongoose";
import { SequenceModel } from "../../db/models/sequence.model.js";
import { SequenceExecutionModel } from "../../db/models/sequence-execution.model.js";
import { SequenceLogModel } from "../../db/models/sequence-log.model.js";
import { ContactModel } from "../../db/models/contact.model.js";
import { CompanyModel } from "../../db/models/company.model.js";
import { CampaignModel } from "../../db/models/campaign.model.js";
import { ActivityModel } from "../../db/models/activity.model.js";
import { OutreachService } from "../outreach/outreach.service.js";
import { SequenceStatus, ExecutionStatus } from "@leadforge/schema";

export class AutomationService {
  constructor(private workspaceId: string) {}

  // ── Sequence CRUD ────────────────────────────────────────────────────────

  public async createSequence(data: any): Promise<any> {
    const seq = new SequenceModel({
      _id: data.id || data._id || undefined,
      workspaceId: this.workspaceId as any,
      name: data.name,
      description: data.description || "",
      status: data.status || SequenceStatus.DRAFT,
      trigger: data.trigger,
      steps: data.steps || [],
      createdBy: data.createdBy || null,
    });
    await seq.save();
    return seq;
  }

  public async listSequences(): Promise<any[]> {
    return SequenceModel.find({
      workspaceId: this.workspaceId,
    } as any).sort({ createdAt: -1 });
  }

  public async getSequence(id: string): Promise<any> {
    const seq = await SequenceModel.findOne({
      _id: id,
      workspaceId: this.workspaceId,
    } as any);
    if (!seq) throw new Error("Sequence not found.");
    return seq;
  }

  public async updateSequence(id: string, data: any): Promise<any> {
    const seq = await SequenceModel.findOneAndUpdate(
      { _id: id, workspaceId: this.workspaceId } as any,
      { $set: data },
      { new: true }
    );
    if (!seq) throw new Error("Sequence not found.");
    return seq;
  }

  public async deleteSequence(id: string): Promise<void> {
    await SequenceModel.findOneAndDelete({
      _id: id,
      workspaceId: this.workspaceId,
    } as any);
  }

  // ── Executions Management ────────────────────────────────────────────────

  public async listExecutions(): Promise<any[]> {
    return SequenceExecutionModel.find({
      workspaceId: this.workspaceId,
    } as any).sort({ startedAt: -1 });
  }

  public async getExecution(id: string): Promise<any> {
    return SequenceExecutionModel.findOne({
      _id: id,
      workspaceId: this.workspaceId,
    } as any);
  }

  public async startExecution(sequenceId: string, payload: { contactId?: string; companyId?: string }): Promise<any> {
    const seq = await SequenceModel.findOne({
      _id: sequenceId,
      workspaceId: this.workspaceId,
    } as any);

    if (!seq) throw new Error("Sequence not found.");

    // Avoid duplicate executions running for the same contact/company
    const existing = await SequenceExecutionModel.findOne({
      workspaceId: this.workspaceId,
      sequenceId,
      status: { $in: [ExecutionStatus.RUNNING, ExecutionStatus.WAITING] },
      contactId: payload.contactId || null,
      companyId: payload.companyId || null,
    } as any);

    if (existing) {
      return existing; // Avoid duplicate run
    }

    const exec = new SequenceExecutionModel({
      _id: (payload as any).id || (payload as any)._id || undefined,
      sequenceId,
      workspaceId: this.workspaceId as any,
      contactId: payload.contactId || null,
      companyId: payload.companyId || null,
      status: ExecutionStatus.RUNNING,
      currentStep: 0,
      startedAt: new Date(),
      logs: [],
    });

    await exec.save();

    await this.logStep(exec._id.toString(), 0, "TRIGGER", "SUCCESS", `Sequence manually triggered.`);

    // Run first step asynchronously
    this.executeNextStep(exec._id.toString()).catch((err) => {
      console.error(`[AutomationService] Execution ${exec._id.toString()} step run error:`, err);
    });

    return exec;
  }

  public async stopExecution(executionId: string): Promise<any> {
    const exec = await SequenceExecutionModel.findOneAndUpdate(
      { _id: executionId, workspaceId: this.workspaceId } as any,
      {
        $set: {
          status: ExecutionStatus.FAILED,
          completedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!exec) throw new Error("Sequence execution not found.");

    await this.logStep(executionId, exec.currentStep, "STOP", "SUCCESS", "Sequence execution stopped by user.");
    return exec;
  }

  public async getExecutionLogs(executionId: string): Promise<any[]> {
    return SequenceLogModel.find({
      workspaceId: this.workspaceId,
      executionId,
    } as any).sort({ timestamp: 1 });
  }

  // ── Event Triggers Receiver ──────────────────────────────────────────────

  /**
   * Evaluates active trigger templates and automatically enrolls targets.
   */
  public async handleEvent(eventType: string, context: { contactId?: string; companyId?: string }): Promise<void> {
    const sequences = await SequenceModel.find({
      workspaceId: this.workspaceId,
      status: SequenceStatus.ACTIVE,
      "trigger.type": eventType,
    } as any);

    for (const seq of sequences) {
      try {
        await this.startExecution(seq._id.toString(), context);
      } catch (err) {
        console.error(`[AutomationService] Event auto-trigger failed for Sequence ${seq._id.toString()}:`, err);
      }
    }
  }

  // ── Execution Steps Processor Engine ─────────────────────────────────────

  public async executeNextStep(executionId: string): Promise<void> {
    const exec = await SequenceExecutionModel.findOne({
      _id: executionId,
      workspaceId: this.workspaceId,
    } as any);

    if (!exec || exec.status === ExecutionStatus.COMPLETED || exec.status === ExecutionStatus.FAILED) {
      return;
    }

    const seq = await SequenceModel.findById(exec.sequenceId);
    if (!seq) {
      exec.status = ExecutionStatus.FAILED;
      exec.completedAt = new Date();
      await exec.save();
      await this.logStep(executionId, exec.currentStep, "LOAD_SEQUENCE", "FAILED", "Sequence template not found.");
      return;
    }

    // Check if we finished all steps
    if (exec.currentStep >= seq.steps.length) {
      exec.status = ExecutionStatus.COMPLETED;
      exec.completedAt = new Date();
      await exec.save();
      await this.logStep(executionId, exec.currentStep, "FINISH", "SUCCESS", "Sequence completed.");
      return;
    }

    const step = seq.steps[exec.currentStep] as any;
    await this.logStep(executionId, exec.currentStep, step.type, "RUNNING", `Executing step type: ${step.type}`);

    try {
      switch (step.type) {
        case "WAIT": {
          const delaySeconds = Number(step.config.delaySeconds || step.config.duration || 60);
          exec.status = ExecutionStatus.WAITING;
          exec.nextExecutionAt = new Date(Date.now() + delaySeconds * 1000);
          exec.currentStep += 1; // Advance pointer for when resumed
          await exec.save();
          await this.logStep(executionId, exec.currentStep - 1, "WAIT", "SUCCESS", `Scheduled delay of ${delaySeconds}s.`);
          return;
        }

        case "SEND_EMAIL": {
          if (!exec.contactId) throw new Error("Contact context missing for SEND_EMAIL.");
          const templateId = step.config.templateId;
          if (!templateId) throw new Error("Email template ID config missing.");

          const outreachService = new OutreachService(this.workspaceId);
          await outreachService.sendSingleEmail(exec.contactId, templateId);

          exec.currentStep += 1;
          await exec.save();
          await this.logStep(executionId, exec.currentStep - 1, "SEND_EMAIL", "SUCCESS", "Email sent successfully.");
          break;
        }

        case "ASSIGN_TAG":
        case "REMOVE_TAG": {
          const tag = step.config.tag;
          if (!tag) throw new Error("Tag config missing.");

          const target = exec.contactId
            ? (await ContactModel.findById(exec.contactId) as any)
            : exec.companyId
            ? (await CompanyModel.findById(exec.companyId) as any)
            : null;

          if (!target) throw new Error("No contact or company found to apply tag operations.");

          const tags = target.tags || [];
          if (step.type === "ASSIGN_TAG") {
            if (!tags.includes(tag)) {
              tags.push(tag);
            }
          } else {
            const idx = tags.indexOf(tag);
            if (idx > -1) tags.splice(idx, 1);
          }

          target.tags = tags;
          await target.save();

          exec.currentStep += 1;
          await exec.save();
          await this.logStep(executionId, exec.currentStep - 1, step.type, "SUCCESS", `Tag ${tag} processed successfully.`);
          break;
        }

        case "CREATE_NOTE": {
          const content = step.config.content;
          if (!content) throw new Error("Note content missing.");

          const targetId = exec.contactId || exec.companyId;
          if (!targetId) throw new Error("No contact or company context found for CREATE_NOTE.");

          // Save note content directly on contact/company
          if (exec.contactId) {
            await ContactModel.findByIdAndUpdate(exec.contactId, {
              $set: { notes: content },
            });
          } else if (exec.companyId) {
            await CompanyModel.findByIdAndUpdate(exec.companyId, {
              $set: { notes: content },
            });
          }

          // Create general activity entry
          const act = new ActivityModel({
            workspaceId: new mongoose.Types.ObjectId(this.workspaceId),
            type: "sequence_note",
            content: `Automation Note: ${content}`,
          });
          await act.save();

          exec.currentStep += 1;
          await exec.save();
          await this.logStep(executionId, exec.currentStep - 1, "CREATE_NOTE", "SUCCESS", "Note added successfully.");
          break;
        }

        case "MOVE_PIPELINE_STAGE": {
          const stage = step.config.stage;
          if (!stage) throw new Error("Pipeline stage config missing.");

          if (exec.contactId) {
            await ContactModel.findByIdAndUpdate(exec.contactId, {
              $set: { status: stage },
            });
          } else if (exec.companyId) {
            await CompanyModel.findByIdAndUpdate(exec.companyId, {
              $set: { status: stage },
            });
          }

          exec.currentStep += 1;
          await exec.save();
          await this.logStep(executionId, exec.currentStep - 1, "MOVE_PIPELINE_STAGE", "SUCCESS", `Pipeline status updated to ${stage}.`);
          break;
        }

        case "START_CAMPAIGN":
        case "STOP_CAMPAIGN": {
          const campaignId = step.config.campaignId;
          if (!campaignId) throw new Error("Campaign ID config missing.");

          const status = step.type === "START_CAMPAIGN" ? "ACTIVE" : "PAUSED";
          await CampaignModel.findByIdAndUpdate(campaignId, {
            $set: { status },
          });

          exec.currentStep += 1;
          await exec.save();
          await this.logStep(executionId, exec.currentStep - 1, step.type, "SUCCESS", `Campaign ${campaignId} set to ${status}.`);
          break;
        }

        case "ASSIGN_OWNER": {
          const ownerId = step.config.ownerId;
          if (!ownerId) throw new Error("Owner ID config missing.");

          // Set owner (if exists, or mock)
          if (exec.contactId) {
            await ContactModel.findByIdAndUpdate(exec.contactId, {
              $set: { ownerId },
            });
          } else if (exec.companyId) {
            await CompanyModel.findByIdAndUpdate(exec.companyId, {
              $set: { ownerId },
            });
          }

          exec.currentStep += 1;
          await exec.save();
          await this.logStep(executionId, exec.currentStep - 1, "ASSIGN_OWNER", "SUCCESS", `Assigned owner to ${ownerId}.`);
          break;
        }

        case "CREATE_ACTIVITY": {
          const type = step.config.type || "automation";
          const content = step.config.content || "Automation activity triggered.";

          const act = new ActivityModel({
            workspaceId: new mongoose.Types.ObjectId(this.workspaceId),
            type,
            content,
          });
          await act.save();

          exec.currentStep += 1;
          await exec.save();
          await this.logStep(executionId, exec.currentStep - 1, "CREATE_ACTIVITY", "SUCCESS", "Logged activity successfully.");
          break;
        }

        case "FINISH_SEQUENCE": {
          exec.status = ExecutionStatus.COMPLETED;
          exec.completedAt = new Date();
          await exec.save();
          await this.logStep(executionId, exec.currentStep, "FINISH_SEQUENCE", "SUCCESS", "Sequence execution finished.");
          return;
        }

        case "CONDITION": {
          const conditionType = step.config.conditionType;
          if (!conditionType) throw new Error("Condition type config missing.");

          const passed = await this.evaluateCondition(conditionType, step.config, exec);
          if (passed) {
            exec.currentStep += 1;
            await exec.save();
            await this.logStep(executionId, exec.currentStep - 1, "CONDITION", "SUCCESS", `Condition ${conditionType} met. Advancing.`);
          } else {
            exec.status = ExecutionStatus.COMPLETED; // Halt execution
            exec.completedAt = new Date();
            await exec.save();
            await this.logStep(executionId, exec.currentStep - 1, "CONDITION", "SUCCESS", `Condition ${conditionType} not met. Gate closed. Halting sequence.`);
            return;
          }
          break;
        }

        default:
          throw new Error(`Unhandled step type: ${step.type}`);
      }

      // Execute next step recursively (async non-blocking next tick)
      process.nextTick(() => {
        this.executeNextStep(executionId).catch((err) => {
          console.error(`[AutomationService] Step execution recursion failed:`, err);
        });
      });

    } catch (err: any) {
      console.error(`[AutomationService] Failed running step in execution ${executionId}:`, err);
      exec.status = ExecutionStatus.FAILED;
      exec.completedAt = new Date();
      await exec.save();
      await this.logStep(executionId, exec.currentStep, step?.type || "UNKNOWN", "FAILED", err.message || "Unknown execution error.");
    }
  }

  private async evaluateCondition(conditionType: string, config: any, exec: any): Promise<boolean> {
    const contact = exec.contactId ? await ContactModel.findById(exec.contactId) : null;
    const company = exec.companyId ? await CompanyModel.findById(exec.companyId) : null;

    switch (conditionType) {
      case "HAS_TAG": {
        const tag = config.tag;
        const tags = (contact as any)?.tags || company?.tags || [];
        return tags.includes(tag);
      }
      case "NO_REPLY_RECEIVED": {
        if (!contact) return true;
        // In LeadForge, contact status becomes REPLIED if they responded
        return contact.status !== "REPLIED";
      }
      case "REPLY_RECEIVED": {
        if (!contact) return false;
        return contact.status === "REPLIED";
      }
      case "EMAIL_BOUNCED": {
        if (!contact) return false;
        return contact.status === "BOUNCED";
      }
      case "CAMPAIGN_FINISHED": {
        const campaignId = config.campaignId;
        const camp = await CampaignModel.findById(campaignId);
        return camp?.status === "COMPLETED";
      }
      case "PIPELINE_STAGE": {
        const stage = config.stage;
        const current = contact?.status || company?.status;
        return current === stage;
      }
      case "LEAD_SCORE": {
        return true; // Simple mock lead score gate
      }
      case "COMPANY_INDUSTRY": {
        if (!company) return false;
        return company.industry === config.industry;
      }
      case "COMPANY_SIZE": {
        return true; // Mock size range check
      }
      default:
        return false;
    }
  }

  private async logStep(
    executionId: string,
    stepIndex: number,
    action: string,
    status: string,
    message: string
  ): Promise<void> {
    const log = new SequenceLogModel({
      workspaceId: this.workspaceId as any,
      executionId,
      timestamp: new Date(),
      step: stepIndex,
      action,
      status,
      message,
    });
    await log.save();

    // Push into execution context history list as well
    await SequenceExecutionModel.findByIdAndUpdate(executionId, {
      $push: {
        logs: {
          timestamp: new Date(),
          step: stepIndex,
          action,
          status,
          message,
        },
      },
    });
  }
}
