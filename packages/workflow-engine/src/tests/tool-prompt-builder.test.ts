import assert from 'assert';
import { ToolPromptBuilder } from '../tool-invocation/tool-prompt-builder';
import type { Tool } from '@leadforge/agent-core';
import { z } from 'zod';

console.log('\n── ToolPromptBuilder Unit Tests ──');

const mockTool: Tool = {
  name: 'search_leads',
  description: 'Searches leads database',
  inputSchema: z.object({ query: z.string() }),
  riskLevel: 'LOW',
  schema: {
    description: 'Searches leads description from schema',
    inputSchema: z.object({ query: z.string() }),
    outputDescription: 'List of matching leads',
    examples: [
      {
        description: 'Find software company leads',
        input: { query: 'software' }
      }
    ],
    requiresApproval: false
  },
  execute: async () => { throw new Error('Unused'); }
};

// ─── Test 1: Single tool description ───────────────────────────────────────────

{
  const desc = ToolPromptBuilder.describeOne(mockTool);
  assert.ok(desc.includes('Tool: search_leads'), 'Should include tool name');
  assert.ok(desc.includes('Input Schema:'), 'Should include input schema details');
  assert.ok(desc.includes('Example 1: Find software company leads'), 'Should include example description');
  console.log('  ✅ describeOne: generated prompt string format verified');
}

// ─── Test 2: Catalog serialization ───────────────────────────────────────────

{
  const catalog = ToolPromptBuilder.buildCatalog([mockTool]);
  assert.strictEqual(catalog.length, 1, 'Catalog should contain one entry');
  assert.strictEqual(catalog[0]?.toolName, 'search_leads', 'Catalog entry name should match');
  assert.strictEqual(catalog[0]?.outputDescription, 'List of matching leads', 'Catalog output description should match');
  console.log('  ✅ buildCatalog: structured JSON output properties verified');
}
