# LeadForge OS — Job System & Automation Lock Implementation Plan

## 1. Executive Summary & Infrastructure Constraints

In the legacy local-first architecture:
1. Background jobs were stored and scheduled exclusively within the local SQLite `jobs` table in `scheduler.ts`.
2. Automation concurrency control relied on the local SQLite `automation_locks` table.

### Target Architecture Mandates:
- **Zero Redis Dependency:** Because the application is deployed on Vercel with MongoDB Atlas free-tier constraints, we strictly avoid introducing Redis, Redlock, or long-lived server-side daemon processes.
- **Authoritative MongoDB State:** All job scheduling, state transitions, progress checkpoints, and concurrency locks are persisted authoritatively in MongoDB collections (`jobs` and `automationlocks`).
- **Local Distributed Workers:** Worker execution remains on local machines, polling and updating MongoDB state via `SdkClient`.

---

## 2. Distributed Job System Architecture

### 2.1 State Machine
The target job lifecycle supports 11 definitive states (inherited from forensic migration `008`):

```text
               ┌──────────┐
               │ pending  │
               └────┬─────┘
                    │ (Scheduled / Dispatched)
                    ▼
               ┌──────────┐
        ┌─────►│  queued  │◄──────────────────┐
        │      └────┬─────┘                   │
        │           │ (Worker claims)         │
        │           ▼                         │
        │      ┌──────────┐                   │ (Retry counter < maxRetries)
        │      │ starting │                   │
        │      └────┬─────┘                   │
        │           │ (Heartbeat handshake)   │
        │           ▼                         │
        │      ┌──────────┐                   │
        ├──────┤ running  ├──────┐            │
        │      └────┬─────┘      │            │
 (Resume)           │            ▼ (Pause)    │
        │           │       ┌──────────┐      │
        │           │       │  paused  │      │
        │           │       └──────────┘      │
        │           ├─────────────────────────┼──────────────┐
        │           │ (Success)               │ (Error)      │ (Worker stall / crash)
        │           ▼                         ▼              ▼
        │      ┌───────────┐             ┌──────────┐   ┌─────────────┐
        │      │ completed │             │ retrying ├──►│ interrupted │
        │      └───────────┘             └────┬─────┘   └─────────────┘
        │                                     │
        │                                     ▼ (Retries exhausted)
        │                                ┌──────────┐
        └────────────────────────────────┤  failed  │
                                         └──────────┘
```

---

### 2.2 Worker Claiming & Race-Condition Prevention
When multiple desktop worker processes or local worker threads poll for available jobs, race conditions are prevented using MongoDB's atomic `findOneAndUpdate` with lease ownership:

```typescript
// apps/api/src/repositories/job.repository.ts
export async function claimNextJob(
  workspaceId: string,
  workerId: string,
  supportedTypes: string[]
): Promise<JobDocument | null> {
  const now = new Date();

  return await JobModel.findOneAndUpdate(
    {
      workspaceId,
      status: { $in: ['queued', 'retrying'] },
      type: { $in: supportedTypes },
      $or: [
        { scheduledAt: null },
        { scheduledAt: { $lte: now } }
      ]
    },
    {
      $set: {
        status: 'starting',
        workerId: workerId,
        startedAt: now,
        updatedAt: now
      }
    },
    {
      sort: { priority: -1, createdAt: 1 },
      new: true
    }
  );
}
```

#### Why This Guarantees Safe Worker Assignment:
MongoDB executes `findOneAndUpdate` as an atomic operation on the matching document. Exactly one worker thread will match and update the document; all other competing threads receive null or the next queued item in sequence.

---

### 2.3 Checkpointing & Crash Recovery
- **Worker Checkpoint:** Long-running jobs emit progress checkpoints via `PUT /api/v1/jobs/:id/checkpoint` at regular intervals (minimum 5s, maximum 10s or 10% progress increments).
- **Stale Worker Recovery:** If a worker crashes or loses network connectivity:
  - The API periodically identifies jobs in `running` or `starting` state whose `updatedAt` is older than `STALE_JOB_THRESHOLD` (3 minutes).
  - If `retryCount < maxRetries`, the job is marked `retrying` and `retryCount` is incremented.
  - If `retryCount >= maxRetries`, the job is marked `failed` with error `"Worker execution interrupted / heartbeat timed out."`.

---

## 3. Distributed Automation Locks (Without Redis)

### 3.1 Lock Key Specification
Every concurrency lock is scoped by workspace, sequence, and target entity (contact or company):
```text
LockKey = `${workspaceId}:${sequenceId}:${entityId}`
```
Example:
```text
"ws_12345:seq_welcome_drip:contact_98765"
```

---

### 3.2 Lock Acquisition Contract
Lock acquisition utilizes MongoDB's atomic conditional update with upsert semantics:

