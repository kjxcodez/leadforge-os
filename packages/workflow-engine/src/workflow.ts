import type { WorkflowContext } from './workflow-context';

// ─── Step Type Discriminant ───────────────────────────────────────────────────

export type WorkflowStepType = 'ToolStep' | 'LLMStep' | 'TransformStep' | 'ValidationStep';

// ─── ToolStep ─────────────────────────────────────────────────────────────────
//
// Executes a registered tool from the ToolRegistry once.
// If buildInputs (plural) is provided instead of buildInput, the runner
// invokes the tool once per element in the returned array and collects
// all results into an array stored under stepId in the WorkflowContext.
// This is the only bounded fan-out mechanism — it is deterministic and static.

export interface ToolStep {
  readonly type: 'ToolStep';
  readonly id: string;
  readonly name: string;
  readonly toolName: string;
  /** Single invocation — tool called once with this input. */
  readonly buildInput?: (ctx: WorkflowContext) => unknown;
  /** Bounded fan-out — tool called once per returned element. */
  readonly buildInputs?: (ctx: WorkflowContext) => unknown[];
}

// ─── LLMStep ─────────────────────────────────────────────────────────────────
//
// Executes an AIRuntime prompt identified by promptId.

export interface LLMStep {
  readonly type: 'LLMStep';
  readonly id: string;
  readonly name: string;
  readonly promptId: string;
  readonly buildInput: (ctx: WorkflowContext) => unknown;
}

// ─── TransformStep ───────────────────────────────────────────────────────────
//
// Pure data transformation with no external I/O.
// Reads from context, produces a value, stores it under stepId.

export interface TransformStep {
  readonly type: 'TransformStep';
  readonly id: string;
  readonly name: string;
  readonly transform: (ctx: WorkflowContext) => unknown;
}

// ─── ValidationStep ──────────────────────────────────────────────────────────
//
// Asserts invariants on the context. Throws if validation fails,
// which causes the runner to stop and emit workflow:failed.

export interface ValidationStep {
  readonly type: 'ValidationStep';
  readonly id: string;
  readonly name: string;
  readonly validate: (ctx: WorkflowContext) => void;
}

// ─── Union ───────────────────────────────────────────────────────────────────

export type WorkflowStep = ToolStep | LLMStep | TransformStep | ValidationStep;

// ─── Workflow ─────────────────────────────────────────────────────────────────
//
// An immutable, ordered sequence of steps. No branching. No loops.

export interface Workflow {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly steps: readonly WorkflowStep[];
}
