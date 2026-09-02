import mongoose, { Schema } from 'mongoose';
import {
  workspacePlugin,
  timestampPlugin,
  type WorkspaceScopedDocument,
  type TimestampDocument
} from '../plugins/index.js';
import type { EmailDeliveryStatus } from '@leadforge/schema';

export interface EmailDeliveryDocument
  extends mongoose.Document,
    WorkspaceScopedDocument,
    TimestampDocument {
  campaignId?: string | null;
  sequenceId: string;
  executionId: string;
  stepIndex: number;
  contactId: string;
  companyId?: string | null;
  accountId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  providerMessageId?: string | null;
  providerThreadId?: string | null;
  status: EmailDeliveryStatus;
  attempt: number;
  error?: string | null;
  failureClassification?: string | null;
  idempotencyKey: string;
  leaseExpiresAt?: Date | null;
  nextRetryAt?: Date | null;
  retryCount?: number;
  reconciledAt?: Date | null;
  reconciliationNotes?: string | null;
  snapshot?: Record<string, any> | null;
  sentAt?: Date | null;
}

const emailDeliverySchema = new Schema<EmailDeliveryDocument>(
  {
    campaignId: { type: String, default: null, index: true },
    sequenceId: { type: String, required: true, index: true },
    executionId: { type: String, required: true, index: true },
    stepIndex: { type: Number, required: true, default: 0 },
    contactId: { type: String, required: true, index: true },
    companyId: { type: String, default: null, index: true },
    accountId: { type: String, required: true, index: true },
    senderEmail: { type: String, required: true, lowercase: true, trim: true },
    recipientEmail: { type: String, required: true, lowercase: true, trim: true },
    subject: { type: String, required: true },
    providerMessageId: { type: String, default: null },
    providerThreadId: { type: String, default: null },
    status: {
      type: String,
      required: true,
      enum: ['QUEUED', 'SENDING', 'SENT', 'FAILED', 'RETRYING', 'AMBIGUOUS', 'CANCELLED', 'SUPPRESSED'],
      default: 'QUEUED',
      index: true
    },
    attempt: { type: Number, default: 1 },
    error: { type: String, default: null },
    failureClassification: { type: String, default: null },
    idempotencyKey: { type: String, required: true, trim: true },
    leaseExpiresAt: { type: Date, default: null, index: true },
    nextRetryAt: { type: Date, default: null, index: true },
    retryCount: { type: Number, default: 0 },
    reconciledAt: { type: Date, default: null },
    reconciliationNotes: { type: String, default: null },
    snapshot: { type: Schema.Types.Mixed, default: null },
    sentAt: { type: Date, default: null }
  },
  {
    strict: true
  }
);

// Strategic Indexes:
// 1. Mandatory workspace-scoped uniqueness on idempotencyKey to prevent duplicate sends:
emailDeliverySchema.index({ workspaceId: 1, idempotencyKey: 1 }, { unique: true });
// 2. Fast tenant query filters:
emailDeliverySchema.index({ workspaceId: 1, status: 1 });
emailDeliverySchema.index({ workspaceId: 1, contactId: 1 });
emailDeliverySchema.index({ workspaceId: 1, executionId: 1 });
// 3. Stale lease and retry query indexes:
emailDeliverySchema.index({ workspaceId: 1, status: 1, leaseExpiresAt: 1 });
emailDeliverySchema.index({ workspaceId: 1, status: 1, nextRetryAt: 1 });

// Note: Permanent outbound send ledger; zero TTL index.
emailDeliverySchema.plugin(workspacePlugin);
emailDeliverySchema.plugin(timestampPlugin);

export const EmailDeliveryModel = mongoose.models.EmailDelivery
  ? (mongoose.models.EmailDelivery as mongoose.Model<EmailDeliveryDocument>)
  : mongoose.model<EmailDeliveryDocument>('EmailDelivery', emailDeliverySchema);
