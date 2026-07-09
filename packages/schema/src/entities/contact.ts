import { z } from 'zod';
import { ContactStatus } from '../enums';
import { objectIdField, nameField, emailField, phoneField, urlField } from '../fields/common';

export const contactStatusSchema = z.nativeEnum(ContactStatus);

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

export type Contact = z.infer<typeof contactSchema>;
