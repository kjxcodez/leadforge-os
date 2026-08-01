import { CampaignRepository } from '../../repositories/campaign/campaign.repository.js';
import type { CampaignDocument } from '../../db/models/campaign.model.js';
import {
  createCampaignDtoSchema,
  updateCampaignDtoSchema,
  type CreateCampaignDto,
  type UpdateCampaignDto
} from '@leadforge/schema';

export class CampaignService {
  private campaignRepository: CampaignRepository;

  constructor(workspaceId: string) {
    this.campaignRepository = new CampaignRepository(workspaceId);
  }

  public async getCampaignById(id: string): Promise<CampaignDocument> {
    return this.campaignRepository.findById(id);
  }

  public async listCampaigns(
    page?: number,
    limit?: number
  ): Promise<{ data: CampaignDocument[]; total: number }> {
    return this.campaignRepository.paginate({}, page, limit);
  }

  public async createCampaign(dto: CreateCampaignDto): Promise<CampaignDocument> {
    const validated = createCampaignDtoSchema.parse(dto);
    return this.campaignRepository.create({
      name: validated.name,
      steps: validated.steps || [],
      status: validated.status || 'draft',
      template: validated.template || null,
      schedule: validated.schedule || null,
      settings: validated.settings || null
    });
  }

  public async updateCampaign(id: string, dto: UpdateCampaignDto): Promise<CampaignDocument> {
    const validated = updateCampaignDtoSchema.parse(dto);
    return this.campaignRepository.update(id, validated);
  }

  public async deleteCampaign(id: string): Promise<boolean> {
    return this.campaignRepository.delete(id);
  }
}
