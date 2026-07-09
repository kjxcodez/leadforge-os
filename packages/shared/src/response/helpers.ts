import type { SuccessResponse, ApiErrorResponse, PaginatedResponse, PaginationMeta } from '@leadforge/types';
import { ErrorCode } from '@leadforge/types';

export function successResponse<T>(data: T, meta?: Record<string, unknown>): SuccessResponse<T> {
  const result: SuccessResponse<T> = {
    success: true,
    data,
    error: null,
  };
  if (meta) {
    result.meta = meta;
  }
  return result;
}

export function errorResponse(
  message: string,
  code: string = ErrorCode.INTERNAL_SERVER_ERROR,
  details: unknown | null = null
): ApiErrorResponse {
  return {
    success: false,
    data: null,
    error: {
      code,
      message,
      details,
    },
  };
}

export function paginatedResponse<T>(data: T[], meta: PaginationMeta): PaginatedResponse<T> {
  return {
    success: true,
    data,
    error: null,
    meta: {
      pagination: meta,
    },
  };
}
