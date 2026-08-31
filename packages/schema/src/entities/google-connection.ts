import { z } from 'zod';
import { entityIdField } from '../fields/common.js';

export const googleConnectionStatusSchema = z.enum([
  'active',
  'reauth_required',
  'disconnected'
]);
export type GoogleConnectionStatus = z.infer<typeof googleConnectionStatusSchema>;

export const googleGmailStatusSchema = z.enum([
  'connected',
  'reauth_required',
  'revoked',
  'error'
]);
export type GoogleGmailStatus = z.infer<typeof googleGmailStatusSchema>;

export const googleDriveStatusSchema = z.enum([
  'authorized',
  'not_authorized',
  'reauth_required',
  'revoked',
  'error'
]);
export type GoogleDriveStatus = z.infer<typeof googleDriveStatusSchema>;

export const googleConnectionSchema = z.object({
  id: entityIdField,
  workspaceId: entityIdField,
  userId: entityIdField,
  googleAccountId: z.string().min(1), // Google subject / stable provider sub
  email: z.string().email(),
  name: z.string().nullable().optional(),
  picture: z.string().url().nullable().optional(),
  grantedScopes: z.array(z.string()).default([]),
  gmailStatus: googleGmailStatusSchema.default('connected'),
  driveStatus: googleDriveStatusSchema.default('not_authorized'),
  status: googleConnectionStatusSchema.default('active'),
  lastVerifiedAt: z.union([z.date(), z.string()]).nullable().optional(),
  lastError: z.string().nullable().optional(),
  createdAt: z.union([z.date(), z.string()]),
  updatedAt: z.union([z.date(), z.string()])
});

export type GoogleConnection = z.infer<typeof googleConnectionSchema>;

export const createGoogleConnectionDtoSchema = z.object({
  id: entityIdField.optional(),
  googleAccountId: z.string().min(1),
  email: z.string().email(),
  name: z.string().optional(),
  picture: z.string().url().optional(),
  grantedScopes: z.array(z.string()).optional(),
  refreshToken: z.string().min(1),
  accessToken: z.string().optional(),
  tokenExpiresAt: z.union([z.date(), z.string()]).optional(),
  gmailStatus: googleGmailStatusSchema.optional(),
  driveStatus: googleDriveStatusSchema.optional()
});

export type CreateGoogleConnectionDto = z.infer<typeof createGoogleConnectionDtoSchema>;

export const updateGoogleConnectionDtoSchema = z.object({
  name: z.string().optional(),
  picture: z.string().url().optional(),
  grantedScopes: z.array(z.string()).optional(),
  refreshToken: z.string().optional(),
  accessToken: z.string().optional(),
  tokenExpiresAt: z.union([z.date(), z.string()]).optional(),
  gmailStatus: googleGmailStatusSchema.optional(),
  driveStatus: googleDriveStatusSchema.optional(),
  status: googleConnectionStatusSchema.optional(),
  lastVerifiedAt: z.union([z.date(), z.string()]).optional(),
  lastError: z.string().nullable().optional()
});

export type UpdateGoogleConnectionDto = z.infer<typeof updateGoogleConnectionDtoSchema>;
