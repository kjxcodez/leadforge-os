import mongoose, { Schema } from "mongoose";
import { softDeletePlugin, type SoftDeleteDocument } from "../plugins/soft-delete.js";
import { auditPlugin, type AuditDocument } from "../plugins/audit.js";

export interface WorkspaceMember {
  userId: string;
  role: "admin" | "member" | "billing";
  joinedAt: Date;
}

export interface WorkspaceDocument extends mongoose.Document, SoftDeleteDocument, AuditDocument {
  name: string;
  slug: string;
  ownerId: string;
  plan: "free" | "growth" | "enterprise";
  settings: {
    defaultTimezone: string;
  };
  members: WorkspaceMember[];
  billing?: Record<string, any> | null;
  limits?: {
    campaignCount: number;
    outreachMonthlyLimit: number;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

const workspaceSchema = new Schema<WorkspaceDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    ownerId: {
      type: String,
      required: true,
      index: true,
    },
    plan: {
      type: String,
      enum: ["free", "growth", "enterprise"],
      default: "free",
    },
    settings: {
      defaultTimezone: {
        type: String,
        default: "UTC",
      },
    },
    members: [
      {
        userId: { type: String, required: true },
        role: { type: String, enum: ["admin", "member", "billing"], default: "member" },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    billing: {
      type: Schema.Types.Mixed,
      default: null,
    },
    limits: {
      campaignCount: { type: Number, default: 5 },
      outreachMonthlyLimit: { type: Number, default: 1000 },
    },
  },
  {
    timestamps: true,
    strict: true,
    optimisticConcurrency: true,
  }
);

workspaceSchema.plugin(softDeletePlugin);
workspaceSchema.plugin(auditPlugin);

export const WorkspaceModel = mongoose.models.Workspace
  ? (mongoose.models.Workspace as mongoose.Model<WorkspaceDocument>)
  : mongoose.model<WorkspaceDocument>("Workspace", workspaceSchema);
