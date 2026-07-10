import { z } from 'zod';
import { objectIdField, nameField } from '../fields/common.js';

export const workspaceSettingsSchema = z.object({
  defaultTimezone: z.string().default('UTC'),
});
export type WorkspaceSettings = z.infer<typeof workspaceSettingsSchema>;

export const workspaceSchema = z.object({
  id: objectIdField,
  name: nameField,
  settings: workspaceSettingsSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Workspace = z.infer<typeof workspaceSchema>;
