import { EventEmitter } from 'events';

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
  | 'automation:triggered';

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
export class LocalEventBus {
  private emitter = new EventEmitter();

  constructor(private workspaceId: string) {
    this.emitter.setMaxListeners(50);
  }

  /**
   * Publishes an event to all subscribers of the event type and the wildcard '*'.
   */
  public publish(type: EventType, payload: any): void {
    const event: AppEvent = {
      type,
      workspaceId: this.workspaceId,
      payload,
      timestamp: new Date().toISOString(),
    };
    this.emitter.emit(type, event);
    this.emitter.emit('*', event);
  }

  /**
   * Subscribes a listener to an event type. Returns an unsubscribe function.
   */
  public subscribe(type: EventType | '*', listener: (event: AppEvent) => void): () => void {
    this.emitter.on(type, listener);
    return () => {
      this.emitter.off(type, listener);
    };
  }

  /**
   * Clears all registered listeners.
   */
  public clear(): void {
    this.emitter.removeAllListeners();
  }
}
