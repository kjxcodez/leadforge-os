import mongoose, { Schema } from "mongoose";
import { softDeletePlugin, type SoftDeleteDocument } from "../plugins/soft-delete.js";
import { auditPlugin, type AuditDocument } from "../plugins/audit.js";

export interface CompanyDocument extends mongoose.Document, SoftDeleteDocument, AuditDocument {
  workspaceId: string;
  name: string;
  domain: string;
  website?: string | null;
  industry?: string | null;
  size?: string | null; // Employee range e.g. "11-50"
  employeeCount?: number | null;
  revenue?: string | null;
  linkedinUrl?: string | null;
  location?: string | null;
  status: "lead" | "contacted" | "nurturing" | "qualified" | "unqualified";
  tags: string[];
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const companySchema = new Schema<CompanyDocument>(
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
    domain: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    website: {
      type: String,
      default: null,
      trim: true,
    },
    industry: {
      type: String,
      default: null,
      trim: true,
    },
    size: {
      type: String,
      default: null,
    },
    employeeCount: {
      type: Number,
      default: null,
    },
    revenue: {
      type: String,
      default: null,
    },
    linkedinUrl: {
      type: String,
      default: null,
      trim: true,
    },
    location: {
      type: String,
      default: null,
      trim: true,
    },
    status: {
      type: String,
      enum: ["lead", "contacted", "nurturing", "qualified", "unqualified"],
      default: "lead",
    },
    tags: {
      type: [String],
      default: [],
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
// 1. workspaceId + domain (enables workspace-level search and validation)
companySchema.index({ workspaceId: 1, domain: 1 });
// 2. workspaceId + status (enables fast tenant filtering by pipeline status)
companySchema.index({ workspaceId: 1, status: 1 });

companySchema.plugin(softDeletePlugin);
companySchema.plugin(auditPlugin);

export const CompanyModel = mongoose.models.Company
  ? (mongoose.models.Company as mongoose.Model<CompanyDocument>)
  : mongoose.model<CompanyDocument>("Company", companySchema);
