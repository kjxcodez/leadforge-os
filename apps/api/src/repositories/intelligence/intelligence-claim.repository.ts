import { BaseRepository } from '../base/base.repository.js';
import { IntelligenceClaimModel, type IntelligenceClaimDocument } from '../../db/models/intelligence-claim.model.js';

export class IntelligenceClaimRepository extends BaseRepository<IntelligenceClaimDocument> {
  constructor(workspaceId?: string) {
    super(IntelligenceClaimModel, workspaceId);
  }

  public async listByCompany(companyId: string, limit = 100): Promise<IntelligenceClaimDocument[]> {
    return this.findMany({ companyId }, { sort: { createdAt: -1 }, limit });
  }
}
