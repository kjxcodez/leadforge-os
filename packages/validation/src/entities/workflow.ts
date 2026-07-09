import { z } from 'zod';
import { objectIdField, nameField } from '../fields/common';

export const workflowStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ERROR']);

export const workflowStepTypeSchema = z.enum(['DISCOVER', 'ENRICH', 'VERIFY', 'QUALIFY', 'SEND']);

export const workflowStepSchema = z.object({
  id: objectIdField,
  type: workflowStepTypeSchema,
  config: z.record(z.string(), z.any()),
  nextStepIds: z.array(objectIdField),
});

export const workflowSchema = z.object({
  id: objectIdField,
  workspaceId: objectIdField,
  name: nameField,
  status: workflowStatusSchema,
  trigger: z.string(),
  steps: z.array(workflowStepSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
});
