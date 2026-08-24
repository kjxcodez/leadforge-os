import { HttpClient } from '../http/client.js';

export interface Audience {
  id: string;
  workspaceId: string;
  name: string;
  description?: string | null;
  entityType: 'companies' | 'contacts' | 'both';
  filterDefinition: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export class AudiencesModule {
  constructor(private client: HttpClient) {}

  public async list(): Promise<Audience[]> {
    return this.client.get<Audience[]>('/audiences');
  }

  public async get(id: string): Promise<Audience> {
    return this.client.get<Audience>(`/audiences/${id}`);
  }

  public async create(payload: Partial<Audience>): Promise<Audience> {
    return this.client.post<Audience>('/audiences', payload);
  }

  public async update(id: string, payload: Partial<Audience>): Promise<Audience> {
    return this.client.patch<Audience>(`/audiences/${id}`, payload);
  }

  public async delete(id: string): Promise<void> {
    return this.client.delete<void>(`/audiences/${id}`);
  }

  public async resolve(id: string): Promise<{ contactIds: string[]; companyIds: string[] }> {
    return this.client.post<{ contactIds: string[]; companyIds: string[] }>(`/audiences/${id}/resolve`, {});
  }
}
