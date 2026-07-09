import { z } from 'zod';
import { objectIdField, emailField } from '../fields/common';

export const userSchema = z.object({
  id: objectIdField,
  email: emailField,
  name: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type User = z.infer<typeof userSchema>;
