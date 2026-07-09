import type { WorkspaceSettings } from '../entities/workspace';

export interface CreateWorkspaceDto {
  name: string;
  settings?: Partial<WorkspaceSettings>;
}

export interface UpdateWorkspaceDto extends Partial<CreateWorkspaceDto> {}
