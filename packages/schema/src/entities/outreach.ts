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

export const testRecipientSchema = z.object({
  email: z.string().email(),
  firstUsedAt: z.union([z.date(), z.string()]).optional(),
  lastUsedAt: z.union([z.date(), z.string()]).optional()
});
export type TestRecipient = z.infer<typeof testRecipientSchema>;

export const emailAccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  provider: z.enum(['gmail_oauth', 'other']),
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
  testRecipients: z.array(testRecipientSchema).optional(),
  lastVerifiedAt: z.union([z.date(), z.string()]).nullable().optional(),
  lastError: z.string().nullable().optional(),
  googleAccountId: z.string().nullable().optional(),
  tokenExpiresAt: z.union([z.date(), z.string()]).nullable().optional(),
  createdAt: z.union([z.date(), z.string()]),
  updatedAt: z.union([z.date(), z.string()])
});
export type EmailAccount = z.infer<typeof emailAccountSchema>;

export const audienceSchema = z.object({
  id: objectIdField,
  workspaceId: objectIdField,
  name: nameField,
  description: z.string().nullable().optional(),
  entityType: z.enum(['companies', 'contacts', 'both']).default('contacts'),
  mode: z.enum(['dynamic', 'static']).default('dynamic'),
  filterDefinition: z.record(z.any()).default({}),
  staticMemberIds: z.array(z.string()).optional(),
  contactCount: z.number().optional(),
  companyCount: z.number().optional(),
  resolvedContactIds: z.array(z.string()).optional(),
  resolvedCompanyIds: z.array(z.string()).optional(),
  createdAt: z.union([z.date(), z.string()]).optional(),
  updatedAt: z.union([z.date(), z.string()]).optional()
});
export type Audience = z.infer<typeof audienceSchema>;

