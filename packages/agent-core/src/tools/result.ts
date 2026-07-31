import type { ToolError } from './errors';

export interface ToolResultMetadata {
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
  readonly attempt: number;
  readonly workerId?: string;
  readonly traceId: string;
  readonly jobId?: string;
  readonly workspaceId: string;
  readonly cached: boolean;
  readonly provider?: string;
  readonly checkpointUsed?: string;
  readonly retryCount: number;
}

export type ToolResult<T = unknown> =
  | { readonly success: true; readonly data: T; readonly error?: never; readonly metadata: ToolResultMetadata }
  | { readonly success: false; readonly data?: never; readonly error: ToolError; readonly metadata: ToolResultMetadata };

export type AsyncToolResult<T = unknown> = Promise<ToolResult<T>>;
