export type SortOrder = 'asc' | 'desc';
export type SortDirection = 1 | -1;

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: SortOrder;
}

export interface CursorParams {
  cursor?: string;
  limit?: number;
}
