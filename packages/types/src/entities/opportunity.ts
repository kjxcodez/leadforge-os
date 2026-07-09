export enum OpportunityStage {
  PROSPECTING = 'PROSPECTING',
  QUALIFICATION = 'QUALIFICATION',
  PROPOSAL = 'PROPOSAL',
  NEGOTIATION = 'NEGOTIATION',
  CLOSED_WON = 'CLOSED_WON',
  CLOSED_LOST = 'CLOSED_LOST',
}

export interface Opportunity {
  id: string;
  workspaceId: string;
  companyId: string;
  name: string;
  value: number | null;
  stage: OpportunityStage;
  expectedCloseDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
