/**
 * LeadForge OS — Authoritative Fake Gmail Provider Double
 *
 * Provides a deterministic, programmable in-memory double for Gmail API interactions.
 * Supports:
 * - Accepted send with provider messageId and threadId assignment
 * - Configurable errors: 429 Rate Limit, 401 Reauth Required, Timeout, Network Error
 * - Search sent messages (collision-resistant query simulation)
 * - Inbound reply simulation and listing
 * - Message & thread lookups
 * - Paginated message lists
 */

export interface FakeGmailMessage {
  id: string;
  threadId: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  html?: string | undefined;
  snippet?: string | undefined;
  date: Date;
  headers?: Record<string, string> | undefined;
  labels?: string[] | undefined;
}

export interface FakeSendOptions {
  to: string;
  subject: string;
  body: string;
  html?: string | undefined;
  inReplyTo?: string | undefined;
  references?: string[] | undefined;
  threadId?: string | undefined;
}

export class FakeGmailProvider {
  public sentMessages: FakeGmailMessage[] = [];
  public inboundMessages: FakeGmailMessage[] = [];
  public searchedQueries: string[] = [];

  // Programmable fault injection
  public nextError: Error | null = null;
  public rateLimitRemainingMs: number | null = null;
  public authFailure: boolean = false;
  public timeoutMs: number | null = null;

  private messageCounter = 1;

  public reset(): void {
    this.sentMessages = [];
    this.inboundMessages = [];
    this.searchedQueries = [];
    this.nextError = null;
    this.rateLimitRemainingMs = null;
    this.authFailure = false;
    this.timeoutMs = null;
    this.messageCounter = 1;
  }

  public simulateAuthFailure(enabled: boolean = true): void {
    this.authFailure = enabled;
  }

  public simulateRateLimit(retryAfterMs: number = 60000): void {
    this.rateLimitRemainingMs = retryAfterMs;
  }

  public simulateTimeout(delayMs: number = 5000): void {
    this.timeoutMs = delayMs;
  }

  public simulateNextError(error: Error): void {
    this.nextError = error;
  }

  /**
   * Simulates sending an email through Gmail.
   */
  public async sendMail(
    senderEmail: string,
    options: FakeSendOptions
  ): Promise<{ messageId: string; threadId: string }> {
    if (this.authFailure) {
      const err: any = new Error('Invalid Credentials (reauth required)');
      err.code = 'MAILBOX_REAUTH_REQUIRED';
      err.status = 401;
      throw err;
    }

    if (this.rateLimitRemainingMs !== null && this.rateLimitRemainingMs > 0) {
      const err: any = new Error('Gmail API user rate limit exceeded');
      err.code = 'EMAIL_RATE_LIMITED';
      err.status = 429;
      err.retryAfterMs = this.rateLimitRemainingMs;
      throw err;
    }

    if (this.timeoutMs !== null) {
      const err: any = new Error('Gmail API request timed out');
      err.code = 'TIMEOUT';
      throw err;
    }

    if (this.nextError) {
      const err = this.nextError;
      this.nextError = null;
      throw err;
    }

    const messageId = `gmail_msg_${this.messageCounter++}`;
    const threadId = options.threadId || `gmail_th_${messageId}`;

    const record: FakeGmailMessage = {
      id: messageId,
      threadId,
      sender: senderEmail,
      recipient: options.to,
      subject: options.subject,
      body: options.body,
      html: options.html,
      snippet: options.body.substring(0, 100),
      date: new Date(),
      headers: {
        ...(options.inReplyTo ? { 'In-Reply-To': options.inReplyTo } : {}),
        ...(options.references && options.references.length > 0
          ? { References: options.references.join(' ') }
          : {})
      },
      labels: ['SENT']
    };

    this.sentMessages.push(record);
    return { messageId, threadId };
  }

  /**
   * Simulates searching sent messages in `in:sent`
   */
  public async searchSentMessages(
    recipient: string,
    subject: string,
    sentAfter: Date,
    sentBefore: Date
  ): Promise<FakeGmailMessage[]> {
    this.searchedQueries.push(`to:${recipient} subject:${subject}`);

    const normalizedRecipient = recipient.toLowerCase().trim();
    const normalizedSubject = subject.toLowerCase().trim();

    return this.sentMessages.filter((msg) => {
      const matchRecipient = msg.recipient.toLowerCase().trim() === normalizedRecipient;
      const matchSubject = msg.subject.toLowerCase().trim() === normalizedSubject;
      const matchTime = msg.date >= sentAfter && msg.date <= sentBefore;
      return matchRecipient && matchSubject && matchTime;
    });
  }

  /**
   * Injects an inbound message / reply into the provider for testing correlation.
   */
  public injectInboundMessage(message: Partial<FakeGmailMessage> & { sender: string; recipient: string; subject: string }): FakeGmailMessage {
    const id = message.id || `gmail_in_${this.messageCounter++}`;
    const threadId = message.threadId || `gmail_th_${id}`;

    const inbound: FakeGmailMessage = {
      id,
      threadId,
      sender: message.sender,
      recipient: message.recipient,
      subject: message.subject,
      body: message.body || 'Inbound reply content',
      html: message.html || `<p>${message.body || 'Inbound reply content'}</p>`,
      snippet: (message.body || 'Inbound reply content').substring(0, 100),
      date: message.date || new Date(),
      headers: message.headers || {},
      labels: ['INBOX']
    };

    this.inboundMessages.push(inbound);
    return inbound;
  }

  /**
   * Lists inbound messages received after a given timestamp.
   */
  public async listInboundMessages(
    receivedAfter?: Date,
    maxResults: number = 50
  ): Promise<{ messages: FakeGmailMessage[]; hasMore: boolean }> {
    let filtered = this.inboundMessages;
    if (receivedAfter) {
      filtered = filtered.filter((m) => m.date > receivedAfter);
    }
    const results = filtered.slice(0, maxResults);
    return {
      messages: results,
      hasMore: filtered.length > maxResults
    };
  }

  /**
   * Fetch single message by provider ID.
   */
  public async getMessage(messageId: string): Promise<FakeGmailMessage | null> {
    const sent = this.sentMessages.find((m) => m.id === messageId);
    if (sent) return sent;
    const inbound = this.inboundMessages.find((m) => m.id === messageId);
    return inbound || null;
  }
}
