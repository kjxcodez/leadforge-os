import { z } from 'zod';
import { CompanyStatus } from '../enums';
import { objectIdField, nameField, urlField } from '../fields/common';

export const companyStatusSchema = z.nativeEnum(CompanyStatus);

export const companySchema = z.object({
  id: objectIdField,
  workspaceId: objectIdField,
  name: nameField,
  domain: urlField,
  industry: z.string().nullable(),
  size: z.string().nullable(),
  location: z.string().nullable(),
  status: companyStatusSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Company = z.infer<typeof companySchema>;
