import mongoose, { Schema } from 'mongoose';
import { workspacePlugin, type WorkspaceScopedDocument } from '../plugins/index.js';

export interface EmailTemplateDocument extends mongoose.Document, WorkspaceScopedDocument {
  name: string;
  subject: string;
  body: string;
  variables: string[];
  createdAt: Date;
  updatedAt: Date;
}

const emailTemplateSchema = new Schema<EmailTemplateDocument>(
  {
    name: { type: String, required: true, trim: true },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    variables: { type: [String], default: [] }
  },
  {
    timestamps: true,
    strict: true
  }
);

emailTemplateSchema.plugin(workspacePlugin);

export const EmailTemplateModel = mongoose.models.EmailTemplate
  ? (mongoose.models.EmailTemplate as mongoose.Model<EmailTemplateDocument>)
  : mongoose.model<EmailTemplateDocument>('EmailTemplate', emailTemplateSchema);
