import mongoose, { Schema } from "mongoose";
import { workspacePlugin, type WorkspaceScopedDocument } from "../plugins/index.js";

export interface SequenceExecutionDocument extends mongoose.Document, WorkspaceScopedDocument {
  _id: any;
  sequenceId: string;
  companyId?: string;
  contactId?: string;
  currentStep: number;
  status: string;
  startedAt: Date;
  completedAt?: Date;
  nextExecutionAt?: Date;
  logs: any[];
  createdAt: Date;
  updatedAt: Date;
}

const sequenceExecutionSchema = new Schema<SequenceExecutionDocument>(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    sequenceId: {
      type: String,
      required: true,
      index: true,
    },
    companyId: {
      type: String,
      index: true,
      default: null,
    },
    contactId: {
      type: String,
      index: true,
      default: null,
    },
    currentStep: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      required: true,
      enum: ["PENDING", "RUNNING", "WAITING", "COMPLETED", "FAILED", "CANCELLED"],
      default: "PENDING",
      index: true,
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    nextExecutionAt: {
      type: Date,
      index: true,
      default: null,
    },
    logs: {
      type: [Schema.Types.Mixed],
      default: [],
    } as any,
  },
  {
    strict: true,
    timestamps: true,
  }
);

sequenceExecutionSchema.index({ workspaceId: 1, status: 1, nextExecutionAt: 1 });
sequenceExecutionSchema.plugin(workspacePlugin);

export const SequenceExecutionModel = mongoose.models.SequenceExecution
  ? (mongoose.models.SequenceExecution as mongoose.Model<SequenceExecutionDocument>)
  : mongoose.model<SequenceExecutionDocument>("SequenceExecution", sequenceExecutionSchema);
export { sequenceExecutionSchema };
