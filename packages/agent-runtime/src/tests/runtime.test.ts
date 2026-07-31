import assert from 'assert';
import { AgentRuntime, ResearchAgent } from '../index';
import { ToolRegistry } from '@leadforge/agent-core';
import type { Tool, ToolResult, ExecutionContext } from '@leadforge/agent-core';
import { z } from 'zod';

console.log('\n── AgentRuntime E2E Unit Tests ──');

// Mock search tool
const mockSearchTool: Tool = {
  name: 'search_local_businesses',
  description: 'Mock search businesses',
  inputSchema: z.object({ query: z.string(), limit: z.number().optional() }),
  riskLevel: 'LOW',
  execute: async (_input: any, context: ExecutionContext): Promise<ToolResult> => ({
    success: true,
    data: [
      { id: 'c-1', name: 'Mock Company 1', domain: 'mock1.com' },
      { id: 'c-2', name: 'Mock Company 2', domain: 'mock2.com' }
    ],
    metadata: {
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 2,
      attempt: 1,
      workspaceId: context.workspaceId,
      traceId: context.traceId,
      cached: false,
      retryCount: 0
    }
  })
};

// Mock crawl tool
const mockCrawlTool: Tool = {
  name: 'crawl_company_website',
  description: 'Mock website crawler',
  inputSchema: z.object({ companyId: z.string(), domain: z.string() }),
  riskLevel: 'LOW',
  execute: async (input: any, context: ExecutionContext): Promise<ToolResult> => ({
    success: true,
    data: {
      emails: [`info@${input.domain}`],
      phone: '123-456'
    },
    metadata: {
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 3,
      attempt: 1,
      workspaceId: context.workspaceId,
      traceId: context.traceId,
      cached: false,
      retryCount: 0
    }
  })
};

// Test complete runtime sequence via WorkflowRunner
{
  const registry = new ToolRegistry();
  registry.register(mockSearchTool);
  registry.register(mockCrawlTool);

  const runtime = new AgentRuntime(registry, { aiMode: 'mock' });

  const statesEmitted: string[] = [];
  runtime.subscribe((session) => {
    statesEmitted.push(session.getState());
  });

  runtime.execute(ResearchAgent, 'Austin software companies', {
    workspaceId: 'ws-test',
    executionId: 'exec-test',
    traceId: 'trace-test',
    actorId: 'user-test'
  }).then((response) => {
    assert.strictEqual(response.success, true, 'Execution should be successful');
    assert.ok(response.message.length > 0, 'Should return a summary message');

    // The runtime delegates to WorkflowRunner — session states now include
    // PREPARING_CONTEXT, EXECUTING_TOOL (per step), RECEIVING_TOOL_RESULT (per step),
    // CALLING_LLM (delegating to runner), GENERATING_RESPONSE, COMPLETED.
    assert.ok(statesEmitted.includes('PREPARING_CONTEXT'), 'Should emit PREPARING_CONTEXT');
    assert.ok(statesEmitted.includes('EXECUTING_TOOL'), 'Should emit EXECUTING_TOOL');
    assert.ok(statesEmitted.includes('RECEIVING_TOOL_RESULT'), 'Should emit RECEIVING_TOOL_RESULT');
    assert.ok(statesEmitted.includes('COMPLETED'), 'Should emit COMPLETED');

    // toolsExecuted reflects steps with tool results
    assert.ok(response.toolsExecuted.length >= 1, 'Should have executed at least 1 tool');

    console.log('  ✅ AgentRuntime → WorkflowRunner delegation verified successfully.');
  }).catch((err) => {
    assert.fail(`AgentRuntime execute failed: ${err.message}`);
  });
}
