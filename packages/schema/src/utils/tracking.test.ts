/**
 * LeadForge OS — Tracking Utilities Unit Test Suite
 */

import {
  generateTrackingToken,
  injectOpenTrackingPixel,
  rewriteLinksForClickTracking,
  sanitizeHtmlForPreview
} from './tracking.js';

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed++;
    console.log(`[PASS] ${msg}`);
  } else {
    failed++;
    console.error(`[FAIL] ${msg}`);
  }
}

console.log('=================================================================');
console.log('RUNNING EMAIL TRACKING UTILITIES UNIT TESTS');
console.log('=================================================================\n');

// ── 1. Token Generation ──
const t1 = generateTrackingToken();
const t2 = generateTrackingToken();
assert(typeof t1 === 'string' && t1.length === 32, 'Token is 32-character hex string');
assert(/^[0-9a-f]{32}$/.test(t1), 'Token contains valid hex characters');
assert(t1 !== t2, 'Tokens are uniquely generated');

// ── 2. Open Tracking Pixel Injection ──
{
  const htmlWithBody = '<html><body><p>Hello World</p></body></html>';
  const injected = injectOpenTrackingPixel(htmlWithBody, 'https://track.leadforge.com', 'tok-123');
  assert(injected.includes('src="https://track.leadforge.com/t/open/tok-123"'), 'Pixel URL constructed with base URL and token');
  assert(injected.includes('width="1" height="1"'), 'Pixel has 1x1 dimensions');
  assert(injected.includes('</body>'), 'Pixel injected before closing body tag');
}

{
  const htmlWithoutBody = '<div><p>Direct Snippet</p></div>';
  const injected = injectOpenTrackingPixel(htmlWithoutBody, 'https://track.leadforge.com/', 'tok-456');
  assert(injected.includes('src="https://track.leadforge.com/t/open/tok-456"'), 'Handles trailing slash in trackingBaseUrl');
  assert(injected.endsWith('/>'), 'Appended at end of fragment without body tag');
}

// ── 3. Click Tracking Link Rewriting ──
{
  const originalHtml = `
    <div>
      <p>Please review:</p>
      <a href="https://acme.com/pricing">See Pricing</a>
      <a href="https://acme.com/docs" target="_blank">Documentation</a>
      <a href="mailto:support@acme.com">Contact Support</a>
      <a href="tel:+18005551234">Call Us</a>
      <a href="#section-2">Jump Down</a>
      <a href="https://acme.com/unsubscribe" class="leadforge-unsubscribe">Unsubscribe</a>
      <a href="https://acme.com/privacy" data-no-track="true">Privacy Policy</a>
    </div>
  `;

  let counter = 0;
  const mockTokenGen = () => `mock-token-${++counter}`;
  const result = rewriteLinksForClickTracking(originalHtml, 'https://track.leadforge.com', mockTokenGen);

  assert(result.tokens.length === 2, 'Exactly 2 links rewritten (pricing & docs)');
  assert(result.tokens[0]?.targetUrl === 'https://acme.com/pricing', 'First target URL preserved');
  assert(result.tokens[1]?.targetUrl === 'https://acme.com/docs', 'Second target URL preserved');

  assert(result.rewrittenHtml.includes('href="https://track.leadforge.com/t/click/mock-token-1"'), 'Pricing link rewritten to tracking URL');
  assert(result.rewrittenHtml.includes('href="https://track.leadforge.com/t/click/mock-token-2"'), 'Docs link rewritten to tracking URL');

  // Verify exclusions
  assert(result.rewrittenHtml.includes('href="mailto:support@acme.com"'), 'mailto: link was NOT rewritten');
  assert(result.rewrittenHtml.includes('href="tel:+18005551234"'), 'tel: link was NOT rewritten');
  assert(result.rewrittenHtml.includes('href="#section-2"'), 'anchor (#) link was NOT rewritten');
  assert(result.rewrittenHtml.includes('href="https://acme.com/unsubscribe"'), 'unsubscribe link was NOT rewritten');
  assert(result.rewrittenHtml.includes('href="https://acme.com/privacy"'), 'data-no-track link was NOT rewritten');
}

// ── 4. HTML Preview Sanitization (Phase 5E) ──
{
  const maliciousHtml = `
    <div>
      <h1>Clean Header</h1>
      <script>alert('pwned');</script>
      <iframe src="http://evil.com"></iframe>
      <img src="https://safe.com/pic.png" onload="alert('xss')" />
      <a href="javascript:alert('click-xss')">Click Me</a>
      <object data="evil.swf"></object>
      <embed src="evil.swf" />
    </div>
  `;

  const safe = sanitizeHtmlForPreview(maliciousHtml);
  assert(!safe.includes('<script'), 'Script tag stripped');
  assert(!safe.includes('<iframe'), 'Iframe tag stripped');
  assert(!safe.includes('<object'), 'Object tag stripped');
  assert(!safe.includes('<embed'), 'Embed tag stripped');
  assert(!safe.includes('onload='), 'Inline onload handler stripped');
  assert(!safe.includes('javascript:'), 'javascript: URI neutralized');
  assert(safe.includes('<h1>Clean Header</h1>'), 'Benign HTML content preserved');
  assert(safe.includes('src="https://safe.com/pic.png"'), 'Safe image preserved');
}

console.log('\n=================================================================');
console.log(`TOTAL TRACKING TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('=================================================================');

if (failed > 0) process.exit(1);
