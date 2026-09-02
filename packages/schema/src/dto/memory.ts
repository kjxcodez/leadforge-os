import { z } from 'zod';
import { entityIdField } from '../fields/common.js';

export const setWorkspaceMemoryDtoSchema = z.object({
  scope: z.string().min(1).max(64),
  key: z.string().min(1).max(128),
  value: z.any()
});
export type SetWorkspaceMemoryDto = z.infer<typeof setWorkspaceMemoryDtoSchema>;
