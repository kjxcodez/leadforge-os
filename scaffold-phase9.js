const fs = require('fs');
const path = require('path');

const promptsSrcDir = 'c:\\Users\\91637\\Desktop\\Business Project\\leadforge-os\\packages\\prompts\\src';

const files = {
  // types
  'types/index.ts': `
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
`,

  // renderer
  'renderer/index.ts': `
import type { PromptTemplate, PromptVariables, RenderedPrompt } from '../types';

export function renderTemplate(template: PromptTemplate, variables: PromptVariables): RenderedPrompt {
  // Check that all required variables are present
  const missing = template.requiredVariables.filter((v) => variables[v] === undefined || variables[v] === null);
  if (missing.length > 0) {
    throw new Error(\`Missing required prompt variables: \${missing.join(', ')}\`);
  }

  const renderString = (str: string, vars: PromptVariables) => {
    return str.replace(/\\{\\{(\\w+)\\}\\}/g, (_, key) => {
      return vars[key] ?? '';
    });
  };

  return {
    systemPrompt: template.systemPrompt ? renderString(template.systemPrompt, variables) : undefined,
    userPrompt: renderString(template.userPromptTemplate, variables),
  };
}
`,

  // templates
  'templates/qualification.ts': `
import type { PromptTemplate } from '../types';

export const leadQualificationTemplate: PromptTemplate = {
  id: 'lead-qualification',
  name: 'Lead Qualification',
  description: 'Qualifies a prospect company based on its profile description and target criteria.',
  systemPrompt: 'You are an expert sales development representative. Evaluate if the company fits the target criteria.',
  userPromptTemplate: 'Company Name: {{companyName}}\\nDescription: {{companyDescription}}\\nIndustry: {{industry}}\\nTarget Criteria: {{targetCriteria}}\\n\\nAnalyze if this company is a qualified lead. Provide a score (1-10) and brief rationale.',
  requiredVariables: ['companyName', 'companyDescription', 'industry', 'targetCriteria'],
};
`,
  'templates/outreach.ts': `
import type { PromptTemplate } from '../types';

export const emailColdOutreachTemplate: PromptTemplate = {
  id: 'email-cold-outreach',
  name: 'Email Cold Outreach',
  description: 'Generates a highly personalized cold outreach email using prospect details.',
  systemPrompt: 'You are a professional outreach strategist. Write a short, engaging, and personalized cold email.',
  userPromptTemplate: 'Prospect Name: {{contactName}}\\nTitle: {{contactTitle}}\\nCompany: {{companyName}}\\nValue Proposition: {{valueProp}}\\nPersonalization Hook: {{customHook}}\\n\\nWrite a cold email addressing the prospect. Keep it under 150 words with a clear call to action.',
  requiredVariables: ['contactName', 'contactTitle', 'companyName', 'valueProp', 'customHook'],
};

export const linkedinConnectionTemplate: PromptTemplate = {
  id: 'linkedin-connection',
  name: 'LinkedIn Connection Request',
  description: 'Creates a personalized LinkedIn connection invitation message.',
  systemPrompt: 'You are a networking expert. Write a concise, authentic invitation message.',
  userPromptTemplate: 'Prospect Name: {{contactName}}\\nCompany: {{companyName}}\\nMutual Ground: {{mutualGround}}\\n\\nWrite a LinkedIn connection message. STRICT limit of 300 characters.',
  requiredVariables: ['contactName', 'companyName', 'mutualGround'],
};
`,
  'templates/scraping.ts': `
import type { PromptTemplate } from '../types';

export const companyEnrichmentTemplate: PromptTemplate = {
  id: 'company-enrichment-instructions',
  name: 'Company Enrichment Instructions',
  description: 'Instructions for LLM agent to extract company details from raw HTML or text.',
  systemPrompt: 'You are a data extraction assistant. Extract details cleanly into JSON format.',
  userPromptTemplate: 'Raw Text: {{rawText}}\\n\\nExtract: \\n1. Official Company Name\\n2. Estimated Employee Count\\n3. Primary Value Proposition\\n4. Key Locations',
  requiredVariables: ['rawText'],
};

export const contactEnrichmentTemplate: PromptTemplate = {
  id: 'contact-enrichment-instructions',
  name: 'Contact Enrichment Instructions',
  description: 'Instructions to locate and extract professional contact data.',
  systemPrompt: 'You are an intelligence collection specialist. Parse professional backgrounds.',
  userPromptTemplate: 'Source Context: {{sourceContext}}\\nTarget Name: {{contactName}}\\n\\nLocate their current job title, corporate email domain, and social handles from the source text.',
  requiredVariables: ['sourceContext', 'contactName'],
};
`,
  'templates/index.ts': `
export * from './qualification';
export * from './outreach';
export * from './scraping';
`,

  // registry
  'registry/index.ts': `
import type { PromptTemplate } from '../types';
import {
  leadQualificationTemplate,
  emailColdOutreachTemplate,
  linkedinConnectionTemplate,
  companyEnrichmentTemplate,
  contactEnrichmentTemplate,
} from '../templates';

export class PromptRegistry {
  private templates: Map<string, PromptTemplate> = new Map();

  constructor() {
    this.register(leadQualificationTemplate);
    this.register(emailColdOutreachTemplate);
    this.register(linkedinConnectionTemplate);
    this.register(companyEnrichmentTemplate);
    this.register(contactEnrichmentTemplate);
  }

  public register(template: PromptTemplate): void {
    if (this.templates.has(template.id)) {
      throw new Error(\`Prompt template with ID '\${template.id}' is already registered.\`);
    }
    this.templates.set(template.id, template);
  }

  public get(id: string): PromptTemplate {
    const template = this.templates.get(id);
    if (!template) {
      throw new Error(\`Prompt template with ID '\${id}' not found in registry.\`);
    }
    return template;
  }

  public list(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }
}

// Export singleton instance
export const promptRegistry = new PromptRegistry();
`,

  // root index
  'index.ts': `
export * from './types';
export * from './renderer';
export * from './templates';
export * from './registry';
`
};

for (const [relativePath, content] of Object.entries(files)) {
  const fullPath = path.join(promptsSrcDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content.trim() + '\\n');
}

console.log("Prompts package scaffolded.");
