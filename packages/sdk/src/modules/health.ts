import { HttpClient } from '../http/client';

export interface HealthStatus {
  status: string;
  uptime: number;
}

export class HealthModule {
  constructor(private client: HttpClient) {}

  public async getStatus(): Promise<HealthStatus> {
    return this.client.get<HealthStatus>('/health');
  }
}
