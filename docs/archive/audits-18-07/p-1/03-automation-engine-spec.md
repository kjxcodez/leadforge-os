# LeadForge OS — Automation Engine Architecture Specification

> **Document Type**: Architecture Specification  
> **Phase**: 8 — Local Worker Runtime Audit  
> **Status**: Pre-Implementation Blueprint

---

## 1. Critical Violation: Automation on the API

### 1.1 Current Violation

The API's `AutomationService` (`apps/api/src/services/automation/automation.service.ts`) currently:

1. **Executes sequence steps** — `executeNextStep()` runs step logic on the API server
2. **Sends emails** — calls `OutreachService.sendSingleEmail()` from the API
3. **Modifies MongoDB records** — tags, pipeline stage, notes, campaign status
4. **Manages WAIT timers** — sets `nextExecutionAt` and relies on server polling to resume
5. **Uses `process.nextTick()`** — recursive async step execution on the API event loop

```typescript
// This entire function must NOT exist on the API:
public async executeNextStep(executionId: string): Promise<void> {
  // ... runs step business logic on the API server
  process.nextTick(() => {
    this.executeNextStep(executionId)  // recursive execution on API
  });
}
```

**This is a P0 architectural violation.** The API is acting as a job runner and a workflow engine. It must never do this.

### 1.2 What the API Should Do Instead

The API's automation endpoints should be **passive CRUD only**:

- `POST /sequences` — persist sequence definition
- `GET /sequences` — list sequences
- `POST /executions` — create execution record (status: PENDING)
- `PATCH /executions/:id` — update status (called by desktop sync)
- `GET /executions/:id/logs` — read logs from MongoDB

The desktop's `SyncEngine` will push execution state changes upward. The API will never initiate or advance execution.

### 1.3 Migration Required

| API endpoint current behavior                 | Target behavior                                       |
| --------------------------------------------- | ----------------------------------------------------- |
| `startExecution()` → runs `executeNextStep()` | `startExecution()` → creates PENDING record → returns |
| `executeNextStep()` → runs steps on API       | **DELETE** — move to desktop worker                   |
| `stopExecution()` → marks FAILED              | Keep — but as status-only mutation                    |
| `handleEvent()` → triggers sequences on API   | **DELETE** — desktop listens to EventBus events       |

---

## 2. Automation Runtime Architecture (Target)

### 2.1 Where Automations Execute

**Everything executes in the desktop worker process.** The automation engine is a worker plugin:

```
EventBus (Main process)
    │
    │ event: 'crm:created' { entityType: 'company', entityId }
    ▼
AutomationTriggerEvaluator (Main process, synchronous)
    │
    │ Finds matching active sequences
    │ Queues job: { type: 'automation:workflow', payload: { sequenceId, entityId } }
    ▼
JobScheduler (Main process)
    │
    │ Dispatches job to child process
    ▼
worker-host.ts (child process)
    │
    │ Resolves 'automation:workflow' plugin
    ▼
AutomationWorkflowPlugin (child process)
    │
    │ Opens SQLite connection
    │ Loads sequence definition
    │ Begins step execution loop
    │ Persists state after each step
    │ Handles WAIT → schedules future job
    ▼
SQLite (writes: sequence_executions, sequence_logs)
    ▼
SyncEngine (pushes to API)
```

### 2.2 AutomationTriggerEvaluator (Main Process)

This component subscribes to the `LocalEventBus` and evaluates whether any active sequences should fire:

```typescript
class AutomationTriggerEvaluator {
  constructor(
    private workspaceId: string,
    private db: Database,
    private eventBus: LocalEventBus
  ) {
    this.bind();
  }

  private bind(): void {
    this.eventBus.subscribe('crm:created', (event) => this.evaluate(event));
    this.eventBus.subscribe('crm:updated', (event) => this.evaluate(event));
  }

  private async evaluate(event: AppEvent): Promise<void> {
    const { entityType, entityId, changeType } = event.payload;

    // Map event to trigger type
    const triggerType = this.mapToTriggerType(entityType, changeType);
    if (!triggerType) return;

    // Find matching active sequences (fast SQLite read)
    const sequences = this.db
      .prepare(
        `
      SELECT id, steps FROM sequences
      WHERE workspaceId = ? AND status = 'active' 
      AND json_extract(trigger, '$.type') = ?
      AND deletedAt IS NULL
    `
      )
      .all(this.workspaceId, triggerType);

    for (const seq of sequences) {
      // Check for existing active execution (deduplication)
      const existing = this.db
        .prepare(
          `
        SELECT id FROM sequence_executions
        WHERE workspaceId = ? AND sequenceId = ? AND (status = 'running' OR status = 'waiting')
        AND (contactId = ? OR companyId = ?)
      `
        )
        .get(this.workspaceId, seq.id, entityId, entityId);

      if (existing) continue;

      // Queue automation job
      this.db
        .prepare(
          `
        INSERT INTO jobs (id, workspaceId, type, status, priority, payload, ...)
        VALUES (?, ?, 'automation:workflow', 'queued', 3, ?, ...)
      `
        )
        .run(
          uuid(),
          this.workspaceId,
          JSON.stringify({ sequenceId: seq.id, entityId, entityType })
        );
    }
  }
}
```

