export type AIProviderName = 'openrouter' | 'ollama' | 'mock';

export interface AIProviderConfig {
  name: AIProviderName;
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
}

export interface AIExecutionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface AIExecutionResult<T = any> {
  success: boolean;
  data: T;
  error?: string;
  provider: AIProviderName;
  model: string;
  latencyMs: number;
  promptIdentifier: string;
  cacheHit?: boolean;
}

export interface PromptDefinition<TInput = any, TOutput = any> {
  id: string;
  version: string;
  render: (input: TInput) => string;
  validateOutput: (response: string) => TOutput;
}
