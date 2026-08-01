import type { ToolRequest, ToolResponse, ToolInvocationLog } from './types';

export interface InvocationLogger {
  logRequest(req: ToolRequest): void;
  logResponse(res: ToolResponse, log: ToolInvocationLog): void;
  getLogs(): ToolInvocationLog[];
}

export class ConsoleInvocationLogger implements InvocationLogger {
  private readonly logs: ToolInvocationLog[] = [];

  public logRequest(req: ToolRequest): void {
    console.log(`[Tool Request - ${req.requestId}] Tool: ${req.toolName}, Trace: ${req.traceId}`);
  }

  public logResponse(res: ToolResponse, log: ToolInvocationLog): void {
    console.log(
      `[Tool Response - ${res.requestId}] Success: ${res.success}, Duration: ${res.durationMs}ms`
    );
    this.logs.push(log);
  }

  public getLogs(): ToolInvocationLog[] {
    return [...this.logs];
  }
}

export class NoopInvocationLogger implements InvocationLogger {
  public logRequest(_req: ToolRequest): void {}
  public logResponse(_res: ToolResponse, _log: ToolInvocationLog): void {}
  public getLogs(): ToolInvocationLog[] {
    return [];
  }
}
