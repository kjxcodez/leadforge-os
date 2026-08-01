import { z } from 'zod';
import { WorkflowStatus, WorkflowStepType } from '../enums/index.js';
import { objectIdField, nameField } from '../fields/common.js';

export const workflowStatusSchema = z.nativeEnum(WorkflowStatus);
export const workflowStepTypeSchema = z.nativeEnum(WorkflowStepType);

export const workflowStepSchema = z.object({
  id: objectIdField,
  type: workflowStepTypeSchema,
  config: z.record(z.string(), z.any()),
  nextStepIds: z.array(objectIdField)
});
export type WorkflowStep = z.infer<typeof workflowStepSchema>;

export const workflowSchema = z.object({
  id: objectIdField,
  workspaceId: objectIdField,
  name: nameField,
  status: workflowStatusSchema,
  trigger: z.string(),
  steps: z.array(workflowStepSchema),
  createdAt: z.date(),
  updatedAt: z.date()
});
export type Workflow = z.infer<typeof workflowSchema>;
