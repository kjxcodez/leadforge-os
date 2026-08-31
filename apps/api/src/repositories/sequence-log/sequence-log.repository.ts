import { BaseRepository } from '../base/base.repository.js';
import { SequenceLogModel, type SequenceLogDocument } from '../../db/models/sequence-log.model.js';

export class SequenceLogRepository extends BaseRepository<SequenceLogDocument> {
  constructor(workspaceId?: string) {
    super(SequenceLogModel, workspaceId);
  }

  public async listByExecution(executionId: string): Promise<SequenceLogDocument[]> {
    return this.findMany({ executionId }, { sort: { createdAt: -1 } });
  }
}
