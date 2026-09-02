import { BaseRepository } from '../base/base.repository.js';
import { EmailAccountModel, type EmailAccountDocument } from '../../db/models/email-account.model.js';

export class EmailAccountRepository extends BaseRepository<EmailAccountDocument> {
  constructor(workspaceId?: string) {
    super(EmailAccountModel, workspaceId);
  }

  public async findByEmail(email: string): Promise<EmailAccountDocument | null> {
    return this.findOne({ email: email.toLowerCase().trim() });
  }

  public async findActive(): Promise<EmailAccountDocument[]> {
    return this.findMany({ status: { $in: ['connected', 'active'] } as any });
  }

  /**
   * Atomically checks and reserves a send slot against daily and hourly limits.
   * Prevents race conditions where concurrent workers both observe remaining quota > 0.
   */
  public async reserveSendSlot(accountId: string): Promise<EmailAccountDocument | null> {
    const filter = this.applyScope({
      _id: accountId,
      status: { $in: ['connected', 'active'] },
      $expr: {
        $and: [
          { $lt: ['$dailySent', { $ifNull: ['$dailyLimit', 200] }] },
          { $lt: ['$hourlySent', { $ifNull: ['$hourlyLimit', 50] }] }
        ]
      }
    } as any);

    return this.atomicFindOneAndUpdate(filter, {
      $inc: { dailySent: 1, hourlySent: 1 }
    });
  }

  /**
   * Atomically releases a reserved send slot if send was aborted prior to external API dispatch.
   */
  public async releaseSendSlot(accountId: string): Promise<EmailAccountDocument | null> {
    const filter = this.applyScope({ _id: accountId } as any);
    return this.atomicFindOneAndUpdate(filter, {
      $inc: { dailySent: -1, hourlySent: -1 }
    });
  }
}
