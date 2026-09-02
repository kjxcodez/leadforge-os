import { z } from 'zod';
import { WorkflowStatus, WorkflowStepType } from '../enums/index.js';
import { entityIdField, nameField } from '../fields/common.js';

export const workflowStatusSchema = z.nativeEnum(WorkflowStatus);
export const workflowStepTypeSchema = z.nativeEnum(WorkflowStepType);

export const workflowStepSchema = z.object({
  id: entityIdField,
  type: workflowStepTypeSchema,
  config: z.record(z.string(), z.any()),
  nextStepIds: z.array(entityIdField)
});
export type WorkflowStep = z.infer<typeof workflowStepSchema>;

export const workflowSchema = z.object({
  id: entityIdField,
  workspaceId: entityIdField,
  name: nameField,
  status: workflowStatusSchema,
  trigger: z.string(),
  steps: z.array(workflowStepSchema),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});
export type Workflow = z.infer<typeof workflowSchema>;
