import type { PromptTemplate, PromptVariables, RenderedPrompt } from '../types';

export function renderTemplate(template: PromptTemplate, variables: PromptVariables): RenderedPrompt {
  // Check that all required variables are present
  const missing = template.requiredVariables.filter((v) => variables[v] === undefined || variables[v] === null);
  if (missing.length > 0) {
    throw new Error(`Missing required prompt variables: ${missing.join(', ')}`);
  }

  const renderString = (str: string, vars: PromptVariables) => {
    return str.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return vars[key] ?? '';
    });
  };

  const result: RenderedPrompt = {
    userPrompt: renderString(template.userPromptTemplate, variables),
  };

  if (template.systemPrompt) {
    result.systemPrompt = renderString(template.systemPrompt, variables);
  }

  return result;
}
