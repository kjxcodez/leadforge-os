const fs = require('fs');
const path = require('path');

const intSrcDir = 'c:\\Users\\91637\\Desktop\\Business Project\\leadforge-os\\packages\\integrations\\src';

const files = {
  // common
  'common/types.ts': `
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
`,
  'common/adapter.ts': `
import type { IntegrationMetadata, IntegrationStatus } from './types';

export interface BaseAdapter {
  getMetadata(): IntegrationMetadata;
  testConnection(): Promise<IntegrationStatus>;
}
`,
  'common/index.ts': `
export * from './types';
export * from './adapter';
`,

  // adapters
  'adapters/scraper.ts': `
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
    console.log(\`[StubScraper] Scraping for query: \${options.query}\`);
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
`,
  'adapters/verification.ts': `
import type { BaseAdapter } from '../common/adapter';
import type { IntegrationMetadata, IntegrationStatus } from '../common/types';

export interface VerificationResult {
  email: string;
  valid: boolean;
  score: number; // 0 to 100
  disposable: boolean;
  role: boolean;
}

export interface VerificationAdapter extends BaseAdapter {
  verifyEmail(email: string): Promise<VerificationResult>;
}

// Stub implementation
export class StubVerificationAdapter implements VerificationAdapter {
  public getMetadata(): IntegrationMetadata {
    return {
      id: 'stub-verification',
      name: 'Stub Verification (Dev Mode)',
      type: 'verification',
      version: '1.0.0',
    };
  }

  public async testConnection(): Promise<IntegrationStatus> {
    return { connected: true };
  }

  public async verifyEmail(email: string): Promise<VerificationResult> {
    console.log(\`[StubVerification] Verifying email: \${email}\`);
    const valid = !email.endsWith('.invalid') && !email.includes('bounce');
    return {
      email,
      valid,
      score: valid ? 95 : 10,
      disposable: false,
      role: email.startsWith('info') || email.startsWith('contact'),
    };
  }
}
`,
  'adapters/email.ts': `
import type { BaseAdapter } from '../common/adapter';
import type { IntegrationMetadata, IntegrationStatus } from '../common/types';

export interface SendEmailOptions {
  to: string;
  subject: string;
  body: string;
  from?: string;
}

export interface EmailResult {
  messageId: string;
  sent: boolean;
}

export interface EmailAdapter extends BaseAdapter {
  sendEmail(options: SendEmailOptions): Promise<EmailResult>;
}

// Stub implementation
export class StubEmailAdapter implements EmailAdapter {
  public getMetadata(): IntegrationMetadata {
    return {
      id: 'stub-email',
      name: 'Stub Email (Dev Mode)',
      type: 'email',
      version: '1.0.0',
    };
  }

  public async testConnection(): Promise<IntegrationStatus> {
    return { connected: true };
  }

  public async sendEmail(options: SendEmailOptions): Promise<EmailResult> {
    console.log(\`[StubEmail] Sending email to: \${options.to} with subject: "\${options.subject}"\`);
    return {
      messageId: 'msg_' + Math.random().toString(36).substring(7),
      sent: true,
    };
  }
}
`,
  'adapters/index.ts': `
export * from './scraper';
export * from './verification';
export * from './email';
`,

  // factories
  'factories/registry.ts': `
import type { BaseAdapter } from '../common/adapter';
import { StubScraperAdapter } from '../adapters/scraper';
import { StubVerificationAdapter } from '../adapters/verification';
import { StubEmailAdapter } from '../adapters/email';

export class IntegrationRegistry {
  private adapters: Map<string, BaseAdapter> = new Map();

  constructor() {
    this.register(new StubScraperAdapter());
    this.register(new StubVerificationAdapter());
    this.register(new StubEmailAdapter());
  }

  public register(adapter: BaseAdapter): void {
    const meta = adapter.getMetadata();
    this.adapters.set(meta.id, adapter);
  }

  public get<T extends BaseAdapter>(id: string): T {
    const adapter = this.adapters.get(id);
    if (!adapter) {
      throw new Error(\`Integration adapter with ID '\${id}' not found.\`);
    }
    return adapter as T;
  }

  public listByType(type: 'scraper' | 'verification' | 'email'): BaseAdapter[] {
    return Array.from(this.adapters.values()).filter((a) => a.getMetadata().type === type);
  }

  public list(): BaseAdapter[] {
    return Array.from(this.adapters.values());
  }
}

export const integrationRegistry = new IntegrationRegistry();
`,
  'factories/index.ts': `
export * from './registry';
`,

  // root index
  'index.ts': `
export * from './common';
export * from './adapters';
export * from './factories';
`
};

for (const [relativePath, content] of Object.entries(files)) {
  const fullPath = path.join(intSrcDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content.trim() + '\\n');
}

console.log("Integrations package scaffolded.");
