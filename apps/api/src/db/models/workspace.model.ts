import mongoose, { Schema } from 'mongoose';
import {
  softDeletePlugin,
  auditPlugin,
  timestampPlugin,
  type SoftDeleteDocument,
  type AuditDocument,
  type TimestampDocument
} from '../plugins/index.js';

export interface WorkspaceMember {
  userId?: string | null;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'READ_ONLY' | 'BILLING';
  status: 'ACTIVE' | 'PENDING' | 'DECLINED' | 'EXPIRED';
  joinedAt?: Date | null;
  invitedBy?: string | null;
  invitedAt?: Date;
  invitationToken?: string | null;
  invitationExpiresAt?: Date | null;
}

export interface WorkspaceDocument
  extends mongoose.Document, SoftDeleteDocument, AuditDocument, TimestampDocument {
  name: string;
  slug: string;
  ownerId: string;
  plan: 'free' | 'growth' | 'enterprise';
  settings: {
    defaultTimezone: string;
  };
  members: WorkspaceMember[];
  billing?: Record<string, any> | null;
  limits?: {
    campaignCount: number;
    outreachMonthlyLimit: number;
  } | null;
}

const workspaceSchema = new Schema<WorkspaceDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    ownerId: {
      type: String,
      required: true,
      index: true
    },
    plan: {
      type: String,
      enum: ['free', 'growth', 'enterprise'],
      default: 'free'
    },
    settings: {
      defaultTimezone: {
        type: String,
        default: 'UTC'
      }
    },
    members: [
      {
        userId: { type: String, default: null, index: true },
        email: { type: String, required: true, lowercase: true, trim: true },
        role: {
          type: String,
          enum: ['OWNER', 'ADMIN', 'MEMBER', 'READ_ONLY', 'BILLING'],
          default: 'MEMBER'
        },
        status: {
          type: String,
          enum: ['ACTIVE', 'PENDING', 'DECLINED', 'EXPIRED'],
          default: 'ACTIVE'
        },
        joinedAt: { type: Date, default: null },
        invitedBy: { type: String, default: null },
        invitedAt: { type: Date, default: Date.now },
        invitationToken: { type: String, default: null, index: true },
        invitationExpiresAt: { type: Date, default: null }
      }
    ],
    billing: {
      type: Schema.Types.Mixed,
      default: null
    },
    limits: {
      campaignCount: { type: Number, default: 5 },
      outreachMonthlyLimit: { type: Number, default: 1000 }
    }
  },
  {
    strict: true,
    optimisticConcurrency: true
  }
);

workspaceSchema.plugin(softDeletePlugin);
workspaceSchema.plugin(auditPlugin);
workspaceSchema.plugin(timestampPlugin);

export const WorkspaceModel = mongoose.models.Workspace
  ? (mongoose.models.Workspace as mongoose.Model<WorkspaceDocument>)
  : mongoose.model<WorkspaceDocument>('Workspace', workspaceSchema);
