# LeadForge OS — Job Lifecycle Specification

> **Document Type**: Architecture Specification  
> **Phase**: 8 — Local Worker Runtime Audit  
> **Status**: Pre-Implementation Blueprint

---

## 1. Complete Job State Machine

### 1.1 State Diagram

```
                          ┌─────────┐
                          │ PENDING │  (pre-queue, optional)
                          └────┬────┘
                               │ enqueueJob()
                               ▼
                          ┌────────┐
                          │ QUEUED │  ← retrying (after failure, before retry delay)
                          └────┬───┘
                               │ scheduler.tick() dispatches
                               ▼
                        ┌──────────┐
                        │ STARTING │  (fork in progress, not yet executing)
                        └─────┬────┘
                              │ worker sends 'ready'
                              ▼
        ┌──────────────────►RUNNING◄──────────────────┐
        │               └─────┬──────┘                │
        │                     │                       │
   PAUSED ◄─────pause──────── │ ──────resume──────► RUNNING
        │                     │                       │
        │                 WAITING ◄──WAIT step         │
        │                (nextExecutionAt set)         │
        │                     │                        │
        │                 scheduler tick               │
        │                (when timer fires)            │
        │                     └─────────────────────► RUNNING
        │                     │
        │           ┌──────────┴───────────┐
        │           │                      │
        │      COMPLETED                 FAILED ──────retryable?──► RETRYING
        │      (success)              (error)              │               │
        │                                                 no              │ delay elapsed
        │                                                 ▼               ▼
        │                                              FAILED          QUEUED
        │
        │
   CANCELLED (from any active state: QUEUED / STARTING / RUNNING / WAITING / PAUSED)
        │
        ▼
   [ARCHIVED] (after N days, moved to job_archive table — future)
```

### 1.2 State Definitions

| State | Description | Who Sets It |
|---|---|---|
| `pending` | Pre-queued, waiting for pre-conditions (future) | Application logic |
| `queued` | In queue, waiting for scheduler to dispatch | `scheduler:jobs:submit` IPC, job completion chaining |
| `starting` | Worker process forked, not yet executing | Scheduler (on fork) |
| `running` | Worker actively executing plugin | Worker 'ready' + scheduler |
| `waiting` | Paused on WAIT step, resuming at `nextExecutionAt` | Worker / sequence engine |
| `paused` | User-paused, indefinite hold | User action via IPC |
| `retrying` | Failed, scheduled for automatic retry | `handleJobFailure()` |
| `completed` | Finished successfully | `handleJobSuccess()` |
| `failed` | Failed, exhausted retries | `handleJobFailure()` |
| `cancelled` | Explicitly cancelled by user or system | `cancelJob()` |
| `interrupted` | Terminated by app shutdown mid-run | `scheduler.stop()` |

### 1.3 Valid State Transitions

```typescript
const VALID_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  pending:     ['queued', 'cancelled'],
  queued:      ['starting', 'cancelled'],
  starting:    ['running', 'failed', 'cancelled'],
  running:     ['completed', 'failed', 'waiting', 'paused', 'cancelled'],
  waiting:     ['running', 'cancelled'],   // running = resumed
  paused:      ['running', 'cancelled'],   // running = resumed
  retrying:    ['queued'],                 // queued = will be picked up next tick
  completed:   [],                         // terminal
  failed:      [],                         // terminal
  cancelled:   [],                         // terminal
  interrupted: ['queued'],                 // can be re-queued after restart
};

function assertValidTransition(from: JobStatus, to: JobStatus): void {
  if (!VALID_TRANSITIONS[from]?.includes(to)) {
    throw new Error(`Invalid job state transition: ${from} → ${to}`);
  }
}
```

---

## 2. Scheduler Tick Algorithm (Complete)

