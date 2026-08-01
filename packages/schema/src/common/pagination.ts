import { z } from 'zod';
export const sortOrderSchema = z.enum(['asc', 'desc']);
export type SortOrder = z.infer<typeof sortOrderSchema>;

export const paginationParamsSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  sortBy: z.string().optional(),
  sortOrder: sortOrderSchema.optional()
});
export type PaginationParams = z.infer<typeof paginationParamsSchema>;

export const cursorParamsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().optional()
});
export type CursorParams = z.infer<typeof cursorParamsSchema>;

export const paginationMetaSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
});
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

export const cursorMetaSchema = z.object({
  nextCursor: z.string().nullable(),
  hasNextPage: z.boolean()
});
export type CursorMeta = z.infer<typeof cursorMetaSchema>;
