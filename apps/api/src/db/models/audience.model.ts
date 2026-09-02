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
  name: string;
  description?: string | null;
  entityType: 'companies' | 'contacts' | 'both';
  mode: 'dynamic' | 'static';
  filterDefinition: Record<string, any>;
  staticMemberIds?: string[];
}

const audienceSchema = new Schema<AudienceDocument>(
  {
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
    mode: {
      type: String,
      enum: ['dynamic', 'static'],
      default: 'dynamic'
    },
    filterDefinition: {
      type: Schema.Types.Mixed,
      required: true,
      default: {}
    },
    staticMemberIds: {
      type: [String],
      default: undefined
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
