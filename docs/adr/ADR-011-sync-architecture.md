# ADR-011: Synchronization Architecture

## Status

Proposed

## Context

Replicating state between local SQLite files and a cloud MongoDB Atlas cluster requires change tracking, backoff retries, and conflict resolution, while ensuring that the synchronization operations do not interfere with local app performance or block user workflows.

## Decision

We define the following rules for the Sync Engine:

1. **Asynchronous Outbox**: Updates write to a local `sync_outbox` table in SQLite. The Sync Engine polls this queue, batching changes into compressed payloads.
2. **Conflict Resolution**: Resolves conflicts using Last-Write-Wins (LWW) based on timestamps and version counters.
3. **Delete Tombstones**: Deletions write a `deletedAt` tombstone instead of deleting database rows. Tombstones sync to the cloud and propagate to other clients, with garbage sweeps purging expired tombstones after 30 days.
4. **Strict Isolation**: The Sync Engine must NEVER execute AI prompts, run planners, call tools, or execute business sequence logic.

## Alternatives Considered

- **Real-time Dual Writes**: Write to SQLite and MongoDB synchronously in the same transaction.
  - _Tradeoffs_: Network lag blocks local UI writes; offline states result in application halts.

## Tradeoffs

- **Pros**:
  - **Zero UI Blocking**: Asynchronous outbox queues run in the background.
  - **Network Resilience**: Handles network drops gracefully using exponential backoffs.
- **Cons**:
  - Final consistency is delayed by the duration of the queue poll/push cycle.

## Consequences

- We implement change-tracking triggers in SQLite schemas.
- The Sync Engine remains an isolated main-process service.
