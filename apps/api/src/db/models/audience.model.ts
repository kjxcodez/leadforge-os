import mongoose, { Schema } from 'mongoose';
import {
  workspacePlugin,
  softDeletePlugin,
  timestampPlugin,
  type WorkspaceScopedDocument,
  type SoftDeleteDocument,
  type TimestampDocument
} from '../plugins/index.js';

export interface AudienceDocument
  extends mongoose.Document,
    WorkspaceScopedDocument,
    SoftDeleteDocument,
    TimestampDocument {
  _id: any;
  name: string;
  description?: string | null;
  entityType: 'companies' | 'contacts' | 'both';
  filterDefinition: Record<string, any>;
}

const audienceSchema = new Schema<AudienceDocument>(
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
    description: {
      type: String,
      default: null,
      trim: true
    },
    entityType: {
      type: String,
      enum: ['companies', 'contacts', 'both'],
      default: 'contacts'
    },
    filterDefinition: {
      type: Schema.Types.Mixed,
      required: true,
      default: {}
    }
  },
  {
    strict: true,
    timestamps: true
  }
);

audienceSchema.index({ workspaceId: 1, name: 1 });
audienceSchema.plugin(workspacePlugin);
audienceSchema.plugin(softDeletePlugin);
audienceSchema.plugin(timestampPlugin);

export const AudienceModel = mongoose.models.Audience
  ? (mongoose.models.Audience as mongoose.Model<AudienceDocument>)
  : mongoose.model<AudienceDocument>('Audience', audienceSchema);

export { audienceSchema };
