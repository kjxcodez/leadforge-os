import mongoose, { Schema } from "mongoose";
import { softDeletePlugin, type SoftDeleteDocument } from "../plugins/soft-delete.js";
import { auditPlugin, type AuditDocument } from "../plugins/audit.js";

export interface CampaignStep {
  id: string;
  type: string;
  delayDays: number;
  templateId: string;
}

export interface CampaignDocument extends mongoose.Document, SoftDeleteDocument, AuditDocument {
  workspaceId: string;
  name: string;
  status: "draft" | "active" | "paused" | "completed";
  steps: CampaignStep[];
  createdAt: Date;
  updatedAt: Date;
}

const campaignSchema = new Schema<CampaignDocument>(
  {
    workspaceId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["draft", "active", "paused", "completed"],
      default: "draft",
    },
    steps: [
      {
        id: { type: String, required: true },
        type: { type: String, required: true },
        delayDays: { type: Number, default: 0 },
        templateId: { type: String, required: true },
      },
    ],
  },
  {
    timestamps: true,
    strict: true,
    optimisticConcurrency: true,
  }
);

campaignSchema.plugin(softDeletePlugin);
campaignSchema.plugin(auditPlugin);

export const CampaignModel = mongoose.models.Campaign
  ? (mongoose.models.Campaign as mongoose.Model<CampaignDocument>)
  : mongoose.model<CampaignDocument>("Campaign", campaignSchema);
