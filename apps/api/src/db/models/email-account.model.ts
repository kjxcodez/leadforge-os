import mongoose, { Schema } from "mongoose";
import { workspacePlugin, type WorkspaceScopedDocument } from "../plugins/index.js";

export interface EmailAccountDocument extends mongoose.Document, WorkspaceScopedDocument {
  name: string;
  email: string;
  provider: string;
  encryptedPassword: string;
  isDefault: boolean;
  status: "connected" | "failed" | "disabled";
  dailyLimit: number;
  hourlyLimit: number;
  dailySent: number;
  hourlySent: number;
  signature?: string | null;
  lastVerifiedAt?: Date | null;
  lastError?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const emailAccountSchema = new Schema<EmailAccountDocument>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true }, // unique scoped in index
    provider: { type: String, required: true, default: "gmail_smtp" },
    encryptedPassword: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["connected", "failed", "disabled"],
      default: "connected",
    },
    dailyLimit: { type: Number, default: 200 },
    hourlyLimit: { type: Number, default: 50 },
    dailySent: { type: Number, default: 0 },
    hourlySent: { type: Number, default: 0 },
    signature: { type: String, default: null },
    lastVerifiedAt: { type: Date, default: null },
    lastError: { type: String, default: null },
  },
  {
    timestamps: true,
    strict: true,
  }
);

emailAccountSchema.plugin(workspacePlugin);

// Unique compound index so workspace boundary restricts emails
emailAccountSchema.index({ workspaceId: 1, email: 1 }, { unique: true });

export const EmailAccountModel = mongoose.models.EmailAccount
  ? (mongoose.models.EmailAccount as mongoose.Model<EmailAccountDocument>)
  : mongoose.model<EmailAccountDocument>("EmailAccount", emailAccountSchema);
