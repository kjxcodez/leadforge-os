import { successResponse as sharedSuccessResponse, errorResponse as sharedErrorResponse } from '@leadforge/shared';
import type { ApiResponse as SharedApiResponse, ApiErrorResponse as SharedErrorResponse } from '@leadforge/schema';

export type ApiResponse<T> = SharedApiResponse<T>;
export type ErrorResponse = SharedErrorResponse;

export function successResponse<T>(data: T, meta?: Record<string, unknown>) {
  return sharedSuccessResponse(data, meta);
}

export function errorResponse(
  code: string,
  message: string,
  details: unknown = null
): ErrorResponse {
  return sharedErrorResponse(message, code, details) as ErrorResponse;
}
