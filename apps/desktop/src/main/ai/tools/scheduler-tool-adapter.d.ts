import type Database from 'better-sqlite3';
import type { LocalEventBus } from '../../lib/event-bus';
import type { ToolResult, ExecutionContext } from '@leadforge/agent-core';
export declare class SchedulerToolAdapter {
  private readonly db;
  private readonly eventBus;
  constructor(db: Database.Database, eventBus: LocalEventBus);
  /**
   * Submits a background worker job to SQLite and waits for its event outcome.
   */
  executeJobTool<TInput, TOutput>(
    jobType: string,
    payload: TInput,
    context: ExecutionContext
  ): Promise<ToolResult<TOutput>>;
}
