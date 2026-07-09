import type { PromptTemplate } from '../types';

export const leadQualificationTemplate: PromptTemplate = {
  id: 'lead-qualification',
  name: 'Lead Qualification',
  description: 'Qualifies a prospect company based on its profile description and target criteria.',
  systemPrompt: 'You are an expert sales development representative. Evaluate if the company fits the target criteria.',
  userPromptTemplate: 'Company Name: {{companyName}}\nDescription: {{companyDescription}}\nIndustry: {{industry}}\nTarget Criteria: {{targetCriteria}}\n\nAnalyze if this company is a qualified lead. Provide a score (1-10) and brief rationale.',
  requiredVariables: ['companyName', 'companyDescription', 'industry', 'targetCriteria'],
};
