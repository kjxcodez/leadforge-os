import mongoose, { Schema } from 'mongoose';
import {
  workspacePlugin,
  type WorkspaceScopedDocument
} from '../plugins/index.js';

export interface IntelligenceClaimDocument extends mongoose.Document, WorkspaceScopedDocument {
  companyId: string;
  evidenceIds: string[];
  subject: string;
  predicate: string;
  objectValue: string;
  verificationStatus: 'UNVERIFIED' | 'VERIFIED' | 'DISPUTED' | 'REFUTED';
  createdAt: Date;
}

const intelligenceClaimSchema = new Schema<IntelligenceClaimDocument>(
  {
    companyId: {
      type: String,
      required: true,
      index: true
    },
    evidenceIds: { type: [String], default: [] },
    subject: { type: String, required: true, trim: true, index: true },
    predicate: { type: String, required: true, trim: true },
    objectValue: { type: String, required: true },
    verificationStatus: {
      type: String,
      required: true,
      enum: ['UNVERIFIED', 'VERIFIED', 'DISPUTED', 'REFUTED'],
      default: 'VERIFIED',
      index: true
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now
    }
  },
  {
    strict: true,
    timestamps: false
  }
);

// Indexes:
intelligenceClaimSchema.index({ workspaceId: 1, companyId: 1, subject: 1 });

intelligenceClaimSchema.plugin(workspacePlugin);

export const IntelligenceClaimModel = mongoose.models.IntelligenceClaim
  ? (mongoose.models.IntelligenceClaim as mongoose.Model<IntelligenceClaimDocument>)
  : mongoose.model<IntelligenceClaimDocument>('IntelligenceClaim', intelligenceClaimSchema);
