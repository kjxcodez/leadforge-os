import { describe, it, expect } from 'vitest';
import {
  plainTextToHtml,
  formatEmailBody,
  renderCanonicalVariables,
  extractTemplateVariables,
  wrapHtmlWithDefaultTypography,
  normalizeEmailSignature,
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
});
