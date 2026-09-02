import mongoose, { Schema } from 'mongoose';
import { workspacePlugin, type WorkspaceScopedDocument } from '../plugins/index.js';

export interface TestRecipientEntry {
  email: string;
  firstUsedAt: Date;
  lastUsedAt: Date;
}

export interface EmailAccountDocument extends mongoose.Document, WorkspaceScopedDocument {
  name: string;
  email: string;
  provider: string;
  googleConnectionId?: string | null;
  encryptedPassword?: string | null;
  isDefault: boolean;
  status: 'connected' | 'reauth_required' | 'disconnected' | 'failed' | 'disabled' | 'unsupported';
  dailyLimit: number;
  hourlyLimit: number;
  dailySent: number;
  hourlySent: number;
  signature?: string | null;
  testRecipients?: TestRecipientEntry[];
  lastVerifiedAt?: Date | null;
  lastError?: string | null;
  googleAccountId?: string | null;
  encryptedRefreshToken?: string | null;
  encryptedAccessToken?: string | null;
  tokenExpiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const emailAccountSchema = new Schema<EmailAccountDocument>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true }, // unique scoped in index
    provider: { type: String, required: true, default: 'gmail' },
    googleConnectionId: { type: String, default: null },
    encryptedPassword: { type: String, default: null }, // Legacy app password (AES-256-GCM)
    isDefault: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['connected', 'reauth_required', 'disconnected', 'failed', 'disabled', 'unsupported'],
      default: 'connected'
    },
    dailyLimit: { type: Number, default: 200 },
    hourlyLimit: { type: Number, default: 50 },
    dailySent: { type: Number, default: 0 },
    hourlySent: { type: Number, default: 0 },
    signature: { type: String, default: null },
    testRecipients: [
      {
        email: { type: String, required: true, lowercase: true, trim: true },
        firstUsedAt: { type: Date, default: Date.now },
        lastUsedAt: { type: Date, default: Date.now }
      }
    ],
    lastVerifiedAt: { type: Date, default: null },
    lastError: { type: String, default: null },
    googleAccountId: { type: String, default: null }, // Gmail OAuth subject identifier
    encryptedRefreshToken: { type: String, default: null }, // Gmail OAuth refresh token (AES-256-GCM)
    encryptedAccessToken: { type: String, default: null }, // Gmail OAuth access token (AES-256-GCM)
    tokenExpiresAt: { type: Date, default: null } // access token expiry
  },
  {
    timestamps: true,
    strict: true
  }
);

emailAccountSchema.plugin(workspacePlugin);

// Unique compound index so workspace boundary restricts emails
emailAccountSchema.index({ workspaceId: 1, email: 1 }, { unique: true });

export const EmailAccountModel = mongoose.models.EmailAccount
  ? (mongoose.models.EmailAccount as mongoose.Model<EmailAccountDocument>)
  : mongoose.model<EmailAccountDocument>('EmailAccount', emailAccountSchema);