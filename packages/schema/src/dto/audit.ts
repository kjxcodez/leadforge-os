import { z } from 'zod';
import { entityIdField, entityIdFieldNullable } from '../fields/common.js';

export const createAuditLogDtoSchema = z.object({
  id: entityIdField.optional(),
  actor: z.object({
    userId: entityIdFieldNullable.optional(),
    type: z.enum(['user', 'system', 'worker']),
    ip: z.string().nullable().optional()
  }),
  action: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  beforeValue: z.record(z.string(), z.any()).nullable().optional(),
  afterValue: z.record(z.string(), z.any()).nullable().optional()
});
export type CreateAuditLogDto = z.infer<typeof createAuditLogDtoSchema>;
