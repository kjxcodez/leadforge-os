import type { CampaignRepository } from '@leadforge/agent-core';
import type { Campaign } from '@leadforge/schema';
import { LocalCRMRepository } from './local-crm';

export class CampaignRepositoryImpl implements CampaignRepository {
  public async getById(id: string, workspaceId: string): Promise<Campaign | null> {
    return LocalCRMRepository.findById('campaigns', workspaceId, id);
  }

  public async save(campaign: Campaign): Promise<Campaign> {
    return LocalCRMRepository.save('campaigns', campaign);
  }

  public async findMany(workspaceId: string, filter?: Record<string, any>): Promise<Campaign[]> {
    return LocalCRMRepository.findMany('campaigns', workspaceId, filter);
  }

  public async delete(id: string, workspaceId: string): Promise<void> {
    await LocalCRMRepository.softDelete('campaigns', workspaceId, id);
  }
}
