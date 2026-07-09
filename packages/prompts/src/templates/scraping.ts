import type { PromptTemplate } from '../types';

export const companyEnrichmentTemplate: PromptTemplate = {
  id: 'company-enrichment-instructions',
  name: 'Company Enrichment Instructions',
  description: 'Instructions for LLM agent to extract company details from raw HTML or text.',
  systemPrompt: 'You are a data extraction assistant. Extract details cleanly into JSON format.',
  userPromptTemplate: 'Raw Text: {{rawText}}\n\nExtract: \n1. Official Company Name\n2. Estimated Employee Count\n3. Primary Value Proposition\n4. Key Locations',
  requiredVariables: ['rawText'],
};

export const contactEnrichmentTemplate: PromptTemplate = {
  id: 'contact-enrichment-instructions',
  name: 'Contact Enrichment Instructions',
  description: 'Instructions to locate and extract professional contact data.',
  systemPrompt: 'You are an intelligence collection specialist. Parse professional backgrounds.',
  userPromptTemplate: 'Source Context: {{sourceContext}}\nTarget Name: {{contactName}}\n\nLocate their current job title, corporate email domain, and social handles from the source text.',
  requiredVariables: ['sourceContext', 'contactName'],
};
