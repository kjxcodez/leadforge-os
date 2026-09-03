import mongoose, { Schema } from 'mongoose';
import { workspacePlugin, type WorkspaceScopedDocument } from '../plugins/index.js';

export interface TestRecipientEntry {
  email: string;
  firstUsedAt: Date;
  lastUsedAt: Date;
}

/**
 * Per-mailbox send rate policy.
 * null = "use platform default". Effective limits are resolved server-side
 * from: platformDefault → workspaceOverride → accountOverride → platformCeiling.
 */
export interface EmailAccountSendPolicy {
  dailyLimit?: number | null;
  hourlyLimit?: number | null;
  /** Minimum ms between consecutive sends from this mailbox. */
  minSendIntervalMs?: number | null;
  /** Max concurrent in-flight sends (platform enforces 1). */
  maxConcurrent?: number;
}

/**
 * Mutable per-mailbox send state. Always written by the atomic reserveSendSlot() pipeline.
 * Never set directly from the desktop or from API validation code.
 */
export interface EmailAccountSendState {
  dailySent: number;
  hourlySent: number;
  dailyResetAt: Date;
  hourlyResetAt: Date;
  lastSentAt?: Date | null;
  nextSendAt?: Date | null;
  /** When the provider rate-limit expires. Null when not rate-limited. */
  rateLimitedUntil?: Date | null;
  /**
   * In-flight send lease expiry timestamp.
   * Non-null while a send is actively being dispatched to the provider.
   * Enforces maxConcurrent = 1. Self-heals after SEND_LEASE_DURATION_MS (30s) on crash.
   */
  sendLeaseExpiresAt?: Date | null;
}

export interface EmailAccountDocument extends mongoose.Document, WorkspaceScopedDocument {
  name: string;
  email: string;
  provider: string;
  googleConnectionId?: string | null;
  connectionId?: string | null;
  encryptedPassword?: string | null;
  isDefault: boolean;
  status: 'connected' | 'reauth_required' | 'disconnected' | 'failed' | 'disabled' | 'unsupported';
  /** Legacy flat daily limit (used when sendPolicy is absent — backward compatible). */
  dailyLimit: number;
  /** Legacy flat hourly limit (used when sendPolicy is absent — backward compatible). */
  hourlyLimit: number;
  /** Legacy flat counter (used when sendState is absent — backward compatible). */
  dailySent: number;
  /** Legacy flat counter (used when sendState is absent — backward compatible). */
  hourlySent: number;
  /** Per-account send policy override. */
  sendPolicy?: EmailAccountSendPolicy | null;
  /** Authoritative send state for atomic quota and lease management. */
  sendState?: EmailAccountSendState | null;
  signature?: string | null;
  testRecipients?: TestRecipientEntry[];
  lastVerifiedAt?: Date | null;
  lastInboundPollAt?: Date | null;
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
    connectionId: { type: String, default: null },
    encryptedPassword: { type: String, default: null }, // Legacy app password (AES-256-GCM)
    isDefault: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['connected', 'reauth_required', 'disconnected', 'failed', 'disabled', 'unsupported'],
      default: 'connected'
    },
    // Legacy flat fields preserved for backward compatibility
    dailyLimit: { type: Number, default: 200 },
    hourlyLimit: { type: Number, default: 50 },
    dailySent: { type: Number, default: 0 },
    hourlySent: { type: Number, default: 0 },
    // New per-account policy override (optional; null = use platform/workspace defaults)
    sendPolicy: {
      type: new Schema({
        dailyLimit: { type: Number, default: null },
        hourlyLimit: { type: Number, default: null },
        minSendIntervalMs: { type: Number, default: null },
        maxConcurrent: { type: Number, default: 1 }
      }, { _id: false }),
      default: null
    },
    // New authoritative send state for atomic reservations
    sendState: {
      type: new Schema({
        dailySent: { type: Number, default: 0 },
        hourlySent: { type: Number, default: 0 },
        dailyResetAt: { type: Date, default: null },
        hourlyResetAt: { type: Date, default: null },
        lastSentAt: { type: Date, default: null },
        nextSendAt: { type: Date, default: null },
        rateLimitedUntil: { type: Date, default: null },
        sendLeaseExpiresAt: { type: Date, default: null }
      }, { _id: false }),
      default: null
    },
    signature: { type: String, default: null },
    testRecipients: [
      {
        email: { type: String, required: true, lowercase: true, trim: true },
        firstUsedAt: { type: Date, default: Date.now },
        lastUsedAt: { type: Date, default: Date.now }
      }
    ],
    lastVerifiedAt: { type: Date, default: null },
    lastInboundPollAt: { type: Date, default: null },
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

// Compound index for atomic reservation and quota evaluation
emailAccountSchema.index({ workspaceId: 1, _id: 1, status: 1, 'sendState.rateLimitedUntil': 1, 'sendState.lastSentAt': 1 });

export const EmailAccountModel = mongoose.models.EmailAccount
  ? (mongoose.models.EmailAccount as mongoose.Model<EmailAccountDocument>)
  : mongoose.model<EmailAccountDocument>('EmailAccount', emailAccountSchema);