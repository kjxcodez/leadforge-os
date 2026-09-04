import { z } from 'zod';
import { EmailQualityStatus, BounceCategory, SuppressionReason } from '../enums/index.js';
import { entityIdField } from '../fields/common.js';

export const emailEvidenceSourceSchema = z.enum([
  'syntax',
  'domain_dns',
  'mx',
  'disposable_db',
  'role_account',
  'catch_all',
  'historical_delivery',
  'historical_bounce',
  'provider_rejection',
  'verification_provider',
  'manual_review'
]);
export type EmailEvidenceSource = z.infer<typeof emailEvidenceSourceSchema>;

export const emailEvidenceResultSchema = z.enum(['pass', 'fail', 'risky', 'unknown']);
export type EmailEvidenceResult = z.infer<typeof emailEvidenceResultSchema>;

export const emailQualityEvidenceSchema = z.object({
  id: z.string(),
  source: emailEvidenceSourceSchema,
  observedAt: z.string(), // ISO string
  result: emailEvidenceResultSchema,
  confidence: z.number().min(0).max(1),
  details: z.record(z.any()).optional(),
  expiresAt: z.string().optional() // ISO string
});
export type EmailQualityEvidence = z.infer<typeof emailQualityEvidenceSchema>;

export const emailRiskLevelSchema = z.enum(['low', 'moderate', 'high', 'prohibited']);
export type EmailRiskLevel = z.infer<typeof emailRiskLevelSchema>;

export const emailRecommendedActionSchema = z.enum([
  'send',
  'caution',
  'verify_required',
  'do_not_send'
]);
export type EmailRecommendedAction = z.infer<typeof emailRecommendedActionSchema>;

export const emailQualityResultSchema = z.object({
  email: z.string(),
  status: z.nativeEnum(EmailQualityStatus),
  sendable: z.boolean(),
  riskLevel: emailRiskLevelSchema,
  reasons: z.array(z.string()),
  evidence: z.array(emailQualityEvidenceSchema),
  recommendedAction: emailRecommendedActionSchema,
  evaluatedAt: z.string()
});
export type EmailQualityResult = z.infer<typeof emailQualityResultSchema>;

export const emailVerificationResultSchema = z.object({
  email: z.string(),
  syntaxValid: z.boolean(),
  domainValid: z.boolean(),
  mxValid: z.boolean(),
  primaryMx: z.string().nullable().optional(),
  isDisposable: z.boolean(),
  isRoleAccount: z.boolean(),
  isCatchAll: z.boolean().nullable().optional(),
  mailboxVerified: z.boolean().nullable().optional(),
  provider: z.string(),
  confidence: z.number().min(0).max(1),
  rawDetails: z.record(z.any()).optional(),
  verifiedAt: z.string()
});
export type EmailVerificationResult = z.infer<typeof emailVerificationResultSchema>;
