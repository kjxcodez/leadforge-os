import type { OutreachChannel } from '../entities/outreach';
import type { PaginationParams } from '../api/pagination';

export interface CreateOutreachDto {
  contactId: string;
  campaignId?: string | null;
  channel: OutreachChannel;
  messageDetails?: import('../entities/outreach').EmailMessage;
}

export interface OutreachFilters extends PaginationParams {
  contactId?: string;
  campaignId?: string;
  channel?: OutreachChannel;
  status?: string;
}
