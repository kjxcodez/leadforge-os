import mongoose, { Schema } from 'mongoose';
import {
  workspacePlugin,
  type WorkspaceScopedDocument
} from '../plugins/index.js';

export interface IntelligenceInferenceDocument extends mongoose.Document, WorkspaceScopedDocument {
  companyId: string;
  supportingClaimIds: string[];
  field: string;
  value: string;
  inferenceMethod: 'RULE_HEURISTIC' | 'LLM_INFERENCE' | 'REGRESSION';
  confidence: number;
  reason: string;
  createdAt: Date;
}

const intelligenceInferenceSchema = new Schema<IntelligenceInferenceDocument>(
  {
    companyId: {
      type: String,
      required: true,
      index: true
    },
    supportingClaimIds: { type: [String], default: [] },
    field: { type: String, required: true, trim: true, index: true },
    value: { type: String, required: true },
    inferenceMethod: {
      type: String,
      required: true,
      enum: ['RULE_HEURISTIC', 'LLM_INFERENCE', 'REGRESSION'],
      default: 'RULE_HEURISTIC'
    },
    confidence: { type: Number, required: true, default: 0.8, min: 0, max: 1 },
    reason: { type: String, required: true },
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
intelligenceInferenceSchema.index({ workspaceId: 1, companyId: 1, field: 1 });

intelligenceInferenceSchema.plugin(workspacePlugin);

export const IntelligenceInferenceModel = mongoose.models.IntelligenceInference
  ? (mongoose.models.IntelligenceInference as mongoose.Model<IntelligenceInferenceDocument>)
  : mongoose.model<IntelligenceInferenceDocument>('IntelligenceInference', intelligenceInferenceSchema);
