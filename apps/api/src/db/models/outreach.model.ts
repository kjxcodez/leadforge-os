import mongoose, { Schema } from 'mongoose';
import {
  softDeletePlugin,
  auditPlugin,
  timestampPlugin,
  workspacePlugin,
  type SoftDeleteDocument,
  type AuditDocument,
  type TimestampDocument,
  type WorkspaceScopedDocument
} from '../plugins/index.js';

export interface OutreachDocument
  extends
    mongoose.Document,
    SoftDeleteDocument,
    AuditDocument,
    TimestampDocument,
    WorkspaceScopedDocument {
  campaignId?: string | null;
  companyId?: string | null;
  contactId: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'opened' | 'replied';
  provider: 'email' | 'linkedin' | 'phone' | string;
  attempts: number;
  lastSentAt?: Date | null;
  messageDetails?: {
    messageId: string;
    threadId?: string;
    subject: string;
    body: string;
  } | null;
}

const outreachSchema = new Schema<OutreachDocument>(
  {
    campaignId: {
      type: String,
      default: null,
      index: true
    },
    companyId: {
      type: String,
      default: null,
      index: true
    },
    contactId: {
      type: String,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'failed', 'opened', 'replied'],
      default: 'pending',
      index: true
    },
    provider: {
      type: String,
      required: true
    },
    attempts: {
      type: Number,
      default: 0
    },
    lastSentAt: {
      type: Date,
      default: null
    },
    messageDetails: {
      messageId: { type: String },
      threadId: { type: String },
      subject: { type: String },
      body: { type: String }
    }
  },
  {
    strict: true,
    optimisticConcurrency: true
  }
);

outreachSchema.plugin(workspacePlugin);
outreachSchema.plugin(softDeletePlugin);
outreachSchema.plugin(auditPlugin);
outreachSchema.plugin(timestampPlugin);

export const OutreachModel = mongoose.models.Outreach
  ? (mongoose.models.Outreach as mongoose.Model<OutreachDocument>)
  : mongoose.model<OutreachDocument>('Outreach', outreachSchema);
