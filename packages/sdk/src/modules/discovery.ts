import { HttpClient } from '../http/client';

export interface DiscoveryResult {
  companies: any[];
  contacts: any[];
}

export class DiscoveryModule {
  constructor(private client: HttpClient) {}

  public async search(query: string): Promise<DiscoveryResult> {
    return this.client.post<DiscoveryResult>('/discovery/search', { query });
  }
}
