/**
 * Granular metadata attached to a progress update from a worker plugin.
 * Spec: worker_runtime_spec.md §4.3
 */
export interface ProgressMetadata {
  step?: number;
  total?: number;
  current?: number;
  description?: string;
  /** Estimated seconds remaining. */
  eta?: number;
  /** Current entity being processed (e.g. company name or URL). */
  entity?: string;
}

export type JobStatus =
  | 'queued'
  | 'running'
  | 'starting'
  | 'waiting'
  | 'retrying'
  | 'paused'
  | 'cancelled'
  | 'completed'
  | 'failed'
  | 'interrupted';

export interface JobPayload {
  id: string;
  workspaceId: string;
  type: string;
  status: JobStatus;
  priority: number;
  payload: string; // JSON string representation of job args
  progress: number;
  retryCount: number;
  maxRetries: number;
  workerId?: string | null;
  error?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  /** Resumable state snapshot — JSON string. Written by the scheduler on { type: 'checkpoint' } / { type: 'paused' }. */
  checkpointData?: string | null;
  /** ISO datetime of the last checkpoint write. */
  checkpointAt?: string | null;
  /** For retry backoff: job will not be re-dispatched before this datetime. Added by migration-008. */
  scheduledAt?: string | null;
  /** Deduplication key for idempotent job queuing. Added by migration-008. */
  idempotencyKey?: string | null;
  /** Total wall-clock duration of the last run in milliseconds. Added by migration-008. */
  durationMs?: number | null;
}

/**
 * Runtime context passed to every job plugin.
 * Provides progress reporting, logging, control-signal checks,
 * checkpoint persistence, and a resolved database path.
 *
 * Spec: worker_runtime_spec.md §4.3
 */
export interface JobContext {
  /** Unique identifier of the running job. */
  jobId: string;
  /** Workspace this job belongs to. */
  workspaceId: string;
  /** Parsed job arguments. If the job was resumed, `payload._checkpoint` contains the saved checkpoint. */
  payload: any;
  /** Absolute path to the workspace SQLite database file. Worker opens its own connection. */
  dbPath: string;

  // -------------------------------------------------------------------------
  // Progress & logging
  // -------------------------------------------------------------------------

  /** Emit a progress update (0–100) with optional structured metadata. */
  updateProgress(progress: number, metadata?: ProgressMetadata): void;
  /** Emit a structured log entry. Relayed to AppLogger in the Main process. */
  emitLog(message: string, severity?: 'info' | 'warn' | 'error', meta?: any): void;

  // -------------------------------------------------------------------------
  // Control signals — plugins must check these at iteration boundaries
  // -------------------------------------------------------------------------

  /** Returns true if the Main process has requested cancellation. */
  isCancelled(): boolean;
  /** Returns true if the Main process has requested a pause. */
  isPaused(): boolean;

  // -------------------------------------------------------------------------
  // Checkpointing — enables resumable jobs
  // -------------------------------------------------------------------------

  /**
   * Persist a resumable state snapshot. Sends `{ type: 'checkpoint', data }` to
   * the Main process which stores it in `jobs.checkpointData`. On the next
   * dispatch after a pause/interrupt, `payload._checkpoint` will contain this data.
   */
  saveCheckpoint(data: any): void;
  /**
   * Retrieve the checkpoint saved before the last pause or interrupt.
   * Returns `null` if the job is running for the first time.
   */
  getCheckpoint(): any | null;
}

export interface JobPlugin {
  type: string;
  execute(context: JobContext): Promise<any>;
}

/**
 * Configurable concurrency limits for the JobScheduler.
 *
 * `globalMaxConcurrency` is the total number of active workers allowed at once.
 * `typeLimits` maps job type strings to their per-type maximum concurrency.
 *
 * Loaded from the `settings` SQLite table on every tick.
 * Keys convention: `scheduler:concurrency:<jobType>` and `scheduler:concurrency:global`.
 *
 * Spec: worker_runtime_spec.md §4.4 / AC-006 / TASK-013
 */
export interface SchedulerConfig {
  /** Maximum total concurrent workers across all job types. Default: 3. */
  globalMaxConcurrency: number;
  /** Per-type concurrency ceiling. Keyed by job type string. */
  typeLimits: Record<string, number>;
}
