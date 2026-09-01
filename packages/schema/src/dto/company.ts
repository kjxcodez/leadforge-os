import { z } from 'zod';
import { entityIdField, nameField, domainField } from '../fields/common.js';
import { companyStatusSchema, companySchema } from '../entities/company.js';
import { paginationParamsSchema } from '../common/pagination.js';

export const createCompanyDtoSchema = z.object({
  id: entityIdField.optional(),
  name: nameField,
  domain: domainField.optional(),
  website: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  size: z.string().nullable().optional(),
  employeeCount: z.number().nullable().optional(),
  revenue: z.string().nullable().optional(),
  linkedin: z.string().nullable().optional(),
  linkedinUrl: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  status: companyStatusSchema.optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().nullable().optional()
});
export type CreateCompanyDto = z.infer<typeof createCompanyDtoSchema>;

export const updateCompanyDtoSchema = createCompanyDtoSchema.partial();
export type UpdateCompanyDto = z.infer<typeof updateCompanyDtoSchema>;

export const companyFiltersSchema = paginationParamsSchema.extend({
  name: z.string().optional(),
  domain: z.string().optional(),
  status: companyStatusSchema.optional(),
  industry: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  location: z.string().optional(),
  search: z.string().optional()
});
export type CompanyFilters = z.infer<typeof companyFiltersSchema>;

export const companyListResponseSchema = z.object({
  items: z.array(companySchema),
  total: z.number()
});
export type CompanyListResponse = z.infer<typeof companyListResponseSchema>;
