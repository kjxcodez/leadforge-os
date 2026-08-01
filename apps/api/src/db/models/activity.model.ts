import mongoose, { Schema } from 'mongoose';
import { workspacePlugin, type WorkspaceScopedDocument } from '../plugins/index.js';

export interface ActivityDocument extends mongoose.Document, WorkspaceScopedDocument {
  type: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const activitySchema = new Schema<ActivityDocument>(
  {
    type: {
      type: String,
      required: true,
      trim: true
    },
    content: {
      type: String,
      required: true,
      trim: true
    }
  },
  {
    strict: true,
    timestamps: true
  }
);

activitySchema.index({ workspaceId: 1, createdAt: -1 });

activitySchema.plugin(workspacePlugin);

export const ActivityModel = mongoose.models.Activity
  ? (mongoose.models.Activity as mongoose.Model<ActivityDocument>)
  : mongoose.model<ActivityDocument>('Activity', activitySchema);
export { activitySchema };
