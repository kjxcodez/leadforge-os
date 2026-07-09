import { z } from 'zod';
import { objectIdField } from '../fields/common';
import { outreachChannelSchema, emailMessageSchema, outreachSchema } from '../entities/outreach';
import { paginationParamsSchema } from '../common/pagination';

export const createOutreachDtoSchema = z.object({
  contactId: objectIdField,
  campaignId: objectIdField.nullable().optional(),
  channel: outreachChannelSchema,
  messageDetails: emailMessageSchema.optional(),
});
export type CreateOutreachDto = z.infer<typeof createOutreachDtoSchema>;

export const outreachFiltersSchema = paginationParamsSchema.extend({
  contactId: objectIdField.optional(),
  campaignId: objectIdField.optional(),
  channel: outreachChannelSchema.optional(),
  status: z.string().optional(),
});
export type OutreachFilters = z.infer<typeof outreachFiltersSchema>;

export const outreachListResponseSchema = z.object({
  items: z.array(outreachSchema),
  total: z.number(),
});
export type OutreachListResponse = z.infer<typeof outreachListResponseSchema>;
