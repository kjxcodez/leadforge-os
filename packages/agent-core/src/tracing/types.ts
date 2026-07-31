export interface ToolCallTrace {
  readonly toolName: string;
  readonly durationMs: number;
  readonly success: boolean;
  readonly error?: string;
}

export interface AgentTrace {
  readonly traceId: string;
  readonly agentId: string;
  readonly workspaceId: string;
  readonly parentJobId?: string;
  readonly toolCalls: ToolCallTrace[];
  readonly durationMs: number;
  readonly metadata?: Record<string, unknown>; // redacted payloads placeholder
}
