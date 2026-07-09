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
