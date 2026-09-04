import { z } from 'zod';
import { ContactStatus, ContactEmailStatus } from '../enums/index.js';
import { entityIdField, entityIdFieldNullable, nameField, emailField, phoneField, urlField } from '../fields/common.js';

export const contactStatusSchema = z.nativeEnum(ContactStatus);
export const contactEmailStatusSchema = z.nativeEnum(ContactEmailStatus);

export const contactEmailMetaSchema = z.object({
  raw: z.string().optional(),
  sourceUrl: z.string().optional(),
  sourceType: z.enum(['mailto', 'json_ld', 'dom_text', 'metadata', 'manual', 'unknown']).optional(),
  confidenceTier: z.enum(['exact', 'recovered', 'role_based', 'third_party', 'ambiguous', 'invalid', 'quarantined']).optional(),
  domainMatched: z.boolean().optional(),
  repaired: z.boolean().optional(),
  repairRule: z.string().nullable().optional(),
  isRoleAccount: z.boolean().optional()
});
export type ContactEmailMeta = z.infer<typeof contactEmailMetaSchema>;

export const contactSchema = z.object({
  id: entityIdField,
  workspaceId: entityIdField,
  companyId: entityIdFieldNullable,
  firstName: z.string().max(100).nullable().optional(),
  lastName: z.string().nullable().optional(),
  email: emailField.nullable().optional(),
  phone: phoneField.nullable().optional(),
  title: z.string().nullable().optional(),
  linkedin: z.string().nullable().optional(),
  linkedinUrl: urlField.nullable().optional(),
  source: z.string().nullable().optional(),
  status: contactStatusSchema,
  /**
   * Validation lifecycle for the contact's email address.
   * - UNVERIFIED (default): address has not been validated.
   * - VALID: passed sanitization checks; eligible for outreach.
   * - QUARANTINED: address is corrupted or ambiguous; excluded from outreach.
   * - INVALID: confirmed invalid (e.g. permanent bounce).
   */
  emailStatus: contactEmailStatusSchema.optional(),
  emailMeta: contactEmailMetaSchema.nullable().optional(),
  /**
   * Phase 10: Authoritative structured email quality evaluation.
   */
  emailQuality: z.record(z.any()).nullable().optional(),
  /**
   * Phase 10: Multi-email address identity support for contact.
   */
  additionalEmails: z.array(
    z.object({
      email: emailField,
      status: contactEmailStatusSchema.optional(),
      isPrimary: z.boolean().optional(),
      emailQuality: z.record(z.any()).nullable().optional()
    })
  ).optional(),
  notes: z.string().nullable().optional(),
  lastContactedAt: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});

export type Contact = z.infer<typeof contactSchema>;

