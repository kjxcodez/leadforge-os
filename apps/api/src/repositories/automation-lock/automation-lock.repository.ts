import { BaseRepository } from '../base/base.repository.js';
import { AutomationLockModel, type AutomationLockDocument } from '../../db/models/automation-lock.model.js';

export class AutomationLockRepository extends BaseRepository<AutomationLockDocument> {
  constructor(workspaceId?: string) {
    super(AutomationLockModel, workspaceId);
  }

  private constructLockKey(sequenceId: string, entityId: string): string {
    const ws = this.workspaceId || 'global';
    return `${ws}:${sequenceId}:${entityId}`;
  }

  /**
   * Atomically acquires an exclusive lease lock for an automation sequence entity.
   * Succeeds if lock does not exist or has expired.
   */
  public async acquireLock(
    sequenceId: string,
    entityId: string,
    ownerId: string,
    leaseDurationMs = 60000
  ): Promise<{ acquired: boolean; lockKey: string; expiresAt?: Date }> {
    const lockKey = this.constructLockKey(sequenceId, entityId);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + leaseDurationMs);

    const filter: any = {
      _id: lockKey,
      $or: [
        { expiresAt: { $lte: now } },
        { ownerId: ownerId }
      ]
    };
    if (this.workspaceId) {
      filter.workspaceId = this.workspaceId;
    }

    try {
      const lock = await this.model.findOneAndUpdate(
        filter,
        {
          $set: {
            ownerId,
            lockedAt: now,
            expiresAt
          },
          $setOnInsert: {
            _id: lockKey,
            workspaceId: this.workspaceId,
            sequenceId,
            entityId
          }
        },
        {
          upsert: true,
          new: true,
          runValidators: true
        }
      );

      return {
        acquired: !!lock,
        lockKey,
        ...(lock?.expiresAt ? { expiresAt: lock.expiresAt } : {})
      };
    } catch (err: any) {
      // 11000 duplicate key error means lock exists and has not expired
      if (err.code === 11000) {
        return { acquired: false, lockKey };
      }
      throw err;
    }
  }

  /**
   * Renews lease for current lock owner.
   */
  public async renewLock(
    sequenceId: string,
    entityId: string,
    ownerId: string,
    leaseDurationMs = 60000
  ): Promise<boolean> {
    const lockKey = this.constructLockKey(sequenceId, entityId);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + leaseDurationMs);

    const filter: any = {
      _id: lockKey,
      ownerId,
      expiresAt: { $gt: now }
    };
    if (this.workspaceId) {
      filter.workspaceId = this.workspaceId;
    }

    const updated = await this.model.findOneAndUpdate(
      filter,
      { $set: { expiresAt } },
      { new: true }
    );
    return !!updated;
  }

  /**
   * Releases lock owned by the specified owner.
   */
  public async releaseLock(
    sequenceId: string,
    entityId: string,
    ownerId: string
  ): Promise<boolean> {
    const lockKey = this.constructLockKey(sequenceId, entityId);
    const filter: any = {
      _id: lockKey,
      ownerId
    };
    if (this.workspaceId) {
      filter.workspaceId = this.workspaceId;
    }

    const res = await this.model.deleteOne(filter);
    return res.deletedCount > 0;
  }
}
