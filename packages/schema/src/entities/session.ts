import { z } from 'zod';
import { objectIdField } from '../fields/common';

export const sessionDataSchema = z.object({
  ip: z.string().optional(),
  userAgent: z.string().optional(),
});
export type SessionData = z.infer<typeof sessionDataSchema>;

export const sessionSchema = z.object({
  id: objectIdField,
  userId: objectIdField,
  token: z.string(),
  expiresAt: z.date(),
  data: sessionDataSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Session = z.infer<typeof sessionSchema>;
