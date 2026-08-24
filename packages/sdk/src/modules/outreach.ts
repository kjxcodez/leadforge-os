import { HttpClient } from '../http/client';
import type {
  Outreach,
  CreateOutreachDto,
  OutreachFilters,
  EmailAccount,
  EmailTemplate,
  CreateEmailTemplateDto
} from '@leadforge/schema';

export interface SendEmailPayload {
  accountId: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  useSignature?: boolean;
  attachments?: Array<{
    filename: string;
    contentBase64?: string;
    path?: string;
    contentType?: string;
    size?: number;
  }>;
}

export interface OAuthConnectResult {
  transactionId: string;
  authorizationUrl: string;
}

export interface OAuthTransactionStatus {
  status: string;
  emailAccountId?: string;
  account?: EmailAccount;
  error?: string;
}

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

  // ── Email Accounts Management (API-owned Gmail OAuth & Mailboxes) ─────────

  public async listAccounts(): Promise<EmailAccount[]> {
    return this.client.get<EmailAccount[]>('/email/accounts');
  }

  public async getAccount(id: string): Promise<EmailAccount> {
    return this.client.get<EmailAccount>(`/email/accounts/${id}`);
  }

  public async connectGmail(): Promise<OAuthConnectResult> {
    return this.client.post<OAuthConnectResult>('/email/accounts/gmail/connect', {});
  }

  public async getOAuthStatus(transactionId: string): Promise<OAuthTransactionStatus> {
    return this.client.get<OAuthTransactionStatus>(`/email/accounts/gmail/oauth/status/${transactionId}`);
  }

  public async reconnectGmail(id: string): Promise<OAuthConnectResult> {
    return this.client.post<OAuthConnectResult>(`/email/accounts/${id}/reconnect`, {});
  }

  public async disconnectAccount(id: string): Promise<{ success: boolean }> {
    return this.client.post<{ success: boolean }>(`/email/accounts/${id}/disconnect`, {});
  }

  public async sendTestEmail(
    id: string,
    payload: {
      to: string;
      useSignature?: boolean;
      attachments?: Array<{
        filename: string;
        contentBase64?: string;
        path?: string;
        contentType?: string;
        size?: number;
      }>;
    }
  ): Promise<{ messageId: string; sentTo: string; signatureNotice?: string }> {
    return this.client.post<{ messageId: string; sentTo: string; signatureNotice?: string }>(`/email/accounts/${id}/test`, payload);
  }

  public async getTestRecipients(): Promise<Array<{ email: string; firstUsedAt?: string; lastUsedAt?: string }>> {
    return this.client.get<Array<{ email: string; firstUsedAt?: string; lastUsedAt?: string }>>('/email/test-recipients');
  }

  public async sendEmail(payload: SendEmailPayload): Promise<{ messageId: string; accepted: string[] }> {
    return this.client.post<{ messageId: string; accepted: string[] }>('/email/send', payload);
  }

  /**
   * Syncs safe metadata to the API.
   */
  public async syncAccountMeta(
    id: string,
    meta: {
      provider?: string;
      name?: string;
      email?: string;
      status?: string;
      googleAccountId?: string;
      signature?: string;
      dailyLimit?: number;
      hourlyLimit?: number;
    }
  ): Promise<EmailAccount> {
    return this.client.patch<EmailAccount>(`/email/accounts/${id}/meta`, meta);
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
