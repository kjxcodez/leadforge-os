import { HttpClient } from '../http/client.js';
import { toQueryString } from '../utils/query.js';

export interface CompanyDiscoveryRun {
  id: string;
  workspaceId: string;
  companyId: string;
  discoveryRunId: string;
  requiresReview?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export class CompanyDiscoveryRunsModule {
  constructor(private client: HttpClient) {}

  public async list(params?: { page?: number; limit?: number; discoveryRunId?: string }): Promise<CompanyDiscoveryRun[]> {
    const query = toQueryString(params);
    return this.client.get<CompanyDiscoveryRun[]>(`/company-discovery-runs${query}`);
  }

  public async create(payload: Partial<CompanyDiscoveryRun>): Promise<CompanyDiscoveryRun> {
    return this.client.post<CompanyDiscoveryRun>('/company-discovery-runs', payload);
  }

  public async update(id: string, payload: Partial<CompanyDiscoveryRun>): Promise<CompanyDiscoveryRun> {
    return this.client.patch<CompanyDiscoveryRun>(`/company-discovery-runs/${id}`, payload);
  }

  public async delete(id: string): Promise<void> {
    return this.client.delete<void>(`/company-discovery-runs/${id}`);
  }
}
