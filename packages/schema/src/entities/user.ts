import { z } from 'zod';
import { UserRole } from '../enums/index.js';
import { entityIdField, entityIdFieldNullable, emailField } from '../fields/common.js';

export const userRoleSchema = z.nativeEnum(UserRole);

export const userSchema = z.object({
  id: entityIdField,
  email: emailField,
  passwordHash: z.string().nullable().optional(),
  name: z.string(),
  displayName: z.string(),
  image: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  role: userRoleSchema,
  activeWorkspaceId: entityIdFieldNullable,
  emailVerified: z.boolean().default(false),
  lastLoginAt: z.coerce.date().nullable().optional(),
  status: z.enum(['active', 'suspended', 'pending']).default('active'),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;
