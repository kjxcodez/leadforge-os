export enum ContactStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  REPLIED = 'REPLIED',
  BOUNCED = 'BOUNCED',
  UNSUBSCRIBED = 'UNSUBSCRIBED',
}

export interface Contact {
  id: string;
  workspaceId: string;
  companyId: string | null;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  linkedinUrl: string | null;
  status: ContactStatus;
  createdAt: Date;
  updatedAt: Date;
}
