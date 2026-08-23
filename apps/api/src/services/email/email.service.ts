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
   * Sends a test message to a user-specified recipient address while enforcing:
   * 1. Recipient normalization & validation.
   * 2. Server-side limit of 3 unique test recipients per sender account.
   * 3. Gmail signature resolution (if useSignature is true/default).
   * 4. Optional attachment processing with 25 MB max size check.
   */
  async sendTest(
    accountId: string,
    options: {
      to: string;
      useSignature?: boolean;
      attachments?: Array<{
        filename: string;
        contentBase64?: string;
        path?: string;
        contentType?: string;
        size?: number;
      }>;
    }
  ): Promise<{ messageId: string; sentTo: string }> {
    const rawTo = options?.to || '';
    const normalizedTo = rawTo.trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!normalizedTo || !emailRegex.test(normalizedTo)) {
      throw new EmailDomainError('EMAIL_SEND_FAILED', 'Invalid recipient email address.');
    }

    const accountDoc = await EmailAccountModel.findOne({
      _id: accountId,
      workspaceId: this.workspaceId
    } as any);

    if (!accountDoc) {
      throw new EmailDomainError('MAILBOX_NOT_FOUND', 'Email Account not found.');
    }

    // Check unique test recipients
    const existingRecipients = accountDoc.testRecipients || [];
    const isKnown = existingRecipients.some(
      (r) => r.email.trim().toLowerCase() === normalizedTo
    );

    if (!isKnown) {
      if (existingRecipients.length >= 3) {
        throw new EmailDomainError(
          'TEST_RECIPIENT_LIMIT_REACHED',
          'Limit reached: You can test this sender with up to 3 different recipient addresses. You can reuse one of your previous test addresses.'
        );
      }
      existingRecipients.push({
        email: normalizedTo,
        firstUsedAt: new Date(),
        lastUsedAt: new Date()
      });
    } else {
      const idx = existingRecipients.findIndex(
        (r) => r.email.trim().toLowerCase() === normalizedTo
      );
      if (idx !== -1) {
        existingRecipients[idx].lastUsedAt = new Date();
      }
    }

    await EmailAccountModel.updateOne(
      { _id: accountId } as any,
      { testRecipients: existingRecipients }
    );

    // Signature resolution
    let signatureHtml = '';
    const useSignature = options.useSignature !== false;
    if (useSignature) {
      try {
        const provider: any = await this.accounts.buildProvider(accountId);
        if (provider && typeof provider.fetchSignature === 'function') {
          const fetchedSig = await provider.fetchSignature();
          if (fetchedSig) {
            signatureHtml = fetchedSig;
            await EmailAccountModel.updateOne(
              { _id: accountId } as any,
              { signature: signatureHtml }
            );
          } else if (accountDoc.signature) {
            signatureHtml = accountDoc.signature;
          }
        }
        provider?.close();
      } catch {
        if (accountDoc.signature) {
          signatureHtml = accountDoc.signature;
        }
      }
    }

    // Attachment validation (25 MB max limit)
    const attachments = options.attachments || [];
    let totalSize = 0;
    for (const att of attachments) {
      if (att.size) totalSize += att.size;
      else if (att.contentBase64) totalSize += Math.round((att.contentBase64.length * 3) / 4);
    }
    if (totalSize > 25 * 1024 * 1024) {
      throw new EmailDomainError(
        'ATTACHMENT_SIZE_EXCEEDED',
        'Total attachment size exceeds the 25 MB LeadForge limit.'
      );
    }

    const baseHtml = `
      <div style="font-family: sans-serif; font-size: 14px; color: #18181b; line-height: 1.6;">
        <p>This is a test email from <strong>LeadForge OS</strong>.</p>
        <p>Your Gmail mailbox (<code>${accountDoc.email}</code>) is connected and delivering messages correctly.</p>
      </div>
    `;

    const fullHtml = signatureHtml
      ? `${baseHtml}<br/><hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 16px 0;" /><div class="gmail_signature">${signatureHtml}</div>`
      : baseHtml;

    const result = await this.send({
      accountId,
      to: normalizedTo,
      subject: 'LeadForge OS — Test Email',
      text: `This is a test email from LeadForge OS. Your Gmail mailbox (${accountDoc.email}) is connected and ready to send.`,
      html: fullHtml,
      useSignature,
      attachments
    });

    return { messageId: result.messageId, sentTo: normalizedTo };
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
