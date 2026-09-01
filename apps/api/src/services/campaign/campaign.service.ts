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
    const clientRecord: any = dto;
    return this.campaignRepository.create({
      ...(clientRecord.id || clientRecord._id ? { _id: clientRecord.id || clientRecord._id } : {}),
      name: validated.name,
      description: validated.description || null,
      sequenceId: validated.sequenceId || null,
      sendingAccountId: validated.sendingAccountId || null,
      steps: validated.steps || [],
      status: (validated.status ? String(validated.status).toUpperCase() : 'DRAFT') as any,
      template: validated.template || null,
      schedule: validated.schedule || null,
      timezone: validated.timezone || 'UTC',
      dailyLimit: validated.dailyLimit !== undefined ? validated.dailyLimit : 0,
      settings: validated.settings || null
    });
  }

  public async updateCampaign(id: string, dto: UpdateCampaignDto): Promise<CampaignDocument> {
    const validated = updateCampaignDtoSchema.parse(dto);
    const updatePayload: any = { ...validated };
    if (updatePayload.status) {
      updatePayload.status = String(updatePayload.status).toUpperCase();
    }
    return this.campaignRepository.update(id, updatePayload);
  }

  public async deleteCampaign(id: string): Promise<boolean> {
    return this.campaignRepository.delete(id);
  }
}
