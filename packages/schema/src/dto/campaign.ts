import { z } from 'zod';
import { nameField, objectIdField } from '../fields/common.js';
import { campaignStatusSchema, campaignSchema } from '../entities/campaign.js';
import { paginationParamsSchema } from '../common/pagination.js';

export const createCampaignStepDtoSchema = z.object({
  type: z.string(),
  delayDays: z.number().int().nonnegative(),
  templateId: objectIdField,
});
export type CreateCampaignStepDto = z.infer<typeof createCampaignStepDtoSchema>;

export const createCampaignDtoSchema = z.object({
  name: nameField,
  status: campaignStatusSchema.optional(),
  steps: z.array(createCampaignStepDtoSchema).optional(),
  template: z.string().nullable().optional(),
  schedule: z.any().nullable().optional(),
  settings: z.any().nullable().optional(),
});
export type CreateCampaignDto = z.infer<typeof createCampaignDtoSchema>;

export const updateCampaignDtoSchema = createCampaignDtoSchema.partial();
export type UpdateCampaignDto = z.infer<typeof updateCampaignDtoSchema>;

export const campaignFiltersSchema = paginationParamsSchema.extend({
  status: campaignStatusSchema.optional(),
});
export type CampaignFilters = z.infer<typeof campaignFiltersSchema>;

export const campaignListResponseSchema = z.object({
  items: z.array(campaignSchema),
  total: z.number(),
});
export type CampaignListResponse = z.infer<typeof campaignListResponseSchema>;
