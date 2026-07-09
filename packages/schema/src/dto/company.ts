import { z } from 'zod';
import { nameField, urlField } from '../fields/common';
import { companyStatusSchema, companySchema } from '../entities/company';
import { paginationParamsSchema } from '../common/pagination';

export const createCompanyDtoSchema = z.object({
  name: nameField,
  domain: urlField.optional(),
  industry: z.string().nullable().optional(),
  size: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  status: companyStatusSchema.optional(),
});
export type CreateCompanyDto = z.infer<typeof createCompanyDtoSchema>;

export const updateCompanyDtoSchema = createCompanyDtoSchema.partial();
export type UpdateCompanyDto = z.infer<typeof updateCompanyDtoSchema>;

export const companyFiltersSchema = paginationParamsSchema.extend({
  name: z.string().optional(),
  domain: z.string().optional(),
  status: companyStatusSchema.optional(),
  industry: z.string().optional(),
});
export type CompanyFilters = z.infer<typeof companyFiltersSchema>;

export const companyListResponseSchema = z.object({
  items: z.array(companySchema),
  total: z.number(),
});
export type CompanyListResponse = z.infer<typeof companyListResponseSchema>;
