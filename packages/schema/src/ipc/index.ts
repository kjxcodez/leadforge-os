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