```typescript
private async tick(): Promise<void> {
  try {
    // ─── 1. Dispatch queued/retrying jobs ─────────────────────────────────
    if (this.activeWorkers.size < this.maxConcurrency) {
      const job = this.db.prepare(`
        SELECT * FROM jobs
        WHERE workspaceId = ? 
          AND status IN ('queued', 'retrying')
          AND (scheduledAt IS NULL OR scheduledAt <= datetime('now'))
        ORDER BY priority DESC, createdAt ASC
        LIMIT 1
      `).get(this.workspaceId) as JobPayload | undefined;

      if (job) {
        this.runJob(job);
      }
    }

    // ─── 2. Resume waiting sequence executions ────────────────────────────
    const dueExecutions = this.db.prepare(`
      SELECT id, sequenceId, currentStep, contactId, companyId
      FROM sequence_executions
      WHERE workspaceId = ? 
        AND status = 'waiting' 
        AND nextExecutionAt <= datetime('now')
      LIMIT 5
    `).all(this.workspaceId);

    for (const exec of dueExecutions) {
      // Check if a resume job is already queued
      const existing = this.db.prepare(`
        SELECT id FROM jobs
        WHERE workspaceId = ? AND type = 'automation:workflow'
          AND json_extract(payload, '$.executionId') = ?
          AND status IN ('queued','running','starting')
      `).get(this.workspaceId, exec.id);

      if (!existing) {
        this.db.prepare(`
          INSERT INTO jobs (id, workspaceId, type, status, priority, payload, maxRetries, createdAt, updatedAt)
          VALUES (?, ?, 'automation:workflow', 'queued', 4, ?, 1, datetime('now'), datetime('now'))
        `).run(uuid(), this.workspaceId, JSON.stringify({ executionId: exec.id, resumeFrom: exec.currentStep }));
      }
    }

    // ─── 3. Interrupted job recovery ──────────────────────────────────────
    // On startup, move interrupted jobs back to queued (configurable per type)
    // This is handled in WorkspaceRuntime.start() not in tick()

  } catch (err) {
    AppLogger.error('JobScheduler', 'Error in scheduler tick', this.workspaceId, err);
  }
}
```

---

## 3. Retry Strategy

### 3.1 Retry Configuration Per Job Type

```typescript
interface RetryConfig {
  maxRetries: number;
  backoffStrategy: 'linear' | 'exponential' | 'fixed';
  baseDelayMs: number;
  maxDelayMs: number;
  retryableErrors?: string[];  // only retry on these error patterns
}

const DEFAULT_RETRY_CONFIGS: Record<string, RetryConfig> = {
  'scraper:maps':       { maxRetries: 2, backoffStrategy: 'exponential', baseDelayMs: 30000, maxDelayMs: 300000 },
  'crawler:website':    { maxRetries: 3, backoffStrategy: 'exponential', baseDelayMs: 10000, maxDelayMs: 120000 },
  'enrich:website':     { maxRetries: 3, backoffStrategy: 'linear',      baseDelayMs: 5000,  maxDelayMs: 30000  },
  'outreach:campaign':  { maxRetries: 2, backoffStrategy: 'fixed',       baseDelayMs: 60000, maxDelayMs: 60000  },
  'automation:workflow':{ maxRetries: 1, backoffStrategy: 'fixed',       baseDelayMs: 5000,  maxDelayMs: 5000   },
  'mock:test':          { maxRetries: 3, backoffStrategy: 'linear',      baseDelayMs: 1000,  maxDelayMs: 5000   },
};
```

### 3.2 Backoff Calculation

```typescript
function calculateRetryDelay(attempt: number, config: RetryConfig): number {
  switch (config.backoffStrategy) {
    case 'exponential':
      return Math.min(config.baseDelayMs * Math.pow(2, attempt - 1), config.maxDelayMs);
    case 'linear':
      return Math.min(config.baseDelayMs * attempt, config.maxDelayMs);
    case 'fixed':
      return config.baseDelayMs;
  }
}
```

### 3.3 Retry Record

```sql
-- jobs table: scheduledAt field needed for delayed retry
ALTER TABLE jobs ADD COLUMN scheduledAt DATETIME;
```

