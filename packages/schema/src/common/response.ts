import { z } from 'zod';
import { ErrorCode } from '../enums';
import { paginationMetaSchema, cursorMetaSchema } from './pagination';

export const apiErrorSchema = z.object({
  code: z.nativeEnum(ErrorCode),
  message: z.string(),
  details: z.any().nullable(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export function createSuccessResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: z.record(z.string(), z.any()).optional(),
    error: z.null(),
  });
}

export const apiErrorResponseSchema = z.object({
  success: z.literal(false),
  data: z.null(),
  meta: z.record(z.string(), z.any()).optional(),
  error: apiErrorSchema,
});
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;

// Generic TypeScript helpers
export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
  error: null;
}

export type ApiResponse<T> = SuccessResponse<T> | ApiErrorResponse;

export interface PaginatedResponse<T> extends SuccessResponse<T[]> {
  meta: {
    pagination: PaginationMeta;
  };
}

export interface CursorPaginatedResponse<T> extends SuccessResponse<T[]> {
  meta: {
    cursor: CursorMeta;
  };
}

import type { PaginationMeta, CursorMeta } from './pagination';
