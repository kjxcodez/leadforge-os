import { HttpClient } from '../http/client';

export interface DiscoveryJob {
  id: string;
  name: string;
  provider: string;
  status: string;
  progress: number;
  query: string;
  error?: string | null;
  statistics: {
    companiesFound: number;
    contactsFound: number;
    duplicates: number;
    imported: number;
  };
  startedAt?: string | null;
  finishedAt?: string | null;
}

export interface DiscoveryResult {
  id: string;
  jobId: string;
  companyName: string;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  description?: string | null;
  status: 'pending' | 'imported' | 'skipped';
  contacts: Array<{
    firstName: string;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    title?: string | null;
    linkedinUrl?: string | null;
  }>;
}

export class DiscoveryModule {
  constructor(private client: HttpClient) {}

  /**
   * Retrieves workspace-wide discovery jobs list.
   */
  public async listJobs(filters?: Record<string, any>): Promise<DiscoveryJob[]> {
    const query = filters ? '?' + new URLSearchParams(filters as any).toString() : '';
    return this.client.get<DiscoveryJob[]>(`/discovery/jobs${query}`);
  }

  /**
   * Creates/triggers a new discovery search job.
   */
  public async createJob(payload: {
    name: string;
    provider: string;
    query: string;
  }): Promise<DiscoveryJob> {
    return this.client.post<DiscoveryJob>('/discovery/jobs', payload);
  }

  /**
   * Gets detail overview metadata for a discovery job by ID.
   */
  public async getJob(id: string): Promise<DiscoveryJob> {
    return this.client.get<DiscoveryJob>(`/discovery/jobs/${id}`);
  }

  /**
   * Lists scraped lead results found by a discovery job.
   */
  public async getJobResults(id: string): Promise<DiscoveryResult[]> {
    return this.client.get<DiscoveryResult[]>(`/discovery/jobs/${id}/results`);
  }

  /**
   * Imports a single discovery result's company and contacts to CRM.
   */
  public async importResult(id: string): Promise<DiscoveryResult> {
    return this.client.post<DiscoveryResult>(`/discovery/results/${id}/import`, {});
  }

  /**
   * Skips/ignores a discovery result.
   */
  public async skipResult(id: string): Promise<DiscoveryResult> {
    return this.client.post<DiscoveryResult>(`/discovery/results/${id}/skip`, {});
  }
}
