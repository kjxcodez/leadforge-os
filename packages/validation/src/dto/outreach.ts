import { z } from 'zod';
import { objectIdField } from '../fields/common';
import { paginationParamsSchema } from '../common/pagination';

export const outreachChannelSchema = z.enum(['EMAIL', 'LINKEDIN', 'CALL']);

export const emailMessageSchema = z.object({
  messageId: z.string(),
  threadId: z.string().optional(),
  subject: z.string(),
  body: z.string(),
});

export const createOutreachDtoSchema = z.object({
  contactId: objectIdField,
  campaignId: objectIdField.nullable().optional(),
  channel: outreachChannelSchema,
  messageDetails: emailMessageSchema.optional(),
});

export const outreachFiltersSchema = paginationParamsSchema.extend({
  contactId: objectIdField.optional(),
  campaignId: objectIdField.optional(),
  channel: outreachChannelSchema.optional(),
  status: z.string().optional(),
});
