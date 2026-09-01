import assert from 'assert';
import { SchedulerGatewayImpl } from './scheduler-gateway';
import type { ExecutionContext } from '@leadforge/agent-core';
import { WorkspaceManager } from '../../lib/workspace-manager';

const mockSdk = {
  jobs: {
    create: async (_payload: any) => ({ id: 'job-test' }),
    cancel: async (_jobId: string) => ({ success: true }),
    get: async (_id: string) => ({ status: 'running' })
  }
} as any;
WorkspaceManager.setSdk(mockSdk);

console.log('\n── SchedulerGateway Mock Unit Tests ──');

// Mock SQLite Database
class MockDatabase {
  public queries: string[] = [];
  public runArgs: any[] = [];

  public prepare(sql: string) {
    this.queries.push(sql);
    return {
      run: (...args: any[]) => {
        this.runArgs.push(args);
        return { changes: 1 };
      },
      get: (...args: any[]) => {
        return { status: 'running' };
      }
    };
  }
}

// Mock LocalEventBus
class MockEventBus {
  private listeners: Map<string, Array<(event: any) => void>> = new Map();

  public subscribe(type: string, listener: (event: any) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
    return () => {
      const idx = this.listeners.get(type)!.indexOf(listener);
      if (idx !== -1) {
        this.listeners.get(type)!.splice(idx, 1);
      }
    };
  }

  public publish(type: string, payload: any) {
    const list = this.listeners.get(type) || [];
    for (const listener of list) {
      listener({ type, payload });
    }
  }
}

const mockContext: ExecutionContext = {
  workspaceId: 'ws-test',
  executionId: 'exec-test',
  traceId: 'trace-test',
  jobId: 'job-test',
  actorId: 'user-test',
  actorType: 'user',
  requestedBy: 'test-suite',
  permissions: [],
  executionMode: 'offline'
};

// 1. Test submit
{
  const db = new MockDatabase() as any;
  const bus = new MockEventBus();
  const gateway = new SchedulerGatewayImpl(db, bus as any);

  gateway
    .submit('scraper:maps', { query: 'test' }, mockContext)
    .then((jobId) => {
      assert.strictEqual(jobId, 'job-test', 'Job ID should match context');
      console.log('  ✅ Gateway submit method check passed.');
    })
    .catch((err) => {
      assert.fail(`Submit check failed: ${err.message}`);
    });
}

// 2. Test submitAndAwait success
{
  const db = new MockDatabase() as any;
  const bus = new MockEventBus();
  const gateway = new SchedulerGatewayImpl(db, bus as any);

  const execPromise = gateway.submitAndAwait('scraper:maps', { query: 'test' }, mockContext);

  // Simulate scheduler completing the job
  setTimeout(() => {
    bus.publish('job:completed', { jobId: 'job-test', result: { success: true, count: 5 } });
  }, 10);

  execPromise
    .then((result) => {
      assert.strictEqual(result.success, true, 'Result should be success');
      assert.strictEqual(result.metadata.jobId, 'job-test', 'Job ID should match context');
      assert.ok(result.metadata.durationMs >= 10, 'Duration should reflect wait time');
      console.log('  ✅ Gateway success await check passed.');
    })
    .catch((err) => {
      assert.fail(`Success await check failed: ${err.message}`);
    });
}

// 3. Test submitAndAwait failure
{
  const db = new MockDatabase() as any;
  const bus = new MockEventBus();
  const gateway = new SchedulerGatewayImpl(db, bus as any);

  const execPromise = gateway.submitAndAwait('scraper:maps', { query: 'test' }, mockContext);

  setTimeout(() => {
    bus.publish('job:failed', { jobId: 'job-test', error: 'Failed intentionally' });
  }, 10);

  execPromise
    .then((result) => {
      assert.strictEqual(result.success, false, 'Result should fail');
      assert.strictEqual(result.error?.code, 'WORKER_ERROR', 'Error code should be WORKER_ERROR');
      assert.strictEqual(
        result.error?.message,
        'Failed intentionally',
        'Error message should match published error'
      );
      console.log('  ✅ Gateway failure await check passed.');
    })
    .catch((err) => {
      assert.fail(`Failure await check failed: ${err.message}`);
    });
}

// 4. Test cancellation
{
  const db = new MockDatabase() as any;
  const bus = new MockEventBus();
  const gateway = new SchedulerGatewayImpl(db, bus as any);

  const controller = new AbortController();
  const execPromise = gateway.submitAndAwait(
    'scraper:maps',
    { query: 'test' },
    {
      ...mockContext,
      abortSignal: controller.signal
    }
  );

  setTimeout(() => {
    controller.abort();
  }, 10);

  execPromise
    .then((result) => {
      assert.strictEqual(result.success, false, 'Result should fail on cancel');
      assert.strictEqual(
        result.error?.code,
        'CANCELLED_BY_USER',
        'Error code should be CANCELLED_BY_USER'
      );
      console.log('  ✅ Gateway cancellation check passed.');
    })
    .catch((err) => {
      assert.fail(`Cancellation check failed: ${err.message}`);
    });
}

// 5. Test status query
{
  const db = new MockDatabase() as any;
  const bus = new MockEventBus();
  const gateway = new SchedulerGatewayImpl(db, bus as any);

  gateway
    .status('job-test', 'ws-test')
    .then((status) => {
      assert.strictEqual(status, 'running', 'Status should be running');
      console.log('  ✅ Gateway status query check passed.');
    })
    .catch((err) => {
      assert.fail(`Status query check failed: ${err.message}`);
    });
}
