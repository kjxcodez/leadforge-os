import mongoose, { Schema } from 'mongoose';
import { workspacePlugin, type WorkspaceScopedDocument } from '../plugins/index.js';

export interface DiscoveryContact {
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  linkedinUrl?: string | null;
}

export interface DiscoveryResultDocument extends mongoose.Document, WorkspaceScopedDocument {
  jobId: mongoose.Types.ObjectId;
  companyName: string;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  description?: string | null;
  status: 'pending' | 'imported' | 'skipped';
  contacts: DiscoveryContact[];
  createdAt: Date;
  updatedAt: Date;
}

const discoveryResultSchema = new Schema<DiscoveryResultDocument>(
  {
    jobId: { type: Schema.Types.ObjectId, ref: 'DiscoveryJob', required: true },
    companyName: { type: String, required: true, trim: true },
    website: { type: String, default: null, trim: true },
    email: { type: String, default: null, trim: true },
    phone: { type: String, default: null, trim: true },
    linkedinUrl: { type: String, default: null, trim: true },
    description: { type: String, default: null },
    status: {
      type: String,
      enum: ['pending', 'imported', 'skipped'],
      default: 'pending'
    },
    contacts: {
      type: [
        {
          firstName: { type: String, required: true },
          lastName: { type: String, default: null },
          email: { type: String, default: null },
          phone: { type: String, default: null },
          title: { type: String, default: null },
          linkedinUrl: { type: String, default: null }
        }
      ],
      default: []
    }
  },
  {
    timestamps: true,
    strict: true
  }
);

discoveryResultSchema.plugin(workspacePlugin);

export const DiscoveryResultModel = mongoose.models.DiscoveryResult
  ? (mongoose.models.DiscoveryResult as mongoose.Model<DiscoveryResultDocument>)
  : mongoose.model<DiscoveryResultDocument>('DiscoveryResult', discoveryResultSchema);
export { discoveryResultSchema };
