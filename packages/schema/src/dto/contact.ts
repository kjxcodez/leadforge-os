import { z } from 'zod';
import {
  entityIdField,
  entityIdFieldNullable,
  nameField,
  emailFieldNullable,
  phoneFieldNullable,
  urlField
} from '../fields/common.js';
import { contactStatusSchema, contactSchema } from '../entities/contact.js';
import { paginationParamsSchema } from '../common/pagination.js';

export const createContactDtoSchema = z.object({
  id: entityIdField.optional(),
  companyId: entityIdFieldNullable.optional(),
  firstName: nameField,
  lastName: z.string().nullable().optional(),
  email: emailFieldNullable.optional(),
  phone: phoneFieldNullable.optional(),
  title: z.string().nullable().optional(),
  linkedin: z.string().nullable().optional(),
  linkedinUrl: urlField.nullable().optional(),
  status: contactStatusSchema.optional(),
  notes: z.string().nullable().optional(),
  source: z.string().nullable().optional()
});
export type CreateContactDto = z.infer<typeof createContactDtoSchema>;

export const updateContactDtoSchema = createContactDtoSchema.partial();
export type UpdateContactDto = z.infer<typeof updateContactDtoSchema>;

export const contactFiltersSchema = paginationParamsSchema.extend({
  companyId: entityIdField.optional(),
  email: z.string().optional(),
  status: contactStatusSchema.optional()
});
export type ContactFilters = z.infer<typeof contactFiltersSchema>;

export const contactListResponseSchema = z.object({
  items: z.array(contactSchema),
  total: z.number()
});
export type ContactListResponse = z.infer<typeof contactListResponseSchema>;
