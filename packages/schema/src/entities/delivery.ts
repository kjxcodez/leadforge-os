import { z } from 'zod';
import { entityIdField, entityIdFieldNullable } from '../fields/common.js';

export const emailDeliveryStatusSchema = z.enum([
  'QUEUED',
  'SENDING',
  'SENT',
  'FAILED',
  'RETRYING',
  'AMBIGUOUS',
  'CANCELLED',
  'SUPPRESSED'
]);
export type EmailDeliveryStatus = z.infer<typeof emailDeliveryStatusSchema>;

export const emailDeliverySchema = z.object({
  id: entityIdField,
  workspaceId: entityIdField,
  campaignId: entityIdFieldNullable.optional(),
  sequenceId: entityIdField,
  executionId: entityIdField,
  stepIndex: z.number().int().min(0),
  contactId: entityIdField,
  companyId: entityIdFieldNullable.optional(),
  accountId: entityIdField,
  senderEmail: z.string().email(),
  recipientEmail: z.string().email(),
  subject: z.string().min(1),
  providerMessageId: z.string().nullable().optional(),
  providerThreadId: z.string().nullable().optional(),
  status: emailDeliveryStatusSchema.default('QUEUED'),
  attempt: z.number().int().default(1),
  error: z.string().nullable().optional(),
  failureClassification: z.string().nullable().optional(),
  idempotencyKey: z.string().min(1).max(128),
  leaseExpiresAt: z.coerce.date().nullable().optional(),
  nextRetryAt: z.coerce.date().nullable().optional(),
  retryCount: z.number().int().default(0).optional(),
  reconciledAt: z.coerce.date().nullable().optional(),
  reconciliationNotes: z.string().nullable().optional(),
  snapshot: z.record(z.any()).nullable().optional(),
  sentAt: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});
export type EmailDelivery = z.infer<typeof emailDeliverySchema>;

export const createEmailDeliveryDtoSchema = z.object({
  id: entityIdField.optional(),
  campaignId: entityIdFieldNullable.optional(),
  sequenceId: entityIdField,
  executionId: entityIdField,
  stepIndex: z.number().int().min(0),
  contactId: entityIdField,
  companyId: entityIdFieldNullable.optional(),
  accountId: entityIdField,
  senderEmail: z.string().email(),
  recipientEmail: z.string().email(),
  subject: z.string().min(1),
  status: emailDeliveryStatusSchema.default('SENDING').optional(),
  idempotencyKey: z.string().min(1).max(128),
  snapshot: z.record(z.any()).nullable().optional()
});
export type CreateEmailDeliveryDto = z.infer<typeof createEmailDeliveryDtoSchema>;

export const reserveEmailDeliveryDtoSchema = z.object({
  id: entityIdField.optional(),
  campaignId: entityIdFieldNullable.optional(),
  sequenceId: entityIdField,
  executionId: entityIdField,
  stepIndex: z.number().int().min(0),
  contactId: entityIdField,
  companyId: entityIdFieldNullable.optional(),
  accountId: entityIdField,
  senderEmail: z.string().email(),
  recipientEmail: z.string().email(),
  subject: z.string().min(1),
  idempotencyKey: z.string().min(1).max(128),
  leaseDurationMs: z.number().int().min(1000).max(3600000).default(300000).optional(),
  snapshot: z.record(z.any()).nullable().optional()
});
export type ReserveEmailDeliveryDto = z.infer<typeof reserveEmailDeliveryDtoSchema>;

export const finalizeEmailDeliveryDtoSchema = z.object({
  status: z.enum(['SENT', 'FAILED', 'RETRYING', 'AMBIGUOUS', 'CANCELLED', 'SUPPRESSED']),
  providerMessageId: z.string().nullable().optional(),
  providerThreadId: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
  failureClassification: z.string().nullable().optional(),
  sentAt: z.coerce.date().nullable().optional(),
  nextRetryAt: z.coerce.date().nullable().optional()
});
export type FinalizeEmailDeliveryDto = z.infer<typeof finalizeEmailDeliveryDtoSchema>;

export const reconcileEmailDeliveryDtoSchema = z.object({
  action: z.enum(['mark_sent', 'mark_failed', 'retry', 'ignore']),
  providerMessageId: z.string().nullable().optional(),
  notes: z.string().nullable().optional()
});
export type ReconcileEmailDeliveryDto = z.infer<typeof reconcileEmailDeliveryDtoSchema>;

export const updateEmailDeliveryDtoSchema = z.object({
  status: emailDeliveryStatusSchema,
  providerMessageId: z.string().nullable().optional(),
  providerThreadId: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
  failureClassification: z.string().nullable().optional(),
  sentAt: z.coerce.date().nullable().optional(),
  nextRetryAt: z.coerce.date().nullable().optional(),
  leaseExpiresAt: z.coerce.date().nullable().optional(),
  reconciledAt: z.coerce.date().nullable().optional(),
  reconciliationNotes: z.string().nullable().optional()
});
export type UpdateEmailDeliveryDto = z.infer<typeof updateEmailDeliveryDtoSchema>;
