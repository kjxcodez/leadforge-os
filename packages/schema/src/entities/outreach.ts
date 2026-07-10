import { z } from 'zod';
import { objectIdField, nameField } from '../fields/common.js';

export const emailTemplateSchema = z.object({
  id: objectIdField,
  workspaceId: objectIdField,
  name: nameField,
  subject: z.string(),
  body: z.string(),
  variables: z.array(z.string()),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type EmailTemplate = z.infer<typeof emailTemplateSchema>;

export const emailMessageSchema = z.object({
  messageId: z.string(),
  threadId: z.string().optional(),
  subject: z.string(),
  body: z.string(),
});
export type EmailMessage = z.infer<typeof emailMessageSchema>;

export const outreachSchema = z.object({
  id: objectIdField,
  workspaceId: objectIdField,
  contactId: objectIdField,
  campaignId: objectIdField.nullable().optional(),
  companyId: objectIdField.nullable().optional(),
  provider: z.string(),
  status: z.string(),
  attempts: z.number().int().nonnegative().default(0),
  lastSentAt: z.date().nullable().optional(),
  messageDetails: emailMessageSchema.nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Outreach = z.infer<typeof outreachSchema>;
