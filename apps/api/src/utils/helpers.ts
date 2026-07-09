import mongoose from "mongoose";

/**
 * Validates if the given string is a valid MongoDB ObjectId.
 *
 * @param value The string to test
 * @returns boolean
 */
export function isValidObjectId(value: string): boolean {
  return mongoose.Types.ObjectId.isValid(value);
}

/**
 * Pagination parameters interface.
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * Standard pagination details object.
 */
export interface PaginatedMeta {
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Normalizes query string page and limit parameters into standard safe numbers.
 *
 * @param page Raw page query param
 * @param limit Raw limit query param
 * @returns PaginationParams
 */
export function getPaginationParams(page?: string | number, limit?: string | number): PaginationParams {
  const p = Math.max(1, typeof page === "string" ? parseInt(page, 10) || 1 : (page ?? 1));
  const l = Math.max(
    1,
    Math.min(100, typeof limit === "string" ? parseInt(limit, 10) || 10 : (limit ?? 10))
  );
  return { page: p, limit: l };
}

/**
 * Builds metadata for paginated lists.
 *
 * @param totalCount Total count of entities
 * @param page Current active page
 * @param limit Page size limit
 * @returns PaginatedMeta
 */
export function buildPaginatedMeta(totalCount: number, page: number, limit: number): PaginatedMeta {
  const totalPages = Math.ceil(totalCount / limit);
  return {
    totalCount,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

/**
 * Formats a Date object or string reliably into ISO string.
 * Returns null if invalid date.
 *
 * @param value The date candidate
 * @returns string | null
 */
export function formatIsoDate(value: string | Date | number): string | null {
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date.toISOString();
}
