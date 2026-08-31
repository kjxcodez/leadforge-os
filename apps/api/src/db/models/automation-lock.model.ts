import mongoose, { Schema } from 'mongoose';

export interface AutomationLockDocument extends mongoose.Document<string> {
  _id: string; // Composite key: `${workspaceId}:${sequenceId}:${entityId}`
  workspaceId: string;
  sequenceId: string;
  entityId: string;
  ownerId: string;
  lockedAt: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const automationLockSchema = new Schema<AutomationLockDocument>(
  {
    _id: { type: String, required: true },
    workspaceId: { type: String, required: true, index: true },
    sequenceId: { type: String, required: true, index: true },
    entityId: { type: String, required: true, index: true },
    ownerId: { type: String, required: true },
    lockedAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, required: true }
  },
  {
    strict: true,
    timestamps: true
  }
);

// Concurrency Indexes:
// 1. Unique constraint on composite tuple (workspaceId, sequenceId, entityId)
automationLockSchema.index({ workspaceId: 1, sequenceId: 1, entityId: 1 }, { unique: true });
// 2. TTL passive cleanup index on expiration
automationLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AutomationLockModel = mongoose.models.AutomationLock
  ? (mongoose.models.AutomationLock as mongoose.Model<AutomationLockDocument>)
  : mongoose.model<AutomationLockDocument>('AutomationLock', automationLockSchema);
