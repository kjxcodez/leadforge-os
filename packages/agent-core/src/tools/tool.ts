import type { ZodSchema } from 'zod';
import type { RiskLevel } from './risk';
import type { ToolResult } from './result';
import type { ExecutionContext } from '../context/execution-context';

export interface Tool<TInput = unknown, TOutput = unknown> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: ZodSchema<TInput>;
  readonly riskLevel: RiskLevel;
  readonly timeoutMs?: number;
  execute(input: TInput, context: ExecutionContext): Promise<ToolResult<TOutput>>;
}
