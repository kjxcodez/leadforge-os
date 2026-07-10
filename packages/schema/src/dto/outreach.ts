import { z } from 'zod';
import { objectIdField } from '../fields/common.js';
import { emailMessageSchema, outreachSchema } from '../entities/outreach.js';
import { paginationParamsSchema } from '../common/pagination.js';

export const createOutreachDtoSchema = z.object({
  contactId: objectIdField,
  campaignId: objectIdField.nullable().optional(),
  companyId: objectIdField.nullable().optional(),
  provider: z.string(),
  status: z.string().optional(),
  messageDetails: emailMessageSchema.optional(),
});
export type CreateOutreachDto = z.infer<typeof createOutreachDtoSchema>;

export const outreachFiltersSchema = paginationParamsSchema.extend({
  contactId: objectIdField.optional(),
  campaignId: objectIdField.optional(),
  companyId: objectIdField.optional(),
  provider: z.string().optional(),
  status: z.string().optional(),
});
export type OutreachFilters = z.infer<typeof outreachFiltersSchema>;

export const outreachListResponseSchema = z.object({
  items: z.array(outreachSchema),
  total: z.number(),
});
export type OutreachListResponse = z.infer<typeof outreachListResponseSchema>;
