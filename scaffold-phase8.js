const fs = require('fs');
const path = require('path');

const sdkSrcDir = 'c:\\Users\\91637\\Desktop\\Business Project\\leadforge-os\\packages\\sdk\\src';

const files = {
  // errors
  'errors/index.ts': `
import { ErrorCode } from '@leadforge/types';

export class SdkError extends Error {
  public readonly code: string;
  public readonly details: unknown | null;
  public readonly status: number | null;

  constructor(message: string, code: string = ErrorCode.INTERNAL_SERVER_ERROR, status: number | null = null, details: unknown | null = null) {
    super(message);
    this.name = 'SdkError';
    this.code = code;
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, SdkError.prototype);
  }
}

export function isSdkError(error: unknown): error is SdkError {
  return error instanceof SdkError;
}
`,

  // http
  'http/client.ts': `
import { SdkError } from '../errors';
import type { ApiResponse } from '@leadforge/types';

export interface HttpClientConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  tokenResolver?: () => string | null | Promise<string | null>;
  onUnauthorized?: () => void | Promise<void>;
}

export class HttpClient {
  private config: HttpClientConfig;

  constructor(config: HttpClientConfig) {
    this.config = config;
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers,
    };

    if (this.config.tokenResolver) {
      const token = await this.config.tokenResolver();
      if (token) {
        headers['Authorization'] = \`Bearer \${token}\`;
      }
    }

    return headers;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options: { retries?: number } = {}
  ): Promise<T> {
    const url = \`\${this.config.baseUrl}\${path}\`;
    const headers = await this.getHeaders();
    const retries = options.retries ?? 2;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (response.status === 401 && this.config.onUnauthorized) {
          await this.config.onUnauthorized();
        }

        const payload = (await response.json()) as ApiResponse<T>;

        if (!response.ok || !payload.success) {
          throw new SdkError(
            payload.error?.message || response.statusText,
            payload.error?.code,
            response.status,
            payload.error?.details
          );
        }

        return payload.data as T;
      } catch (error) {
        if (error instanceof SdkError) {
          throw error;
        }
        if (attempt === retries) {
          throw new SdkError(
            error instanceof Error ? error.message : 'Network request failed',
            'NETWORK_ERROR',
            null,
            error
          );
        }
        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 200));
      }
    }

    throw new SdkError('Network request failed', 'NETWORK_ERROR');
  }

  public get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  public post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  public put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  public patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  public delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }
}
`,

  // modules
  'modules/health.ts': `
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
`,
  'modules/auth.ts': `
import { HttpClient } from '../http/client';
import type { LoginDto, RegisterDto, AuthResponse } from '@leadforge/types';

export class AuthModule {
  constructor(private client: HttpClient) {}

  public async login(dto: LoginDto): Promise<AuthResponse> {
    return this.client.post<AuthResponse>('/auth/login', dto);
  }

  public async register(dto: RegisterDto): Promise<AuthResponse> {
    return this.client.post<AuthResponse>('/auth/register', dto);
  }

  public async logout(): Promise<void> {
    return this.client.post<void>('/auth/logout');
  }
}
`,
  'modules/companies.ts': `
import { HttpClient } from '../http/client';
import type { Company, CreateCompanyDto, UpdateCompanyDto, CompanyFilters } from '@leadforge/types';

export class CompaniesModule {
  constructor(private client: HttpClient) {}

  public async list(filters?: CompanyFilters): Promise<Company[]> {
    const queryParams = filters
      ? '?' + new URLSearchParams(filters as any).toString()
      : '';
    return this.client.get<Company[]>(\`/companies\${queryParams}\`);
  }

  public async get(id: string): Promise<Company> {
    return this.client.get<Company>(\`/companies/\${id}\`);
  }

  public async create(dto: CreateCompanyDto): Promise<Company> {
    return this.client.post<Company>('/companies', dto);
  }

  public async update(id: string, dto: UpdateCompanyDto): Promise<Company> {
    return this.client.patch<Company>(\`/companies/\${id}\`, dto);
  }

  public async delete(id: string): Promise<void> {
    return this.client.delete<void>(\`/companies/\${id}\`);
  }
}
`,
  'modules/contacts.ts': `
import { HttpClient } from '../http/client';
import type { Contact, CreateContactDto, UpdateContactDto, ContactFilters } from '@leadforge/types';

export class ContactsModule {
  constructor(private client: HttpClient) {}

  public async list(filters?: ContactFilters): Promise<Contact[]> {
    const queryParams = filters
      ? '?' + new URLSearchParams(filters as any).toString()
      : '';
    return this.client.get<Contact[]>(\`/contacts\${queryParams}\`);
  }

  public async get(id: string): Promise<Contact> {
    return this.client.get<Contact>(\`/contacts/\${id}\`);
  }

  public async create(dto: CreateContactDto): Promise<Contact> {
    return this.client.post<Contact>('/contacts', dto);
  }

  public async update(id: string, dto: UpdateContactDto): Promise<Contact> {
    return this.client.patch<Contact>(\`/contacts/\${id}\`, dto);
  }

  public async delete(id: string): Promise<void> {
    return this.client.delete<void>(\`/contacts/\${id}\`);
  }
}
`,
  'modules/campaigns.ts': `
import { HttpClient } from '../http/client';
import type { Campaign, CreateCampaignDto, UpdateCampaignDto, CampaignFilters } from '@leadforge/types';

export class CampaignsModule {
  constructor(private client: HttpClient) {}

  public async list(filters?: CampaignFilters): Promise<Campaign[]> {
    const queryParams = filters
      ? '?' + new URLSearchParams(filters as any).toString()
      : '';
    return this.client.get<Campaign[]>(\`/campaigns\${queryParams}\`);
  }

  public async get(id: string): Promise<Campaign> {
    return this.client.get<Campaign>(\`/campaigns/\${id}\`);
  }

  public async create(dto: CreateCampaignDto): Promise<Campaign> {
    return this.client.post<Campaign>('/campaigns', dto);
  }

  public async update(id: string, dto: UpdateCampaignDto): Promise<Campaign> {
    return this.client.patch<Campaign>(\`/campaigns/\${id}\`, dto);
  }

  public async delete(id: string): Promise<void> {
    return this.client.delete<void>(\`/campaigns/\${id}\`);
  }
}
`,
  'modules/outreach.ts': `
import { HttpClient } from '../http/client';
import type { Outreach, CreateOutreachDto, OutreachFilters } from '@leadforge/types';

export class OutreachModule {
  constructor(private client: HttpClient) {}

  public async list(filters?: OutreachFilters): Promise<Outreach[]> {
    const queryParams = filters
      ? '?' + new URLSearchParams(filters as any).toString()
      : '';
    return this.client.get<Outreach[]>(\`/outreach\${queryParams}\`);
  }

  public async send(dto: CreateOutreachDto): Promise<Outreach> {
    return this.client.post<Outreach>('/outreach', dto);
  }
}
`,
  'modules/workspaces.ts': `
import { HttpClient } from '../http/client';
import type { Workspace, CreateWorkspaceDto, UpdateWorkspaceDto } from '@leadforge/types';

export class WorkspacesModule {
  constructor(private client: HttpClient) {}

  public async get(id: string): Promise<Workspace> {
    return this.client.get<Workspace>(\`/workspaces/\${id}\`);
  }

  public async create(dto: CreateWorkspaceDto): Promise<Workspace> {
    return this.client.post<Workspace>('/workspaces', dto);
  }

  public async update(id: string, dto: UpdateWorkspaceDto): Promise<Workspace> {
    return this.client.patch<Workspace>(\`/workspaces/\${id}\`, dto);
  }
}
`,
  'modules/discovery.ts': `
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
`,
  'modules/index.ts': `
export * from './health';
export * from './auth';
export * from './companies';
export * from './contacts';
export * from './campaigns';
export * from './outreach';
export * from './workspaces';
export * from './discovery';
`,

  // client
  'client/index.ts': `
import { HttpClient, HttpClientConfig } from '../http/client';
import {
  HealthModule,
  AuthModule,
  CompaniesModule,
  ContactsModule,
  CampaignsModule,
  OutreachModule,
  WorkspacesModule,
  DiscoveryModule,
} from '../modules';

export class SdkClient {
  private httpClient: HttpClient;

  public readonly health: HealthModule;
  public readonly auth: AuthModule;
  public readonly companies: CompaniesModule;
  public readonly contacts: ContactsModule;
  public readonly campaigns: CampaignsModule;
  public readonly outreach: OutreachModule;
  public readonly workspaces: WorkspacesModule;
  public readonly discovery: DiscoveryModule;

  constructor(config: HttpClientConfig) {
    this.httpClient = new HttpClient(config);

    this.health = new HealthModule(this.httpClient);
    this.auth = new AuthModule(this.httpClient);
    this.companies = new CompaniesModule(this.httpClient);
    this.contacts = new ContactsModule(this.httpClient);
    this.campaigns = new CampaignsModule(this.httpClient);
    this.outreach = new OutreachModule(this.httpClient);
    this.workspaces = new WorkspacesModule(this.httpClient);
    this.discovery = new DiscoveryModule(this.httpClient);
  }
}
`,

  // root index
  'index.ts': `
export * from './errors';
export * from './http/client';
export * from './modules';
export * from './client';
`
};

for (const [relativePath, content] of Object.entries(files)) {
  const fullPath = path.join(sdkSrcDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content.trim() + '\\n');
}

console.log("SDK package scaffolded.");
