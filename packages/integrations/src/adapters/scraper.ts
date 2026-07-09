import type { BaseAdapter } from '../common/adapter';
import type { IntegrationMetadata, IntegrationStatus } from '../common/types';

export interface ScrapeOptions {
  query: string;
  limit?: number;
  depth?: number;
}

export interface ScrapedLead {
  companyName: string;
  website?: string;
  description?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
}

export interface ScraperAdapter extends BaseAdapter {
  scrape(options: ScrapeOptions): Promise<ScrapedLead[]>;
}

// Stub implementation for development
export class StubScraperAdapter implements ScraperAdapter {
  public getMetadata(): IntegrationMetadata {
    return {
      id: 'stub-scraper',
      name: 'Stub Scraper (Dev Mode)',
      type: 'scraper',
      version: '1.0.0',
    };
  }

  public async testConnection(): Promise<IntegrationStatus> {
    return { connected: true };
  }

  public async scrape(options: ScrapeOptions): Promise<ScrapedLead[]> {
    console.log(`[StubScraper] Scraping for query: ${options.query}`);
    // Return mock data
    return [
      {
        companyName: 'Acme Corp',
        website: 'https://acme.example.com',
        description: 'Global manufacturing of cartoons and gadgets.',
        email: 'info@acme.example.com',
        linkedinUrl: 'https://linkedin.com/company/acme',
      },
      {
        companyName: 'Stark Industries',
        website: 'https://stark.example.com',
        description: 'Advanced defense tech and clean energy.',
        email: 'pepper@stark.example.com',
        linkedinUrl: 'https://linkedin.com/company/stark',
      },
    ];
  }
}
