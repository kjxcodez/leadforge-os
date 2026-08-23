import mongoose, { Schema } from 'mongoose';
import {
  workspacePlugin,
  timestampPlugin,
  type WorkspaceScopedDocument,
  type TimestampDocument
} from '../plugins/index.js';

export interface CompanyDiscoveryRunDocument
  extends mongoose.Document,
    WorkspaceScopedDocument,
    TimestampDocument {
  _id: any;
  companyId: string;
  discoveryRunId: string;
  requiresReview?: boolean;
}

const companyDiscoveryRunSchema = new Schema<CompanyDiscoveryRunDocument>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString()
    },
    companyId: {
      type: String,
      required: true,
      index: true
    },
    discoveryRunId: {
      type: String,
      required: true,
      index: true
    },
    requiresReview: {
      type: Boolean,
      default: false
    }
  },
  {
    strict: true,
    timestamps: true
  }
);

companyDiscoveryRunSchema.index({ workspaceId: 1, companyId: 1, discoveryRunId: 1 }, { unique: true });
companyDiscoveryRunSchema.index({ workspaceId: 1, discoveryRunId: 1 });
companyDiscoveryRunSchema.plugin(workspacePlugin);
companyDiscoveryRunSchema.plugin(timestampPlugin);

export const CompanyDiscoveryRunModel = mongoose.models.CompanyDiscoveryRun
  ? (mongoose.models.CompanyDiscoveryRun as mongoose.Model<CompanyDiscoveryRunDocument>)
  : mongoose.model<CompanyDiscoveryRunDocument>('CompanyDiscoveryRun', companyDiscoveryRunSchema);

export { companyDiscoveryRunSchema };
