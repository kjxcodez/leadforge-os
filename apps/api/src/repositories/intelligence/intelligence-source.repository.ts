import { BaseRepository } from '../base/base.repository.js';
import { IntelligenceSourceModel, type IntelligenceSourceDocument } from '../../db/models/intelligence-source.model.js';

export class IntelligenceSourceRepository extends BaseRepository<IntelligenceSourceDocument> {
  constructor(workspaceId?: string) {
    super(IntelligenceSourceModel, workspaceId);
  }

  public async listByCompany(companyId: string, limit = 50): Promise<IntelligenceSourceDocument[]> {
    return this.findMany({ companyId }, { sort: { retrievedAt: -1 }, limit });
  }
}
