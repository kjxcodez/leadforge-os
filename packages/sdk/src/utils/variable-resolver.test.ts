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

// Test 2: plainTextToHtml paragraph and line-break conversion
const html = plainTextToHtml(rendered);
assert.ok(html.includes('<p style="margin:0 0 16px 0;line-height:1.5;">Hello Sarah,</p>'));
assert.ok(html.includes('<p style="margin:0 0 16px 0;line-height:1.5;">I noticed Cyberdyne Systems is hiring.<br/>Let me know if you are open to chatting.</p>'));
assert.ok(html.includes('<p style="margin:0 0 16px 0;line-height:1.5;">Best,<br/>John Doe</p>'));
console.log('✅ plainTextToHtml paragraph blocks and line breaks passed.');

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
console.log('✅ HTML escaping passed.');

// Test 5: extractTemplateVariables with namespaced and dot tokens
const { extractTemplateVariables } = await import('./variable-resolver.js');
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

console.log('[SDK Test] All variable-resolver and formatting tests PASSED!');
