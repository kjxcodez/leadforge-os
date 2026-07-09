import { z } from 'zod';
import { CampaignStatus } from '../enums';
import { objectIdField, nameField } from '../fields/common';

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
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Campaign = z.infer<typeof campaignSchema>;
