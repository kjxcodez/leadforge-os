import { z } from 'zod';
import { CampaignStatus } from '../enums/index.js';
import { objectIdField, nameField } from '../fields/common.js';

export const campaignStatusSchema = z.nativeEnum(CampaignStatus);

export const campaignStepSchema = z.object({
  id: objectIdField,
  type: z.string(),
  delayDays: z.number().int().nonnegative(),
  templateId: objectIdField,
});
export type CampaignStep = z.infer<typeof campaignStepSchema>;

export const campaignSchema = z.object({
  id: objectIdField,
  workspaceId: objectIdField,
  name: nameField,
  status: campaignStatusSchema,
  steps: z.array(campaignStepSchema),
  template: z.string().nullable().optional(),
  schedule: z.any().nullable().optional(),
  settings: z.any().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Campaign = z.infer<typeof campaignSchema>;
