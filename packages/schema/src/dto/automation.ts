import { z } from 'zod';
import { SequenceStatus } from '../enums/index.js';
import { entityIdField } from '../fields/common.js';
import {
  sequenceStepSchema,
  sequenceTriggerSchema,
  sequenceSchema
} from '../entities/automation.js';
import { paginationParamsSchema } from '../common/pagination.js';

export const createSequenceDtoSchema = z.object({
  id: entityIdField.optional(),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().nullable(),
  trigger: sequenceTriggerSchema,
  steps: z.array(sequenceStepSchema),
  status: z.nativeEnum(SequenceStatus).default(SequenceStatus.DRAFT)
});
export type CreateSequenceDto = z.infer<typeof createSequenceDtoSchema>;

export const updateSequenceDtoSchema = createSequenceDtoSchema.partial();
export type UpdateSequenceDto = z.infer<typeof updateSequenceDtoSchema>;

export const startExecutionDtoSchema = z.object({
  contactId: z.string().optional().nullable(),
  companyId: z.string().optional().nullable()
});
export type StartExecutionDto = z.infer<typeof startExecutionDtoSchema>;

export const sequenceFiltersSchema = paginationParamsSchema.extend({
  name: z.string().optional(),
  status: z.nativeEnum(SequenceStatus).optional()
});
export type SequenceFilters = z.infer<typeof sequenceFiltersSchema>;

export const sequenceListResponseSchema = z.object({
  items: z.array(sequenceSchema),
  total: z.number()
});
export type SequenceListResponse = z.infer<typeof sequenceListResponseSchema>;
