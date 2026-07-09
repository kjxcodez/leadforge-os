import { z } from 'zod';
import { OutreachChannel } from '../enums';
import { objectIdField, nameField } from '../fields/common';

export const outreachChannelSchema = z.nativeEnum(OutreachChannel);

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
  campaignId: objectIdField.nullable(),
  channel: outreachChannelSchema,
  status: z.string(),
  sentAt: z.date().nullable(),
  messageDetails: emailMessageSchema.nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Outreach = z.infer<typeof outreachSchema>;
