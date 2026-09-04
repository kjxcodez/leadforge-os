/**
 * Send Test Attachment & Signature Boundary Unit Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { sendTestEmail } from './email-account-service.js';

describe('Send Test Attachment Boundary Tests', () => {
  it('forwards valid Base64 attachments to SDK', async () => {
    let capturedOpts: any = null;
    const mockSdk: any = {
      outreach: {
        sendTestEmail: vi.fn(async (id: string, opts: any) => {
          capturedOpts = opts;
          return { messageId: 'msg_123', sentTo: opts.to };
        })
      }
    };

    const res = await sendTestEmail(mockSdk, {
      id: 'acc_123',
      to: 'test@example.com',
      useSignature: true,
      attachments: [
        {
          filename: 'image.png',
          contentBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          contentType: 'image/png',
          size: 1024
        }
      ]
    });

    expect(mockSdk.outreach.sendTestEmail).toHaveBeenCalledTimes(1);
    expect(res.sent).toBe(true);
    expect(capturedOpts.attachments.length).toBe(1);
    expect(capturedOpts.attachments[0].filename).toBe('image.png');
    expect(capturedOpts.attachments[0].contentBase64).toBeDefined();
  });

  it('rejects unreadable attachments without calling SDK', async () => {
    const mockSdk: any = {
      outreach: {
        sendTestEmail: vi.fn()
      }
    };

    await expect(
      sendTestEmail(mockSdk, {
        id: 'acc_123',
        to: 'test@example.com',
        attachments: [{ filename: 'missing_file.pdf' }]
      })
    ).rejects.toThrow(/Unable to read "missing_file\.pdf"/);

    expect(mockSdk.outreach.sendTestEmail).not.toHaveBeenCalled();
  });

  it('rejects disallowed executable file extensions (.exe)', async () => {
    const mockSdk: any = {
      outreach: {
        sendTestEmail: vi.fn()
      }
    };

    await expect(
      sendTestEmail(mockSdk, {
        id: 'acc_123',
        to: 'test@example.com',
        attachments: [{ filename: 'malware.exe', contentBase64: 'abc' }]
      })
    ).rejects.toThrow(/\.exe is not allowed/);

    expect(mockSdk.outreach.sendTestEmail).not.toHaveBeenCalled();
  });

  it('rejects attachments exceeding 25MB limit', async () => {
    const mockSdk: any = {
      outreach: {
        sendTestEmail: vi.fn()
      }
    };

    await expect(
      sendTestEmail(mockSdk, {
        id: 'acc_123',
        to: 'test@example.com',
        attachments: [{ filename: 'huge_file.zip', contentBase64: 'abc', size: 30 * 1024 * 1024 }]
      })
    ).rejects.toThrow(/exceeds the 25 MB limit/);

    expect(mockSdk.outreach.sendTestEmail).not.toHaveBeenCalled();
  });

  it('forwards Drive-backed attachment metadata without contentBase64', async () => {
    let capturedOpts: any = null;
    const mockSdk: any = {
      outreach: {
        sendTestEmail: vi.fn(async (_id: string, opts: any) => {
          capturedOpts = opts;
          return { messageId: 'msg_drive_1', sentTo: opts.to };
        })
      }
    };

    const res = await sendTestEmail(mockSdk, {
      id: 'acc_123',
      to: 'test@example.com',
      attachments: [
        {
          id: 'att_drive_999',
          fileId: 'file_google_888',
          filename: 'Quarterly_Report.pdf',
          driveUrl: 'https://drive.google.com/file/d/file_google_888/view',
          googleConnectionId: 'gconn_123',
          size: 2048
        }
      ]
    });

    expect(mockSdk.outreach.sendTestEmail).toHaveBeenCalledTimes(1);
    expect(res.sent).toBe(true);
    expect(capturedOpts.attachments[0].fileId).toBe('file_google_888');
    expect(capturedOpts.attachments[0].googleConnectionId).toBe('gconn_123');
  });

  it('forwards signature option and propagates signatureNotice', async () => {
    let capturedOpts: any = null;
    const mockSdk: any = {
      outreach: {
        sendTestEmail: vi.fn(async (_id: string, opts: any) => {
          capturedOpts = opts;
          return {
            messageId: 'msg_sig_123',
            sentTo: opts.to,
            signatureNotice: 'Gmail signature included'
          };
        })
      }
    };

    const res = await sendTestEmail(mockSdk, {
      id: 'acc_123',
      to: 'test@example.com',
      useSignature: true
    });

    expect(mockSdk.outreach.sendTestEmail).toHaveBeenCalledTimes(1);
    expect(capturedOpts.useSignature).toBe(true);
    expect(res.signatureNotice).toBe('Gmail signature included');
  });
});
