import mongoose, { Schema } from "mongoose";
import { workspacePlugin, type WorkspaceScopedDocument } from "../plugins/index.js";

export interface SequenceDocument extends mongoose.Document, WorkspaceScopedDocument {
  name: string;
  description?: string;
  status: string;
  trigger: {
    type: string;
    config?: Record<string, any>;
  };
  steps: Array<{
    id: string;
    type: string;
    config: Record<string, any>;
  }>;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const sequenceSchema = new Schema<SequenceDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      required: true,
      enum: ["DRAFT", "ACTIVE", "PAUSED"],
      default: "DRAFT",
    },
    trigger: {
      type: {
        type: String,
        required: true,
      },
      config: {
        type: Schema.Types.Mixed,
        default: {},
      },
    },
    steps: [
      {
        id: { type: String, required: true },
        type: { type: String, required: true },
        config: { type: Schema.Types.Mixed, default: {} },
      },
    ],
    createdBy: {
      type: String,
    },
  },
  {
    strict: true,
    timestamps: true,
  }
);

sequenceSchema.index({ workspaceId: 1, name: 1 });
sequenceSchema.plugin(workspacePlugin);

export const SequenceModel = mongoose.models.Sequence
  ? (mongoose.models.Sequence as mongoose.Model<SequenceDocument>)
  : mongoose.model<SequenceDocument>("Sequence", sequenceSchema);
export { sequenceSchema };
