import mongoose, { Schema } from 'mongoose';
import {
  workspacePlugin,
  timestampPlugin,
  type WorkspaceScopedDocument,
  type TimestampDocument
} from '../plugins/index.js';

export interface IntelligenceSourceDocument
  extends mongoose.Document,
    WorkspaceScopedDocument,
    TimestampDocument {
  companyId?: string | null;
  sourceType: 'WEBSITE' | 'GOOGLE_MAPS' | 'LINKEDIN' | 'REGISTRY' | 'MANUAL';
  url?: string | null;
  retrievedAt: Date;
  status: 'SUCCESS' | 'FAILED' | 'STALE';
  contentHash?: string | null;
  retrievalMethod?: string | null;
}

const intelligenceSourceSchema = new Schema<IntelligenceSourceDocument>(
  {
    companyId: {
      type: String,
      default: null,
      index: true
    },
    sourceType: {
      type: String,
      required: true,
      enum: ['WEBSITE', 'GOOGLE_MAPS', 'LINKEDIN', 'REGISTRY', 'MANUAL'],
      index: true
    },
    url: { type: String, default: null, trim: true },
    retrievedAt: { type: Date, required: true, default: Date.now },
    status: {
      type: String,
      required: true,
      enum: ['SUCCESS', 'FAILED', 'STALE'],
      default: 'SUCCESS'
    },
    contentHash: { type: String, default: null },
    retrievalMethod: { type: String, default: null }
  },
  {
    strict: true
  }
);

// Indexes:
intelligenceSourceSchema.index({ workspaceId: 1, companyId: 1, sourceType: 1 });

intelligenceSourceSchema.plugin(workspacePlugin);
intelligenceSourceSchema.plugin(timestampPlugin);

export const IntelligenceSourceModel = mongoose.models.IntelligenceSource
  ? (mongoose.models.IntelligenceSource as mongoose.Model<IntelligenceSourceDocument>)
  : mongoose.model<IntelligenceSourceDocument>('IntelligenceSource', intelligenceSourceSchema);
