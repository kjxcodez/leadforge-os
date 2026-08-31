import { z } from 'zod';
import { entityIdField } from '../fields/common.js';

export const jobStatusSchema = z.enum([
  'pending',
  'queued',
  'starting',
  'running',
  'waiting',
  'retrying',
  'paused',
  'cancelled',
  'completed',
  'failed',
  'interrupted'
]);
export type JobStatus = z.infer<typeof jobStatusSchema>;

export const jobSchema = z.object({
  id: entityIdField,
  workspaceId: entityIdField,
  type: z.string().min(1),
  status: jobStatusSchema.default('queued'),
  priority: z.number().int().min(1).max(10).default(1),
  payload: z.record(z.string(), z.any()).default({}),
  progress: z.number().min(0).max(100).default(0),
  retryCount: z.number().int().min(0).default(0),
  maxRetries: z.number().int().min(0).default(3),
  workerId: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
  startedAt: z.coerce.date().nullable().optional(),
  finishedAt: z.coerce.date().nullable().optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
  checkpointData: z.record(z.string(), z.any()).nullable().optional(),
  checkpointAt: z.coerce.date().nullable().optional(),
  idempotencyKey: z.string().max(128).nullable().optional(),
  durationMs: z.number().int().nullable().optional(),
  leaseExpiresAt: z.coerce.date().nullable().optional(),
  lastHeartbeatAt: z.coerce.date().nullable().optional(),
  recoveryCount: z.number().int().min(0).default(0),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});
export type Job = z.infer<typeof jobSchema>;

export const createJobDtoSchema = z.object({
  id: entityIdField.optional(),
  type: z.string().min(1),
  priority: z.number().int().min(1).max(10).default(1).optional(),
  payload: z.record(z.string(), z.any()).default({}).optional(),
  maxRetries: z.number().int().min(0).max(10).default(3).optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
  idempotencyKey: z.string().max(128).nullable().optional()
});
export type CreateJobDto = z.infer<typeof createJobDtoSchema>;

export const jobCheckpointDtoSchema = z.object({
  progress: z.number().min(0).max(100),
  checkpointData: z.record(z.string(), z.any()),
  workerId: z.string().min(1)
});
export type JobCheckpointDto = z.infer<typeof jobCheckpointDtoSchema>;

export const jobHeartbeatDtoSchema = z.object({
  workerId: z.string().optional(),
  leaseDurationMs: z.number().int().min(1000).max(600000).optional()
});
export type JobHeartbeatDto = z.infer<typeof jobHeartbeatDtoSchema>;

export const jobStatusTransitionDtoSchema = z.object({
  status: jobStatusSchema,
  workerId: z.string().optional(),
  error: z.string().nullable().optional(),
  durationMs: z.number().int().optional(),
  scheduledAt: z.coerce.date().nullable().optional()
});
export type JobStatusTransitionDto = z.infer<typeof jobStatusTransitionDtoSchema>;

export const systemLogSchema = z.object({
  id: entityIdField,
  workspaceId: entityIdField,
  workerId: z.string().nullable().optional(),
  severity: z.enum(['debug', 'info', 'warn', 'error', 'fatal']),
  task: z.string().min(1),
  message: z.string().min(1),
  durationMs: z.number().int().nullable().optional(),
  metadata: z.record(z.string(), z.any()).nullable().optional(),
  createdAt: z.coerce.date()
});
export type SystemLog = z.infer<typeof systemLogSchema>;

export const createSystemLogDtoSchema = z.object({
  id: entityIdField.optional(),
  workerId: z.string().nullable().optional(),
  severity: z.enum(['debug', 'info', 'warn', 'error', 'fatal']),
  task: z.string().min(1),
  message: z.string().min(1),
  durationMs: z.number().int().nullable().optional(),
  metadata: z.record(z.string(), z.any()).nullable().optional()
});
export type CreateSystemLogDto = z.infer<typeof createSystemLogDtoSchema>;
