import { CampaignRepository } from '../../repositories/campaign/campaign.repository.js';
import type { CampaignDocument } from '../../db/models/campaign.model.js';
import { JobModel, SequenceExecutionModel } from '../../db/models/index.js';
import {
  createCampaignDtoSchema,
  updateCampaignDtoSchema,
  isValidCampaignTransition,
  CampaignStatus,
  VALID_CAMPAIGN_TRANSITIONS,
  type CreateCampaignDto,
  type UpdateCampaignDto
} from '@leadforge/schema';
import { ValidationError } from '../../errors/index.js';

export class CampaignService {
  private campaignRepository: CampaignRepository;
  private workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
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
      const targetStatus = String(updatePayload.status).toUpperCase();
      const existing = await this.campaignRepository.findById(id);
      if (!isValidCampaignTransition(existing.status, targetStatus)) {
        throw new ValidationError(
          `Invalid campaign state transition from "${existing.status}" to "${targetStatus}". Allowed: ${
            (VALID_CAMPAIGN_TRANSITIONS as any)[existing.status]?.join(', ') || 'none'
          }.`
        );
      }
      updatePayload.status = targetStatus;

      if (targetStatus === 'STOPPED') {
        try {
          const executionIds = await SequenceExecutionModel.find({
            workspaceId: this.workspaceId,
            campaignId: id
          }).distinct('_id');

          await JobModel.updateMany(
            {
              workspaceId: this.workspaceId,
              status: { $in: ['queued', 'starting', 'running', 'retrying'] },
              $or: [
                { 'payload.campaignId': id },
                { 'payload.executionId': { $in: executionIds.map((eid) => String(eid)) } }
              ]
            },
            { $set: { status: 'cancelled' } }
          );

          await SequenceExecutionModel.updateMany(
            {
              workspaceId: this.workspaceId,
              campaignId: id,
              status: { $in: ['PENDING', 'RUNNING', 'WAITING', 'PAUSED'] }
            },
            { $set: { status: 'CANCELLED' } }
          );
        } catch (cancelErr) {
          console.warn(`[CampaignService] Warning during stop cleanup for ${id}:`, cancelErr);
        }
      }
    }
    return this.campaignRepository.update(id, updatePayload);
  }

  public async pauseCampaign(id: string): Promise<CampaignDocument> {
    return this.updateCampaign(id, { status: CampaignStatus.PAUSED as any });
  }

  public async resumeCampaign(id: string): Promise<CampaignDocument> {
    return this.updateCampaign(id, { status: CampaignStatus.ACTIVE as any });
  }

  public async stopCampaign(id: string): Promise<CampaignDocument> {
    return this.updateCampaign(id, { status: CampaignStatus.STOPPED as any });
  }

  public async deleteCampaign(id: string): Promise<boolean> {
    return this.campaignRepository.delete(id);
  }
}
