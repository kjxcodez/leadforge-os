import { z } from 'zod';
import { ContactStatus } from '../enums/index.js';
import { objectIdField, nameField, emailField, phoneField, urlField } from '../fields/common.js';

export const contactStatusSchema = z.nativeEnum(ContactStatus);

export const contactSchema = z.object({
  id: objectIdField,
  workspaceId: objectIdField,
  companyId: objectIdField.nullable().optional(),
  firstName: nameField,
  lastName: z.string().nullable().optional(),
  email: emailField.nullable().optional(),
  phone: phoneField.nullable().optional(),
  title: z.string().nullable().optional(),
  linkedin: z.string().nullable().optional(),
  linkedinUrl: urlField.nullable().optional(),
  source: z.string().nullable().optional(),
  status: contactStatusSchema,
  notes: z.string().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Contact = z.infer<typeof contactSchema>;
