import type { Workflow, WorkflowStep, WorkflowStepType, WorkflowStatus } from '@leadforge/schema';
import { generateTempId } from '@leadforge/shared';

export class WorkflowBuilder {
  private workflow: Workflow;

  constructor(name: string) {
    this.workflow = {
      id: generateTempId(),
      workspaceId: 'temp-workspace-id',
      name,
      status: 'DRAFT' as WorkflowStatus,
      trigger: 'manual',
      steps: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  public setTrigger(trigger: string): this {
    this.workflow.trigger = trigger;
    return this;
  }

  public addStep(type: WorkflowStepType, config: Record<string, any> = {}): this {
    const step: WorkflowStep = {
      id: generateTempId(),
      type,
      config,
      nextStepIds: [],
    };

    // link previous step to this step if any exist
    if (this.workflow.steps.length > 0) {
      const prevStep = this.workflow.steps[this.workflow.steps.length - 1];
      if (prevStep) {
        prevStep.nextStepIds.push(step.id);
      }
    }

    this.workflow.steps.push(step);
    return this;
  }

  public build(): Workflow {
    this.workflow.updatedAt = new Date();
    return this.workflow;
  }
}
