import type { ZodSchema } from 'zod';
import type { RiskLevel } from './risk';
import type { ToolResult } from './result';
import type { ExecutionContext } from '../context/execution-context';

export interface ToolExample {
  readonly description: string;
  readonly input: Record<string, unknown>;
}

export interface ToolSchema {
  readonly description: string;
  readonly inputSchema: ZodSchema;
  readonly outputSchema?: ZodSchema | undefined;
  readonly outputDescription?: string | undefined;
  readonly examples: ToolExample[];
  readonly requiresApproval: boolean;
  readonly approvalReason?: string | undefined;
}

export interface Tool<TInput = unknown, TOutput = unknown> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: ZodSchema<TInput>;
  readonly riskLevel: RiskLevel;
  readonly timeoutMs?: number;
  readonly schema?: ToolSchema | undefined;
  execute(input: TInput, context: ExecutionContext): Promise<ToolResult<TOutput>>;
}
