import { z } from 'zod';
import { createCompanyDtoSchema } from './company.js';
import { createContactDtoSchema } from './contact.js';
import { createJobDtoSchema, createSystemLogDtoSchema } from '../entities/job.js';
import { createEmailDeliveryDtoSchema } from '../entities/delivery.js';

export const bulkErrorItemSchema = z.object({
  index: z.number().int(),
  id: z.string().optional(),
  error: z.string()
});
export type BulkErrorItem = z.infer<typeof bulkErrorItemSchema>;

export const bulkOperationResultSchema = z.object({
  success: z.boolean(),
  totalRequested: z.number().int(),
  inserted: z.number().int(),
  updated: z.number().int(),
  failed: z.number().int(),
  errors: z.array(bulkErrorItemSchema),
  data: z.array(z.any()).optional()
});
export type BulkOperationResult<T = any> = {
  success: boolean;
  totalRequested: number;
  inserted: number;
  updated: number;
  failed: number;
  errors: BulkErrorItem[];
  data?: T[];
};

// 1. Companies Bulk (Max 100)
export const bulkCompanyDtoSchema = z.object({
  companies: z.array(createCompanyDtoSchema).min(1).max(100)
});
export type BulkCompanyDto = z.infer<typeof bulkCompanyDtoSchema>;

// 2. Contacts Bulk (Max 100)
export const bulkContactDtoSchema = z.object({
  contacts: z.array(createContactDtoSchema).min(1).max(100)
});
export type BulkContactDto = z.infer<typeof bulkContactDtoSchema>;

// 3. Jobs Bulk (Max 100)
export const bulkJobDtoSchema = z.object({
  jobs: z.array(createJobDtoSchema).min(1).max(100)
});
export type BulkJobDto = z.infer<typeof bulkJobDtoSchema>;

// 4. Email Deliveries Bulk (Max 50)
export const bulkEmailDeliveryDtoSchema = z.object({
  deliveries: z.array(createEmailDeliveryDtoSchema).min(1).max(50)
});
export type BulkEmailDeliveryDto = z.infer<typeof bulkEmailDeliveryDtoSchema>;

// 5. System Logs Bulk (Max 200)
export const bulkSystemLogDtoSchema = z.object({
  logs: z.array(createSystemLogDtoSchema).min(1).max(200)
});
export type BulkSystemLogDto = z.infer<typeof bulkSystemLogDtoSchema>;
