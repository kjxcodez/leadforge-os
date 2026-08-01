import { z } from 'zod';
import { SequenceStatus, ExecutionStatus } from '../enums/index.js';

export const sequenceStepSchema = z.object({
  id: z.string(),
  type: z.string(),
  config: z.record(z.string(), z.any())
});
export type SequenceStep = z.infer<typeof sequenceStepSchema>;

export const sequenceTriggerSchema = z.object({
  type: z.string(),
  config: z.record(z.string(), z.any()).optional()
});
export type SequenceTrigger = z.infer<typeof sequenceTriggerSchema>;

export const sequenceSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  status: z.nativeEnum(SequenceStatus),
  trigger: sequenceTriggerSchema,
  steps: z.array(sequenceStepSchema),
  createdBy: z.string().optional().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});
export type Sequence = z.infer<typeof sequenceSchema>;

export const sequenceExecutionSchema = z.object({
  id: z.string(),
  sequenceId: z.string(),
  workspaceId: z.string(),
  companyId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  currentStep: z.number().default(0),
  status: z.nativeEnum(ExecutionStatus),
  startedAt: z.coerce.date(),
  completedAt: z.coerce.date().optional().nullable(),
  nextExecutionAt: z.coerce.date().optional().nullable(),
  logs: z.array(z.any()).default([])
});
export type SequenceExecution = z.infer<typeof sequenceExecutionSchema>;

export const sequenceLogSchema = z.object({
  id: z.string(),
  executionId: z.string(),
  workspaceId: z.string(),
  timestamp: z.coerce.date(),
  step: z.number(),
  action: z.string(),
  status: z.string(),
  message: z.string().optional().nullable()
});
export type SequenceLog = z.infer<typeof sequenceLogSchema>;
