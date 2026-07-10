import mongoose, { Schema } from "mongoose";
import { softDeletePlugin, auditPlugin, timestampPlugin, workspacePlugin, type SoftDeleteDocument, type AuditDocument, type TimestampDocument, type WorkspaceScopedDocument } from "../plugins/index.js";

export interface CampaignStep {
  id: string;
  type: string;
  delayDays: number;
  templateId: string;
}

export interface CampaignDocument extends mongoose.Document, SoftDeleteDocument, AuditDocument, TimestampDocument, WorkspaceScopedDocument {
  name: string;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED";
  steps: CampaignStep[];
  template?: string | null;
  schedule?: Record<string, any> | string | null;
  settings?: Record<string, any> | null;
}

const campaignSchema = new Schema<CampaignDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"],
      default: "DRAFT",
    },
    steps: [
      {
        id: { type: String, required: true },
        type: { type: String, required: true },
        delayDays: { type: Number, default: 0 },
        templateId: { type: String, required: true },
      },
    ],
    template: {
      type: String,
      default: null,
    },
    schedule: {
      type: Schema.Types.Mixed,
      default: null,
    },
    settings: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  {
    strict: true,
    optimisticConcurrency: true,
  }
);

campaignSchema.plugin(workspacePlugin);
campaignSchema.plugin(softDeletePlugin);
campaignSchema.plugin(auditPlugin);
campaignSchema.plugin(timestampPlugin);

export const CampaignModel = mongoose.models.Campaign
  ? (mongoose.models.Campaign as mongoose.Model<CampaignDocument>)
  : mongoose.model<CampaignDocument>("Campaign", campaignSchema);
