export type ToolErrorCode =
  | 'VALIDATION_ERROR'
  | 'PERMISSION_DENIED'
  | 'APPROVAL_REQUIRED'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'RESOURCE_EXHAUSTED'
  | 'UNAVAILABLE'
  | 'SCHEDULER_ERROR'
  | 'WORKER_ERROR'
  | 'CHECKPOINT_RESTORED'
  | 'RETRYABLE'
  | 'CANCELLED_BY_USER'
  | 'UNKNOWN';

export interface ToolError {
  readonly code: ToolErrorCode;
  readonly message: string;
  readonly isRetryable: boolean;
  readonly details?: unknown;
}
