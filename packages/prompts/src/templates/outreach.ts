import type { PromptTemplate } from '../types';

export const emailColdOutreachTemplate: PromptTemplate = {
  id: 'email-cold-outreach',
  name: 'Email Cold Outreach',
  description: 'Generates a highly personalized cold outreach email using prospect details.',
  systemPrompt: 'You are a professional outreach strategist. Write a short, engaging, and personalized cold email.',
  userPromptTemplate: 'Prospect Name: {{contactName}}\nTitle: {{contactTitle}}\nCompany: {{companyName}}\nValue Proposition: {{valueProp}}\nPersonalization Hook: {{customHook}}\n\nWrite a cold email addressing the prospect. Keep it under 150 words with a clear call to action.',
  requiredVariables: ['contactName', 'contactTitle', 'companyName', 'valueProp', 'customHook'],
};

export const linkedinConnectionTemplate: PromptTemplate = {
  id: 'linkedin-connection',
  name: 'LinkedIn Connection Request',
  description: 'Creates a personalized LinkedIn connection invitation message.',
  systemPrompt: 'You are a networking expert. Write a concise, authentic invitation message.',
  userPromptTemplate: 'Prospect Name: {{contactName}}\nCompany: {{companyName}}\nMutual Ground: {{mutualGround}}\n\nWrite a LinkedIn connection message. STRICT limit of 300 characters.',
  requiredVariables: ['contactName', 'companyName', 'mutualGround'],
};
