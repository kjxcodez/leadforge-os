import { z } from 'zod';
import { nameField, objectIdField } from '../fields/common';
import { campaignStatusSchema } from '../entities/campaign';
import { paginationParamsSchema } from '../common/pagination';

export const createCampaignStepDtoSchema = z.object({
  type: z.string(),
  delayDays: z.number().int().nonnegative(),
  templateId: objectIdField,
});

export const createCampaignDtoSchema = z.object({
  name: nameField,
  status: campaignStatusSchema.optional(),
  steps: z.array(createCampaignStepDtoSchema).optional(),
});

export const updateCampaignDtoSchema = createCampaignDtoSchema.partial();

export const campaignFiltersSchema = paginationParamsSchema.extend({
  status: campaignStatusSchema.optional(),
});
