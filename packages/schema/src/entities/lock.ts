import { z } from 'zod';
import { entityIdField } from '../fields/common.js';

export const automationLockSchema = z.object({
  id: z.string().min(1), // Composite key: `${workspaceId}:${sequenceId}:${entityId}`
  workspaceId: entityIdField,
  sequenceId: entityIdField,
  entityId: entityIdField,
  ownerId: z.string().min(1),
  lockedAt: z.coerce.date(),
  expiresAt: z.coerce.date()
});
export type AutomationLock = z.infer<typeof automationLockSchema>;

export const acquireLockDtoSchema = z.object({
  sequenceId: entityIdField,
  entityId: entityIdField,
  ownerId: z.string().min(1),
  leaseDurationMs: z.number().int().min(1000).max(300000).default(60000)
});
export type AcquireLockDto = z.infer<typeof acquireLockDtoSchema>;

export const releaseLockDtoSchema = z.object({
  sequenceId: entityIdField,
  entityId: entityIdField,
  ownerId: z.string().min(1)
});
export type ReleaseLockDto = z.infer<typeof releaseLockDtoSchema>;

export const lockResponseSchema = z.object({
  acquired: z.boolean(),
  lockKey: z.string(),
  expiresAt: z.coerce.date().optional()
});
export type LockResponse = z.infer<typeof lockResponseSchema>;
