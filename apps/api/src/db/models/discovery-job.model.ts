import mongoose, { Schema } from "mongoose";
import { workspacePlugin, type WorkspaceScopedDocument } from "../plugins/index.js";

export interface DiscoveryJobDocument extends mongoose.Document, WorkspaceScopedDocument {
  name: string;
  provider: string;
  status: "queued" | "pending" | "running" | "paused" | "completed" | "failed" | "cancelled";
  progress: number;
  query: string;
  error?: string | null;
  statistics: {
    companiesFound: number;
    contactsFound: number;
    duplicates: number;
    imported: number;
  };
  startedAt?: Date | null;
  finishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const discoveryJobSchema = new Schema<DiscoveryJobDocument>(
  {
    name: { type: String, required: true, trim: true },
    provider: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["queued", "pending", "running", "paused", "completed", "failed", "cancelled"],
      default: "queued",
    },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    query: { type: String, required: true, trim: true },
    error: { type: String, default: null },
    statistics: {
      companiesFound: { type: Number, default: 0 },
      contactsFound: { type: Number, default: 0 },
      duplicates: { type: Number, default: 0 },
      imported: { type: Number, default: 0 },
    },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    strict: true,
  }
);

discoveryJobSchema.plugin(workspacePlugin);

export const DiscoveryJobModel = mongoose.models.DiscoveryJob
  ? (mongoose.models.DiscoveryJob as mongoose.Model<DiscoveryJobDocument>)
  : mongoose.model<DiscoveryJobDocument>("DiscoveryJob", discoveryJobSchema);
