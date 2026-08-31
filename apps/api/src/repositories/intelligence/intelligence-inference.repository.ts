import { BaseRepository } from '../base/base.repository.js';
import { IntelligenceInferenceModel, type IntelligenceInferenceDocument } from '../../db/models/intelligence-inference.model.js';

export class IntelligenceInferenceRepository extends BaseRepository<IntelligenceInferenceDocument> {
  constructor(workspaceId?: string) {
    super(IntelligenceInferenceModel, workspaceId);
  }

  public async listByCompany(companyId: string, limit = 100): Promise<IntelligenceInferenceDocument[]> {
    return this.findMany({ companyId }, { sort: { createdAt: -1 }, limit });
  }
}
