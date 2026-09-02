import { z } from 'zod';
import { entityIdField, entityIdFieldNullable } from '../fields/common.js';

export const leadConfidenceSchema = z.enum([
  'VERY_LOW',
  'LOW',
  'MEDIUM',
  'HIGH',
  'VERY_HIGH'
]);
export type LeadConfidence = z.infer<typeof leadConfidenceSchema>;

export const companyIntelligenceSchema = z.object({
  id: entityIdField,
  workspaceId: entityIdField,
  companyId: entityIdField,
  summary: z.string().nullable().optional(),
  openingLine: z.string().nullable().optional(),
  techStack: z.array(z.string()).default([]),
  businessModel: z.string().nullable().optional(),
  estimatedRevenue: z.string().nullable().optional(),
  growthSignals: z.array(z.string()).default([]),
  hiringSignals: z.array(z.string()).default([]),
  decisionMakerLikelihood: z.number().min(0).max(1).nullable().optional(),
  leadConfidence: leadConfidenceSchema.nullable().optional(),
  missingInformation: z.array(z.string()).default([]),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});
export type CompanyIntelligence = z.infer<typeof companyIntelligenceSchema>;

export const websiteIntelligenceSchema = z.object({
  id: entityIdField,
  workspaceId: entityIdField,
  companyId: entityIdField,
  brandVoice: z.string().nullable().optional(),
  contentQuality: z.string().nullable().optional(),
  buyingSignals: z.array(z.string()).default([]),
  seoSignals: z.record(z.string(), z.any()).nullable().optional(),
  technicalIssues: z.array(z.string()).default([]),
  productsServices: z.array(z.string()).default([]),
  testimonialsCaseStudies: z.array(z.string()).default([]),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});
export type WebsiteIntelligence = z.infer<typeof websiteIntelligenceSchema>;

export const contactSenioritySchema = z.enum([
  'C_LEVEL',
  'VP',
  'DIRECTOR',
  'MANAGER',
  'INDIVIDUAL_CONTRIBUTOR',
  'UNKNOWN'
]);
export type ContactSeniority = z.infer<typeof contactSenioritySchema>;

export const contactIntelligenceSchema = z.object({
  id: entityIdField,
  workspaceId: entityIdField,
  contactId: entityIdField,
  decisionMakerScore: z.number().min(0).max(1).nullable().optional(),
  seniority: contactSenioritySchema.default('UNKNOWN'),
  buyingInfluence: z.string().nullable().optional(),
  personalizationOpportunities: z.array(z.string()).default([]),
  relationshipStrength: z.number().min(0).max(1).nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});
export type ContactIntelligence = z.infer<typeof contactIntelligenceSchema>;

export const opportunityScoreSchema = z.object({
  id: entityIdField,
  workspaceId: entityIdField,
  companyId: entityIdField,
  overallScore: z.number().min(0).max(100),
  fitScore: z.number().min(0).max(100).default(0),
  sizeScore: z.number().min(0).max(100).default(0),
  intentScore: z.number().min(0).max(100).default(0),
  urgencyScore: z.number().min(0).max(100).default(0),
  explanation: z.string().nullable().optional(),
  provenance: z.record(z.string(), z.any()).nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});
export type OpportunityScore = z.infer<typeof opportunityScoreSchema>;

export const pageCrawlSchema = z.object({
  id: entityIdField,
  workspaceId: entityIdField,
  companyId: entityIdField,
  url: z.string().url(),
  status: z.number().int().default(200),
  contentHash: z.string().min(1),
  extractedText: z.string().nullable().optional(),
  rawHtmlLength: z.number().int().default(0),
  crawledAt: z.coerce.date()
});
export type PageCrawl = z.infer<typeof pageCrawlSchema>;

export const intelligenceSourceSchema = z.object({
  id: entityIdField,
  workspaceId: entityIdField,
  companyId: entityIdFieldNullable,
  sourceType: z.enum(['WEBSITE', 'GOOGLE_MAPS', 'LINKEDIN', 'REGISTRY', 'MANUAL']),
  url: z.string().nullable().optional(),
  retrievedAt: z.coerce.date(),
  status: z.enum(['SUCCESS', 'FAILED', 'STALE']).default('SUCCESS'),
  contentHash: z.string().nullable().optional(),
  retrievalMethod: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});
export type IntelligenceSource = z.infer<typeof intelligenceSourceSchema>;

export const intelligenceEvidenceSchema = z.object({
  id: entityIdField,
  workspaceId: entityIdField,
  companyId: entityIdField,
  sourceId: entityIdField,
  evidenceType: z.string().min(1),
  key: z.string().min(1),
  value: z.string(),
  rawExcerpt: z.string().nullable().optional(),
  extractionMethod: z.enum(['REGEX', 'DOM_SELECTOR', 'LLM', 'HEURISTIC']).default('DOM_SELECTOR'),
  observedAt: z.coerce.date(),
  createdAt: z.coerce.date()
});
export type IntelligenceEvidence = z.infer<typeof intelligenceEvidenceSchema>;

export const intelligenceClaimSchema = z.object({
  id: entityIdField,
  workspaceId: entityIdField,
  companyId: entityIdField,
  evidenceIds: z.array(entityIdField).default([]),
  subject: z.string().min(1),
  predicate: z.string().min(1),
  objectValue: z.string(),
  verificationStatus: z.enum(['UNVERIFIED', 'VERIFIED', 'DISPUTED', 'REFUTED']).default('VERIFIED'),
  createdAt: z.coerce.date()
});
export type IntelligenceClaim = z.infer<typeof intelligenceClaimSchema>;

export const intelligenceInferenceSchema = z.object({
  id: entityIdField,
  workspaceId: entityIdField,
  companyId: entityIdField,
  supportingClaimIds: z.array(entityIdField).default([]),
  field: z.string().min(1),
  value: z.string(),
  inferenceMethod: z.enum(['RULE_HEURISTIC', 'LLM_INFERENCE', 'REGRESSION']).default('RULE_HEURISTIC'),
  confidence: z.number().min(0).max(1).default(0.8),
  reason: z.string(),
  createdAt: z.coerce.date()
});
export type IntelligenceInference = z.infer<typeof intelligenceInferenceSchema>;

export const workspaceMemorySchema = z.object({
  id: entityIdField,
  workspaceId: entityIdField,
  scope: z.string().min(1),
  key: z.string().min(1),
  value: z.any(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});
export type WorkspaceMemory = z.infer<typeof workspaceMemorySchema>;

export const auditLogSchema = z.object({
  id: entityIdField,
  workspaceId: entityIdField,
  actor: z.object({
    userId: entityIdFieldNullable,
    type: z.enum(['user', 'system', 'worker']),
    ip: z.string().nullable().optional()
  }),
  action: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  beforeValue: z.record(z.string(), z.any()).nullable().optional(),
  afterValue: z.record(z.string(), z.any()).nullable().optional(),
  timestamp: z.coerce.date()
});
export type AuditLog = z.infer<typeof auditLogSchema>;