### 2.3 Automation Worker Plugin

The `AutomationWorkflowPlugin` executes inside the worker process:

```typescript
export async function executeAutomationWorkflow(ctx: JobContext): Promise<any> {
  const { sequenceId, entityId, entityType } = ctx.payload;
  const db = new Database(ctx.dbPath);

  // 1. Create execution record
  const executionId = uuid();
  db.prepare(
    `
    INSERT INTO sequence_executions (id, sequenceId, workspaceId, status, currentStep, startedAt, ...)
    VALUES (?, ?, ?, 'running', 0, datetime('now'), ...)
  `
  ).run(executionId, sequenceId, ctx.workspaceId);

  // 2. Load sequence
  const sequence = db.prepare('SELECT * FROM sequences WHERE id = ?').get(sequenceId);
  const steps = JSON.parse(sequence.steps);

  // 3. Execute steps
  let currentStep = 0;
  while (currentStep < steps.length) {
    if (ctx.isCancelled()) break;
    if (ctx.isPaused()) {
      ctx.saveCheckpoint({ currentStep, executionId });
      return { status: 'paused', currentStep };
    }

    const step = steps[currentStep];
    const result = await executeStep(step, executionId, entityId, entityType, ctx, db);

    if (result.status === 'wait') {
      // Schedule future resumption job
      const resumeAt = new Date(Date.now() + result.delayMs).toISOString();
      db.prepare(
        `
        UPDATE sequence_executions 
        SET status = 'waiting', currentStep = ?, nextExecutionAt = ?
        WHERE id = ?
      `
      ).run(currentStep + 1, resumeAt, executionId);
      db.close();
      return { status: 'waiting', resumeAt };
    }

    if (result.status === 'halt') {
      // Condition not met, halt sequence
      db.prepare(
        `UPDATE sequence_executions SET status = 'completed', completedAt = datetime('now') WHERE id = ?`
      ).run(executionId);
      db.close();
      return { status: 'halted', reason: result.reason };
    }

    currentStep++;
    ctx.updateProgress(Math.round((currentStep / steps.length) * 100), {
      step: currentStep,
      total: steps.length,
      description: step.type
    });
  }

  db.prepare(
    `UPDATE sequence_executions SET status = 'completed', completedAt = datetime('now') WHERE id = ?`
  ).run(executionId);
  db.close();
  return { status: 'completed', stepsExecuted: currentStep };
}
```

---

## 3. Workflow Engine

### 3.1 Current State

The `packages/workflows` package contains a `WorkflowEngine` class that:

- Executes steps sequentially
- Has a pluggable `StepExecutor` registry
- Has no persistence, no pause/resume, no concurrency, no IPC integration

It is a **prototype**. It cannot support the required automation flows. However, its executor pattern is sound and should be retained and extended.

### 3.2 Workflow vs Sequence Distinction

|               | Workflow                               | Sequence                               |
| ------------- | -------------------------------------- | -------------------------------------- |
| **Trigger**   | Explicit user action or system event   | Automatic on CRM event                 |
| **Scope**     | Multiple entities, multi-step pipeline | Single contact/company                 |
| **Steps**     | DISCOVER → ENRICH → QUALIFY → SEND     | WAIT → SEND_EMAIL → CONDITION → BRANCH |
| **Spawns**    | Worker jobs for each step              | Itself is a worker job                 |
| **Branching** | `nextStepIds` (DAG)                    | Linear with conditions                 |
| **Resume**    | Via checkpoint                         | Via `nextExecutionAt`                  |

### 3.3 Workflow Engine Target Design

The workflow engine should be a **coordinator**, not an executor. It spawns the appropriate worker jobs for each step:

