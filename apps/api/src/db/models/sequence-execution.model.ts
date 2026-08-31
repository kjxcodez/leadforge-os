import mongoose, { Schema } from 'mongoose';
import { workspacePlugin, type WorkspaceScopedDocument } from '../plugins/index.js';

export interface SequenceExecutionDocument extends mongoose.Document, WorkspaceScopedDocument {
  sequenceId: string;
  campaignId?: string | null;
  parentJobId?: string | null;
  companyId?: string | null;
  contactId?: string | null;
  currentStep: number;
  currentStepName?: string | null;
  status: string;
  emailsSent: number;
  replies: number;
  failures: number;
  startedAt: Date;
  completedAt?: Date | null;
  nextExecutionAt?: Date | null;
  logs: any[];
  createdAt: Date;
  updatedAt: Date;
}

const sequenceExecutionSchema = new Schema<SequenceExecutionDocument>(
  {
    sequenceId: {
      type: String,
      required: true,
      index: true
    },
    campaignId: {
      type: String,
      index: true,
      default: null
    },
    parentJobId: {
      type: String,
      index: true,
      default: null
    },
    companyId: {
      type: String,
      index: true,
      default: null
    },
    contactId: {
      type: String,
      index: true,
      default: null
    },
    currentStep: {
      type: Number,
      required: true,
      default: 0
    },
    currentStepName: {
      type: String,
      default: null
    },
    status: {
      type: String,
      required: true,
      enum: ['PENDING', 'RUNNING', 'WAITING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED'],
      default: 'PENDING',
      index: true
    },
    emailsSent: {
      type: Number,
      default: 0
    },
    replies: {
      type: Number,
      default: 0
    },
    failures: {
      type: Number,
      default: 0
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    completedAt: {
      type: Date,
      default: null
    },
    nextExecutionAt: {
      type: Date,
      index: true,
      default: null
    },
    logs: {
      type: [Schema.Types.Mixed],
      default: []
    } as any
  },
  {
    strict: true,
    timestamps: true
  }
);

sequenceExecutionSchema.index({ workspaceId: 1, sequenceId: 1 });
sequenceExecutionSchema.index({ workspaceId: 1, status: 1, nextExecutionAt: 1 });
sequenceExecutionSchema.plugin(workspacePlugin);

export const SequenceExecutionModel = mongoose.models.SequenceExecution
  ? (mongoose.models.SequenceExecution as mongoose.Model<SequenceExecutionDocument>)
  : mongoose.model<SequenceExecutionDocument>('SequenceExecution', sequenceExecutionSchema);
export { sequenceExecutionSchema };
