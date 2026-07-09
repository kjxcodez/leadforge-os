export enum CompanyStatus {
  LEAD = 'LEAD',
  QUALIFIED = 'QUALIFIED',
  CUSTOMER = 'CUSTOMER',
  ARCHIVED = 'ARCHIVED',
}

export interface Company {
  id: string;
  workspaceId: string;
  name: string;
  domain: string | null;
  industry: string | null;
  size: string | null;
  location: string | null;
  status: CompanyStatus;
  createdAt: Date;
  updatedAt: Date;
}
