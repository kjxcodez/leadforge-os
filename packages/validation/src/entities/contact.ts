import { z } from 'zod';
import { objectIdField, nameField, emailField, phoneField, urlField } from '../fields/common';

export const contactStatusSchema = z.enum(['NEW', 'CONTACTED', 'REPLIED', 'BOUNCED', 'UNSUBSCRIBED']);

export const contactSchema = z.object({
  id: objectIdField,
  workspaceId: objectIdField,
  companyId: objectIdField.nullable(),
  firstName: nameField,
  lastName: z.string().nullable(),
  email: emailField.nullable(),
  phone: phoneField,
  title: z.string().nullable(),
  linkedinUrl: urlField,
  status: contactStatusSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});
