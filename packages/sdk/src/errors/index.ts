import { ErrorCode } from '@leadforge/schema';

export class SdkError extends Error {
  public readonly code: string;
  public readonly details: unknown | null;
  public readonly status: number | null;

  constructor(message: string, code: string = ErrorCode.INTERNAL_SERVER_ERROR, status: number | null = null, details: unknown | null = null) {
    super(message);
    this.name = 'SdkError';
    this.code = code;
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, SdkError.prototype);
  }
}

export function isSdkError(error: unknown): error is SdkError {
  return error instanceof SdkError;
}
