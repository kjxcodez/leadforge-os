import mongoose, { Schema } from "mongoose";
import { softDeletePlugin, type SoftDeleteDocument } from "../plugins/soft-delete.js";
import { auditPlugin, type AuditDocument } from "../plugins/audit.js";
import { ContactStatus } from "@leadforge/schema";

export interface ContactDocument extends mongoose.Document, SoftDeleteDocument, AuditDocument {
  workspaceId: string;
  companyId?: string | null;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  linkedinUrl?: string | null;
  source?: string | null;
  status: ContactStatus;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const contactSchema = new Schema<ContactDocument>(
  {
    workspaceId: {
      type: String,
      required: true,
      index: true,
    },
    companyId: {
      type: String,
      default: null,
      index: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      default: null,
      trim: true,
    },
    email: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      default: null,
      trim: true,
    },
    title: {
      type: String,
      default: null,
      trim: true,
    },
    linkedinUrl: {
      type: String,
      default: null,
      trim: true,
    },
    source: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(ContactStatus),
      default: ContactStatus.NEW,
    },
    notes: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    strict: true,
    optimisticConcurrency: true,
  }
);

// Indexes
// 1. workspaceId + companyId (enables contact listing per company inside workspace)
contactSchema.index({ workspaceId: 1, companyId: 1 });
// 2. workspaceId + email (unique per workspace: email must be unique per tenant)
// Note: We use unique: true, but since email is optional (can be null), we use partialFilterExpression to allow multiple null emails.
contactSchema.index(
  { workspaceId: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $type: "string" } },
  }
);

contactSchema.plugin(softDeletePlugin);
contactSchema.plugin(auditPlugin);

export const ContactModel = mongoose.models.Contact
  ? (mongoose.models.Contact as mongoose.Model<ContactDocument>)
  : mongoose.model<ContactDocument>("Contact", contactSchema);
