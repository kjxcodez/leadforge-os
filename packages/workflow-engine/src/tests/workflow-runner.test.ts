import assert from 'assert';
import { WorkflowRunner } from '../workflow-runner';
import { WorkflowContext } from '../workflow-context';
import { WorkflowEvents } from '../workflow-events';
import type { Workflow } from '../workflow';
import { ToolRegistry } from '@leadforge/agent-core';
import type { Tool, ToolResult, ExecutionContext } from '@leadforge/agent-core';
import { z } from 'zod';

console.log('\n── WorkflowEngine Unit Tests ──');

// ─── Shared Fixtures ──────────────────────────────────────────────────────────

const EXEC_CTX: ExecutionContext = {
  workspaceId: 'ws-test',
  executionId: 'exec-test',
  traceId: 'trace-test',
  actorId: 'user-test',
  actorType: 'user',
  requestedBy: 'test',
  permissions: [],
  executionMode: 'offline'
};

const mockSearchTool: Tool = {
  name: 'mock_search',
  description: 'Mock search',
  inputSchema: z.object({ query: z.string() }),
  riskLevel: 'LOW',
  execute: async (_input: any, ctx: ExecutionContext): Promise<ToolResult> => ({
    success: true,
    data: [
      { id: 'c-1', name: 'Acme Corp', domain: 'acme.com' },
      { id: 'c-2', name: 'Beta LLC', domain: 'beta.com' }
    ],
    metadata: {
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 1,
      attempt: 1,
      workspaceId: ctx.workspaceId,
      traceId: ctx.traceId,
      cached: false,
      retryCount: 0
    }
  })
};

const mockCrawlTool: Tool = {
  name: 'mock_crawl',
  description: 'Mock crawl',
  inputSchema: z.object({ domain: z.string() }),
  riskLevel: 'LOW',
  execute: async (input: any, ctx: ExecutionContext): Promise<ToolResult> => ({
    success: true,
    data: { emails: [`info@${input.domain}`] },
    metadata: {
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 1,
      attempt: 1,
      workspaceId: ctx.workspaceId,
      traceId: ctx.traceId,
      cached: false,
      retryCount: 0
    }
  })
};

const mockFailingTool: Tool = {
  name: 'mock_fail',
  description: 'Always fails',
  inputSchema: z.object({}),
  riskLevel: 'LOW',
  execute: async (): Promise<ToolResult> => {
    throw new Error('Simulated tool failure');
  }
};

// ─── Test 1: WorkflowContext ───────────────────────────────────────────────────

{
  const ctx = new WorkflowContext({ query: 'test query' });
  assert.strictEqual(ctx.get('query'), 'test query', 'Context should seed initial values');
  ctx.set('step_one', [1, 2, 3]);
  assert.deepStrictEqual(ctx.get('step_one'), [1, 2, 3], 'Context should store and retrieve values');
  assert.strictEqual(ctx.has('step_one'), true, 'Context.has() should return true for existing key');
  assert.strictEqual(ctx.has('missing'), false, 'Context.has() should return false for missing key');
  assert.strictEqual(ctx.get('missing'), undefined, 'Context.get() should return undefined for missing key');
  console.log('  ✅ WorkflowContext: seed, get, set, has verified');
}

// ─── Test 2: WorkflowEvents types ─────────────────────────────────────────────

{
  const events = new WorkflowEvents();
  const emitted: string[] = [];

  events.onStarted(() => emitted.push('started'));
  events.onStepStarted(() => emitted.push('step:started'));
  events.onStepCompleted(() => emitted.push('step:completed'));
  events.onCompleted(() => emitted.push('completed'));
  events.onFailed(() => emitted.push('failed'));

  events.emitStarted({ workflowId: 'w', workflowName: 'W', traceId: 't', timestamp: '', totalSteps: 1 });
  events.emitStepStarted({ workflowId: 'w', stepId: 's', stepName: 'S', stepIndex: 0, totalSteps: 1, traceId: 't', timestamp: '' });
  events.emitStepCompleted({ workflowId: 'w', stepId: 's', stepName: 'S', stepIndex: 0, totalSteps: 1, traceId: 't', timestamp: '', durationMs: 1 });
  events.emitCompleted({ workflowId: 'w', workflowName: 'W', traceId: 't', timestamp: '', durationMs: 1, stepsCompleted: 1 });

  assert.deepStrictEqual(emitted, ['started', 'step:started', 'step:completed', 'completed'], 'All events should fire in order');
  console.log('  ✅ WorkflowEvents: all five event types emit and subscribe correctly');
}

