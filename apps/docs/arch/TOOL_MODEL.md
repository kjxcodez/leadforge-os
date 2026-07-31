# Tool Model & Worker Integration

This document specifies how LeadForge OS exposes its existing background worker plugins as AI Tools within the Agent Platform. It avoids duplicating scheduler, worker-process, or recovery logic.

---

## Architectural Principle
LeadForge OS relies on a decoupled, multi-process execution engine. Heavy actions (such as scraping, crawling, and outreach dispatch) run in sandboxed child processes controlled by the `JobScheduler`. 

To prevent memory bloat, CPU saturation, and concurrency bugs, **the Agent Platform must never execute heavy tasks directly inside its reasoning loop.** Instead, it uses the existing `JobScheduler` to run tasks asynchronously.

---

## Worker Plugins as AI Tools

AI Tools are lightweight wrappers that submit jobs to the `JobScheduler`, wait for execution, and return the job result.

```text
[ Agent Planner ] ──► Calls Tool.execute()
                             │
                             ▼ (Submits Job)
                      [ JobScheduler ] ──► (Writes to 'jobs' table)
                             │
                             ▼ (Ticks & Forks)
                      [ Sandboxed Worker ] ──► (Runs Playwright/Cheerio)
                             │
                             ▼ (Writes result & exits)
                      [ SQLite DB ]
                             │
                             ▼ (Detects job complete)
[ Agent Planner ] ◄── Returns Tool Result
```

### The AI Tool Wrapper
Every background worker plugin is registered in the Agent SDK's `ToolRegistry` via an asynchronous tool wrapper:

```typescript
class SchedulerJobTool implements Tool {
  constructor(
    private readonly jobType: string,
    private readonly scheduler: JobScheduler,
    public readonly name: string,
    public readonly description: string,
    public readonly inputSchema: ZodSchema,
    public readonly isHighRisk: boolean
  ) {}

  async execute(input: unknown, context: ExecutionContext): Promise<unknown> {
    // 1. Submit job to the scheduler
    const jobId = await this.scheduler.submitJob({
      workspaceId: context.workspaceId,
      type: this.jobType,
      payload: input,
      priority: 10, // High priority for agent-driven actions
    });

    // 2. Poll the database or wait for the scheduler's completion event
    const result = await this.scheduler.waitForJobCompletion(jobId);

    if (result.status === 'failed') {
      throw new Error(`Tool execution failed: ${result.error}`);
    }

    return result.data;
  }
}
```

---

## Leveraging Scheduler Features

By wrapping jobs in this tool model, the Agent Platform leverages the existing scheduler's features without duplicating code:

1. **Heartbeats**: The main process continues to ping the worker every 10 seconds. If the worker hangs, the scheduler kills it and reports a failure to the agent.
2. **Retries**: If a network request fails, the scheduler handles retries using exponential backoffs.
3. **Checkpointing**: If the application is paused, the worker saves its state to `checkpointData` in SQLite, allowing it to resume later.
4. **Recovery**: If the application crashes, the scheduler cleans up active jobs on startup, returning an error to the agent on restart.
5. **Observability**: Tool runs write logs directly to the `system_logs` and `audit_logs` tables, making them visible in the Operations Center.
