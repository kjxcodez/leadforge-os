import { HttpClient } from '../http/client.js';
import { toQueryString } from '../utils/query.js';

export interface SuppressionItem {
  id?: string;
  email: string;
  reason: string;
  source?: string;
  evidence?: Record<string, any> | null;
  suppressedAt?: string;
  notes?: string | null;
}

export class SuppressionsModule {
  constructor(private client: HttpClient) {}

  public async list(params?: {
    reason?: string;
    limit?: number;
    skip?: number;
  }): Promise<{ items: SuppressionItem[]; total: number }> {
    const query = toQueryString(params);
    return this.client.get<{ items: SuppressionItem[]; total: number }>(`/suppressions${query}`);
  }

  public async check(
    email: string
  ): Promise<{ email: string; suppressed: boolean; suppression: SuppressionItem | null }> {
    return this.client.get<{ email: string; suppressed: boolean; suppression: SuppressionItem | null }>(
      `/suppressions/check?email=${encodeURIComponent(email)}`
    );
  }

  public async create(data: {
    email: string;
    reason: string;
    source?: string;
    notes?: string | null;
    evidence?: any;
  }): Promise<SuppressionItem> {
    return this.client.post<SuppressionItem>('/suppressions', data);
  }

  public async delete(
    email: string
  ): Promise<{ unsuppressed: boolean; email: string; restoredContactIds?: string[] }> {
    return this.client.delete<{ unsuppressed: boolean; email: string; restoredContactIds?: string[] }>(
      `/suppressions/${encodeURIComponent(email)}`
    );
  }
}
