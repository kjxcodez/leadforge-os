import type { CreateCompanyDto, CompanyFilters } from '../dto/company.js';
import type { Company } from '../entities/company.js';
import type { LoginDto, RegisterDto, AuthResponse } from '../dto/auth.js';
import type { CreateWorkspaceDto, UpdateWorkspaceDto, InviteMemberDto } from '../dto/workspace.js';
import type { Workspace, WorkspaceMember } from '../entities/workspace.js';
import type { WorkspaceRole } from '../enums/index.js';


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
  'auth:login': {
    input: LoginDto;
    output: AuthResponse;
  };
  'auth:register': {
    input: RegisterDto;
    output: AuthResponse;
  };
  'auth:logout': {
    input: void;
    output: void;
  };
  'auth:session': {
    input: void;
    output: any;
  };
  'auth:unauthorized': {
    input: void;
    output: void;
  };
  'workspaces:create': {
    input: CreateWorkspaceDto;
    output: Workspace;
  };
  'workspaces:list': {
    input: void;
    output: Workspace[];
  };
  'workspaces:update': {
    input: { id: string; dto: UpdateWorkspaceDto };
    output: Workspace;
  };
  'workspaces:delete': {
    input: string;
    output: void;
  };
  'workspaces:get': {
    input: string;
    output: Workspace;
  };
  'workspaces:members:list': {
    input: string;
    output: WorkspaceMember[];
  };
  'workspaces:members:invite': {
    input: { id: string; dto: InviteMemberDto };
    output: Workspace;
  };
  'workspaces:members:updateRole': {
    input: { id: string; memberId: string; role: WorkspaceRole };
    output: Workspace;
  };
  'workspaces:members:remove': {
    input: { id: string; memberId: string };
    output: Workspace;
  };
  'workspaces:members:leave': {
    input: string;
    output: Workspace;
  };
  'workspaces:members:transferOwnership': {
    input: { id: string; newOwnerId: string };
    output: Workspace;
  };
  'workspaces:invites:list': {
    input: void;
    output: Workspace[];
  };
  'workspaces:invites:accept': {
    input: string;
    output: Workspace;
  };
  'workspaces:invites:decline': {
    input: string;
    output: Workspace;
  };
  'electron:setActiveWorkspace': {
    input: string | null;
    output: void;
  };
  'electron:getActiveWorkspace': {
    input: void;
    output: string | null;
  };

  // ── CRM API Remote queries ──────────────────────────────────────────────
  'companies:get': {
    input: string;
    output: any;
  };
  'companies:update': {
    input: { id: string; dto: any };
    output: any;
  };
  'companies:delete': {
    input: string;
    output: void;
  };
  'contacts:get': {
    input: string;
    output: any;
  };
  'contacts:list': {
    input: any;
    output: any[];
  };
  'contacts:create': {
    input: any;
    output: any;
  };
  'contacts:update': {
    input: { id: string; dto: any };
    output: any;
  };
  'contacts:delete': {
    input: string;
    output: void;
  };
  'campaigns:get': {
    input: string;
    output: any;
  };
  'campaigns:list': {
    input: any;
    output: any[];
  };
  'campaigns:create': {
    input: any;
    output: any;
  };
  'campaigns:update': {
    input: { id: string; dto: any };
    output: any;
  };
  'campaigns:delete': {
    input: string;
    output: void;
  };

  // ── Local SQLite Cache Queries ───────────────────────────────────────────
  'db:find': {
    input: { tableName: string; workspaceId: string; filter?: any };
    output: any[];
  };
  'db:findById': {
    input: { tableName: string; workspaceId: string; id: string };
    output: any | null;
  };
  'db:save': {
    input: { tableName: string; record: any };
    output: any;
  };
  'db:saveMany': {
    input: { tableName: string; records: any[] };
    output: void;
  };
  'db:softDelete': {
    input: { tableName: string; workspaceId: string; id: string };
    output: void;
  };
  'db:delete': {
    input: { tableName: string; workspaceId: string; id: string };
    output: void;
  };
  'db:workspaces:findMany': {
    input: void;
    output: any[];
  };
  'db:workspaces:saveMany': {
    input: any[];
    output: void;
  };

  // ── Local Offline Sync Queue Queries ─────────────────────────────────────
  'db:queue:push': {
    input: any;
    output: void;
  };
  'db:queue:pop': {
    input: string;
    output: any | null;
  };
  'db:queue:list': {
    input: string;
    output: any[];
  };
  'db:queue:update': {
    input: { workspaceId: string; id: string; retryCount: number; error: string };
    output: void;
  };
  'db:queue:remove': {
    input: { workspaceId: string; id: string };
    output: void;
  };

  'scheduler:jobs:list': {
    input: { workspaceId: string };
    output: any[];
  };
  'scheduler:jobs:submit': {
    input: { id?: string; workspaceId: string; type: string; payload: any; priority?: number; maxRetries?: number };
    output: any;
  };
  'scheduler:jobs:cancel': {
    input: { workspaceId: string; jobId: string };
    output: void;
  };

  'activities:list': {
    input: any;
    output: any[];
  };
  'discovery:list': {
    input: any;
    output: any[];
  };
  'discovery:create': {
    input: { name: string; provider: string; query: string };
    output: any;
  };
  'discovery:get': {
    input: string;
    output: any;
  };
  'discovery:results': {
    input: string;
    output: any[];
  };
  'discovery:import': {
    input: string;
    output: any;
  };
  'discovery:skip': {
    input: string;
    output: any;
  };
  'email-accounts:list': {
    input: void;
    output: any[];
  };
  'email-accounts:create': {
    input: any;
    output: any;
  };
  'email-accounts:delete': {
    input: string;
    output: void;
  };
  'email-accounts:test': {
    input: string;
    output: { verified: boolean };
  };
  'templates:list': {
    input: void;
    output: any[];
  };
  'templates:create': {
    input: any;
    output: any;
  };
  'templates:delete': {
    input: string;
    output: void;
  };
  'templates:preview': {
    input: { id: string; contactId?: string };
    output: { subject: string; body: string };
  };
  'campaigns:schedule': {
    input: string;
    output: void;
  };
  'sequence:list': {
    input: void;
    output: any[];
  };
  'sequence:get': {
    input: string;
    output: any;
  };
  'sequence:create': {
    input: any;
    output: any;
  };
  'sequence:update': {
    input: { id: string; dto: any };
    output: any;
  };
  'sequence:delete': {
    input: string;
    output: void;
  };
  'sequence:start': {
    input: { sequenceId: string; contactId?: string | null; companyId?: string | null };
    output: any;
  };
  'sequence:stop': {
    input: string;
    output: any;
  };
  'execution:list': {
    input: void;
    output: any[];
  };
  'execution:get': {
    input: string;
    output: any;
  };
  'execution:logs': {
    input: string;
    output: any[];
  };
}

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
