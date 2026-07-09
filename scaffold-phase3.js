const fs = require('fs');
const path = require('path');

const sharedSrcDir = 'c:\\Users\\91637\\Desktop\\Business Project\\leadforge-os\\packages\\shared\\src';

const files = {
  // constants
  'constants/api.ts': `
export const API_VERSION = 'v1';
export const API_PREFIX = \`/api/\${API_VERSION}\`;
`,
  'constants/limits.ts': `
export const LIMITS = {
  PAGINATION: {
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
  },
  FILE_SIZE: {
    MAX_UPLOAD_MB: 10,
  },
  RATE_LIMIT: {
    PUBLIC_WINDOW_MS: 15 * 60 * 1000,
    PUBLIC_MAX_REQUESTS: 100,
  },
};
`,
  'constants/timeouts.ts': `
export const TIMEOUTS = {
  API_REQUEST: 30000,
  DB_CONNECTION: 10000,
  WORKFLOW_STEP: 60000,
};
`,
  'constants/collections.ts': `
export const COLLECTION_NAMES = {
  COMPANIES: 'companies',
  CONTACTS: 'contacts',
  CAMPAIGNS: 'campaigns',
  WORKFLOWS: 'workflows',
  WORKSPACES: 'workspaces',
  USERS: 'users',
  SESSIONS: 'sessions',
  OPPORTUNITIES: 'opportunities',
  OUTREACH: 'outreach',
} as const;
`,
  'constants/index.ts': `
export * from './api';
export * from './limits';
export * from './timeouts';
export * from './collections';
`,

  // pagination
  'pagination/utils.ts': `
import type { PaginationParams, SortOrder, PaginationMeta } from '@leadforge/types';
import { LIMITS } from '../constants/limits';

export function getPaginationParams(query: Record<string, any>): Required<PaginationParams> {
  const page = Math.max(1, parseInt(query.page as string, 10) || 1);
  const limit = Math.min(
    LIMITS.PAGINATION.MAX_LIMIT,
    Math.max(1, parseInt(query.limit as string, 10) || LIMITS.PAGINATION.DEFAULT_LIMIT)
  );
  const sortBy = (query.sortBy as string) || 'createdAt';
  const sortOrder: SortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

  return { page, limit, sortBy, sortOrder };
}

export function buildPaginatedMeta(total: number, page: number, limit: number): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}
`,
  'pagination/index.ts': `
export * from './utils';
`,

  // response
  'response/helpers.ts': `
import type { ApiResponse, ApiErrorResponse, ApiError, PaginatedResponse, PaginationMeta } from '@leadforge/types';
import { ErrorCode } from '@leadforge/types';

export function successResponse<T>(data: T, meta?: Record<string, unknown>): ApiResponse<T> {
  return {
    success: true,
    data,
    error: null,
    ...(meta ? { meta } : {}),
  };
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
`,
  'response/index.ts': `
export * from './helpers';
`,

  // helpers
  'helpers/string.ts': `
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\\s+/g, '-')
    .replace(/[^\\w\\-]+/g, '')
    .replace(/\\-\\-+/g, '-');
}
`,
  'helpers/id.ts': `
// In a real app we might use UUIDs or CUIDs here for new entities, but MongoDB will generate ObjectIds
export function generateTempId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
`,
  'helpers/date.ts': `
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function isPast(date: Date): boolean {
  return date.getTime() < Date.now();
}
`,
  'helpers/index.ts': `
export * from './string';
export * from './id';
export * from './date';
`,

  // guards
  'guards/type-guards.ts': `
/**
 * Basic RegExp to validate MongoDB ObjectIDs (24 hex characters)
 */
const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export function isValidObjectId(id: unknown): id is string {
  return typeof id === 'string' && OBJECT_ID_REGEX.test(id);
}

export function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

export function isError(error: unknown): error is Error {
  return error instanceof Error;
}
`,
  'guards/index.ts': `
export * from './type-guards';
`,

  // root index
  'index.ts': `
export * from './constants';
export * from './pagination';
export * from './response';
export * from './helpers';
export * from './guards';
`
};

for (const [relativePath, content] of Object.entries(files)) {
  const fullPath = path.join(sharedSrcDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content.trim() + '\\n');
}

console.log("Shared package scaffolded.");
