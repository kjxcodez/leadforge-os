import { z } from 'zod';
import { entityIdField, entityIdFieldNullable } from '../fields/common.js';
import { leadConfidenceSchema, contactSenioritySchema } from '../entities/intelligence.js';

// 1. Company Intelligence DTO
export const createCompanyIntelligenceDtoSchema = z.object({
  id: entityIdField.optional(),
  companyId: entityIdField,
  summary: z.string().nullable().optional(),
  openingLine: z.string().nullable().optional(),
  techStack: z.array(z.string()).default([]).optional(),
  businessModel: z.string().nullable().optional(),
  estimatedRevenue: z.string().nullable().optional(),
  growthSignals: z.array(z.string()).default([]).optional(),
  hiringSignals: z.array(z.string()).default([]).optional(),
  decisionMakerLikelihood: z.number().min(0).max(1).nullable().optional(),
  leadConfidence: leadConfidenceSchema.nullable().optional(),
  missingInformation: z.array(z.string()).default([]).optional()
});
export type CreateCompanyIntelligenceDto = z.infer<typeof createCompanyIntelligenceDtoSchema>;

// Bulk Company Intelligence (Max 50)
export const bulkCompanyIntelligenceDtoSchema = z.object({
  items: z.array(createCompanyIntelligenceDtoSchema).min(1).max(50)
});
export type BulkCompanyIntelligenceDto = z.infer<typeof bulkCompanyIntelligenceDtoSchema>;

// 2. Website Intelligence DTO
export const createWebsiteIntelligenceDtoSchema = z.object({
  id: entityIdField.optional(),
  companyId: entityIdField,
  brandVoice: z.string().nullable().optional(),
  contentQuality: z.string().nullable().optional(),
  buyingSignals: z.array(z.string()).default([]).optional(),
  seoSignals: z.record(z.string(), z.any()).nullable().optional(),
  technicalIssues: z.array(z.string()).default([]).optional(),
  productsServices: z.array(z.string()).default([]).optional(),
  testimonialsCaseStudies: z.array(z.string()).default([]).optional()
});
export type CreateWebsiteIntelligenceDto = z.infer<typeof createWebsiteIntelligenceDtoSchema>;

// 3. Contact Intelligence DTO
export const createContactIntelligenceDtoSchema = z.object({
  id: entityIdField.optional(),
  contactId: entityIdField,
  decisionMakerScore: z.number().min(0).max(1).nullable().optional(),
  seniority: contactSenioritySchema.default('UNKNOWN').optional(),
  buyingInfluence: z.string().nullable().optional(),
  personalizationOpportunities: z.array(z.string()).default([]).optional(),
  relationshipStrength: z.number().min(0).max(1).nullable().optional()
});
export type CreateContactIntelligenceDto = z.infer<typeof createContactIntelligenceDtoSchema>;

// 4. Opportunity Score DTO
export const createOpportunityScoreDtoSchema = z.object({
  id: entityIdField.optional(),
  companyId: entityIdField,
  overallScore: z.number().min(0).max(100),
  fitScore: z.number().min(0).max(100).default(0).optional(),
  sizeScore: z.number().min(0).max(100).default(0).optional(),
  intentScore: z.number().min(0).max(100).default(0).optional(),
  urgencyScore: z.number().min(0).max(100).default(0).optional(),
  explanation: z.string().nullable().optional(),
  provenance: z.record(z.string(), z.any()).nullable().optional()
});
export type CreateOpportunityScoreDto = z.infer<typeof createOpportunityScoreDtoSchema>;

// 5. Page Crawl DTO
export const createPageCrawlDtoSchema = z.object({
  id: entityIdField.optional(),
  companyId: entityIdField,
  url: z.string().url(),
  status: z.number().int().default(200).optional(),
  contentHash: z.string().min(1),
  extractedText: z.string().max(65536).nullable().optional(), // Max 64KB
  rawHtmlLength: z.number().int().default(0).optional()
});
export type CreatePageCrawlDto = z.infer<typeof createPageCrawlDtoSchema>;

// 6. Intelligence Source DTO
export const createIntelligenceSourceDtoSchema = z.object({
  id: entityIdField.optional(),
  companyId: entityIdFieldNullable.optional(),
  sourceType: z.enum(['WEBSITE', 'GOOGLE_MAPS', 'LINKEDIN', 'REGISTRY', 'MANUAL']),
  url: z.string().nullable().optional(),
  status: z.enum(['SUCCESS', 'FAILED', 'STALE']).default('SUCCESS').optional(),
  contentHash: z.string().nullable().optional(),
  retrievalMethod: z.string().nullable().optional()
});
export type CreateIntelligenceSourceDto = z.infer<typeof createIntelligenceSourceDtoSchema>;

// 7. Intelligence Evidence DTO
export const createIntelligenceEvidenceDtoSchema = z.object({
  id: entityIdField.optional(),
  companyId: entityIdField,
  sourceId: entityIdField,
  evidenceType: z.string().min(1),
  key: z.string().min(1),
  value: z.string(),
  rawExcerpt: z.string().max(4096).nullable().optional(), // Max 4KB
  extractionMethod: z.enum(['REGEX', 'DOM_SELECTOR', 'LLM', 'HEURISTIC']).default('DOM_SELECTOR').optional()
});
export type CreateIntelligenceEvidenceDto = z.infer<typeof createIntelligenceEvidenceDtoSchema>;

// Bulk Intelligence Evidence (Max 200)
export const bulkIntelligenceEvidenceDtoSchema = z.object({
  evidence: z.array(createIntelligenceEvidenceDtoSchema).min(1).max(200)
});
export type BulkIntelligenceEvidenceDto = z.infer<typeof bulkIntelligenceEvidenceDtoSchema>;

// 8. Intelligence Claim DTO
export const createIntelligenceClaimDtoSchema = z.object({
  id: entityIdField.optional(),
  companyId: entityIdField,
  evidenceIds: z.array(entityIdField).default([]).optional(),
  subject: z.string().min(1),
  predicate: z.string().min(1),
  objectValue: z.string(),
  verificationStatus: z.enum(['UNVERIFIED', 'VERIFIED', 'DISPUTED', 'REFUTED']).default('VERIFIED').optional()
});
export type CreateIntelligenceClaimDto = z.infer<typeof createIntelligenceClaimDtoSchema>;

// 9. Intelligence Inference DTO
export const createIntelligenceInferenceDtoSchema = z.object({
  id: entityIdField.optional(),
  companyId: entityIdField,
  supportingClaimIds: z.array(entityIdField).default([]).optional(),
  field: z.string().min(1),
  value: z.string(),
  inferenceMethod: z.enum(['RULE_HEURISTIC', 'LLM_INFERENCE', 'REGRESSION']).default('RULE_HEURISTIC').optional(),
  confidence: z.number().min(0).max(1).default(0.8).optional(),
  reason: z.string()
});
export type CreateIntelligenceInferenceDto = z.infer<typeof createIntelligenceInferenceDtoSchema>;
