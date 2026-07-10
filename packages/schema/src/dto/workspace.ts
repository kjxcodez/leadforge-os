import { z } from 'zod';
import { nameField } from '../fields/common.js';
import { workspaceSettingsSchema } from '../entities/workspace.js';

export const createWorkspaceDtoSchema = z.object({
  name: nameField,
  settings: workspaceSettingsSchema.partial().optional(),
});
export type CreateWorkspaceDto = z.infer<typeof createWorkspaceDtoSchema>;

export const updateWorkspaceDtoSchema = createWorkspaceDtoSchema.partial();
export type UpdateWorkspaceDto = z.infer<typeof updateWorkspaceDtoSchema>;
