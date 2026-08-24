import { SequenceModel } from '../../db/models/sequence.model.js';
import { SequenceExecutionModel } from '../../db/models/sequence-execution.model.js';
import { SequenceLogModel } from '../../db/models/sequence-log.model.js';
import { SequenceStatus, ExecutionStatus } from '@leadforge/schema';

export class AutomationService {
  constructor(private workspaceId: string) {}

  // ── Sequence CRUD ────────────────────────────────────────────────────────

  public async createSequence(data: any): Promise<any> {
    const seq = new SequenceModel({
      _id: data.id || data._id || undefined,
      workspaceId: this.workspaceId as any,
      name: data.name,
      description: data.description || '',
      status: data.status || SequenceStatus.DRAFT,
      trigger: data.trigger,
      steps: data.steps || [],
      createdBy: data.createdBy || null
    });
    await seq.save();
    return seq;
  }

  public async listSequences(): Promise<any[]> {
    return SequenceModel.find({
      workspaceId: this.workspaceId
    } as any).sort({ createdAt: -1 });
  }

  public async getSequence(id: string): Promise<any> {
    const seq = await SequenceModel.findOne({
      _id: id,
      workspaceId: this.workspaceId
    } as any);
    if (!seq) throw new Error('Sequence not found.');
    return seq;
  }

  public async updateSequence(id: string, data: any): Promise<any> {
    const seq = await SequenceModel.findOneAndUpdate(
      { _id: id, workspaceId: this.workspaceId } as any,
      { $set: data },
      { new: true }
    );
    if (!seq) throw new Error('Sequence not found.');
    return seq;
  }

  public async deleteSequence(id: string): Promise<void> {
    await SequenceModel.findOneAndDelete({
      _id: id,
      workspaceId: this.workspaceId
    } as any);
  }

  // ── Executions Management ────────────────────────────────────────────────

  public async createExecution(data: any): Promise<any> {
    const exec = new SequenceExecutionModel({
      _id: data.id || data._id || undefined,
      workspaceId: this.workspaceId as any,
      sequenceId: data.sequenceId,
      campaignId: data.campaignId,
      contactId: data.contactId,
      companyId: data.companyId,
      currentStep: data.currentStep || 0,
      currentStepName: data.currentStepName || 'Initial',
      status: (data.status || 'RUNNING').toUpperCase(),
      startedAt: data.startedAt ? new Date(data.startedAt) : new Date(),
      completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
      logs: data.logs || [],
      sentMessageIds: data.sentMessageIds || []
    });
    await exec.save();
    return exec;
  }

  public async updateExecution(id: string, data: any): Promise<any> {
    const updateData = { ...data };
    if (updateData.status) {
      updateData.status = updateData.status.toUpperCase();
    }
    const exec = await SequenceExecutionModel.findOneAndUpdate(
      { _id: id, workspaceId: this.workspaceId } as any,
      { $set: updateData },
      { new: true }
    );
    if (!exec) throw new Error('Sequence execution not found.');
    return exec;
  }

  public async deleteExecution(id: string): Promise<void> {
    await SequenceExecutionModel.findOneAndDelete({
      _id: id,
      workspaceId: this.workspaceId
    } as any);
  }

  public async listExecutions(): Promise<any[]> {
    return SequenceExecutionModel.find({
      workspaceId: this.workspaceId
    } as any).sort({ startedAt: -1 });
  }

  public async getExecution(id: string): Promise<any> {
    return SequenceExecutionModel.findOne({
      _id: id,
      workspaceId: this.workspaceId
    } as any);
  }

  public async getExecutionLogs(executionId: string): Promise<any[]> {
    return SequenceLogModel.find({
      workspaceId: this.workspaceId,
      executionId
    } as any).sort({ timestamp: 1 });
  }
}
