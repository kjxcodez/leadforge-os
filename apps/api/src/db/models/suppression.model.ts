import mongoose, { Schema } from 'mongoose';
import { workspacePlugin, type WorkspaceScopedDocument } from '../plugins/index.js';
import { SuppressionReason } from '@leadforge/schema';

export interface SuppressionDocument extends mongoose.Document, WorkspaceScopedDocument {
  email: string;
  reason: SuppressionReason;
  source: string;
  evidence?: Record<string, any> | null;
  suppressedAt: Date;
  suppressedBy?: string | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const suppressionSchema = new Schema<SuppressionDocument>(
  {
    workspaceId: { type: String, required: true, index: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    reason: {
      type: String,
      enum: Object.values(SuppressionReason),
      required: true
    },
    source: { type: String, default: 'system' },
    evidence: { type: Schema.Types.Mixed, default: null },
    suppressedAt: { type: Date, default: Date.now, required: true },
    suppressedBy: { type: String, default: null },
    notes: { type: String, default: null }
  },
  {
    timestamps: true,
    collection: 'suppressions'
  }
);

suppressionSchema.plugin(workspacePlugin);
suppressionSchema.index({ workspaceId: 1, email: 1 }, { unique: true });
suppressionSchema.index({ workspaceId: 1, reason: 1 });

export const SuppressionModel =
  (mongoose.models.Suppression as mongoose.Model<SuppressionDocument>) ||
  mongoose.model<SuppressionDocument>('Suppression', suppressionSchema);
