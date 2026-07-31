export interface ExecutionContext {
  readonly workspaceId: string;
  readonly executionId: string;
  readonly traceId: string;
  readonly jobId?: string;
  readonly actorId: string;
  readonly actorType: 'user' | 'agent' | 'system';
  readonly requestedBy: string;
  readonly permissions: string[];
  readonly executionMode: 'offline' | 'online';
  readonly abortSignal?: AbortSignal;
  readonly metadata?: Record<string, unknown>;
}
