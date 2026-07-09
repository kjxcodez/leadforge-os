import mongoose, { Schema } from "mongoose";
import { softDeletePlugin, type SoftDeleteDocument } from "../plugins/soft-delete.js";
import { auditPlugin, type AuditDocument } from "../plugins/audit.js";

export interface UserDocument extends mongoose.Document, SoftDeleteDocument, AuditDocument {
  email: string;
  name: string;
  emailVerified: boolean;
  image?: string | null;
  role: "admin" | "user" | "owner";
  activeWorkspaceId?: string | null;
  lastLoginAt?: Date | null;
  status: "active" | "suspended" | "pending";
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    image: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ["admin", "user", "owner"],
      default: "user",
    },
    activeWorkspaceId: {
      type: String,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "suspended", "pending"],
      default: "active",
    },
  },
  {
    timestamps: true,
    strict: true,
    optimisticConcurrency: true,
  }
);

userSchema.plugin(softDeletePlugin);
userSchema.plugin(auditPlugin);

export const UserModel = mongoose.models.User 
  ? (mongoose.models.User as mongoose.Model<UserDocument>)
  : mongoose.model<UserDocument>("User", userSchema);
