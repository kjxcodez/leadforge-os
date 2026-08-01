import assert from 'assert';
import { ToolRegistry, ToolCatalog, ProviderRegistry } from '../index';
import type { Tool, ExecutionContext } from '../index';
import { z } from 'zod';

console.log('\n── ToolRegistry Unit Tests ──');

const mockContext: ExecutionContext = {
  workspaceId: 'ws-test',
  executionId: 'exec-test',
  traceId: 'trace-test',
  actorId: 'user-test',
  actorType: 'user',
  requestedBy: 'test-suite',
  permissions: [],
  executionMode: 'offline'
};

const testTool: Tool<{ val: string }, string> = {
  name: 'test_tool',
  description: 'A mock test tool',
  inputSchema: z.object({ val: z.string() }),
  riskLevel: 'LOW',
  execute: async (input, context) => {
    return {
      success: true,
      data: `echo: ${input.val}`,
      metadata: {
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 5,
        attempt: 1,
        workspaceId: context.workspaceId,
        traceId: context.traceId,
        cached: false,
        retryCount: 0
      }
    };
  }
};

// 1. ToolRegistry Checks
{
  const registry = new ToolRegistry();
  registry.register(testTool);

  assert.strictEqual(registry.has('test_tool'), true, 'Registry should have test_tool');
  assert.strictEqual(
    registry.get('test_tool'),
    testTool,
    'Registry get should return same instance'
  );
  assert.strictEqual(registry.list().length, 1, 'Registry list length should be 1');
  assert.strictEqual(
    registry.listByRisk('LOW').length,
    1,
    'Registry listByRisk Low length should be 1'
  );
  console.log('  ✅ Registry operations verified.');
}

// 2. ToolCatalog Checks
console.log('\n── ToolCatalog Unit Tests ──');
{
  const catalog = new ToolCatalog([
    {
      identity: 'search_local_businesses',
      displayName: 'Maps Search',
      description: 'Find companies on Google Maps',
      categories: ['Scraper', 'Discovery'],
      tags: ['maps', 'local', 'leads'],
      requiredCapabilities: ['browser'],
      requiredPermissions: ['network:outbound'],
      riskLevel: 'LOW',
      estimatedDuration: 30000,
      supportsCancellation: true,
      supportsStreaming: false,
      requiresBrowser: true,
      requiresNetwork: true,
      requiresHumanApproval: false,
      sideEffects: 'None',
      version: '1.0.0'
    }
  ]);

  assert.strictEqual(catalog.list().length, 1, 'Catalog list should contain 1 entry');
  assert.strictEqual(
    catalog.get('search_local_businesses')?.displayName,
    'Maps Search',
    'Catalog get should match ID'
  );
  assert.strictEqual(
    catalog.searchByTag('local').length,
    1,
    'Search by tag local should return 1 entry'
  );
  assert.strictEqual(
    catalog.searchByCategory('scraper').length,
    1,
    'Search by category scraper should return 1 entry'
  );
  assert.strictEqual(
    catalog.searchByCapability('browser').length,
    1,
    'Search by capability browser should return 1 entry'
  );
  assert.strictEqual(
    catalog.searchByRisk('LOW').length,
    1,
    'Search by risk LOW should return 1 entry'
  );
  console.log('  ✅ Catalog search & filter operations verified.');
}

// 3. ProviderRegistry Checks
console.log('\n── ProviderRegistry Unit Tests ──');
{
  const registry = new ProviderRegistry();
  const mockCapabilities = {
    supportsVision: true,
    supportsImages: false,
    supportsAudio: false,
    supportsEmbeddings: true,
    supportsStreaming: true,
    supportsTools: true,
    supportsStructuredOutputs: true,
    supportsThinking: false,
    supportsReasoning: false,
    supportsContextCaching: true,
    supportsLargeContext: true,
    supportsJSON: true,
    supportsFunctionCalling: true,
    supportsMCP: false
  };

  registry.register('openai-mock', mockCapabilities);
  assert.strictEqual(registry.has('openai-mock'), true, 'Registry should have openai-mock');
  assert.strictEqual(
    registry.get('openai-mock')?.capabilities?.supportsVision,
    true,
    'Vision capability should be true'
  );

  const selection = registry.selectByCapabilities({
    supportsVision: true,
    supportsEmbeddings: true
  });
  assert.strictEqual(selection.length, 1, 'Selection should return openai-mock');
  assert.strictEqual(selection[0]?.name, 'openai-mock', 'Selected provider name should match');
  console.log('  ✅ ProviderRegistry selection logic verified.');
}
