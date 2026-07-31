import { EventEmitter } from 'events';
import type { AgentLifecycleState, AgentLifecycleEvent } from './types';

export class AgentSession extends EventEmitter {
  public readonly traceId: string;
  private currentState: AgentLifecycleState = 'CREATED';
  private readonly logs: string[] = [];
  public readonly startedAt: string;

  constructor(traceId: string) {
    super();
    this.traceId = traceId;
    this.startedAt = new Date().toISOString();
  }

  /**
   * Transitions the active session state, logs the update, and emits corresponding events.
   */
  public transition(
    state: AgentLifecycleState,
    message?: string,
    metadata?: Record<string, unknown>
  ): void {
    this.currentState = state;
    const logMsg = `[${new Date().toISOString()}] State: ${state}${message ? ` - ${message}` : ''}`;
    this.logs.push(logMsg);

    const event: any = {
      state,
      timestamp: new Date().toISOString(),
      traceId: this.traceId
    };

    if (message !== undefined) {
      event.message = message;
    }
    if (metadata !== undefined) {
      event.metadata = metadata;
    }

    this.emit('state-change', event);
    this.emit(state, event);
  }

  /**
   * Retrieves the current lifecycle state of the execution session.
   */
  public getState(): AgentLifecycleState {
    return this.currentState;
  }

  /**
   * Retrieves all logged state transitions and messages.
   */
  public getLogs(): string[] {
    return [...this.logs];
  }
}
