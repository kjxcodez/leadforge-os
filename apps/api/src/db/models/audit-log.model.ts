import mongoose, { Schema } from 'mongoose';
import {
  workspacePlugin,
  type WorkspaceScopedDocument
} from '../plugins/index.js';

export interface AuditLogDocument extends mongoose.Document, WorkspaceScopedDocument {
  actor: {
    userId?: string | null;
    type: 'user' | 'system' | 'worker';
    ip?: string | null;
  };
  action: string;
  entityType: string;
  entityId: string;
  beforeValue?: Record<string, any> | null;
  afterValue?: Record<string, any> | null;
  timestamp: Date;
}

const auditLogSchema = new Schema<AuditLogDocument>(
  {
    actor: {
      userId: { type: String, default: null, index: true },
      type: {
        type: String,
        required: true,
        enum: ['user', 'system', 'worker'],
        default: 'user'
      },
      ip: { type: String, default: null }
    },
    action: { type: String, required: true, trim: true, index: true },
    entityType: { type: String, required: true, trim: true, index: true },
    entityId: { type: String, required: true, trim: true, index: true },
    beforeValue: { type: Schema.Types.Mixed, default: null },
    afterValue: { type: Schema.Types.Mixed, default: null },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    }
  },
  {
    strict: true,
    timestamps: false
  }
);

// Strategic Indexes:
// 1. Audit trail per entity:
auditLogSchema.index({ workspaceId: 1, entityType: 1, entityId: 1, timestamp: -1 });
// 2. Audit trail by actor:
auditLogSchema.index({ workspaceId: 1, 'actor.userId': 1, timestamp: -1 });

// Note: Permanent compliance audit history; zero TTL index.
auditLogSchema.plugin(workspacePlugin);

export const AuditLogModel = mongoose.models.AuditLog
  ? (mongoose.models.AuditLog as mongoose.Model<AuditLogDocument>)
  : mongoose.model<AuditLogDocument>('AuditLog', auditLogSchema);
