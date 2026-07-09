import type { Workflow, WorkflowStep, WorkflowStepType } from '@leadforge/types';
import type { WorkflowExecutionState, StepExecutor, WorkflowExecutionContext } from '../types';

export class WorkflowEngine {
  private executors: Map<WorkflowStepType, StepExecutor> = new Map();

  public registerExecutor(executor: StepExecutor): void {
    this.executors.set(executor.type, executor);
  }

  public async execute(workflow: Workflow, initialVariables: Record<string, any> = {}): Promise<WorkflowExecutionState> {
    const context: WorkflowExecutionContext = {
      variables: { ...initialVariables },
      logs: [],
    };

    const state: WorkflowExecutionState = {
      workflowId: workflow.id,
      status: 'RUNNING',
      currentStepId: null,
      context,
      startTime: new Date(),
    };

    context.logs.push(`Starting execution of workflow: "${workflow.name}"`);

    try {
      if (workflow.steps.length === 0) {
        context.logs.push('Workflow has no steps. Exiting.');
        state.status = 'COMPLETED';
        state.endTime = new Date();
        return state;
      }

      // Simple sequential execution for now
      for (const step of workflow.steps) {
        state.currentStepId = step.id;
        context.logs.push(`Processing step ${step.id} of type ${step.type}`);

        const executor = this.executors.get(step.type);
        if (!executor) {
          throw new Error(`No executor registered for step type: ${step.type}`);
        }

        await executor.execute(step, context);
        context.logs.push(`Finished step ${step.id}`);
      }

      state.status = 'COMPLETED';
      context.logs.push('Workflow completed successfully.');
    } catch (error) {
      state.status = 'FAILED';
      state.error = error instanceof Error ? error.message : 'Unknown error';
      context.logs.push(`Workflow execution failed: ${state.error}`);
    } finally {
      state.endTime = new Date();
    }

    return state;
  }
}
