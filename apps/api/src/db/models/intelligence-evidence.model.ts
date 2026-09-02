import mongoose, { Schema } from 'mongoose';
import {
  workspacePlugin,
  timestampPlugin,
  type WorkspaceScopedDocument,
  type TimestampDocument
} from '../plugins/index.js';

export interface IntelligenceEvidenceDocument
  extends mongoose.Document,
    WorkspaceScopedDocument,
    TimestampDocument {
  companyId: string;
  sourceId: string;
  evidenceType: string;
  key: string;
  value: string;
  rawExcerpt?: string | null;
  extractionMethod: 'REGEX' | 'DOM_SELECTOR' | 'LLM' | 'HEURISTIC';
  observedAt: Date;
}

const intelligenceEvidenceSchema = new Schema<IntelligenceEvidenceDocument>(
  {
    companyId: {
      type: String,
      required: true,
      index: true
    },
    sourceId: {
      type: String,
      required: true,
      index: true
    },
    evidenceType: { type: String, required: true, trim: true, index: true },
    key: { type: String, required: true, trim: true, index: true },
    value: { type: String, required: true },
    rawExcerpt: { type: String, default: null, maxlength: 4096 },
    extractionMethod: {
      type: String,
      enum: ['REGEX', 'DOM_SELECTOR', 'LLM', 'HEURISTIC'],
      default: 'DOM_SELECTOR'
    },
    observedAt: { type: Date, required: true, default: Date.now }
  },
  {
    strict: true
  }
);

// Strategic Indexes:
intelligenceEvidenceSchema.index({ workspaceId: 1, companyId: 1, sourceId: 1 });
intelligenceEvidenceSchema.index({ workspaceId: 1, key: 1 });

intelligenceEvidenceSchema.plugin(workspacePlugin);
intelligenceEvidenceSchema.plugin(timestampPlugin);

export const IntelligenceEvidenceModel = mongoose.models.IntelligenceEvidence
  ? (mongoose.models.IntelligenceEvidence as mongoose.Model<IntelligenceEvidenceDocument>)
  : mongoose.model<IntelligenceEvidenceDocument>('IntelligenceEvidence', intelligenceEvidenceSchema);
