import { z } from 'zod';
import { entityIdField } from '../fields/common.js';

export const sessionDataSchema = z.object({
  ip: z.string().optional(),
  userAgent: z.string().optional()
});
export type SessionData = z.infer<typeof sessionDataSchema>;

export const sessionSchema = z.object({
  id: entityIdField,
  userId: entityIdField,
  token: z.string(),
  expiresAt: z.coerce.date(),
  data: sessionDataSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});
export type Session = z.infer<typeof sessionSchema>;
