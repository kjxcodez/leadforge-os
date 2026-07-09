export enum WorkflowStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  ERROR = 'ERROR',
}

export enum WorkflowStepType {
  DISCOVER = 'DISCOVER',
  ENRICH = 'ENRICH',
  VERIFY = 'VERIFY',
  QUALIFY = 'QUALIFY',
  SEND = 'SEND',
}

export interface WorkflowStep {
  id: string;
  type: WorkflowStepType;
  config: Record<string, unknown>;
  nextStepIds: string[];
}

export interface Workflow {
  id: string;
  workspaceId: string;
  name: string;
  status: WorkflowStatus;
  trigger: string;
  steps: WorkflowStep[];
  createdAt: Date;
  updatedAt: Date;
}
