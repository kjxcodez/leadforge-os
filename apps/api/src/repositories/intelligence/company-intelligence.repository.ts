import { BaseRepository } from '../base/base.repository.js';
import { CompanyIntelligenceModel, type CompanyIntelligenceDocument } from '../../db/models/company-intelligence.model.js';

export class CompanyIntelligenceRepository extends BaseRepository<CompanyIntelligenceDocument> {
  constructor(workspaceId?: string) {
    super(CompanyIntelligenceModel, workspaceId);
  }

  public async findByCompanyId(companyId: string): Promise<CompanyIntelligenceDocument | null> {
    return this.findOne({ companyId });
  }
}
