import assert from 'node:assert';
import { plainTextToHtml, formatEmailBody, renderCanonicalVariables, type CanonicalVariableContext } from './variable-resolver.js';

console.log('[SDK Test] Testing variable-resolver and formatting utilities...');

// Test 1: Plain text variable rendering
const ctx: CanonicalVariableContext = {
  contact: { firstName: 'Sarah', lastName: 'Connor', email: 'sarah@resistance.org' },
  company: { name: 'Cyberdyne Systems', domain: 'cyberdyne.com' },
  sender: { name: 'John Doe', email: 'john@leadforge.ai' }
};

const inputTpl = 'Hello {{contact.firstName}},\n\nI noticed {{company.name}} is hiring.\nLet me know if you are open to chatting.\n\nBest,\n{{sender.name}}';
const rendered = renderCanonicalVariables(inputTpl, ctx);

assert.strictEqual(
  rendered,
  'Hello Sarah,\n\nI noticed Cyberdyne Systems is hiring.\nLet me know if you are open to chatting.\n\nBest,\nJohn Doe'
);
console.log('✅ Variable interpolation passed.');

// Test 2: plainTextToHtml paragraph and line-break conversion with Gmail default typography
const html = plainTextToHtml(rendered);
assert.ok(html.startsWith('<div style="font-family:sans-serif;line-height:107%;">'));
assert.ok(html.endsWith('</div>'));
assert.ok(html.includes('<p class="MsoNormal" style="margin:0in 0in 8pt;line-height:107%;font-size:11pt;font-family:Calibri,sans-serif">Hello Sarah,</p>'));
assert.ok(html.includes('<p class="MsoNormal" style="margin:0in 0in 8pt;line-height:107%;font-size:11pt;font-family:Calibri,sans-serif">I noticed Cyberdyne Systems is hiring.<br/>Let me know if you are open to chatting.</p>'));
assert.ok(html.includes('<p class="MsoNormal" style="margin:0in 0in 8pt;line-height:107%;font-size:11pt;font-family:Calibri,sans-serif">Best,<br/>John Doe</p>'));
console.log('✅ plainTextToHtml paragraph blocks, line breaks, and default typography passed.');

// Test 3: formatEmailBody returns both text and html
const formatted = formatEmailBody(rendered);
assert.strictEqual(formatted.text, rendered);
assert.strictEqual(formatted.html, html);
console.log('✅ formatEmailBody structure passed.');

// Test 4: HTML entity escaping
const rawWithEntities = 'Price < $100 & profit > 50% "quoted" \'single\'';
const escapedHtml = plainTextToHtml(rawWithEntities);
assert.ok(escapedHtml.includes('&lt;'));
assert.ok(escapedHtml.includes('&gt;'));
assert.ok(escapedHtml.includes('&amp;'));
assert.ok(escapedHtml.includes('&quot;'));
assert.ok(escapedHtml.includes('&#39;'));
assert.ok(escapedHtml.includes('font-family:sans-serif'));
assert.ok(escapedHtml.includes('line-height:107%'));
console.log('✅ HTML escaping and root typography passed.');

// Test 5: extractTemplateVariables with namespaced and dot tokens
const { extractTemplateVariables, wrapHtmlWithDefaultTypography } = await import('./variable-resolver.js');
const extracted = extractTemplateVariables('Hi {{contact.firstName}} from {{company.name}} ({{company.domain}})! Contact us at {{sender.email}}.');
assert.deepStrictEqual(extracted, ['contact.firstName', 'company.name', 'company.domain', 'sender.email']);
console.log('✅ extractTemplateVariables with namespaced tokens passed.');

// Test 6: Fallback when company is null
const nullCompanyCtx: CanonicalVariableContext = {
  contact: { firstName: 'Alice', lastName: 'Smith', email: 'alice@example.com' },
  company: null,
  sender: { name: 'Bob', email: 'bob@sender.com' }
};
const missingCompanyRendered = renderCanonicalVariables('Hi {{contact.firstName}}, working at {{company.name}}', nullCompanyCtx);
assert.strictEqual(missingCompanyRendered, 'Hi Alice, working at ');
console.log('✅ Null company fallback handling passed.');

// Test 7: wrapHtmlWithDefaultTypography
const rawHtmlSnippet = '<p>Custom HTML paragraph</p>';
const wrappedSnippet = wrapHtmlWithDefaultTypography(rawHtmlSnippet);
assert.strictEqual(wrappedSnippet, '<div style="font-family:sans-serif;line-height:107%;"><p>Custom HTML paragraph</p></div>');

// Already wrapped should not be double wrapped
const doubleWrapped = wrapHtmlWithDefaultTypography(wrappedSnippet);
assert.strictEqual(doubleWrapped, wrappedSnippet);
console.log('✅ wrapHtmlWithDefaultTypography passed.');

// Test 8: normalizeEmailSignature handles entity-escaped and bare td table cells
const { normalizeEmailSignature } = await import('./variable-resolver.js');
const rawEscapedSig = '<div dir="ltr"><pre><code>&lt;td style=&quot;padding-left:18px;&quot;&gt;&lt;div&gt;&lt;strong&gt;Test Company&lt;/strong&gt;&lt;/div&gt;&lt;/td&gt;</code></pre></div>';
const normalized = normalizeEmailSignature(rawEscapedSig);
assert.ok(normalized.includes('<table'), 'Bare td should be wrapped in table');
assert.ok(normalized.includes('<strong>Test Company</strong>'), 'Entities should be decoded to HTML');
assert.ok(!normalized.includes('<pre>'), 'Pre tags should be stripped');
console.log('✅ normalizeEmailSignature passed.');

console.log('[SDK Test] All variable-resolver and formatting tests PASSED!');
