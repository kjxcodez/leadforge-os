import type { IntegrationMetadata, IntegrationStatus } from './types';

export interface BaseAdapter {
  getMetadata(): IntegrationMetadata;
  testConnection(): Promise<IntegrationStatus>;
}
