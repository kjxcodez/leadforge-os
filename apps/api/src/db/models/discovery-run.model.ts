import mongoose, { Schema } from 'mongoose';
import {
  workspacePlugin,
  softDeletePlugin,
  timestampPlugin,
  type WorkspaceScopedDocument,
  type SoftDeleteDocument,
  type TimestampDocument
} from '../plugins/index.js';

export interface DiscoveryRunDocument
  extends mongoose.Document,
    WorkspaceScopedDocument,
    SoftDeleteDocument,
    TimestampDocument {
  _id: any;
  name: string;
  query: string;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  provider: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  resultCount: number;
  error?: string | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
}

const discoveryRunSchema = new Schema<DiscoveryRunDocument>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString()
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    query: {
      type: String,
      required: true,
      trim: true
    },
    country: {
      type: String,
      default: null,
      trim: true
    },
    state: {
      type: String,
      default: null,
      trim: true
    },
    city: {
      type: String,
      default: null,
      trim: true
    },
    provider: {
      type: String,
      required: true,
      default: 'google_maps',
      trim: true
    },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed'],
      default: 'pending'
    },
    resultCount: {
      type: Number,
      default: 0
    },
    error: {
      type: String,
      default: null
    },
    startedAt: {
      type: Date,
      default: null
    },
    finishedAt: {
      type: Date,
      default: null
    }
  },
  {
    strict: true,
    timestamps: true
  }
);

discoveryRunSchema.index({ workspaceId: 1, createdAt: -1 });
discoveryRunSchema.plugin(workspacePlugin);
discoveryRunSchema.plugin(softDeletePlugin);
discoveryRunSchema.plugin(timestampPlugin);

export const DiscoveryRunModel = mongoose.models.DiscoveryRun
  ? (mongoose.models.DiscoveryRun as mongoose.Model<DiscoveryRunDocument>)
  : mongoose.model<DiscoveryRunDocument>('DiscoveryRun', discoveryRunSchema);

export { discoveryRunSchema };
