import mongoose, { Schema } from "mongoose";
import { softDeletePlugin, type SoftDeleteDocument } from "../plugins/soft-delete.js";
import { auditPlugin, type AuditDocument } from "../plugins/audit.js";

export interface OutreachDocument extends mongoose.Document, SoftDeleteDocument, AuditDocument {
  workspaceId: string;
  contactId: string;
  campaignId?: string | null;
  channel: "email" | "linkedin" | "phone";
  status: "pending" | "sent" | "delivered" | "failed" | "opened" | "replied";
  sentAt?: Date | null;
  messageDetails?: {
    messageId: string;
    threadId?: string;
    subject: string;
    body: string;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

const outreachSchema = new Schema<OutreachDocument>(
  {
    workspaceId: {
      type: String,
      required: true,
      index: true,
    },
    contactId: {
      type: String,
      required: true,
      index: true,
    },
    campaignId: {
      type: String,
      default: null,
      index: true,
    },
    channel: {
      type: String,
      enum: ["email", "linkedin", "phone"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "sent", "delivered", "failed", "opened", "replied"],
      default: "pending",
      index: true,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    messageDetails: {
      messageId: { type: String },
      threadId: { type: String },
      subject: { type: String },
      body: { type: String },
    },
  },
  {
    timestamps: true,
    strict: true,
    optimisticConcurrency: true,
  }
);

outreachSchema.plugin(softDeletePlugin);
outreachSchema.plugin(auditPlugin);

export const OutreachModel = mongoose.models.Outreach
  ? (mongoose.models.Outreach as mongoose.Model<OutreachDocument>)
  : mongoose.model<OutreachDocument>("Outreach", outreachSchema);
