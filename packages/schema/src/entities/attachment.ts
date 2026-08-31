import { z } from 'zod';
import { entityIdField } from '../fields/common.js';

export const attachmentProviderSchema = z.enum(['google-drive']);
export type AttachmentProvider = z.infer<typeof attachmentProviderSchema>;

export const attachmentSchema = z.object({
  id: entityIdField,
  workspaceId: entityIdField,
  provider: attachmentProviderSchema.default('google-drive'),
  googleConnectionId: entityIdField,
  googleAccountId: z.string().min(1),
  fileId: z.string().min(1), // Google Drive fileId
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().int().nonnegative(),
  contentHash: z.string().nullable().optional(),
  metadata: z.record(z.any()).optional().default({}),
  createdAt: z.union([z.date(), z.string()]),
  updatedAt: z.union([z.date(), z.string()])
});

export type Attachment = z.infer<typeof attachmentSchema>;

export const createAttachmentDtoSchema = z.object({
  id: entityIdField.optional(),
  provider: attachmentProviderSchema.default('google-drive'),
  googleConnectionId: entityIdField,
  googleAccountId: z.string().min(1),
  fileId: z.string().min(1),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().int().nonnegative(),
  contentHash: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

export type CreateAttachmentDto = z.infer<typeof createAttachmentDtoSchema>;

export const uploadAttachmentDtoSchema = z.object({
  googleConnectionId: entityIdField,
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  contentBase64: z.string().min(1),
  idempotencyKey: z.string().optional()
});

export type UploadAttachmentDto = z.infer<typeof uploadAttachmentDtoSchema>;
