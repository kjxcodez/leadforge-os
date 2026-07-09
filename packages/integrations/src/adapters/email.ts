import type { BaseAdapter } from '../common/adapter';
import type { IntegrationMetadata, IntegrationStatus } from '../common/types';

export interface SendEmailOptions {
  to: string;
  subject: string;
  body: string;
  from?: string;
}

export interface EmailResult {
  messageId: string;
  sent: boolean;
}

export interface EmailAdapter extends BaseAdapter {
  sendEmail(options: SendEmailOptions): Promise<EmailResult>;
}

// Stub implementation
export class StubEmailAdapter implements EmailAdapter {
  public getMetadata(): IntegrationMetadata {
    return {
      id: 'stub-email',
      name: 'Stub Email (Dev Mode)',
      type: 'email',
      version: '1.0.0',
    };
  }

  public async testConnection(): Promise<IntegrationStatus> {
    return { connected: true };
  }

  public async sendEmail(options: SendEmailOptions): Promise<EmailResult> {
    console.log(`[StubEmail] Sending email to: ${options.to} with subject: "${options.subject}"`);
    return {
      messageId: 'msg_' + Math.random().toString(36).substring(7),
      sent: true,
    };
  }
}
