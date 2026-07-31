import { EventEmitter } from 'events';

// ─── Event Payloads ───────────────────────────────────────────────────────────

export interface WorkflowStartedPayload {
  readonly workflowId: string;
  readonly workflowName: string;
  readonly traceId: string;
  readonly timestamp: string;
  readonly totalSteps: number;
}

export interface WorkflowStepStartedPayload {
  readonly workflowId: string;
  readonly stepId: string;
  readonly stepName: string;
  readonly stepIndex: number;
  readonly totalSteps: number;
  readonly traceId: string;
  readonly timestamp: string;
}

export interface WorkflowStepCompletedPayload {
  readonly workflowId: string;
  readonly stepId: string;
  readonly stepName: string;
  readonly stepIndex: number;
  readonly totalSteps: number;
  readonly traceId: string;
  readonly timestamp: string;
  readonly durationMs: number;
}

export interface WorkflowCompletedPayload {
  readonly workflowId: string;
  readonly workflowName: string;
  readonly traceId: string;
  readonly timestamp: string;
  readonly durationMs: number;
  readonly stepsCompleted: number;
}

export interface WorkflowFailedPayload {
  readonly workflowId: string;
  readonly workflowName: string;
  readonly traceId: string;
  readonly timestamp: string;
  readonly failedStepId: string;
  readonly failedStepName: string;
  readonly error: string;
}

// ─── Typed Event Map ──────────────────────────────────────────────────────────

export interface WorkflowEventMap {
  'workflow:started': [payload: WorkflowStartedPayload];
  'workflow:step:started': [payload: WorkflowStepStartedPayload];
  'workflow:step:completed': [payload: WorkflowStepCompletedPayload];
  'workflow:completed': [payload: WorkflowCompletedPayload];
  'workflow:failed': [payload: WorkflowFailedPayload];
}

// ─── WorkflowEvents ───────────────────────────────────────────────────────────

/**
 * WorkflowEvents is a typed EventEmitter that carries workflow lifecycle
 * events. WorkflowRunner emits on it during execution. Consumers subscribe
 * to receive real-time progress.
 */
export class WorkflowEvents extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(20);
  }

  public emitStarted(payload: WorkflowStartedPayload): void {
    this.emit('workflow:started', payload);
  }

  public emitStepStarted(payload: WorkflowStepStartedPayload): void {
    this.emit('workflow:step:started', payload);
  }

  public emitStepCompleted(payload: WorkflowStepCompletedPayload): void {
    this.emit('workflow:step:completed', payload);
  }

  public emitCompleted(payload: WorkflowCompletedPayload): void {
    this.emit('workflow:completed', payload);
  }

  public emitFailed(payload: WorkflowFailedPayload): void {
    this.emit('workflow:failed', payload);
  }

  public onStarted(listener: (payload: WorkflowStartedPayload) => void): this {
    return this.on('workflow:started', listener);
  }

  public onStepStarted(listener: (payload: WorkflowStepStartedPayload) => void): this {
    return this.on('workflow:step:started', listener);
  }

  public onStepCompleted(listener: (payload: WorkflowStepCompletedPayload) => void): this {
    return this.on('workflow:step:completed', listener);
  }

  public onCompleted(listener: (payload: WorkflowCompletedPayload) => void): this {
    return this.on('workflow:completed', listener);
  }

  public onFailed(listener: (payload: WorkflowFailedPayload) => void): this {
    return this.on('workflow:failed', listener);
  }
}
