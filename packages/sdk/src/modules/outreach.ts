import { HttpClient } from '../http/client';
import type { Outreach, CreateOutreachDto, OutreachFilters } from '@leadforge/schema';

export class OutreachModule {
  constructor(private client: HttpClient) {}

  public async list(filters?: OutreachFilters): Promise<Outreach[]> {
    const queryParams = filters
      ? '?' + new URLSearchParams(filters as any).toString()
      : '';
    return this.client.get<Outreach[]>(`/outreach${queryParams}`);
  }

  public async send(dto: CreateOutreachDto): Promise<Outreach> {
    return this.client.post<Outreach>('/outreach', dto);
  }
}