```typescript
private handleJobFailure(jobId: string, retryCount: number, maxRetries: number, error: string): void {
  const nextRetry = retryCount + 1;
  
  if (nextRetry <= maxRetries) {
    const config = DEFAULT_RETRY_CONFIGS[job.type] || DEFAULT_RETRY_CONFIGS['mock:test'];
    const delayMs = calculateRetryDelay(nextRetry, config);
    const scheduledAt = new Date(Date.now() + delayMs).toISOString();
    
    this.db.prepare(`
      UPDATE jobs
      SET status = 'retrying', retryCount = ?, error = ?, 
          scheduledAt = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(nextRetry, error, scheduledAt, jobId);
    
    // Note: status stays 'retrying' until scheduledAt passes, then scheduler tick
    // changes it to 'queued' when it's picked up
  } else {
    this.db.prepare(`
      UPDATE jobs
      SET status = 'failed', error = ?, finishedAt = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(error, new Date().toISOString(), jobId);
  }
}
```

---

## 4. Pause / Resume Mechanism

### 4.1 Pause Protocol

```
User Action → IPC 'scheduler:jobs:pause' { workspaceId, jobId }
    │
    ├─ If job is RUNNING:
    │    Main sends { command: 'pause' } to worker process
    │    Worker: sets isPausedState = true
    │    Worker: at next checkpoint, calls ctx.saveCheckpoint(data)
    │    Worker: sends { type: 'paused', checkpoint: data }
    │    Worker: exits 0
    │    Main: UPDATE jobs SET status='paused', checkpointData=? WHERE id=?
    │
    └─ If job is QUEUED:
         UPDATE jobs SET status='paused' WHERE id=?
         (scheduler will skip paused jobs)
```

### 4.2 Checkpoint Persistence

```sql
ALTER TABLE jobs ADD COLUMN checkpointData TEXT;  -- JSON blob
ALTER TABLE jobs ADD COLUMN checkpointAt DATETIME;
```

```typescript
// In JobContext:
saveCheckpoint(data: any): void {
  process.send?.({ type: 'checkpoint', data });
}

// In worker-host.ts message handler:
case 'checkpoint':
  // Store checkpoint in main process (which writes to SQLite)
  process.send?.({ type: 'checkpoint', data: msg.data });
  break;

// In scheduler.ts message handler:
case 'checkpoint':
  this.db.prepare(`
    UPDATE jobs SET checkpointData = ?, checkpointAt = CURRENT_TIMESTAMP WHERE id = ?
  `).run(JSON.stringify(msg.data), job.id);
  break;
```

### 4.3 Resume Protocol

```
User Action → IPC 'scheduler:jobs:resume' { workspaceId, jobId }
    │
    └─ UPDATE jobs SET status='queued' WHERE id = ? AND status='paused'
       (scheduler tick picks it up, forks worker, passes checkpointData in payload)
       
// In scheduler.ts runJob():
const checkpoint = job.checkpointData ? JSON.parse(job.checkpointData) : null;
worker.send({
  command: 'start',
  jobId: job.id,
  workspaceId: this.workspaceId,
  type: job.type,
  payload: { ...JSON.parse(job.payload), _checkpoint: checkpoint },
});

// In plugin (e.g., AutomationWorkflowPlugin):
const resumeFrom = ctx.getCheckpoint()?.currentStep ?? 0;
let currentStep = resumeFrom;  // start from saved checkpoint
```

---

## 5. Cancellation Protocol

### 5.1 Soft Cancel (Preferred)

```
IPC: 'scheduler:jobs:cancel' { workspaceId, jobId }
    │
    ├─ If RUNNING: 
    │    Main sends { command: 'cancel' } via process.send (NOT kill signal)
    │    Worker: sets isCancelledState = true
    │    Worker: plugin checks ctx.isCancelled() at each iteration boundary
    │    Worker: performs cleanup (db.close(), context.close())
    │    Worker: sends { type: 'cancelled', cleanedUp: true }
    │    Worker: exits 0
    │    Main: UPDATE jobs SET status='cancelled', finishedAt=? WHERE id=?
    │
    ├─ If QUEUED or PAUSED:
    │    UPDATE jobs SET status='cancelled', finishedAt=? WHERE id=?
    │
    └─ If WAITING (sequence):
         UPDATE jobs SET status='cancelled' WHERE id=?
         UPDATE sequence_executions SET status='cancelled' WHERE id=?
```

### 5.2 Hard Kill Fallback

If the worker does not respond to soft cancel within `cancelTimeoutMs` (default: 15s):

```typescript
const softCancelTimeout = setTimeout(() => {
  AppLogger.warn('JobScheduler', `Force-killing unresponsive worker for job ${jobId}`);
  worker.kill('SIGKILL');
  this.db.prepare(`UPDATE jobs SET status='cancelled', error='Force-killed: did not respond to cancel' WHERE id=?`)
    .run(jobId);
}, this.config.cancelTimeoutMs);

// Clear timeout if worker sends 'cancelled' message
worker.on('message', (msg) => {
  if (msg.type === 'cancelled') clearTimeout(softCancelTimeout);
});
```

---

## 6. Recovery After App Restart

```typescript
// In WorkspaceRuntime.start():
private async recoverInterruptedJobs(): Promise<void> {
  // 1. Mark all 'running' and 'starting' jobs as 'interrupted'
  this.sqliteDb.prepare(`
    UPDATE jobs 
    SET status = 'interrupted', error = 'App restarted during execution', updatedAt = CURRENT_TIMESTAMP
    WHERE workspaceId = ? AND status IN ('running', 'starting')
  `).run(this.workspaceId);

  // 2. Re-queue interrupted jobs that are auto-recoverable
  const AUTO_RECOVERABLE = ['scraper:maps', 'crawler:website', 'enrich:website', 'automation:workflow'];
  this.sqliteDb.prepare(`
    UPDATE jobs 
    SET status = 'queued', error = NULL, updatedAt = CURRENT_TIMESTAMP
    WHERE workspaceId = ? AND status = 'interrupted' AND type IN (${AUTO_RECOVERABLE.map(() => '?').join(',')})
  `).run(this.workspaceId, ...AUTO_RECOVERABLE);

  // 3. Resume overdue waiting sequence executions
  const overdueExecutions = this.sqliteDb.prepare(`
    SELECT id, currentStep FROM sequence_executions
    WHERE workspaceId = ? AND status = 'waiting' AND nextExecutionAt <= datetime('now')
  `).all(this.workspaceId);

  for (const exec of overdueExecutions) {
    this.sqliteDb.prepare(`
      INSERT INTO jobs (id, workspaceId, type, status, priority, payload, maxRetries, createdAt, updatedAt)
      VALUES (?, ?, 'automation:workflow', 'queued', 4, ?, 1, datetime('now'), datetime('now'))
    `).run(uuid(), this.workspaceId, JSON.stringify({ executionId: exec.id, resumeFrom: exec.currentStep }));
  }

  AppLogger.info('JobScheduler', 'Job recovery complete after app restart', this.workspaceId);
}
```

---

## 7. Scheduled / Delayed Job Submission

For future recurring jobs (cron-like behavior):

```typescript
interface JobSubmissionParams {
  workspaceId: string;
  type: string;
  payload: any;
  priority?: number;
  maxRetries?: number;
  scheduledAt?: string;      // ISO datetime — delay before first execution
  cronExpression?: string;   // FUTURE: recurring jobs
  idempotencyKey?: string;   // prevent duplicate submissions
}

// IPC handler:
safeRegister('scheduler:jobs:submit', async (_event, params) => {
  // Idempotency check
  if (params.idempotencyKey) {
    const existing = db.prepare(`
      SELECT id FROM jobs WHERE workspaceId = ? 
      AND json_extract(payload, '$.idempotencyKey') = ?
      AND status NOT IN ('failed','cancelled','completed')
    `).get(workspaceId, params.idempotencyKey);
    if (existing) return existing;
  }

  const jobId = params.id || uuid();
  db.prepare(`
    INSERT INTO jobs (id, workspaceId, type, status, priority, payload, maxRetries, scheduledAt, createdAt, updatedAt)
    VALUES (?, ?, ?, 'queued', ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(jobId, workspaceId, type, priority, JSON.stringify(payload), maxRetries, scheduledAt || null);

  return { id: jobId, status: 'queued' };
});
```

---

## 8. Missing Schema Fields (Required)

```sql
-- Add to jobs table via migration 008:
ALTER TABLE jobs ADD COLUMN scheduledAt DATETIME;
ALTER TABLE jobs ADD COLUMN checkpointData TEXT;
ALTER TABLE jobs ADD COLUMN checkpointAt DATETIME;
ALTER TABLE jobs ADD COLUMN idempotencyKey TEXT;
ALTER TABLE jobs ADD COLUMN durationMs INTEGER;      -- filled on completion

-- Add index for scheduled jobs
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled ON jobs(workspaceId, status, scheduledAt);

-- Add to sequence_executions:
ALTER TABLE sequence_executions ADD COLUMN cancelledAt DATETIME;
ALTER TABLE sequence_executions ADD COLUMN cancelReason TEXT;
ALTER TABLE sequence_executions ADD COLUMN parentJobId TEXT;  -- the job that ran this execution
```
