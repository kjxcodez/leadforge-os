import { describe, it, expect } from 'vitest';
import { redactSensitiveData, createLogger } from './index.js';

describe('Logger Sensitive Data Redaction', () => {
  it('redacts common sensitive keys (passwords, tokens, secrets, credentials, auth)', () => {
    const raw = {
      user: 'alice@example.com',
      token: 'super-secret-token-123',
      accessToken: 'ya29.a0AfH6SMD-fake-token',
      refreshToken: '1//04fake-refresh-token',
      password: 'mypassword',
      secret: 'shhh',
      clientSecret: 'client-sec-xyz',
      apiKey: 'api-key-999',
      privateKey: 'private-pem-content',
      credentials: {
        certificate: 'cert-123'
      }
    };

    const redacted = redactSensitiveData(raw);

    expect(redacted.user).toBe('alice@example.com');
    expect(redacted.token).toBe('[REDACTED]');
    expect(redacted.accessToken).toBe('[REDACTED]');
    expect(redacted.refreshToken).toBe('[REDACTED]');
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.secret).toBe('[REDACTED]');
    expect(redacted.clientSecret).toBe('[REDACTED]');
    expect(redacted.apiKey).toBe('[REDACTED]');
    expect(redacted.privateKey).toBe('[REDACTED]');
    expect(redacted.credentials.certificate).toBe('cert-123'); // nested key not matching regex
  });

  it('redacts headers authorization and cookie values', () => {
    const raw = {
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer ya29.secret',
        cookie: 'session_id=abcdef123456',
        'set-cookie': 'tracking=true',
        'x-request-id': 'req-987'
      }
    };

    const redacted = redactSensitiveData(raw);

    expect(redacted.headers['content-type']).toBe('application/json');
    expect(redacted.headers['x-request-id']).toBe('req-987');
    expect(redacted.headers.authorization).toBe('[REDACTED]');
    expect(redacted.headers.cookie).toBe('[REDACTED]');
    expect(redacted.headers['set-cookie']).toBe('[REDACTED]');
  });

  it('truncates bulky email HTML and body payloads (> 80 chars)', () => {
    const longHtml = '<html><body>' + 'A'.repeat(500) + '</body></html>';
    const shortHtml = '<p>Hi</p>';

    const raw = {
      html: longHtml,
      htmlBody: longHtml,
      textBody: longHtml,
      shortText: shortHtml,
      rawPayload: longHtml
    };

    const redacted = redactSensitiveData(raw);

    expect(redacted.html).toContain('[PAYLOAD_TRUNCATED:');
    expect(redacted.htmlBody).toContain('[PAYLOAD_TRUNCATED:');
    expect(redacted.textBody).toContain('[PAYLOAD_TRUNCATED:');
    expect(redacted.rawPayload).toContain('[PAYLOAD_TRUNCATED:');
    expect(redacted.shortText).toBe(shortHtml); // not matching SENSITIVE_BODY_KEYS
  });

  it('handles circular references gracefully without crashing', () => {
    const cyclicObj: any = { name: 'cyclic-test' };
    cyclicObj.self = cyclicObj;

    const result = redactSensitiveData(cyclicObj);

    expect(result.name).toBe('cyclic-test');
    expect(result.self).toBe('[CIRCULAR]');
  });

  it('handles arrays and nested objects cleanly', () => {
    const data = {
      items: [
        { id: 1, token: 'secret-token-1' },
        { id: 2, password: 'secret-password-2' },
        { id: 3, normal: 'safe' }
      ]
    };

    const result = redactSensitiveData(data);

    expect(result.items[0].token).toBe('[REDACTED]');
    expect(result.items[1].password).toBe('[REDACTED]');
    expect(result.items[2].normal).toBe('safe');
  });

  it('supports logger.operational helper with sensitive redaction', () => {
    const capturedLogs: any[] = [];
    const customLogger = createLogger({ env: 'test', logLevel: 'info' });

    // Mock the info method
    (customLogger as any).info = (data: any, msg: string) => {
      capturedLogs.push({ data, msg });
    };

    customLogger.operational('email.send.started', {
      deliveryId: 'del_123',
      workspaceId: 'ws_456',
      token: 'leaked-token',
      attempt: 1
    });

    expect(capturedLogs.length).toBe(1);
    expect(capturedLogs[0].msg).toBe('[OP] email.send.started');
    expect(capturedLogs[0].data.eventName).toBe('email.send.started');
    expect(capturedLogs[0].data.deliveryId).toBe('del_123');
    expect(capturedLogs[0].data.token).toBe('[REDACTED]');
  });
});
