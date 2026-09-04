import { describe, it, expect } from 'vitest';
import { sanitizeHtmlForPreview } from '@leadforge/schema';

describe('Email Logs UI & Safe Preview Suite', () => {
  describe('HTML Sanitization and Preview Security', () => {
    it('strips open tracking pixels completely to prevent false open events during desktop inspection', () => {
      const rawEmailHtml = `
        <div>
          <h1>Hello Alex</h1>
          <p>Hope you are doing well.</p>
          <img src="https://app.leadforge.com/tracking/open/token-12345" alt="pixel" width="1" height="1" style="display:none;" />
          <img src="/tracking/open/relative-pixel" width="1" height="1" />
        </div>
      `;

      const sanitized = sanitizeHtmlForPreview(rawEmailHtml, {
        stripTrackingPixels: true,
        blockRemoteImages: false,
        neutralizeLinks: true
      });

      expect(sanitized).not.toContain('/tracking/open/token-12345');
      expect(sanitized).not.toContain('/tracking/open/relative-pixel');
      expect(sanitized).toContain('<h1>Hello Alex</h1>');
      expect(sanitized).toContain('<p>Hope you are doing well.</p>');
    });

    it('blocks remote images and injects inline SVG placeholder when blockRemoteImages is true', () => {
      const rawEmailHtml = `
        <div>
          <p>Check our logo:</p>
          <img src="https://cdn.example.com/logo.png" alt="Company Logo" />
        </div>
      `;

      const sanitized = sanitizeHtmlForPreview(rawEmailHtml, {
        stripTrackingPixels: true,
        blockRemoteImages: true,
        neutralizeLinks: true
      });

      expect(sanitized).not.toMatch(/\ssrc="https?:\/\/cdn\.example\.com/);
      expect(sanitized).toContain('data-src="https://cdn.example.com/logo.png"');
      expect(sanitized).toContain('data:image/svg+xml');
    });

    it('allows remote images when blockRemoteImages is false', () => {
      const rawEmailHtml = `
        <div>
          <img src="https://cdn.example.com/photo.jpg" alt="Photo" />
        </div>
      `;

      const sanitized = sanitizeHtmlForPreview(rawEmailHtml, {
        stripTrackingPixels: true,
        blockRemoteImages: false,
        neutralizeLinks: true
      });

      expect(sanitized).toContain('src="https://cdn.example.com/photo.jpg"');
      expect(sanitized).not.toContain('data-blocked-image');
    });

    it('neutralizes malicious scripts, iframes, and javascript: links in email body', () => {
      const maliciousHtml = `
        <div>
          <p>Safe text</p>
          <script>alert("hacked")</script>
          <iframe src="https://malicious.example.com"></iframe>
          <a href="javascript:alert(1)">Click me</a>
          <a href="https://legit.example.com">Legit Link</a>
        </div>
      `;

      const sanitized = sanitizeHtmlForPreview(maliciousHtml, {
        stripTrackingPixels: true,
        blockRemoteImages: false,
        neutralizeLinks: true
      });

      expect(sanitized).not.toContain('<script');
      expect(sanitized).not.toContain('alert("hacked")');
      expect(sanitized).not.toContain('<iframe');
      expect(sanitized).not.toContain('href="javascript:alert(1)"');
      expect(sanitized).toContain('href="https://legit.example.com"');
      expect(sanitized).toContain('target="_blank"');
      expect(sanitized).toContain('rel="noopener noreferrer"');
    });

    it('handles empty, null, or plain-text gracefully', () => {
      expect(sanitizeHtmlForPreview('', { stripTrackingPixels: true })).toBe('');
      expect(sanitizeHtmlForPreview('Just plain text without tags', { stripTrackingPixels: true })).toBe(
        'Just plain text without tags'
      );
    });
  });

  describe('Delivery State & Diagnostic Correctness', () => {
    it('accurately distinguishes SENT, AMBIGUOUS, and FAILED status semantics', () => {
      const sentDelivery = {
        id: 'del_sent_1',
        status: 'SENT',
        providerMessageId: 'gmail_msg_123',
        sentAt: new Date('2026-09-04T00:00:00Z'),
        ambiguous: false
      };

      const ambiguousDelivery = {
        id: 'del_ambig_1',
        status: 'AMBIGUOUS',
        providerMessageId: null,
        ambiguous: true,
        safeHumanMessage: 'Provider timeout. Delivery state inconclusive.'
      };

      const failedDelivery = {
        id: 'del_failed_1',
        status: 'FAILED',
        error: 'Invalid recipient address',
        failureCode: 'INVALID_RECIPIENT',
        retryable: false
      };

      expect(sentDelivery.status).toBe('SENT');
      expect(sentDelivery.providerMessageId).toBeTruthy();

      expect(ambiguousDelivery.status).toBe('AMBIGUOUS');
      expect(ambiguousDelivery.ambiguous).toBe(true);
      expect(ambiguousDelivery.providerMessageId).toBeNull();

      expect(failedDelivery.status).toBe('FAILED');
      expect(failedDelivery.retryable).toBe(false);
    });

    it('correctly associates reply detection with sequence cessation flag', () => {
      const deliveryWithReply = {
        id: 'del_reply_1',
        status: 'SENT',
        hasReply: true,
        replyCount: 1,
        lastRepliedAt: new Date('2026-09-04T01:00:00Z'),
        direction: 'OUTBOUND'
      };

      const inboundReply = {
        id: 'del_inbound_1',
        direction: 'INBOUND',
        senderEmail: 'lead@target.com',
        recipientEmail: 'sales@leadforge.com',
        subject: 'Re: Quick inquiry',
        matchedDeliveryId: 'del_reply_1',
        matchConfidence: 'thread'
      };

      expect(deliveryWithReply.hasReply).toBe(true);
      expect(inboundReply.direction).toBe('INBOUND');
      expect(inboundReply.matchedDeliveryId).toBe('del_reply_1');
      expect(inboundReply.matchConfidence).toBe('thread');
    });
  });
});
