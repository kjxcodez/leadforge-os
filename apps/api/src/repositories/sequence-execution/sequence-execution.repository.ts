import { BaseRepository } from '../base/base.repository.js';
import { SequenceExecutionModel, type SequenceExecutionDocument } from '../../db/models/sequence-execution.model.js';

export class SequenceExecutionRepository extends BaseRepository<SequenceExecutionDocument> {
  constructor(workspaceId?: string) {
    super(SequenceExecutionModel, workspaceId);
  }

  public async findByContact(sequenceId: string, contactId: string): Promise<SequenceExecutionDocument | null> {
    return this.findOne({ sequenceId, contactId });
  }

  public async findActive(): Promise<SequenceExecutionDocument[]> {
    return this.findMany({ status: 'ACTIVE' });
  }
}
