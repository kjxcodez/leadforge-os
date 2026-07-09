import { z } from 'zod';
import { nameField, urlField } from '../fields/common';
import { companyStatusSchema } from '../entities/company';
import { paginationParamsSchema } from '../common/pagination';

export const createCompanyDtoSchema = z.object({
  name: nameField,
  domain: urlField.optional(),
  industry: z.string().nullable().optional(),
  size: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  status: companyStatusSchema.optional(),
});

export const updateCompanyDtoSchema = createCompanyDtoSchema.partial();

export const companyFiltersSchema = paginationParamsSchema.extend({
  name: z.string().optional(),
  domain: z.string().optional(),
  status: companyStatusSchema.optional(),
  industry: z.string().optional(),
});
