import { z } from 'zod';
import { objectIdField, nameField } from '../fields/common';

export const campaignStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED']);

export const campaignStepSchema = z.object({
  id: objectIdField,
  type: z.string(),
  delayDays: z.number().int().nonnegative(),
  templateId: objectIdField,
});

export const campaignSchema = z.object({
  id: objectIdField,
  workspaceId: objectIdField,
  name: nameField,
  status: campaignStatusSchema,
  steps: z.array(campaignStepSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
});
