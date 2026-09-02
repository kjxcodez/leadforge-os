import { BaseRepository } from '../base/base.repository.js';
import { OpportunityScoreModel, type OpportunityScoreDocument } from '../../db/models/opportunity-score.model.js';

export class OpportunityScoreRepository extends BaseRepository<OpportunityScoreDocument> {
  constructor(workspaceId?: string) {
    super(OpportunityScoreModel, workspaceId);
  }

  public async findByCompanyId(companyId: string): Promise<OpportunityScoreDocument | null> {
    return this.findOne({ companyId });
  }
}
