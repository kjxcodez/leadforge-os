/**
 * Agent Core ToolRegistry, Catalog & ProviderRegistry Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { ToolRegistry, ToolCatalog, ProviderRegistry } from '../index.js';
import type { Tool, ExecutionContext } from '../index.js';
import { z } from 'zod';

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

describe('Agent Core Tool & Provider Registries', () => {
  describe('ToolRegistry', () => {
    it('registers, retrieves, and filters tools by risk level', () => {
      const registry = new ToolRegistry();
      registry.register(testTool);

      expect(registry.has('test_tool')).toBe(true);
      expect(registry.get('test_tool')).toBe(testTool);
      expect(registry.list().length).toBe(1);
      expect(registry.listByRisk('LOW').length).toBe(1);
    });
  });

  describe('ToolCatalog', () => {
    it('searches and filters catalog entries by tags, categories, capabilities, and risk', () => {
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

      expect(catalog.list().length).toBe(1);
      expect(catalog.get('search_local_businesses')?.displayName).toBe('Maps Search');
      expect(catalog.searchByTag('local').length).toBe(1);
      expect(catalog.searchByCategory('scraper').length).toBe(1);
      expect(catalog.searchByCapability('browser').length).toBe(1);
      expect(catalog.searchByRisk('LOW').length).toBe(1);
    });
  });

  describe('ProviderRegistry', () => {
    it('registers providers and selects by capabilities', () => {
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
      expect(registry.has('openai-mock')).toBe(true);
      expect(registry.get('openai-mock')?.capabilities?.supportsVision).toBe(true);

      const selection = registry.selectByCapabilities({
        supportsVision: true,
        supportsEmbeddings: true
      });
      expect(selection.length).toBe(1);
      expect(selection[0]?.name).toBe('openai-mock');
    });
  });
});
