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

export const createEmailAccountDtoSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  provider: z.string(),
  password: z.string().min(1), // raw App Password for connect verification
  dailyLimit: z.number().int().optional(),
  hourlyLimit: z.number().int().optional(),
  signature: z.string().optional(),
});
export type CreateEmailAccountDto = z.infer<typeof createEmailAccountDtoSchema>;

export const createEmailTemplateDtoSchema = z.object({
  name: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  variables: z.array(z.string()).default([]),
});
export type CreateEmailTemplateDto = z.infer<typeof createEmailTemplateDtoSchema>;
