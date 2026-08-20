import { EmailAccountModel } from '../../db/models/email-account.model.js';
import {
  EmailDomainError,
  type SendEmailInput,
  type SendEmailResult
} from './types.js';
import { EmailAccountService } from './email-account.service.js';
import type { EmailProvider } from './providers/types.js';

/**
 * EmailService owns email operations (send / sendTest / verify) on top of the
 * EmailProvider abstraction. It resolves the mailbox, checks limits, delegates
 * to the correct provider, and increments send counters.
 *
 * This is the single entry point used by:
 *   - the Hono /email/* routes (web/mobile + desktop API)
 *   - the desktop worker (via the shared provider abstraction, not an HTTP call)
 */
export class EmailService {
  private readonly accounts: EmailAccountService;

  constructor(private readonly workspaceId: string) {
    this.accounts = new EmailAccountService(workspaceId);
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const account = await EmailAccountModel.findOne({
      _id: input.accountId,
      workspaceId: this.workspaceId
    } as any);

    if (!account) {
      throw new EmailDomainError(
        'MAILBOX_NOT_FOUND',
        'Email Account not found.'
      );
    }

    if (account.dailySent >= (account.dailyLimit || 200)) {
      throw new EmailDomainError(
        'EMAIL_RATE_LIMITED',
        'Daily send limit reached for this mailbox.'
      );
    }
    if (account.hourlySent >= (account.hourlyLimit || 50)) {
      throw new EmailDomainError(
        'EMAIL_RATE_LIMITED',
        'Hourly send limit reached for this mailbox.'
      );
    }

    const provider = await this.accounts.buildProvider(input.accountId);
    try {
      const result = await provider.send(input);
      await EmailAccountModel.updateOne(
        { _id: input.accountId } as any,
        {
          $inc: { dailySent: 1, hourlySent: 1 },
          lastVerifiedAt: new Date()
        }
      );
      return result;
    } catch (err: any) {
      if (err instanceof EmailDomainError && err.reauthRequired) {
        await EmailAccountModel.updateOne(
          { _id: input.accountId } as any,
          { status: 'reauth_required', lastError: err.message }
        );
      }
      throw err;
    } finally {
      provider.close();
    }
  }

  /**
   * Sends a short test message to the mailbox's own address, verifying
   * end-to-end delivery.
   */
  async sendTest(accountId: string): Promise<{ messageId: string; sentTo: string }> {
    const account = await this.accounts.getAccount(accountId);
    const result = await this.send({
      accountId,
      to: account.email,
      subject: 'LeadForge OS — Test Email',
      text: 'This is a test email from LeadForge OS. Your Gmail mailbox is connected and ready to send.'
    });
    return { messageId: result.messageId, sentTo: account.email };
  }

  /** Lightweight mailbox health check through the resolved provider. */
  async verify(accountId: string): Promise<{ verified: boolean; health: string }> {
    const provider = await this.accounts.buildProvider(accountId);
    try {
      const health = await provider.verify();
      return { verified: health === 'healthy', health };
    } finally {
      provider.close();
    }
  }
}
