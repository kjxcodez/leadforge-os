import { z } from 'zod';
import { SuppressionReason } from '../enums/index.js';
import { entityIdField, emailField } from '../fields/common.js';

export const suppressionReasonSchema = z.nativeEnum(SuppressionReason);

export const suppressionRecordSchema = z.object({
  id: entityIdField,
  workspaceId: entityIdField,
  email: emailField,
  reason: suppressionReasonSchema,
  source: z.string().default('system'),
  evidence: z.record(z.any()).optional().nullable(),
  suppressedAt: z.coerce.date(),
  suppressedBy: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});
export type SuppressionRecord = z.infer<typeof suppressionRecordSchema>;

export const createSuppressionDtoSchema = z.object({
  email: emailField,
  reason: suppressionReasonSchema,
  source: z.string().optional().default('manual'),
  notes: z.string().optional(),
  evidence: z.record(z.any()).optional()
});
export type CreateSuppressionDto = z.infer<typeof createSuppressionDtoSchema>;
