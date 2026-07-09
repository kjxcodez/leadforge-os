export enum CampaignStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
}

export interface CampaignStep {
  id: string;
  type: string;
  delayDays: number;
  templateId: string;
}

export interface Campaign {
  id: string;
  workspaceId: string;
  name: string;
  status: CampaignStatus;
  steps: CampaignStep[];
  createdAt: Date;
  updatedAt: Date;
}
