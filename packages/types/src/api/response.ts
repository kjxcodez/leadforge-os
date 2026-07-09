export interface ApiError {
  code: string;
  message: string;
  details: unknown | null;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
  error: null;
}

export interface ApiErrorResponse {
  success: false;
  data: null;
  meta?: Record<string, unknown>;
  error: ApiError;
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

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface CursorMeta {
  nextCursor: string | null;
  hasNextPage: boolean;
}
