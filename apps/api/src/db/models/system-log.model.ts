import mongoose, { Schema } from 'mongoose';
import {
  workspacePlugin,
  type WorkspaceScopedDocument
} from '../plugins/index.js';

export interface SystemLogDocument extends mongoose.Document, WorkspaceScopedDocument {
  workerId?: string | null;
  severity: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  task: string;
  message: string;
  durationMs?: number | null;
  metadata?: Record<string, any> | null;
  createdAt: Date;
}

const systemLogSchema = new Schema<SystemLogDocument>(
  {
    workerId: { type: String, default: null, index: true },
    severity: {
      type: String,
      required: true,
      enum: ['debug', 'info', 'warn', 'error', 'fatal'],
      default: 'info',
      index: true
    },
    task: { type: String, required: true, trim: true, index: true },
    message: { type: String, required: true },
    durationMs: { type: Number, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now
    }
  },
  {
    strict: true,
    timestamps: false
  }
);

// Indexes:
// 1. Workspace query by severity & timestamp
systemLogSchema.index({ workspaceId: 1, severity: 1, createdAt: -1 });
// 2. Ephemeral TTL policy: 14-day automated expiration (1,209,600 seconds)
systemLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 1209600 });

systemLogSchema.plugin(workspacePlugin);

export const SystemLogModel = mongoose.models.SystemLog
  ? (mongoose.models.SystemLog as mongoose.Model<SystemLogDocument>)
  : mongoose.model<SystemLogDocument>('SystemLog', systemLogSchema);
