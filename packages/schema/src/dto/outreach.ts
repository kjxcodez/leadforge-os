import { z } from 'zod';
import { entityIdField, entityIdFieldNullable } from '../fields/common.js';
import { emailMessageSchema, outreachSchema, attachmentItemSchema } from '../entities/outreach.js';
import { paginationParamsSchema } from '../common/pagination.js';

export const createOutreachDtoSchema = z.object({
  id: entityIdField.optional(),
  contactId: entityIdField,
  campaignId: entityIdFieldNullable.optional(),
  companyId: entityIdFieldNullable.optional(),
  provider: z.string(),
  status: z.string().optional(),
  messageDetails: emailMessageSchema.optional()
});
export type CreateOutreachDto = z.infer<typeof createOutreachDtoSchema>;

export const outreachFiltersSchema = paginationParamsSchema.extend({
  contactId: entityIdField.optional(),
  campaignId: entityIdField.optional(),
  companyId: entityIdField.optional(),
  provider: z.string().optional(),
  status: z.string().optional()
});
export type OutreachFilters = z.infer<typeof outreachFiltersSchema>;

export const outreachListResponseSchema = z.object({
  items: z.array(outreachSchema),
  total: z.number()
});
export type OutreachListResponse = z.infer<typeof outreachListResponseSchema>;

export const createEmailAccountDtoSchema = z.object({
  id: entityIdField.optional(),
  name: z.string().min(1),
  email: z.string().email(),
  provider: z.string().default('gmail'),
  googleConnectionId: z.string().optional(),
  dailyLimit: z.number().int().optional(),
  hourlyLimit: z.number().int().optional(),
  signature: z.string().optional(),
  // Gmail OAuth fields (for legacy compatibility)
  refreshToken: z.string().optional(),
  accessToken: z.string().optional(),
  tokenExpiresAt: z.string().optional(),
  googleAccountId: z.string().optional()
});
export type CreateEmailAccountDto = z.infer<typeof createEmailAccountDtoSchema>;

export const reconnectEmailAccountDtoSchema = createEmailAccountDtoSchema.partial().omit({
  email: true
});
export type ReconnectEmailAccountDto = z.infer<typeof reconnectEmailAccountDtoSchema>;

export const createEmailTemplateDtoSchema = z.object({
  id: entityIdField.optional(),
  name: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  variables: z.array(z.string()).default([]),
  attachments: z.array(attachmentItemSchema).optional()
});
export type CreateEmailTemplateDto = z.infer<typeof createEmailTemplateDtoSchema>;

export const updateEmailTemplateDtoSchema = createEmailTemplateDtoSchema.partial();
export type UpdateEmailTemplateDto = z.infer<typeof updateEmailTemplateDtoSchema>;
