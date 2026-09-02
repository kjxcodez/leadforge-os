import { BaseRepository } from '../base/base.repository.js';
import { WebsiteIntelligenceModel, type WebsiteIntelligenceDocument } from '../../db/models/website-intelligence.model.js';

export class WebsiteIntelligenceRepository extends BaseRepository<WebsiteIntelligenceDocument> {
  constructor(workspaceId?: string) {
    super(WebsiteIntelligenceModel, workspaceId);
  }

  public async findByCompanyId(companyId: string): Promise<WebsiteIntelligenceDocument | null> {
    return this.findOne({ companyId });
  }
}
