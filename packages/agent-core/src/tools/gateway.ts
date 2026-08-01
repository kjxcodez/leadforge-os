import type { ExecutionContext } from '../context/execution-context';
import type { ToolResult } from './result';

export interface SchedulerGateway {
  /**
   * Submits a background worker task and returns the queued Job ID immediately.
   */
  submit(jobType: string, payload: unknown, context: ExecutionContext): Promise<string>;

  /**
   * Submits a background worker task and awaits its eventual success/failure outcome.
   */
  submitAndAwait<TInput = unknown, TOutput = unknown>(
    jobType: string,
    payload: TInput,
    context: ExecutionContext
  ): Promise<ToolResult<TOutput>>;

  /**
   * Cancels a queued or running background job.
   */
  cancel(jobId: string, workspaceId: string): Promise<void>;

  /**
   * Queries the current status of a background job.
   */
  status(
    jobId: string,
    workspaceId: string
  ): Promise<
    | 'queued'
    | 'running'
    | 'waiting'
    | 'retrying'
    | 'paused'
    | 'cancelled'
    | 'completed'
    | 'failed'
    | 'interrupted'
    | 'unknown'
  >;
}
