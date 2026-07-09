export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
  error: null;
}

export interface ErrorResponse {
  success: false;
  data: null;
  meta?: Record<string, unknown>;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

/**
 * Creates a standard formatted success response.
 *
 * @param data Response payload
 * @param meta Optional pagination or metadata
 * @returns ApiResponse
 */
export function successResponse<T>(data: T, meta?: Record<string, unknown>): SuccessResponse<T> {
  return {
    success: true,
    data,
    meta,
    error: null,
  };
}

/**
 * Creates a standard formatted error response.
 *
 * @param code Error code identifier
 * @param message User facing error message
 * @param details Optional detailed contextual error parameters
 * @returns ApiResponse
 */
export function errorResponse(
  code: string,
  message: string,
  details: unknown = null
): ErrorResponse {
  return {
    success: false,
    data: null,
    error: {
      code,
      message,
      details: details ?? undefined,
    },
  };
}