```typescript
// apps/api/src/services/lock.service.ts
export async function acquireLock(
  workspaceId: string,
  sequenceId: string,
  entityId: string,
  ownerId: string,
  leaseDurationMs: number = 60000
): Promise<{ acquired: boolean; expiresAt: Date }> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + leaseDurationMs);
  const lockKey = `${workspaceId}:${sequenceId}:${entityId}`;

  try {
    const lock = await AutomationLockModel.findOneAndUpdate(
      {
        _id: lockKey,
        $or: [
          { expiresAt: { $lt: now } }, // Previous lease expired (stale lock recovery)
          { ownerId: ownerId }        // Re-entrant lock by same owner
        ]
      },
      {
        $setOnInsert: {
          workspaceId,
          sequenceId,
          entityId
        },
        $set: {
          ownerId,
          lockedAt: now,
          expiresAt
        }
      },
      {
        upsert: true,
        new: true,
        runValidators: true
      }
    );

    return { acquired: true, expiresAt: lock.expiresAt };
  } catch (error: any) {
    // E11000 duplicate key error indicates another worker acquired the lock simultaneously
    if (error.code === 11000) {
      return { acquired: false, expiresAt: now };
    }
    throw error;
  }
}
```

### 3.3 Strict Concurrency Proof: How Two Workers Cannot Both Acquire
1. **Scenario 1: Lock Does Not Exist**
   - Both Worker A and Worker B attempt to upsert on `_id: lockKey`.
   - The unique index on `_id` ensures that MongoDB only allows ONE upsert to succeed. The second worker receives an E11000 Duplicate Key exception and fails gracefully (`acquired: false`).
2. **Scenario 2: Lock Exists and is Active (`expiresAt > now`)**
   - The query filter requires `expiresAt: { $lt: now }` or `ownerId: currentWorker`.
   - Since neither condition matches, neither worker can update the document.
3. **Scenario 3: Lock Exists but is Stale (`expiresAt < now`)**
   - Both workers detect that the lock has expired.
   - Both attempt `findOneAndUpdate`.
   - MongoDB serializes the document update. The first worker updates `expiresAt` to a future timestamp. The second worker's query condition `expiresAt < now` now fails, and it receives null (`acquired: false`).

---

### 3.4 Lock Renewal & Release

#### Lock Renewal (Heartbeat)
While executing multi-minute workflow steps, the worker extends the lease every 30 seconds:
```typescript
await AutomationLockModel.updateOne(
  { _id: lockKey, ownerId },
  { $set: { expiresAt: new Date(Date.now() + leaseDurationMs) } }
);
```

#### Lock Release
Upon step completion or fatal failure, the worker releases the lock immediately:
```typescript
await AutomationLockModel.deleteOne({ _id: lockKey, ownerId });
```

#### Automatic Stale Cleanup (TTL)
Even if a worker process is abruptly killed (`SIGKILL` or power outage), the MongoDB TTL index on `expiresAt` automatically purges the lock document when it reaches expiration:
```typescript
automationLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

---

## 4. Implementation & Verification Status

- **Status:** COMPLETE & FORMALLY VERIFIED (Phases 8, 9 & 10)
- **Authoritative Reports:**
  - Phase 8: [`46-phase8-job-runtime-report.md`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/docs/architecture-migration/46-phase8-job-runtime-report.md)
  - Phase 9: [`47-phase9-google-integration-report.md`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/docs/architecture-migration/47-phase9-google-integration-report.md)
  - Phase 10: [`48-phase10-gmail-delivery-report.md`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/docs/architecture-migration/48-phase10-gmail-delivery-report.md)
- **Verification Suites:**
  - [`scripts/verify-phase8.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/scripts/verify-phase8.ts) (18/18 tests passed)
  - [`scripts/verify-phase9.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/scripts/verify-phase9.ts) (27/27 tests passed)
  - [`scripts/verify-phase10.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/scripts/verify-phase10.ts) (27/27 tests passed)
- **Key Deliverables Completed:**
  - Strict authoritative 11-state job state machine enforced in `JobRepository.transitionStatus`.
  - High-concurrency atomic claiming via `sdk.jobs.claim()` tested with 20 concurrent contenders.
  - Periodic heartbeats extending `leaseExpiresAt` via `sdk.jobs.heartbeat()`.
  - Durable progress checkpoints and execution metadata saved via `sdk.jobs.checkpoint()`.
  - Stale lease recovery with exponential retry backoff via `sdk.jobs.recover()`.
  - Desktop `JobScheduler` completely refactored with 0 SQLite queries, 0 SQLite imports, and 0 `sync_queue` writes.
  - Zero-Redis distributed locking via MongoDB `automationlocks` collection with TTL indexing.
  - Hardened outbound delivery pipeline with atomic reservations, MIME RFC 2822/2047 construction, 25 MB guards, and ambiguous-send reconciliation in Phase 10.