```typescript
// packages/workflows/src/engine/index.ts

export class WorkflowEngine {
  async execute(workflowId: string, context: WorkflowContext): Promise<void> {
    const workflow = loadWorkflow(workflowId);

    // Persist workflow execution state
    const execId = createWorkflowExecution(workflowId, context);

    // Execute DAG — walk steps, queue jobs for each
    const visited = new Set<string>();
    const queue = [workflow.steps[0]];

    while (queue.length > 0) {
      const step = queue.shift();
      if (!step || visited.has(step.id)) continue;
      visited.add(step.id);

      // Each step type maps to a job type
      const jobType = STEP_TO_JOB_MAP[step.type];
      enqueueJob(jobType, { workflowExecId: execId, stepId: step.id, ...step.config });

      // Wait for job completion via EventBus subscription
      await waitForJobCompletion(execId, step.id);

      // Enqueue next steps
      for (const nextId of step.nextStepIds) {
        const nextStep = workflow.steps.find((s) => s.id === nextId);
        if (nextStep) queue.push(nextStep);
      }
    }

    markWorkflowCompleted(execId);
  }
}

const STEP_TO_JOB_MAP: Record<WorkflowStepType, string> = {
  DISCOVER: 'scraper:maps',
  ENRICH: 'crawler:website',
  VERIFY: 'enrich:verify',
  QUALIFY: 'score:company',
  SEND: 'outreach:campaign'
};
```

### 3.4 Workflow Engine Location

The `WorkflowEngine` lives in `packages/workflows` (shared package) but is **instantiated and executed in the desktop worker process**. It must not run on the API server.

---

## 4. Sequence Engine

### 4.1 Step Type Implementation Matrix

| Step Type             | Current API Implementation                       | Target Desktop Implementation                           |
| --------------------- | ------------------------------------------------ | ------------------------------------------------------- |
| `WAIT`                | Sets `nextExecutionAt`, relies on server poll    | Reschedules future job in SQLite                        |
| `SEND_EMAIL`          | Calls `OutreachService.sendSingleEmail()` on API | Worker calls local SMTP via `outreach:email` sub-plugin |
| `ASSIGN_TAG`          | Mongoose update                                  | SQLite UPDATE + sync_queue                              |
| `REMOVE_TAG`          | Mongoose update                                  | SQLite UPDATE + sync_queue                              |
| `CREATE_NOTE`         | Mongoose update + ActivityModel                  | SQLite UPDATE + sync_queue                              |
| `MOVE_PIPELINE_STAGE` | Mongoose update                                  | SQLite UPDATE + sync_queue                              |
| `START_CAMPAIGN`      | Mongoose update                                  | SQLite UPDATE + sync_queue                              |
| `STOP_CAMPAIGN`       | Mongoose update                                  | SQLite UPDATE + sync_queue                              |
| `ASSIGN_OWNER`        | Mongoose update                                  | SQLite UPDATE + sync_queue                              |
| `CREATE_ACTIVITY`     | New ActivityModel                                | INSERT INTO activities + sync_queue                     |
| `FINISH_SEQUENCE`     | Mark completed                                   | UPDATE sequence_executions status='completed'           |
| `CONDITION`           | `evaluateCondition()` on API                     | `evaluateCondition()` in worker against SQLite          |

### 4.2 WAIT Step Scheduling

The WAIT step cannot block a worker process thread. The correct approach:

```
AutomationWorkflowPlugin encounters WAIT step
  → saves { executionId, nextStep: currentStep+1, resumeAt } to sequence_executions
  → exits the job successfully (not failure)
  → returns { status: 'waiting', resumeAt }

JobScheduler (Main process, tick-based)
  → Periodically checks for waiting executions due for resumption:
    SELECT id, sequenceId, contactId, companyId, currentStep
    FROM sequence_executions
    WHERE workspaceId = ? AND status = 'waiting' AND nextExecutionAt <= datetime('now')
  → Queues new job: { type: 'automation:workflow', payload: { executionId, resumeFrom: currentStep } }
```

This means the `JobScheduler.tick()` must handle **two** query types:

1. `SELECT from jobs WHERE status IN ('queued', 'retrying')` — regular job dispatch
2. `SELECT from sequence_executions WHERE status = 'waiting' AND nextExecutionAt <= NOW` — timer resumption

### 4.3 WAIT After App Restart Recovery

When the desktop app restarts, the scheduler must immediately scan for overdue waiting executions:

```typescript
// In WorkspaceRuntime.start():
const overdueExecutions = this.sqliteDb
  .prepare(
    `
  SELECT * FROM sequence_executions
  WHERE workspaceId = ? AND status = 'waiting' AND nextExecutionAt <= datetime('now')
`
  )
  .all(this.workspaceId);

for (const exec of overdueExecutions) {
  // Queue immediate resumption
  this.sqliteDb
    .prepare(`INSERT INTO jobs (...) VALUES (...)`)
    .run(
      uuid(),
      this.workspaceId,
      'automation:workflow',
      'queued',
      4,
      JSON.stringify({ executionId: exec.id, resumeFrom: exec.currentStep })
    );
}
```

