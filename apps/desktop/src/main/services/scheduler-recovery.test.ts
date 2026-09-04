import { describe, it, expect } from 'vitest';
import { randomUUID } from 'crypto';

interface SequenceExecutionRow {
  id: string;
  workspaceId: string;
  sequenceId: string;
  contactId: string;
  campaignId: string;
  currentStep: number;
  status: string;
  nextExecutionAt: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

class InMemoryExecutionStore {
  private rows: Map<string, SequenceExecutionRow> = new Map();

  public insert(row: SequenceExecutionRow) {
    this.rows.set(row.id, { ...row });
  }

  public findDueWaiting(workspaceId: string, limit = 20): SequenceExecutionRow[] {
    const nowIso = new Date().toISOString();
    const results: SequenceExecutionRow[] = [];

    for (const row of this.rows.values()) {
      if (
        row.workspaceId === workspaceId &&
        row.status.toUpperCase() === 'WAITING' &&
        row.nextExecutionAt &&
        row.nextExecutionAt <= nowIso &&
        !row.deletedAt
      ) {
        results.push({ ...row });
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  public atomicClaim(id: string): { changes: number } {
    const row = this.rows.get(id);
    if (!row || row.status.toUpperCase() !== 'WAITING') {
      return { changes: 0 };
    }
    row.status = 'RUNNING';
    row.updatedAt = new Date().toISOString();
    this.rows.set(id, row);
    return { changes: 1 };
  }

  public get(id: string): SequenceExecutionRow | undefined {
    return this.rows.get(id);
  }
}

describe('Scheduler WAITING Execution Recovery (Invariants 11 & 12)', () => {
  it('correctly identifies only due WAITING executions (Invariant 11)', () => {
    const store = new InMemoryExecutionStore();
    const workspaceId = randomUUID();

    const execDueId = randomUUID();
    const execFutureId = randomUUID();

    const pastDate = new Date(Date.now() - 10_000).toISOString();
    const futureDate = new Date(Date.now() + 300_000).toISOString();

    store.insert({
      id: execDueId,
      workspaceId,
      sequenceId: 'seq-1',
      contactId: 'contact-1',
      campaignId: 'camp-1',
      currentStep: 0,
      status: 'WAITING',
      nextExecutionAt: pastDate,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    store.insert({
      id: execFutureId,
      workspaceId,
      sequenceId: 'seq-2',
      contactId: 'contact-2',
      campaignId: 'camp-1',
      currentStep: 0,
      status: 'WAITING',
      nextExecutionAt: futureDate,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const dueExecutions = store.findDueWaiting(workspaceId);
    expect(dueExecutions.length).toBe(1);
    expect(dueExecutions[0]?.id).toBe(execDueId);
  });

  it('performs atomic claim compare-and-swap preventing double recovery (Invariant 12)', () => {
    const store = new InMemoryExecutionStore();
    const workspaceId = randomUUID();
    const execDueId = randomUUID();
    const pastDate = new Date(Date.now() - 10_000).toISOString();

    store.insert({
      id: execDueId,
      workspaceId,
      sequenceId: 'seq-1',
      contactId: 'contact-1',
      campaignId: 'camp-1',
      currentStep: 0,
      status: 'WAITING',
      nextExecutionAt: pastDate,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Worker 1 claims:
    const claimResult1 = store.atomicClaim(execDueId);
    expect(claimResult1.changes).toBe(1);

    // Worker 2 attempts concurrent claim on same execution:
    const claimResult2 = store.atomicClaim(execDueId);
    expect(claimResult2.changes).toBe(0);

    // Confirm execution status is now RUNNING:
    const finalRow = store.get(execDueId);
    expect(finalRow?.status).toBe('RUNNING');
  });
});
