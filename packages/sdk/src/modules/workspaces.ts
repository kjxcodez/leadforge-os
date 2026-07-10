import { HttpClient } from '../http/client';
import type { Workspace, CreateWorkspaceDto, UpdateWorkspaceDto } from '@leadforge/schema';

export class WorkspacesModule {
  constructor(private client: HttpClient) {}

  public async get(id: string): Promise<Workspace> {
    return this.client.get<Workspace>(`/workspaces/${id}`);
  }

  public async create(dto: CreateWorkspaceDto): Promise<Workspace> {
    return this.client.post<Workspace>('/workspaces', dto);
  }

  public async update(id: string, dto: UpdateWorkspaceDto): Promise<Workspace> {
    return this.client.patch<Workspace>(`/workspaces/${id}`, dto);
  }

  public async list(): Promise<Workspace[]> {
    return this.client.get<Workspace[]>('/workspaces');
  }
}
