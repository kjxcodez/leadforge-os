import { HttpClient } from '../http/client';
import type {
  Outreach,
  CreateOutreachDto,
  OutreachFilters,
  EmailAccount,
  CreateEmailAccountDto,
  EmailTemplate,
  CreateEmailTemplateDto
} from '@leadforge/schema';

export class OutreachModule {
  constructor(private client: HttpClient) {}

  // ── Outbound Log Listing ────────────────────────────────────────────────

  public async list(filters?: OutreachFilters): Promise<Outreach[]> {
    const queryParams = filters ? '?' + new URLSearchParams(filters as any).toString() : '';
    return this.client.get<Outreach[]>(`/outreach${queryParams}`);
  }

  public async send(dto: CreateOutreachDto): Promise<Outreach> {
    return this.client.post<Outreach>('/outreach', dto);
  }

  // ── Email Accounts Management ───────────────────────────────────────────

  public async listAccounts(): Promise<EmailAccount[]> {
    return this.client.get<EmailAccount[]>('/outreach/accounts');
  }

  public async createAccount(dto: CreateEmailAccountDto): Promise<EmailAccount> {
    return this.client.post<EmailAccount>('/outreach/accounts', dto);
  }

  public async deleteAccount(id: string): Promise<void> {
    return this.client.delete<void>(`/outreach/accounts/${id}`);
  }

  public async verifyAccount(id: string): Promise<{ verified: boolean }> {
    return this.client.post<{ verified: boolean }>(`/outreach/accounts/${id}/verify`, {});
  }

  public async disconnectAccount(id: string): Promise<{ success: boolean }> {
    return this.client.post<{ success: boolean }>(`/outreach/accounts/${id}/disconnect`, {});
  }

  public async reconnectAccount(id: string, dto: any): Promise<EmailAccount> {
    return this.client.post<EmailAccount>(`/outreach/accounts/${id}/reconnect`, dto);
  }

  // ── Email Templates Management ──────────────────────────────────────────

  public async listTemplates(): Promise<EmailTemplate[]> {
    return this.client.get<EmailTemplate[]>('/outreach/templates');
  }

  public async createTemplate(dto: CreateEmailTemplateDto): Promise<EmailTemplate> {
    return this.client.post<EmailTemplate>('/outreach/templates', dto);
  }

  public async deleteTemplate(id: string): Promise<void> {
    return this.client.delete<void>(`/outreach/templates/${id}`);
  }

  public async previewTemplate(
    id: string,
    contactId?: string
  ): Promise<{ subject: string; body: string }> {
    const queryParams = contactId ? `?contactId=${contactId}` : '';
    return this.client.get<{ subject: string; body: string }>(
      `/outreach/templates/${id}/preview${queryParams}`
    );
  }
}
