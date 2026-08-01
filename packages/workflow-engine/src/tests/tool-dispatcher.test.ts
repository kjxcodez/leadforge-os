import assert from 'assert';
import { ToolDispatcher } from '../tool-invocation/tool-dispatcher';
import { ConsoleInvocationLogger } from '../tool-invocation/invocation-logger';
import type { ToolRequest } from '../tool-invocation/types';
import { ToolRegistry } from '@leadforge/agent-core';
import type { Tool, ToolResult, ExecutionContext } from '@leadforge/agent-core';
import { z } from 'zod';

console.log('\n── ToolDispatcher Unit Tests ──');

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

const mockValidTool: Tool = {
  name: 'mock_valid',
  description: 'Valid tool',
  inputSchema: z.object({ value: z.string() }),
  riskLevel: 'LOW',
  execute: async (input: any, ctx: ExecutionContext): Promise<ToolResult> => ({
    success: true,
    data: { echoed: input.value },
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

const mockApprovalTool: Tool = {
  name: 'mock_approval_required',
  description: 'Approval tool',
  inputSchema: z.object({}),
  riskLevel: 'HIGH',
  schema: {
    description: 'Approval tool schema',
    inputSchema: z.object({}),
    examples: [],
    requiresApproval: true,
    approvalReason: 'Sensitive action'
  },
  execute: async (_input: any, ctx: ExecutionContext): Promise<ToolResult> => ({
    success: true,
    data: 'approved success',
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

// ─── Test 1: Successful tool dispatch ──────────────────────────────────────────

{
  const registry = new ToolRegistry();
  registry.register(mockValidTool);

  const logger = new ConsoleInvocationLogger();
  const dispatcher = new ToolDispatcher(registry, logger);

  const req: ToolRequest = {
    requestId: 'req-1',
    toolName: 'mock_valid',
    arguments: { value: 'hello' },
    traceId: 'trace-test',
    workspaceId: 'ws-test',
    invokedBy: 'test-step',
    timestamp: new Date().toISOString(),
    requiresApproval: false
  };

  const res = await dispatcher.dispatch(req, EXEC_CTX);

  assert.strictEqual(res.success, true, 'Dispatch should succeed');
  assert.strictEqual(res.approvalStatus, 'NOT_REQUIRED', 'Approval status should be NOT_REQUIRED');
  assert.deepStrictEqual(res.data, { echoed: 'hello' }, 'Output data should match echoes');
  assert.ok(res.toolResult, 'Raw ToolResult should be attached');
  assert.strictEqual(logger.getLogs().length, 1, 'Logger should log the invocation');
  console.log('  ✅ Success dispatch: inputs parsed, outputs returned, execution logged');
}

// ─── Test 2: Tool not found (UNAVAILABLE) ──────────────────────────────────────

{
  const registry = new ToolRegistry();
  const logger = new ConsoleInvocationLogger();
  const dispatcher = new ToolDispatcher(registry, logger);

  const req: ToolRequest = {
    requestId: 'req-2',
    toolName: 'non_existent_tool',
    arguments: {},
    traceId: 'trace-test',
    workspaceId: 'ws-test',
    invokedBy: 'test-step',
    timestamp: new Date().toISOString(),
    requiresApproval: false
  };

  const res = await dispatcher.dispatch(req, EXEC_CTX);

  assert.strictEqual(res.success, false, 'Dispatch should fail');
  assert.strictEqual(res.error?.code, 'UNAVAILABLE', 'Error code should be UNAVAILABLE');
  assert.ok(
    res.error?.message.includes('not found'),
    'Error message should explain missing status'
  );
  assert.strictEqual(logger.getLogs().length, 1, 'Logger should log the error response');
  console.log('  ✅ UNAVAILABLE check: returns structured error when tool not found');
}

// ─── Test 3: Validation failure ────────────────────────────────────────────────

{
  const registry = new ToolRegistry();
  registry.register(mockValidTool);

  const logger = new ConsoleInvocationLogger();
  const dispatcher = new ToolDispatcher(registry, logger);

  const req: ToolRequest = {
    requestId: 'req-3',
    toolName: 'mock_valid',
    arguments: { value: 123 }, // Expected string, sent number
    traceId: 'trace-test',
    workspaceId: 'ws-test',
    invokedBy: 'test-step',
    timestamp: new Date().toISOString(),
    requiresApproval: false
  };

  const res = await dispatcher.dispatch(req, EXEC_CTX);

  assert.strictEqual(res.success, false, 'Dispatch should fail validation');
  assert.strictEqual(res.error?.code, 'VALIDATION_ERROR', 'Error code should be VALIDATION_ERROR');
  console.log('  ✅ VALIDATION_ERROR check: rejects invalid inputs prior to run');
}

// ─── Test 4: Approval requirement ──────────────────────────────────────────────

{
  const registry = new ToolRegistry();
  registry.register(mockApprovalTool);

  const logger = new ConsoleInvocationLogger();
  const dispatcher = new ToolDispatcher(registry, logger);

  const req: ToolRequest = {
    requestId: 'req-4',
    toolName: 'mock_approval_required',
    arguments: {},
    traceId: 'trace-test',
    workspaceId: 'ws-test',
    invokedBy: 'test-step',
    timestamp: new Date().toISOString(),
    requiresApproval: true // Trigger approval flow contract
  };

  const res = await dispatcher.dispatch(req, EXEC_CTX);

  assert.strictEqual(res.success, false, 'Should fail without granted approval');
  assert.strictEqual(res.approvalStatus, 'PENDING', 'Approval status should be PENDING');
  assert.strictEqual(
    res.error?.code,
    'APPROVAL_REQUIRED',
    'Error code should be APPROVAL_REQUIRED'
  );
  console.log('  ✅ APPROVAL_REQUIRED check: stops execution and flags PENDING status');
}