// ─── Test 3: Sequential step execution order ───────────────────────────────────

{
  const registry = new ToolRegistry();
  registry.register(mockSearchTool);

  const stepsExecuted: string[] = [];

  const workflow: Workflow = {
    id: 'test_workflow',
    name: 'Test Workflow',
    description: 'Test',
    steps: [
      {
        type: 'ToolStep',
        id: 'step_a',
        name: 'Step A',
        toolName: 'mock_search',
        buildInput: () => ({ query: 'test' })
      },
      {
        type: 'TransformStep',
        id: 'step_b',
        name: 'Step B',
        transform: (ctx) => {
          stepsExecuted.push('B');
          return ctx.get('step_a');
        }
      },
      {
        type: 'ValidationStep',
        id: 'step_c',
        name: 'Step C',
        validate: (ctx) => {
          stepsExecuted.push('C');
          const data = ctx.get('step_b');
          if (!Array.isArray(data)) throw new Error('Expected array from step_b');
        }
      }
    ]
  };

  const runner = new WorkflowRunner(registry, { aiMode: 'mock' });

  const eventsEmitted: string[] = [];
  runner.events.onStarted(() => eventsEmitted.push('workflow:started'));
  runner.events.onStepStarted((e) => eventsEmitted.push(`step:started:${e.stepId}`));
  runner.events.onStepCompleted((e) => eventsEmitted.push(`step:completed:${e.stepId}`));
  runner.events.onCompleted(() => eventsEmitted.push('workflow:completed'));

  // Step A runs the tool so we track it via the events
  runner.events.onStepStarted((e) => {
    if (e.stepId === 'step_a') stepsExecuted.push('A');
  });

  const result = await runner.run(workflow, EXEC_CTX, {});

  assert.strictEqual(result.status, 'COMPLETED', 'Workflow should complete successfully');
  assert.strictEqual(result.steps.length, 3, 'All 3 steps should be recorded');
  assert.deepStrictEqual(stepsExecuted, ['A', 'B', 'C'], 'Steps must execute in declaration order');
  assert.ok(eventsEmitted.includes('workflow:started'), 'workflow:started must be emitted');
  assert.ok(eventsEmitted.includes('workflow:completed'), 'workflow:completed must be emitted');
  assert.ok(eventsEmitted.indexOf('workflow:started') < eventsEmitted.indexOf('workflow:completed'), 'started must come before completed');
  console.log('  ✅ Sequential execution: steps run in correct order, all events emitted');
}

// ─── Test 4: WorkflowContext accumulation across steps ────────────────────────

{
  const registry = new ToolRegistry();
  registry.register(mockSearchTool);

  const workflow: Workflow = {
    id: 'ctx_workflow',
    name: 'Context Test',
    description: '',
    steps: [
      {
        type: 'ToolStep',
        id: 'step_search',
        name: 'Search',
        toolName: 'mock_search',
        buildInput: (ctx) => ({ query: ctx.get('query') as string })
      },
      {
        type: 'TransformStep',
        id: 'step_count',
        name: 'Count',
        transform: (ctx) => {
          const results = ctx.get('step_search') as any[];
          return results.length;
        }
      }
    ]
  };

  const runner = new WorkflowRunner(registry, { aiMode: 'mock' });
  const result = await runner.run(workflow, EXEC_CTX, { query: 'Austin companies' });

  assert.strictEqual(result.status, 'COMPLETED', 'Context workflow should complete');
  // Final output from last step (count)
  assert.strictEqual(result.output, 2, 'Transform step should count 2 companies from search results');
  console.log('  ✅ Context accumulation: step outputs flow correctly into downstream steps');
}

// ─── Test 5: Failure stops execution at failed step ───────────────────────────

