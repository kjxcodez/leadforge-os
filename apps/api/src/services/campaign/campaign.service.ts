import { CampaignRepository } from "../../repositories/campaign/campaign.repository.js";
import type { CampaignDocument, CampaignStep } from "../../db/models/campaign.model.js";
import { CampaignStatus } from "@leadforge/schema";

export class CampaignService {
  private campaignRepository: CampaignRepository;

  constructor(workspaceId: string) {
    this.campaignRepository = new CampaignRepository(workspaceId);
  }

  public async getCampaignById(id: string): Promise<CampaignDocument> {
    return this.campaignRepository.findById(id);
  }

  public async listCampaigns(page?: number, limit?: number): Promise<{ data: CampaignDocument[]; total: number }> {
    return this.campaignRepository.paginate({}, page, limit);
  }

  public async createCampaign(data: { name: string; steps?: CampaignStep[] }): Promise<CampaignDocument> {
    return this.campaignRepository.create({
      name: data.name,
      steps: data.steps || [],
      status: CampaignStatus.DRAFT,
    });
  }

  public async updateCampaign(id: string, data: Partial<CampaignDocument>): Promise<CampaignDocument> {
    return this.campaignRepository.update(id, data);
  }

  public async deleteCampaign(id: string): Promise<boolean> {
    return this.campaignRepository.delete(id);
  }
}
