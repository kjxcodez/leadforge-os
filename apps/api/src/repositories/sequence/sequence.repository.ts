import { BaseRepository } from '../base/base.repository.js';
import { SequenceModel, type SequenceDocument } from '../../db/models/sequence.model.js';

export class SequenceRepository extends BaseRepository<SequenceDocument> {
  constructor(workspaceId?: string) {
    super(SequenceModel, workspaceId);
  }

  public async findActive(): Promise<SequenceDocument[]> {
    return this.findMany({ status: 'ACTIVE' });
  }
}
