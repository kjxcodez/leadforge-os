import assert from 'assert';
import { sendTestEmail } from './email-account-service.js';

/**
 * Phase 9T — Send Test Attachment Boundary Unit Tests
 */
async function runTests() {
  console.log('[Desktop Test] Starting Send Test Attachment Boundary Tests...');

  let sdkCalled = false;
  let capturedOpts: any = null;

  const mockSdk: any = {
    outreach: {
      sendTestEmail: async (id: string, opts: any) => {
        sdkCalled = true;
        capturedOpts = opts;
        return { messageId: 'msg_123', sentTo: opts.to };
      }
    }
  };

  // Test 1: Valid Base64 attachment provided by Renderer
  sdkCalled = false;
  capturedOpts = null;
  const res1 = await sendTestEmail(mockSdk, {
    id: 'acc_123',
    to: 'test@example.com',
    useSignature: true,
    attachments: [
      {
        filename: 'ChatGPT Image Aug 5, 2026, 08_52_09 AM.png',
        contentBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        contentType: 'image/png',
        size: 1024
      }
    ]
  });

  assert.strictEqual(sdkCalled, true, 'SDK MUST be called when attachment resolution succeeds');
  assert.strictEqual(res1.sent, true, 'Result should return sent: true');
  assert.strictEqual(capturedOpts.attachments.length, 1, 'Should pass 1 attachment to SDK');
  assert.strictEqual(
    capturedOpts.attachments[0].filename,
    'ChatGPT Image Aug 5, 2026, 08_52_09 AM.png'
  );
  assert.ok(capturedOpts.attachments[0].contentBase64, 'contentBase64 MUST be passed to SDK');

  // Test 2: Unreadable attachment (missing contentBase64 and missing file on disk)
  sdkCalled = false;
  try {
    await sendTestEmail(mockSdk, {
      id: 'acc_123',
      to: 'test@example.com',
      attachments: [
        {
          filename: 'missing_file.pdf'
        }
      ]
    });
    assert.fail('Should throw error for unreadable attachment');
  } catch (err: any) {
    assert.strictEqual(sdkCalled, false, 'SDK MUST NOT be called if attachment resolution fails');
    assert.ok(
      err.message.includes('Unable to read "missing_file.pdf"'),
      'Error message must provide user-friendly guidance'
    );
  }

  // Test 3: Disallowed executable file extension (.exe)
  sdkCalled = false;
  try {
    await sendTestEmail(mockSdk, {
      id: 'acc_123',
      to: 'test@example.com',
      attachments: [
        {
          filename: 'malware.exe',
          contentBase64: 'abc'
        }
      ]
    });
    assert.fail('Should throw error for .exe extension');
  } catch (err: any) {
    assert.strictEqual(sdkCalled, false, 'SDK MUST NOT be called if extension is disallowed');
    assert.ok(err.message.includes('.exe is not allowed'), 'Must reject executable attachment');
  }

  // Test 4: Exceeded size limit (> 25MB)
  sdkCalled = false;
  try {
    await sendTestEmail(mockSdk, {
      id: 'acc_123',
      to: 'test@example.com',
      attachments: [
        {
          filename: 'huge_file.zip',
          contentBase64: 'abc',
          size: 30 * 1024 * 1024
        }
      ]
    });
    assert.fail('Should throw error for file exceeding 25MB');
  } catch (err: any) {
    assert.strictEqual(sdkCalled, false, 'SDK MUST NOT be called if size limit is exceeded');
    assert.ok(err.message.includes('exceeds the 25 MB limit'), 'Must reject oversized attachment');
  }

  console.log('[Desktop Test] PASS: All Send Test Attachment Boundary Tests Passed!');
}

runTests();