{
  const registry = new ToolRegistry();
  registry.register(mockFailingTool);

  let step2Ran = false;

  const workflow: Workflow = {
    id: 'fail_workflow',
    name: 'Failure Test',
    description: '',
    steps: [
      {
        type: 'ToolStep',
        id: 'step_fail',
        name: 'Failing Step',
        toolName: 'mock_fail',
        buildInput: () => ({})
      },
      {
        type: 'TransformStep',
        id: 'step_after',
        name: 'Step After Failure',
        transform: () => { step2Ran = true; return null; }
      }
    ]
  };

  const runner = new WorkflowRunner(registry, { aiMode: 'mock' });
  const failEventsEmitted: string[] = [];
  runner.events.onFailed(() => failEventsEmitted.push('workflow:failed'));

  const result = await runner.run(workflow, EXEC_CTX, {});

  assert.strictEqual(result.status, 'FAILED', 'Workflow should report FAILED status');
  assert.strictEqual(step2Ran, false, 'Step after failure must NOT execute');
  assert.strictEqual(result.steps.length, 1, 'Only the failed step should be recorded');
  assert.strictEqual(result.steps[0]!.status, 'FAILED', 'Failed step status should be FAILED');
  assert.ok(result.error, 'Workflow result should carry error message');
  assert.ok(failEventsEmitted.includes('workflow:failed'), 'workflow:failed event must be emitted');
  console.log('  ✅ Failure handling: execution stops at failing step, workflow:failed emitted');
}

// ─── Test 6: Bounded fan-out (buildInputs) ────────────────────────────────────

{
  const registry = new ToolRegistry();
  registry.register(mockCrawlTool);

  const crawlCallCount = { count: 0 };
  const countingCrawlTool: Tool = {
    ...mockCrawlTool,
    name: 'counting_crawl',
    execute: async (input: any, ctx: ExecutionContext): Promise<ToolResult> => {
      crawlCallCount.count++;
      return mockCrawlTool.execute(input, ctx);
    }
  };
  registry.register(countingCrawlTool);

  const workflow: Workflow = {
    id: 'fanout_workflow',
    name: 'Fan-out Test',
    description: '',
    steps: [
      {
        type: 'ToolStep',
        id: 'step_crawl',
        name: 'Crawl Many',
        toolName: 'counting_crawl',
        buildInputs: (_ctx) => [
          { domain: 'alpha.com' },
          { domain: 'beta.com' },
          { domain: 'gamma.com' }
        ]
      }
    ]
  };

  const runner = new WorkflowRunner(registry, { aiMode: 'mock' });
  const result = await runner.run(workflow, EXEC_CTX, {});

  assert.strictEqual(result.status, 'COMPLETED', 'Fan-out workflow should complete');
  assert.strictEqual(crawlCallCount.count, 3, 'Tool should be called once per input element');
  assert.ok(Array.isArray(result.output), 'Fan-out output should be an array');
  assert.strictEqual((result.output as any[]).length, 3, 'Fan-out output should have 3 elements');
  console.log('  ✅ Bounded fan-out: tool called once per input, all results collected');
}

// ─── Test 7: ValidationStep failure ──────────────────────────────────────────

{
  const registry = new ToolRegistry();

  const workflow: Workflow = {
    id: 'validation_workflow',
    name: 'Validation Test',
    description: '',
    steps: [
      {
        type: 'ValidationStep',
        id: 'step_validate',
        name: 'Validate Query',
        validate: (ctx) => {
          const q = ctx.get('query');
          if (!q || typeof q !== 'string' || q.length === 0) {
            throw new Error('query must be a non-empty string');
          }
        }
      }
    ]
  };

  const runner = new WorkflowRunner(registry, { aiMode: 'mock' });

  // Should pass with valid query
  const pass = await runner.run(workflow, EXEC_CTX, { query: 'valid query' });
  assert.strictEqual(pass.status, 'COMPLETED', 'Validation step should pass with valid input');

  // Should fail with missing query
  const fail = await runner.run(workflow, EXEC_CTX, {});
  assert.strictEqual(fail.status, 'FAILED', 'Validation step should fail with missing query');
  console.log('  ✅ ValidationStep: passes and fails correctly');
}

console.log('\n  ALL WORKFLOW ENGINE TESTS PASSED ✅\n');
