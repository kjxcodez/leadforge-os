import { z } from 'zod';
import type { PromptDefinition } from '../types';

// Structured Output Schemas (Phase 7)
export const CompanySummaryOutputSchema = z.string();
export const OpeningLineOutputSchema = z.string();
export const AIInsightsOutputSchema = z.object({
  openingLine: z.string(),
  painPoint: z.string(),
  outreachAngle: z.string()
});

export type CompanySummaryInput = { companyName: string; industry: string };
export type OpeningLineInput = { companyName: string; industry: string };
export type AIInsightsInput = {
  companyName: string;
  industry: string;
  techStack: string[];
  technicalIssues: string[];
};

export const PromptsLibrary = {
  GENERATE_AI_SUMMARY: {
    id: 'generate_ai_summary',
    version: '1.0.0',
    render: (input: CompanySummaryInput) =>
      `Write a short 2-sentence executive summary for company "${input.companyName}" in "${input.industry}" based on lead intelligence data.`,
    validateOutput: (res: string) => {
      return CompanySummaryOutputSchema.parse(res.trim());
    }
  } as PromptDefinition<CompanySummaryInput, string>,

  GENERATE_OPENING_LINE: {
    id: 'generate_opening_line',
    version: '1.0.0',
    render: (input: OpeningLineInput) =>
      `Write a high-converting, cold email personalization opening line for company "${input.companyName}" in "${input.industry}". Return only the opening line.`,
    validateOutput: (res: string) => {
      return OpeningLineOutputSchema.parse(res.trim());
    }
  } as PromptDefinition<OpeningLineInput, string>,

  AI_INSIGHTS: {
    id: 'ai_insights',
    version: '1.0.0',
    render: (input: AIInsightsInput) =>
      `Analyze company "${input.companyName}" in "${input.industry}" using tech stack: [${input.techStack.join(', ')}]. Has issues: [${input.technicalIssues.join(', ')}].
Generate:
1. One personalized opening line for cold outreach.
2. One key pain point hypothesis.
3. Recommended email Outreach angle.
Return JSON format: { "openingLine": "...", "painPoint": "...", "outreachAngle": "..." }`,
    validateOutput: (res: string) => {
      const match = res.match(/\{[\s\S]*?\}/);
      if (!match) throw new Error('Response does not contain a JSON block');
      const parsed = JSON.parse(match[0]);
      return AIInsightsOutputSchema.parse(parsed);
    }
  } as PromptDefinition<AIInsightsInput, z.infer<typeof AIInsightsOutputSchema>>
};
