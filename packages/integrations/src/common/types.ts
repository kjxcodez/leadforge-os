export interface IntegrationMetadata {
  id: string;
  name: string;
  type: 'scraper' | 'verification' | 'email';
  version: string;
}

export interface IntegrationStatus {
  connected: boolean;
  message?: string;
}
