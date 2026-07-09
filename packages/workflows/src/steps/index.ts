// Built-in step executor factories/stubs
import type { StepExecutor, WorkflowExecutionContext } from '../types';
import type { WorkflowStep } from '@leadforge/types';

export const createConsoleLogExecutor = (): StepExecutor => ({
  type: 'DISCOVER' as any, // fallback or test type
  async execute(step: WorkflowStep, context: WorkflowExecutionContext): Promise<void> {
    context.logs.push(`[ConsoleLogExecutor] Executing step ${step.id} with config: ${JSON.stringify(step.config)}`);
    console.log('[ConsoleLogExecutor]', step.config);
  },
});
