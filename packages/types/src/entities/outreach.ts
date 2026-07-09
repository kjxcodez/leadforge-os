export enum OutreachChannel {
  EMAIL = 'EMAIL',
  LINKEDIN = 'LINKEDIN',
  CALL = 'CALL',
}

export interface EmailTemplate {
  id: string;
  workspaceId: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailMessage {
  messageId: string;
  threadId?: string;
  subject: string;
  body: string;
}

export interface Outreach {
  id: string;
  workspaceId: string;
  contactId: string;
  campaignId: string | null;
  channel: OutreachChannel;
  status: string;
  sentAt: Date | null;
  messageDetails: EmailMessage | null;
  createdAt: Date;
  updatedAt: Date;
}
