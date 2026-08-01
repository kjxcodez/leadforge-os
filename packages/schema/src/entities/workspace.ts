import { z } from 'zod';
import { objectIdField, nameField, emailField } from '../fields/common.js';
import { WorkspaceRole, WorkspaceMemberStatus } from '../enums/index.js';

export const workspaceSettingsSchema = z.object({
  defaultTimezone: z.string().default('UTC')
});
export type WorkspaceSettings = z.infer<typeof workspaceSettingsSchema>;

export const workspaceMemberSchema = z.object({
  id: z.string().optional(),
  userId: objectIdField.nullable().optional(),
  email: emailField,
  role: z.nativeEnum(WorkspaceRole),
  status: z.nativeEnum(WorkspaceMemberStatus),
  joinedAt: z.coerce.date().nullable().optional(),
  invitedBy: objectIdField.nullable().optional(),
  invitedAt: z.coerce.date().optional(),
  invitationToken: z.string().nullable().optional(),
  invitationExpiresAt: z.coerce.date().nullable().optional()
});
export type WorkspaceMember = z.infer<typeof workspaceMemberSchema>;

export const workspaceSchema = z.object({
  id: objectIdField,
  name: nameField,
  slug: z.string(),
  ownerId: objectIdField,
  plan: z.enum(['free', 'growth', 'enterprise']).default('free'),
  settings: workspaceSettingsSchema,
  members: z.array(workspaceMemberSchema),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});
export type Workspace = z.infer<typeof workspaceSchema>;
