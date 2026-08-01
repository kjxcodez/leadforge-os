import { z } from 'zod';
import { UserRole } from '../enums/index.js';
import { objectIdField, emailField } from '../fields/common.js';

export const userRoleSchema = z.nativeEnum(UserRole);

export const userSchema = z.object({
  id: objectIdField,
  email: emailField,
  passwordHash: z.string().nullable().optional(),
  name: z.string(),
  displayName: z.string(),
  image: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  role: userRoleSchema,
  activeWorkspaceId: objectIdField.nullable().optional(),
  emailVerified: z.boolean().default(false),
  lastLoginAt: z.date().nullable().optional(),
  status: z.enum(['active', 'suspended', 'pending']).default('active'),
  createdAt: z.date(),
  updatedAt: z.date()
});

export type User = z.infer<typeof userSchema>;
