import type { WorkflowRepository } from '@leadforge/agent-core';
import type { SequenceExecution, SequenceLog, Sequence } from '@leadforge/schema';
import { LocalCRMRepository } from './local-crm';

export class WorkflowRepositoryImpl implements WorkflowRepository {
  public async getExecutionById(
    id: string,
    workspaceId: string
  ): Promise<SequenceExecution | null> {
    return LocalCRMRepository.findById('sequence_executions', workspaceId, id);
  }

  public async saveExecution(execution: SequenceExecution): Promise<SequenceExecution> {
    return LocalCRMRepository.save('sequence_executions', execution);
  }

  public async saveLog(log: SequenceLog): Promise<SequenceLog> {
    return LocalCRMRepository.save('sequence_logs', log);
  }

  public async findExecutions(
    workspaceId: string,
    filter?: Record<string, any>
  ): Promise<SequenceExecution[]> {
    return LocalCRMRepository.findMany('sequence_executions', workspaceId, filter);
  }

  public async getSequenceById(id: string, workspaceId: string): Promise<Sequence | null> {
    return LocalCRMRepository.findById('sequences', workspaceId, id);
  }
}