### 4.4 Condition Evaluation

All conditions must be evaluated against **SQLite data** in the worker process:

```typescript
async function evaluateCondition(
  conditionType: string,
  config: any,
  entityId: string,
  entityType: 'contact' | 'company',
  db: Database
): Promise<boolean> {
  switch (conditionType) {
    case 'HAS_TAG': {
      const row = db.prepare(`SELECT tags FROM ${entityType}s WHERE id = ?`).get(entityId);
      const tags = JSON.parse(row?.tags || '[]');
      return tags.includes(config.tag);
    }
    case 'NO_REPLY_RECEIVED': {
      const contact = db.prepare('SELECT status FROM contacts WHERE id = ?').get(entityId);
      return contact?.status !== 'REPLIED';
    }
    case 'REPLY_RECEIVED': {
      const contact = db.prepare('SELECT status FROM contacts WHERE id = ?').get(entityId);
      return contact?.status === 'REPLIED';
    }
    case 'LEAD_SCORE': {
      const company = db.prepare('SELECT score FROM companies WHERE id = ?').get(entityId);
      return (company?.score ?? 0) >= config.threshold;
    }
    case 'PIPELINE_STAGE': {
      const row = db.prepare(`SELECT status FROM ${entityType}s WHERE id = ?`).get(entityId);
      return row?.status === config.stage;
    }
    default:
      return false;
  }
}
```

### 4.5 Sequence Execution State Machine

```
PENDING (initial, created by trigger)
  ↓
RUNNING (job dispatched, step executing)
  ↓
WAITING (WAIT step encountered, nextExecutionAt set)
  ↓
RUNNING (resumed from WAIT)
  ↓
COMPLETED (all steps done OR FINISH_SEQUENCE step)

RUNNING → FAILED (step throws unrecoverable error)
RUNNING → CANCELLED (user or system cancellation)
WAITING → CANCELLED (user cancels while waiting)
```

---

## 5. Event-to-Trigger Mapping

```typescript
const TRIGGER_MAP: Record<string, AutomationTriggerType> = {
  // EventBus event          → AutomationTriggerType
  'crm:created:company': AutomationTriggerType.COMPANY_CREATED,
  'crm:created:contact': AutomationTriggerType.CONTACT_CREATED,
  'crm:updated:contact': AutomationTriggerType.PIPELINE_STAGE_CHANGED, // if status changed
  'job:completed:scraper': AutomationTriggerType.DISCOVERY_IMPORT_COMPLETED,
  'outreach:email:sent': AutomationTriggerType.EMAIL_SENT,
  'outreach:email:replied': AutomationTriggerType.EMAIL_REPLIED,
  'outreach:email:bounced': AutomationTriggerType.EMAIL_BOUNCED
};
```

The `AutomationTriggerEvaluator` subscribes to these events and dispatches automation jobs accordingly. This is the **only** integration point between the scraping/CRM layer and the automation layer.

---

## 6. Example: Full Automation Execution

```
[Event] crm:created:company { companyId: 'abc123' }
  ↓
[AutomationTriggerEvaluator] Finds Sequence "New Company → Enrich → Score → Email"
  ↓
[JobScheduler] Queues: { type: 'automation:workflow', payload: { sequenceId, entityId: 'abc123' } }
  ↓
[Worker: AutomationWorkflowPlugin]
  Step 1: SCRAPE_WEBSITE → queues { type: 'crawler:website', payload: { companyId: 'abc123' } }
           waits for completion
  Step 2: CONDITION { type: 'HAS_CONTACTS' } → evaluate against SQLite → true → continue
  Step 3: ENRICH_CONTACTS → queues { type: 'enrich:website', payload: { companyId: 'abc123' } }
           waits for completion
  Step 4: SCORE_COMPANY → inline scoring logic or sub-job
  Step 5: CONDITION { type: 'LEAD_SCORE', threshold: 60 } → evaluate → true → continue
  Step 6: START_SEQUENCE { sequenceId: 'outreach-seq-1' } → queue automation:workflow for outreach

[Outreach Sequence Worker]
  Step 1: SEND_EMAIL { templateId: 'intro-email' } → SMTP dispatch
  Step 2: WAIT { delaySeconds: 259200 } → mark waiting, nextExecutionAt = +3 days

[3 days later — scheduler tick]
  Step 3: CONDITION { type: 'NO_REPLY_RECEIVED' } → true → continue
  Step 4: SEND_EMAIL { templateId: 'followup-email' }
  Step 5: WAIT { delaySeconds: 172800 } → +2 days
  Step 6: FINISH_SEQUENCE
```
