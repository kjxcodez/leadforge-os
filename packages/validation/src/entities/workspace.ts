import { z } from 'zod';
import { objectIdField, nameField } from '../fields/common';

export const workspaceSettingsSchema = z.object({
  defaultTimezone: z.string().default('UTC'),
});

export const workspaceSchema = z.object({
  id: objectIdField,
  name: nameField,
  settings: workspaceSettingsSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});
