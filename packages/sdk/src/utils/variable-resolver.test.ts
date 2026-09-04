import { describe, it, expect } from 'vitest';
import {
  plainTextToHtml,
  formatEmailBody,
  renderCanonicalVariables,
  extractTemplateVariables,
  wrapHtmlWithDefaultTypography,
  normalizeEmailSignature,
  sanitizeSubject,
  htmlToPlainText,
  computeMessageFingerprint,
  composeOutboundMessage,
  type CanonicalVariableContext
} from './variable-resolver.js';

describe('Variable Resolver & Email Formatting Utilities', () => {
  it('renders plain text variables correctly', () => {
    const ctx: CanonicalVariableContext = {
      contact: { firstName: 'Sarah', lastName: 'Connor', email: 'sarah@resistance.org' },
      company: { name: 'Cyberdyne Systems', domain: 'cyberdyne.com' },
      sender: { name: 'John Doe', email: 'john@leadforge.ai' }
    };

    const inputTpl = 'Hello {{contact.firstName}},\n\nI noticed {{company.name}} is hiring.\nLet me know if you are open to chatting.\n\nBest,\n{{sender.name}}';
    const rendered = renderCanonicalVariables(inputTpl, ctx);

    expect(rendered).toBe(
      'Hello Sarah,\n\nI noticed Cyberdyne Systems is hiring.\nLet me know if you are open to chatting.\n\nBest,\nJohn Doe'
    );
  });

  it('converts plainTextToHtml with paragraphs, line breaks, and default typography', () => {
    const input = 'Hello Sarah,\n\nI noticed Cyberdyne Systems is hiring.\nLet me know if you are open to chatting.\n\nBest,\nJohn Doe';
    const html = plainTextToHtml(input);

    expect(html.startsWith('<div style="font-family:sans-serif;line-height:107%;">')).toBe(true);
    expect(html.endsWith('</div>')).toBe(true);
    expect(html).toContain('<p class="MsoNormal" style="margin:0in 0in 8pt;line-height:107%;font-size:11pt;font-family:Calibri,sans-serif">Hello Sarah,</p>');
    expect(html).toContain('<p class="MsoNormal" style="margin:0in 0in 8pt;line-height:107%;font-size:11pt;font-family:Calibri,sans-serif">I noticed Cyberdyne Systems is hiring.<br/>Let me know if you are open to chatting.</p>');
    expect(html).toContain('<p class="MsoNormal" style="margin:0in 0in 8pt;line-height:107%;font-size:11pt;font-family:Calibri,sans-serif">Best,<br/>John Doe</p>');
  });

  it('returns both text and html from formatEmailBody', () => {
    const raw = 'Hello world';
    const formatted = formatEmailBody(raw);
    expect(formatted.text).toBe(raw);
    expect(formatted.html).toContain('Hello world');
  });

  it('escapes HTML entities safely in plainTextToHtml', () => {
    const rawWithEntities = 'Price < $100 & profit > 50% "quoted" \'single\'';
    const escapedHtml = plainTextToHtml(rawWithEntities);
    expect(escapedHtml).toContain('&lt;');
    expect(escapedHtml).toContain('&gt;');
    expect(escapedHtml).toContain('&amp;');
    expect(escapedHtml).toContain('&quot;');
    expect(escapedHtml).toContain('&#39;');
    expect(escapedHtml).toContain('font-family:sans-serif');
  });

  it('extracts template variables with dot and namespace notation', () => {
    const extracted = extractTemplateVariables('Hi {{contact.firstName}} from {{company.name}} ({{company.domain}})! Contact us at {{sender.email}}.');
    expect(extracted).toEqual(['contact.firstName', 'company.name', 'company.domain', 'sender.email']);
  });

  it('handles null company and missing values gracefully', () => {
    const nullCompanyCtx: CanonicalVariableContext = {
      contact: { firstName: 'Alice', lastName: 'Smith', email: 'alice@example.com' },
      company: null,
      sender: { name: 'Bob', email: 'bob@sender.com' }
    };
    const rendered = renderCanonicalVariables('Hi {{contact.firstName}}, working at {{company.name}}', nullCompanyCtx);
    expect(rendered).toBe('Hi Alice, working at ');
  });

  it('wraps HTML with default typography without double wrapping', () => {
    const rawHtmlSnippet = '<p>Custom HTML paragraph</p>';
    const wrappedSnippet = wrapHtmlWithDefaultTypography(rawHtmlSnippet);
    expect(wrappedSnippet).toBe('<div style="font-family:sans-serif;line-height:107%;"><p>Custom HTML paragraph</p></div>');

    // Already wrapped should not be double wrapped
    const doubleWrapped = wrapHtmlWithDefaultTypography(wrappedSnippet);
    expect(doubleWrapped).toBe(wrappedSnippet);
  });

  it('normalizes email signature with bare td table cells and escaped entities', () => {
    const rawEscapedSig = '<div dir="ltr"><pre><code>&lt;td style=&quot;padding-left:18px;&quot;&gt;&lt;div&gt;&lt;strong&gt;Test Company&lt;/strong&gt;&lt;/div&gt;&lt;/td&gt;</code></pre></div>';
    const normalized = normalizeEmailSignature(rawEscapedSig);
    expect(normalized).toContain('<table');
    expect(normalized).toContain('<strong>Test Company</strong>');
    expect(normalized).not.toContain('<pre>');
  });

  it('escapes variable values when isHtml is true to prevent XSS injection', () => {
    const maliciousCtx: CanonicalVariableContext = {
      contact: {
        firstName: '<script>alert(1)</script>',
        lastName: '"><img src=x onerror=alert(2)>',
        email: 'test@evil.com'
      },
      company: { name: 'Acme & Sons' }
    };

    const htmlTpl = '<p>Hello {{contact.firstName}} {{contact.lastName}}, welcome to {{company.name}}!</p>';
    const rendered = renderCanonicalVariables(htmlTpl, maliciousCtx, { isHtml: true });

    expect(rendered).not.toContain('<script>');
    expect(rendered).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(rendered).not.toContain('onerror=alert(2)>');
    expect(rendered).toContain('&quot;&gt;&lt;img src=x onerror=alert(2)&gt;');
    expect(rendered).toContain('Acme &amp; Sons');
    // Benign template tags must remain intact
    expect(rendered).toContain('<p>');
    expect(rendered).toContain('</p>');
  });

  it('sanitizes subject lines by stripping CRLF and collapsing whitespace', () => {
    const crlfSubject = 'Important proposal\r\nBcc: evil@attacker.com\n\n   Special Offer  ';
    const res = sanitizeSubject(crlfSubject);
    expect(res.isValid).toBe(true);
    expect(res.sanitized).toBe('Important proposal Bcc: evil@attacker.com Special Offer');
    expect(res.sanitized).not.toContain('\r');
    expect(res.sanitized).not.toContain('\n');

    const emptyRes = sanitizeSubject('   \n\r   ');
    expect(emptyRes.isValid).toBe(false);
    expect(emptyRes.error).toBeDefined();
  });

  it('converts HTML email to clean plain text via htmlToPlainText', () => {
    const html = '<h1>Welcome!</h1><p>Hello Sarah,<br/>Please find the <b>details</b> below.</p><p>Best,<br/>LeadForge</p>';
    const plain = htmlToPlainText(html);
    expect(plain).toContain('Welcome!');
    expect(plain).toContain('Hello Sarah,\nPlease find the details below.');
    expect(plain).toContain('Best,\nLeadForge');
    expect(plain).not.toContain('<h1>');
    expect(plain).not.toContain('<p>');
    expect(plain).not.toContain('<br/>');
    expect(plain).not.toContain('<b>');
  });

  it('produces deterministic message fingerprints for identical inputs', () => {
    const input1 = {
      workspaceId: 'ws-123',
      senderEmail: 'sales@leadforge.ai',
      recipientEmail: 'lead@company.com',
      subject: 'Quick chat',
      textBody: 'Hello there',
      htmlBody: '<p>Hello there</p>',
      templateId: 'tpl-1',
      templateVersion: 2
    };

    const fp1 = computeMessageFingerprint(input1);
    const fp2 = computeMessageFingerprint(input1);
    expect(fp1).toBe(fp2);
    expect(typeof fp1).toBe('string');
    expect(fp1.length).toBe(64);

    // Mutation alters fingerprint
    const fp3 = computeMessageFingerprint({ ...input1, subject: 'Quick chat!' });
    expect(fp3).not.toBe(fp1);
  });

  it('executes composeOutboundMessage uniting rendering, sanitization, tracking, and fingerprinting', () => {
    const res = composeOutboundMessage({
      workspaceId: 'ws-test',
      template: {
        id: 'tpl-100',
        version: 1,
        subject: 'Expanding {{company.name}}\r\n',
        body: 'Hello {{contact.firstName}},\n\nWanted to connect.'
      },
      context: {
        company: { name: 'Acme' }
      },
      sender: {
        name: 'Alex',
        email: 'alex@sender.com',
        signatureHtml: '<b>Alex</b><br/>LeadForge'
      },
      recipient: {
        email: 'bob@acme.com',
        firstName: 'Bob'
      },
      trackingBaseUrl: 'https://track.leadforge.com'
    });

    expect(res.subject).toBe('Expanding Acme');
    expect(res.subject).not.toContain('\r');
    expect(res.subject).not.toContain('\n');
    expect(res.variablesSnapshot['company.name']).toBe('Acme');
    expect(res.variablesSnapshot['contact.firstName']).toBe('Bob');
    expect(res.htmlBody).toContain('Hello Bob,');
    expect(res.htmlBody).toContain('gmail_signature');
    expect(res.htmlBody).toContain('https://track.leadforge.com/t/open/');
    expect(res.openTrackingToken).toBeDefined();
    expect(res.textBody).toContain('Hello Bob,');
    expect(res.templateId).toBe('tpl-100');
    expect(res.templateVersion).toBe(1);
    expect(res.messageFingerprint).toBeDefined();
    expect(res.messageFingerprint.length).toBe(64);
  });
});
