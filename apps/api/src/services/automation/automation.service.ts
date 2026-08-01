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

  public async startExecution(
    sequenceId: string,
    payload: { contactId?: string; companyId?: string }
  ): Promise<any> {
    const seq = await SequenceModel.findOne({
      _id: sequenceId,
      workspaceId: this.workspaceId
    } as any);

    if (!seq) throw new Error('Sequence not found.');

    // Avoid duplicate executions running for the same contact/company
    const existing = await SequenceExecutionModel.findOne({
      workspaceId: this.workspaceId,
      sequenceId,
      status: { $in: [ExecutionStatus.RUNNING, ExecutionStatus.WAITING, ExecutionStatus.PENDING] },
      contactId: payload.contactId || null,
      companyId: payload.companyId || null
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
      status: ExecutionStatus.PENDING,
      currentStep: 0,
      startedAt: new Date(),
      logs: []
    });

    await exec.save();

    await this.logStep(
      exec._id.toString(),
      0,
      'TRIGGER',
      'SUCCESS',
      `Sequence manually triggered.`
    );

    return exec;
  }

  public async stopExecution(executionId: string): Promise<any> {
    const exec = await SequenceExecutionModel.findOneAndUpdate(
      { _id: executionId, workspaceId: this.workspaceId } as any,
      {
        $set: {
          status: ExecutionStatus.CANCELLED,
          completedAt: new Date()
        }
      },
      { new: true }
    );

    if (!exec) throw new Error('Sequence execution not found.');

    await this.logStep(
      executionId,
      exec.currentStep,
      'STOP',
      'SUCCESS',
      'Sequence execution stopped by user.'
    );
    return exec;
  }

  public async getExecutionLogs(executionId: string): Promise<any[]> {
    return SequenceLogModel.find({
      workspaceId: this.workspaceId,
      executionId
    } as any).sort({ timestamp: 1 });
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
      message
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
          message
        }
      }
    });
  }
}
