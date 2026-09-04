import mongoose, { Schema } from 'mongoose';
import {
  workspacePlugin,
  softDeletePlugin,
  type WorkspaceScopedDocument,
  type SoftDeleteDocument
} from '../plugins/index.js';

export interface TemplateAttachment {
  id: string;
  provider: 'google-drive' | 'local';
  fileId?: string | null;
  filename: string;
  mimeType?: string | null;
  size: number;
  driveUrl?: string | null;
  thumbnailUrl?: string | null;
  googleConnectionId?: string | null;
  storagePath?: string | null;
}

export interface EmailTemplateDocument
  extends mongoose.Document,
    WorkspaceScopedDocument,
    SoftDeleteDocument {
  name: string;
  subject: string;
  body: string;
  variables: string[];
  attachments: TemplateAttachment[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateVersionDocument
  extends mongoose.Document,
    WorkspaceScopedDocument {
  templateId: string;
  version: number;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  attachments: TemplateAttachment[];
  createdAt: Date;
}

const templateAttachmentSchema = new Schema<TemplateAttachment>(
  {
    id: { type: String, required: true },
    provider: { type: String, enum: ['google-drive', 'local'], default: 'google-drive' },
    fileId: { type: String, default: null },
    filename: { type: String, required: true },
    mimeType: { type: String, default: null },
    size: { type: Number, required: true },
    driveUrl: { type: String, default: null },
    thumbnailUrl: { type: String, default: null },
    googleConnectionId: { type: String, default: null },
    storagePath: { type: String, default: null }
  },
  { _id: false }
);

const emailTemplateSchema = new Schema<EmailTemplateDocument>(
  {
    name: { type: String, required: true, trim: true },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    variables: { type: [String], default: [] },
    attachments: { type: [templateAttachmentSchema], default: [] },
    version: { type: Number, default: 1, required: true }
  },
  {
    timestamps: true,
    strict: true
  }
);

emailTemplateSchema.index({ workspaceId: 1, name: 1 });
emailTemplateSchema.plugin(workspacePlugin);
emailTemplateSchema.plugin(softDeletePlugin);

export const EmailTemplateModel = mongoose.models.EmailTemplate
  ? (mongoose.models.EmailTemplate as mongoose.Model<EmailTemplateDocument>)
  : mongoose.model<EmailTemplateDocument>('EmailTemplate', emailTemplateSchema);

const templateVersionSchema = new Schema<TemplateVersionDocument>(
  {
    templateId: { type: String, required: true, index: true },
    version: { type: Number, required: true },
    name: { type: String, required: true },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    variables: { type: [String], default: [] },
    attachments: { type: [templateAttachmentSchema], default: [] }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    strict: true
  }
);

templateVersionSchema.index({ workspaceId: 1, templateId: 1, version: 1 }, { unique: true });
templateVersionSchema.plugin(workspacePlugin);

export const TemplateVersionModel = mongoose.models.TemplateVersion
  ? (mongoose.models.TemplateVersion as mongoose.Model<TemplateVersionDocument>)
  : mongoose.model<TemplateVersionDocument>('TemplateVersion', templateVersionSchema);

