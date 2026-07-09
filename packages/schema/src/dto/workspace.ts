import { z } from 'zod';
import { nameField } from '../fields/common';
import { workspaceSettingsSchema } from '../entities/workspace';

export const createWorkspaceDtoSchema = z.object({
  name: nameField,
  settings: workspaceSettingsSchema.partial().optional(),
});
export type CreateWorkspaceDto = z.infer<typeof createWorkspaceDtoSchema>;

export const updateWorkspaceDtoSchema = createWorkspaceDtoSchema.partial();
export type UpdateWorkspaceDto = z.infer<typeof updateWorkspaceDtoSchema>;
