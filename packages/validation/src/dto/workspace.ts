import { z } from 'zod';
import { nameField } from '../fields/common';
import { workspaceSettingsSchema } from '../entities/workspace';

export const createWorkspaceDtoSchema = z.object({
  name: nameField,
  settings: workspaceSettingsSchema.partial().optional(),
});

export const updateWorkspaceDtoSchema = createWorkspaceDtoSchema.partial();
