import mongoose, { Schema } from 'mongoose';
import {
  workspacePlugin,
  timestampPlugin,
  type WorkspaceScopedDocument,
  type TimestampDocument
} from '../plugins/index.js';

export interface OpportunityScoreDocument
  extends mongoose.Document,
    WorkspaceScopedDocument,
    TimestampDocument {
  companyId: string;
  overallScore: number;
  fitScore: number;
  sizeScore: number;
  intentScore: number;
  urgencyScore: number;
  explanation?: string | null;
  provenance?: Record<string, any> | null;
}

const opportunityScoreSchema = new Schema<OpportunityScoreDocument>(
  {
    companyId: {
      type: String,
      required: true,
      index: true
    },
    overallScore: { type: Number, required: true, min: 0, max: 100, index: true },
    fitScore: { type: Number, default: 0, min: 0, max: 100 },
    sizeScore: { type: Number, default: 0, min: 0, max: 100 },
    intentScore: { type: Number, default: 0, min: 0, max: 100 },
    urgencyScore: { type: Number, default: 0, min: 0, max: 100 },
    explanation: { type: String, default: null },
    provenance: { type: Schema.Types.Mixed, default: null }
  },
  {
    strict: true
  }
);

// Indexes:
opportunityScoreSchema.index({ workspaceId: 1, companyId: 1 }, { unique: true });
opportunityScoreSchema.index({ workspaceId: 1, overallScore: -1 });

opportunityScoreSchema.plugin(workspacePlugin);
opportunityScoreSchema.plugin(timestampPlugin);

export const OpportunityScoreModel = mongoose.models.OpportunityScore
  ? (mongoose.models.OpportunityScore as mongoose.Model<OpportunityScoreDocument>)
  : mongoose.model<OpportunityScoreDocument>('OpportunityScore', opportunityScoreSchema);
