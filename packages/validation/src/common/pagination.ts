import { z } from 'zod';

export const sortOrderSchema = z.enum(['asc', 'desc']);

export const paginationParamsSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  sortBy: z.string().optional(),
  sortOrder: sortOrderSchema.optional(),
});

export const cursorParamsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
});
