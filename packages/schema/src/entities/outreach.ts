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
  updatedAt: z.date()
});
export type EmailTemplate = z.infer<typeof emailTemplateSchema>;

export const emailMessageSchema = z.object({
  messageId: z.string(),
  threadId: z.string().optional(),
  subject: z.string(),
  body: z.string()
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
  updatedAt: z.date()
});
export type Outreach = z.infer<typeof outreachSchema>;

export const emailAccountSchema = z.object({
  id: objectIdField,
  workspaceId: objectIdField,
  name: nameField,
  email: z.string().email(),
  provider: z.string(),
  status: z.enum([
    'connected',
    'reauth_required',
    'disconnected',
    'failed',
    'disabled'
  ]),
  dailyLimit: z.number().int().default(200),
  hourlyLimit: z.number().int().default(50),
  dailySent: z.number().int().default(0),
  hourlySent: z.number().int().default(0),
  signature: z.string().nullable().optional(),
  lastVerifiedAt: z.date().nullable().optional(),
  lastError: z.string().nullable().optional(),
  googleAccountId: z.string().nullable().optional(),
  tokenExpiresAt: z.date().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});
export type EmailAccount = z.infer<typeof emailAccountSchema>;
