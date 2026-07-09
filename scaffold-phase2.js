const fs = require('fs');
const path = require('path');

const typesSrcDir = 'c:\\Users\\91637\\Desktop\\Business Project\\leadforge-os\\packages\\types\\src';

const files = {
  // utils
  'utils/common.ts': `
export type WithId<T> = T & { id: string };
export type WithTimestamps<T> = T & { createdAt: Date; updatedAt: Date };
export type WithWorkspace<T> = T & { workspaceId: string };
export type DeepPartial<T> = T extends object ? { [P in keyof T]?: DeepPartial<T[P]> } : T;
export type Nullable<T> = T | null;
export type Brand<K, T> = K & { __brand: T };
`,
  'utils/index.ts': `export * from './common';\n`,

  // api
  'api/response.ts': `
export interface ApiError {
  code: string;
  message: string;
  details: unknown | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: ApiError | null;
  meta?: Record<string, unknown>;
}

export interface ApiErrorResponse extends ApiResponse<null> {
  success: false;
  data: null;
  error: ApiError;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  success: true;
  data: T[];
  error: null;
  meta: {
    pagination: PaginationMeta;
  };
}

export interface CursorPaginatedResponse<T> extends ApiResponse<T[]> {
  success: true;
  data: T[];
  error: null;
  meta: {
    cursor: CursorMeta;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface CursorMeta {
  nextCursor: string | null;
  hasNextPage: boolean;
}
`,
  'api/errors.ts': `
export const enum ErrorCode {
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
}

export interface ErrorDetail {
  field?: string;
  message: string;
}
`,
  'api/http.ts': `
export const enum HttpStatus {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500,
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
`,
  'api/pagination.ts': `
export type SortOrder = 'asc' | 'desc';
export type SortDirection = 1 | -1;

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: SortOrder;
}

export interface CursorParams {
  cursor?: string;
  limit?: number;
}
`,
  'api/index.ts': `
export * from './response';
export * from './errors';
export * from './http';
export * from './pagination';
`,

  // entities
  'entities/company.ts': `
export const enum CompanyStatus {
  LEAD = 'LEAD',
  QUALIFIED = 'QUALIFIED',
  CUSTOMER = 'CUSTOMER',
  ARCHIVED = 'ARCHIVED',
}

export interface Company {
  id: string;
  workspaceId: string;
  name: string;
  domain: string | null;
  industry: string | null;
  size: string | null;
  location: string | null;
  status: CompanyStatus;
  createdAt: Date;
  updatedAt: Date;
}
`,
  'entities/contact.ts': `
export const enum ContactStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  REPLIED = 'REPLIED',
  BOUNCED = 'BOUNCED',
  UNSUBSCRIBED = 'UNSUBSCRIBED',
}

export interface Contact {
  id: string;
  workspaceId: string;
  companyId: string | null;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  linkedinUrl: string | null;
  status: ContactStatus;
  createdAt: Date;
  updatedAt: Date;
}
`,
  'entities/campaign.ts': `
export const enum CampaignStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
}

export interface CampaignStep {
  id: string;
  type: string;
  delayDays: number;
  templateId: string;
}

export interface Campaign {
  id: string;
  workspaceId: string;
  name: string;
  status: CampaignStatus;
  steps: CampaignStep[];
  createdAt: Date;
  updatedAt: Date;
}
`,
  'entities/workflow.ts': `
export const enum WorkflowStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  ERROR = 'ERROR',
}

export const enum WorkflowStepType {
  DISCOVER = 'DISCOVER',
  ENRICH = 'ENRICH',
  VERIFY = 'VERIFY',
  QUALIFY = 'QUALIFY',
  SEND = 'SEND',
}

export interface WorkflowStep {
  id: string;
  type: WorkflowStepType;
  config: Record<string, unknown>;
  nextStepIds: string[];
}

export interface Workflow {
  id: string;
  workspaceId: string;
  name: string;
  status: WorkflowStatus;
  trigger: string;
  steps: WorkflowStep[];
  createdAt: Date;
  updatedAt: Date;
}
`,
  'entities/workspace.ts': `
export interface WorkspaceSettings {
  defaultTimezone: string;
}

export interface Workspace {
  id: string;
  name: string;
  settings: WorkspaceSettings;
  createdAt: Date;
  updatedAt: Date;
}
`,
  'entities/user.ts': `
export const enum UserRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}
`,
  'entities/session.ts': `
export interface SessionData {
  ip?: string;
  userAgent?: string;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  data: SessionData;
  createdAt: Date;
  updatedAt: Date;
}
`,
  'entities/opportunity.ts': `
export const enum OpportunityStage {
  PROSPECTING = 'PROSPECTING',
  QUALIFICATION = 'QUALIFICATION',
  PROPOSAL = 'PROPOSAL',
  NEGOTIATION = 'NEGOTIATION',
  CLOSED_WON = 'CLOSED_WON',
  CLOSED_LOST = 'CLOSED_LOST',
}

export interface Opportunity {
  id: string;
  workspaceId: string;
  companyId: string;
  name: string;
  value: number | null;
  stage: OpportunityStage;
  expectedCloseDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
`,
  'entities/outreach.ts': `
export const enum OutreachChannel {
  EMAIL = 'EMAIL',
  LINKEDIN = 'LINKEDIN',
  CALL = 'CALL',
}

export interface EmailTemplate {
  id: string;
  workspaceId: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailMessage {
  messageId: string;
  threadId?: string;
  subject: string;
  body: string;
}

export interface Outreach {
  id: string;
  workspaceId: string;
  contactId: string;
  campaignId: string | null;
  channel: OutreachChannel;
  status: string;
  sentAt: Date | null;
  messageDetails: EmailMessage | null;
  createdAt: Date;
  updatedAt: Date;
}
`,
  'entities/index.ts': `
export * from './company';
export * from './contact';
export * from './campaign';
export * from './workflow';
export * from './workspace';
export * from './user';
export * from './session';
export * from './opportunity';
export * from './outreach';
`,

  // dto
  'dto/company.dto.ts': `
import type { CompanyStatus } from '../entities/company';
import type { PaginationParams } from '../api/pagination';

export interface CreateCompanyDto {
  name: string;
  domain?: string | null;
  industry?: string | null;
  size?: string | null;
  location?: string | null;
  status?: CompanyStatus;
}

export interface UpdateCompanyDto extends Partial<CreateCompanyDto> {}

export interface CompanyFilters extends PaginationParams {
  name?: string;
  domain?: string;
  status?: CompanyStatus;
  industry?: string;
}

export interface CompanyListResponse {
  items: import('../entities/company').Company[];
  total: number;
}
`,
  'dto/contact.dto.ts': `
import type { ContactStatus } from '../entities/contact';
import type { PaginationParams } from '../api/pagination';

export interface CreateContactDto {
  companyId?: string | null;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  linkedinUrl?: string | null;
  status?: ContactStatus;
}

export interface UpdateContactDto extends Partial<CreateContactDto> {}

export interface ContactFilters extends PaginationParams {
  companyId?: string;
  email?: string;
  status?: ContactStatus;
}
`,
  'dto/campaign.dto.ts': `
import type { CampaignStatus, CampaignStep } from '../entities/campaign';
import type { PaginationParams } from '../api/pagination';

export interface CreateCampaignDto {
  name: string;
  status?: CampaignStatus;
  steps?: Omit<CampaignStep, 'id'>[];
}

export interface UpdateCampaignDto extends Partial<CreateCampaignDto> {}

export interface CampaignFilters extends PaginationParams {
  status?: CampaignStatus;
}
`,
  'dto/auth.dto.ts': `
export interface LoginDto {
  email: string;
  password?: string; // Optional if using magic links/SSO
}

export interface RegisterDto {
  email: string;
  name: string;
  password?: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

export interface AuthResponse {
  token: string;
  user: import('../entities/user').User;
}
`,
  'dto/workspace.dto.ts': `
import type { WorkspaceSettings } from '../entities/workspace';

export interface CreateWorkspaceDto {
  name: string;
  settings?: Partial<WorkspaceSettings>;
}

export interface UpdateWorkspaceDto extends Partial<CreateWorkspaceDto> {}
`,
  'dto/outreach.dto.ts': `
import type { OutreachChannel } from '../entities/outreach';
import type { PaginationParams } from '../api/pagination';

export interface CreateOutreachDto {
  contactId: string;
  campaignId?: string | null;
  channel: OutreachChannel;
  messageDetails?: import('../entities/outreach').EmailMessage;
}

export interface OutreachFilters extends PaginationParams {
  contactId?: string;
  campaignId?: string;
  channel?: OutreachChannel;
  status?: string;
}
`,
  'dto/index.ts': `
export * from './company.dto';
export * from './contact.dto';
export * from './campaign.dto';
export * from './auth.dto';
export * from './workspace.dto';
export * from './outreach.dto';
`,

  // ipc
  'ipc/channels.ts': `
import type { CreateCompanyDto, CompanyFilters } from '../dto/company.dto';
import type { Company } from '../entities/company';

// Map of channel name -> { input: T, output: U }
export interface IpcChannelMap {
  'companies:list': {
    input: CompanyFilters;
    output: Company[];
  };
  'companies:create': {
    input: CreateCompanyDto;
    output: Company;
  };
  'system:status': {
    input: void;
    output: Array<{ name: string; status: string }>;
  };
  // Add other channels here over time
}
`,
  'ipc/messages.ts': `
export interface IpcRequest<T> {
  channel: string;
  payload: T;
}

export interface IpcResponse<T> {
  success: true;
  data: T;
}

export interface IpcError {
  success: false;
  error: {
    message: string;
    code?: string;
  };
}
`,
  'ipc/index.ts': `
export * from './channels';
export * from './messages';
`,

  // root index
  'index.ts': `
export * from './utils';
export * from './api';
export * from './entities';
export * from './dto';
export * from './ipc';
`
};

for (const [relativePath, content] of Object.entries(files)) {
  const fullPath = path.join(typesSrcDir, relativePath);
  fs.writeFileSync(fullPath, content.trim() + '\\n');
}

console.log("Types scaffolded.");
