import mongoose, { Schema } from 'mongoose';
import {
  workspacePlugin,
  timestampPlugin,
  type WorkspaceScopedDocument,
  type TimestampDocument
} from '../plugins/index.js';

export interface WebsiteIntelligenceDocument
  extends mongoose.Document,
    WorkspaceScopedDocument,
    TimestampDocument {
  companyId: string;
  brandVoice?: string | null;
  contentQuality?: string | null;
  buyingSignals: string[];
  seoSignals?: Record<string, any> | null;
  technicalIssues: string[];
  productsServices: string[];
  testimonialsCaseStudies: string[];
}

const websiteIntelligenceSchema = new Schema<WebsiteIntelligenceDocument>(
  {
    companyId: {
      type: String,
      required: true,
      index: true
    },
    brandVoice: { type: String, default: null },
    contentQuality: { type: String, default: null },
    buyingSignals: { type: [String], default: [] },
    seoSignals: { type: Schema.Types.Mixed, default: null },
    technicalIssues: { type: [String], default: [] },
    productsServices: { type: [String], default: [] },
    testimonialsCaseStudies: { type: [String], default: [] }
  },
  {
    strict: true
  }
);

websiteIntelligenceSchema.index({ workspaceId: 1, companyId: 1 }, { unique: true });

websiteIntelligenceSchema.plugin(workspacePlugin);
websiteIntelligenceSchema.plugin(timestampPlugin);

export const WebsiteIntelligenceModel = mongoose.models.WebsiteIntelligence
  ? (mongoose.models.WebsiteIntelligence as mongoose.Model<WebsiteIntelligenceDocument>)
  : mongoose.model<WebsiteIntelligenceDocument>('WebsiteIntelligence', websiteIntelligenceSchema);
