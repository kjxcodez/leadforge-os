import mongoose, { Schema } from 'mongoose';
import {
  workspacePlugin,
  timestampPlugin,
  type WorkspaceScopedDocument,
  type TimestampDocument
} from '../plugins/index.js';

export interface WorkspaceMemoryDocument
  extends mongoose.Document,
    WorkspaceScopedDocument,
    TimestampDocument {
  scope: string;
  key: string;
  value: any;
}

const workspaceMemorySchema = new Schema<WorkspaceMemoryDocument>(
  {
    scope: { type: String, required: true, trim: true, index: true },
    key: { type: String, required: true, trim: true, index: true },
    value: { type: Schema.Types.Mixed, default: null }
  },
  {
    strict: true
  }
);

// Compound unique key constraint per tenant scope
workspaceMemorySchema.index({ workspaceId: 1, scope: 1, key: 1 }, { unique: true });

workspaceMemorySchema.plugin(workspacePlugin);
workspaceMemorySchema.plugin(timestampPlugin);

export const WorkspaceMemoryModel = mongoose.models.WorkspaceMemory
  ? (mongoose.models.WorkspaceMemory as mongoose.Model<WorkspaceMemoryDocument>)
  : mongoose.model<WorkspaceMemoryDocument>('WorkspaceMemory', workspaceMemorySchema);
