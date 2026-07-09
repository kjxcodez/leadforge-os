const fs = require('fs');
const path = require('path');

const wfSrcDir = 'c:\\Users\\91637\\Desktop\\Business Project\\leadforge-os\\packages\\workflows\\src';

const files = {
  // types
  'types/index.ts': `
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
`,

  // builders
  'builders/index.ts': `
import type { Workflow, WorkflowStep, WorkflowStepType, WorkflowStatus } from '@leadforge/types';
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
`,

  // steps
  'steps/index.ts': `
// Built-in step executor factories/stubs
import type { StepExecutor, WorkflowExecutionContext } from '../types';
import type { WorkflowStep } from '@leadforge/types';

export const createConsoleLogExecutor = (): StepExecutor => ({
  type: 'DISCOVER' as any, // fallback or test type
  async execute(step: WorkflowStep, context: WorkflowExecutionContext): Promise<void> {
    context.logs.push(\`[ConsoleLogExecutor] Executing step \${step.id} with config: \${JSON.stringify(step.config)}\`);
    console.log('[ConsoleLogExecutor]', step.config);
  },
});
`,

  // engine
  'engine/index.ts': `
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

    context.logs.push(\`Starting execution of workflow: "\${workflow.name}"\`);

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
        context.logs.push(\`Processing step \${step.id} of type \${step.type}\`);

        const executor = this.executors.get(step.type);
        if (!executor) {
          throw new Error(\`No executor registered for step type: \${step.type}\`);
        }

        await executor.execute(step, context);
        context.logs.push(\`Finished step \${step.id}\`);
      }

      state.status = 'COMPLETED';
      context.logs.push('Workflow completed successfully.');
    } catch (error) {
      state.status = 'FAILED';
      state.error = error instanceof Error ? error.message : 'Unknown error';
      context.logs.push(\`Workflow execution failed: \${state.error}\`);
    } finally {
      state.endTime = new Date();
    }

    return state;
  }
}
`,

  // root index
  'index.ts': `
export * from './types';
export * from './builders';
export * from './steps';
export * from './engine';
`
};

for (const [relativePath, content] of Object.entries(files)) {
  const fullPath = path.join(wfSrcDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content.trim() + '\\n');
}

console.log("Workflows package scaffolded.");
