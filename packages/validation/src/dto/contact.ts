import { z } from 'zod';
import { objectIdField, nameField, emailField, phoneField, urlField } from '../fields/common';
import { contactStatusSchema } from '../entities/contact';
import { paginationParamsSchema } from '../common/pagination';

export const createContactDtoSchema = z.object({
  companyId: objectIdField.nullable().optional(),
  firstName: nameField,
  lastName: z.string().nullable().optional(),
  email: emailField.nullable().optional(),
  phone: phoneField.optional(),
  title: z.string().nullable().optional(),
  linkedinUrl: urlField.optional(),
  status: contactStatusSchema.optional(),
});

export const updateContactDtoSchema = createContactDtoSchema.partial();

export const contactFiltersSchema = paginationParamsSchema.extend({
  companyId: objectIdField.optional(),
  email: z.string().optional(),
  status: contactStatusSchema.optional(),
});
