import type { CampaignStatus, CampaignStep } from '../entities/campaign';
import type { PaginationParams } from '../api/pagination';

export interface CreateCampaignDto {
  name: string;
  status?: CampaignStatus;
  steps?: Omit<CampaignStep, 'id'>[];
}

export interface UpdateCampaignDto extends Partial<CreateCampaignDto> {}

export interface CampaignFilters extends PaginationParams {
  status?: CampaignStatus;
}
