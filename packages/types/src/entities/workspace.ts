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
