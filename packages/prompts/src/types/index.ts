export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  systemPrompt?: string;
  userPromptTemplate: string;
  requiredVariables: string[];
}

export type PromptVariables = Record<string, string>;

export interface RenderedPrompt {
  systemPrompt?: string;
  userPrompt: string;
}
