import type { Workflow, WorkflowStep, WorkflowStepType } from '@leadforge/types';

export interface WorkflowExecutionContext {
  variables: Record<string, any>;
  logs: string[];
}

export interface WorkflowExecutionState {
  workflowId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  currentStepId: string | null;
  context: WorkflowExecutionContext;
  startTime: Date;
  endTime?: Date;
  error?: string;
}

export interface StepExecutor {
  type: WorkflowStepType;
  execute(step: WorkflowStep, context: WorkflowExecutionContext): Promise<void>;
}
