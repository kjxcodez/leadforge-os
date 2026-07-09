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
      throw new Error(`Prompt template with ID '${template.id}' is already registered.`);
    }
    this.templates.set(template.id, template);
  }

  public get(id: string): PromptTemplate {
    const template = this.templates.get(id);
    if (!template) {
      throw new Error(`Prompt template with ID '${id}' not found in registry.`);
    }
    return template;
  }

  public list(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }
}

// Export singleton instance
export const promptRegistry = new PromptRegistry();
