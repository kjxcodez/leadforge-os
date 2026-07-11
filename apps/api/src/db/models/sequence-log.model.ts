import mongoose, { Schema } from "mongoose";
import { workspacePlugin, type WorkspaceScopedDocument } from "../plugins/index.js";

export interface SequenceLogDocument extends mongoose.Document, WorkspaceScopedDocument {
  executionId: string;
  timestamp: Date;
  step: number;
  action: string;
  status: string;
  message?: string;
  createdAt: Date;
  updatedAt: Date;
}

const sequenceLogSchema = new Schema<SequenceLogDocument>(
  {
    executionId: {
      type: String,
      required: true,
      index: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
    step: {
      type: Number,
      required: true,
    },
    action: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      default: "",
    },
  },
  {
    strict: true,
    timestamps: true,
  }
);

sequenceLogSchema.index({ workspaceId: 1, executionId: 1 });
sequenceLogSchema.plugin(workspacePlugin);

export const SequenceLogModel = mongoose.models.SequenceLog
  ? (mongoose.models.SequenceLog as mongoose.Model<SequenceLogDocument>)
  : mongoose.model<SequenceLogDocument>("SequenceLog", sequenceLogSchema);
export { sequenceLogSchema };
