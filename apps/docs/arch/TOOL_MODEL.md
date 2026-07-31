# Agent Tool Model & Execution Lifecycle

This document describes how worker capabilities are exposed as LLM tools, wrapped in safety checks, and executed asynchronously via the Scheduler Gateway.

---

## Tool Execution Lifecycle

Tools must not access database schemas, Electron handles, or process spawning APIs directly. All actions flow through a structured execution boundary:

```text
    [ Agent Planner ]
           │
           ▼ [1. Execute]
      [ Tool Class ] (Validated Zod Inputs)
           │
           ▼ [2. Request Job]
   [ SchedulerGateway ] (Hides SQLite Schema Details)
           │
           ▼ [3. SQL Write]
     [ SQLite jobs ] (Inserted status='queued')
           │
           ▼ [4. Poll & Fork]
     [ JobScheduler ] ──► Spawns ──► [ Worker Process ] (Playwright Scraper)
                                             │
                                             ▼ [5. Write Result]
                                       [ SQLite jobs ] (status='completed')
                                             │
                                             ▼ [6. Publish Event]
                                       [ LocalEventBus ]
                                             │
                                             ▼ [7. Resolve Promise]
                                    [ SchedulerGateway ]
                                             │
                                             ▼
                                     Normalized Result
```

---

## The Scheduler Gateway Bridge

The `SchedulerGateway` (or `JobSubmissionService`) acts as a boundary abstraction. It replaces direct database inserts in tool logic.

```typescript
export interface SchedulerGateway {
  submitAndAwait<TInput, TOutput>(
    jobType: string,
    payload: TInput,
    context: ExecutionContext
  ): Promise<ToolResult<TOutput>>;
}
```

* **Database Decoupling**: If the database schema of the `jobs` table or the queue mechanism changes (e.g. migrating from SQLite queues to a memory queue or an external job queue), only the implementation of the `SchedulerGateway` changes.
* **Typing Safety**: Inputs are type-checked at the gateway boundary, avoiding raw payload corruption.
* **Tracing Correlation**: The gateway automatically propagates `traceId`, `executionId`, and `jobId` parameters from the `ExecutionContext` to the SQLite queue fields, guaranteeing end-to-end trace correlation in audit logs.
