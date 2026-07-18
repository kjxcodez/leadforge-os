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
}

export interface JobContext {
  jobId: string;
  workspaceId: string;
  payload: any;
  updateProgress: (progress: number, metadata?: any) => void;
  emitLog: (message: string, severity?: 'info' | 'warn' | 'error', meta?: any) => void;
  isCancelled: () => boolean;
}

export interface JobPlugin {
  type: string;
  execute(context: JobContext): Promise<any>;
}
