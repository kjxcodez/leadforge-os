import { z } from 'zod';
import { CompanyStatus } from '../enums/index.js';
import { objectIdField, nameField, domainField } from '../fields/common.js';

export const companyStatusSchema = z.nativeEnum(CompanyStatus);

export const companySchema = z.object({
  id: objectIdField,
  workspaceId: objectIdField,
  name: nameField,
  domain: domainField,
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
  status: companyStatusSchema,
  tags: z.array(z.string()).default([]),
  notes: z.string().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export type Company = z.infer<typeof companySchema>;
