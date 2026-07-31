import { callOpenRouter } from '../providers/openrouter';
import { callOllama } from '../providers/ollama';
import type { PromptDefinition, AIExecutionResult, AIExecutionOptions } from '../types';

// request cache (Phase 8)
const promptCache = new Map<string, string>();

export class AIRuntime {
  /**
   * Execute an AI prompt using the configured runtime environment.
   */
  public static async execute<TInput, TOutput>(
    prompt: PromptDefinition<TInput, TOutput>,
    input: TInput,
    config: {
      openRouterKey?: string | undefined;
      aiMode?: 'cloud' | 'local' | 'mock' | undefined;
      ollamaModel?: string | undefined;
      ollamaUrl?: string | undefined;
    },
    options?: AIExecutionOptions | undefined
  ): Promise<AIExecutionResult<TOutput>> {
    const startTime = Date.now();
    const promptText = prompt.render(input);
    const cacheKey = `${prompt.id}:${prompt.version}:${promptText}`;

    // 1. Check prompt result cache (Phase 8)
    if (promptCache.has(cacheKey)) {
      const cachedResponse = promptCache.get(cacheKey)!;
      try {
        const parsed = prompt.validateOutput(cachedResponse);
        return {
          success: true,
          data: parsed,
          provider: (config.aiMode || 'mock') as any,
          model: options?.model || 'cached',
          latencyMs: Date.now() - startTime,
          promptIdentifier: prompt.id,
          cacheHit: true,
        };
      } catch (err: any) {
        // Fall through on cache validation failure
      }
    }

    // 2. Determine provider selection
    let providerName: 'openrouter' | 'ollama' | 'mock' = 'mock';
    let modelName = 'fallback-rules';
    let responseText = '';

    const mode = config.aiMode || (config.openRouterKey ? 'cloud' : 'mock');

    try {
      if (mode === 'cloud' && config.openRouterKey) {
        providerName = 'openrouter';
        modelName = options?.model || 'meta-llama/llama-3-8b-instruct:free';
        responseText = await callOpenRouter(config.openRouterKey, promptText, modelName, options);
      } else if (mode === 'local') {
        providerName = 'ollama';
        modelName = config.ollamaModel || 'llama3';
        responseText = await callOllama(config.ollamaUrl, promptText, modelName, options);
      } else {
        // Mock fallback rules (Phase 2 & 11)
        providerName = 'mock';
        responseText = this.getMockResponse(prompt.id, input);
      }

      // 3. Structured validation (Phase 7)
      const validatedData = prompt.validateOutput(responseText);

      // Save to cache on successful completion
      promptCache.set(cacheKey, responseText);

      return {
        success: true,
        data: validatedData,
        provider: providerName,
        model: modelName,
        latencyMs: Date.now() - startTime,
        promptIdentifier: prompt.id,
        cacheHit: false,
      };
    } catch (err: any) {
      // Graceful fallback to mock output on error (Phase 11)
      try {
        const fallbackText = this.getMockResponse(prompt.id, input);
        const validatedFallback = prompt.validateOutput(fallbackText);
        return {
          success: true,
          data: validatedFallback,
          provider: 'mock',
          model: 'fallback-rules',
          latencyMs: Date.now() - startTime,
          promptIdentifier: prompt.id,
          error: err.message,
        };
      } catch (validationErr: any) {
        return {
          success: false,
          data: null as any,
          provider: providerName,
          model: modelName,
          latencyMs: Date.now() - startTime,
          promptIdentifier: prompt.id,
          error: `Execution failed: ${err.message}. Validation failed: ${validationErr.message}`,
        };
      }
    }
  }

  private static getMockResponse(promptId: string, input: any): string {
    if (promptId === 'generate_ai_summary') {
      return `Executive summary: ${input.companyName} is an active competitor in ${input.industry} sector.`;
    }
    if (promptId === 'generate_opening_line') {
      return `Hi there, reaching out to see if you have technical needs at ${input.companyName}.`;
    }
    if (promptId === 'ai_insights') {
      const techText = input.techStack && input.techStack.length > 0 ? input.techStack[0] : 'modern systems';
      const issueText = input.technicalIssues && input.technicalIssues.length > 0 ? input.technicalIssues[0] : 'inefficient digital pipelines';
      return JSON.stringify({
        openingLine: `Saw that you guys are building out your digital infrastructure using ${techText} at ${input.companyName}—really impressive work.`,
        painPoint: `Potential friction in customer acquisition cycles and technical scale constraints related to ${issueText}.`,
        outreachAngle: `Highlight how optimizing their current stack can reduce conversion drop-offs and drive higher demo conversions.`,
      });
    }
    return '';
  }
}
