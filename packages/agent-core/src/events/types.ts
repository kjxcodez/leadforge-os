export type AgentPlatformEventType =
  | 'agent:started'
  | 'agent:completed'
  | 'agent:failed'
  | 'tool:requested'
  | 'tool:started'
  | 'tool:completed'
  | 'tool:failed'
  | 'approval:required'
  | 'approval:granted'
  | 'approval:denied'
  | 'llm:started'
  | 'llm:completed'
  | 'llm:failed';

export interface AgentPlatformEvent {
  readonly type: AgentPlatformEventType;
  readonly traceId: string;
  readonly workspaceId: string;
  readonly timestamp: string;
  readonly payload: Record<string, unknown>;
}
