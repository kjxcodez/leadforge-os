import { BaseRepository } from '../base/base.repository.js';
import { IntelligenceEvidenceModel, type IntelligenceEvidenceDocument } from '../../db/models/intelligence-evidence.model.js';

export class IntelligenceEvidenceRepository extends BaseRepository<IntelligenceEvidenceDocument> {
  constructor(workspaceId?: string) {
    super(IntelligenceEvidenceModel, workspaceId);
  }

  public async listByCompany(companyId: string, limit = 100): Promise<IntelligenceEvidenceDocument[]> {
    return this.findMany({ companyId }, { sort: { observedAt: -1 }, limit });
  }

  public async listBySource(sourceId: string): Promise<IntelligenceEvidenceDocument[]> {
    return this.findMany({ sourceId });
  }
}
