export type EventType =
  | 'job:queued'
  | 'job:starting'
  | 'job:started'
  | 'job:progress'
  | 'job:completed'
  | 'job:failed'
  | 'job:paused'
  | 'job:resumed'
  | 'job:cancelled'
  | 'job:heartbeat:timeout'
  | 'job:deduplicated'
  | 'sync:started'
  | 'sync:progress'
  | 'sync:completed'
  | 'sync:failed'
  | 'crm:created'
  | 'crm:updated'
  | 'crm:deleted'
  | 'system:log'
  | 'automation:triggered'
  | 'automation:queued'
  | 'automation:started'
  | 'automation:resumed'
  | 'automation:paused'
  | 'automation:waiting'
  | 'automation:completed'
  | 'automation:cancelled'
  | 'automation:failed'
  | 'automation:recovered'
  | 'workspace:opened'
  | 'update:installed';
export interface AppEvent {
  type: EventType;
  workspaceId: string;
  payload: any;
  timestamp: string;
}
/**
 * LocalEventBus is a scoped event emitter for decoupling components and jobs
 * within a single active Workspace Runtime.
 */
export declare class LocalEventBus {
  private workspaceId;
  private emitter;
  constructor(workspaceId: string);
  /**
   * Publishes an event to all subscribers of the event type and the wildcard '*'.
   */
  publish(type: EventType, payload: any): void;
  /**
   * Subscribes a listener to an event type. Returns an unsubscribe function.
   */
  subscribe(type: EventType | '*', listener: (event: AppEvent) => void): () => void;
  /**
   * Clears all registered listeners.
   */
  clear(): void;
}
