import { BaseRepository } from '../base/base.repository.js';
import { CampaignModel, type CampaignDocument } from '../../db/models/campaign.model.js';

export class CampaignRepository extends BaseRepository<CampaignDocument> {
  constructor(workspaceId?: string) {
    super(CampaignModel, workspaceId);
  }

  public async findByName(name: string): Promise<CampaignDocument | null> {
    return this.findOne({ name });
  }
}
