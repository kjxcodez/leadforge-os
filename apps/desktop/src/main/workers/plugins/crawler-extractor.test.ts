/**
 * LeadForge OS — Crawler Email Extractor Integration Tests
 *
 * Validates the 12 deterministic HTML fixtures and crawler invariants
 * defined in Phase 3: Production Crawler & Email Discovery Integration.
 */

import { extractCandidatesFromHtml } from './crawler-extractor.js';
import { ContactEmailStatus } from '@leadforge/schema';

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passedCount++;
    console.log(`[PASS] ${message}`);
  } else {
    failedCount++;
    console.error(`[FAIL] ${message}`);
  }
}

console.log('=================================================================');
console.log('RUNNING CRAWLER EXTRACTOR INTEGRATION FIXTURES & INVARIANTS');
console.log('=================================================================\n');

// ── Fixture 1: Simple mailto ──
{
  const html = `<html><body><p>Contact us: <a href="mailto:john@company.com">Email John</a></p></body></html>`;
  const res = extractCandidatesFromHtml(html, 'https://company.com/contact', 'company.com');
  assert(res.candidates.length === 1, 'Fixture 1: Extracts single candidate');
  assert(res.candidates[0]?.email === 'john@company.com', 'Fixture 1: Clean email extracted');
  assert(res.candidates[0]?.emailMeta.sourceType === 'mailto', 'Fixture 1: Source type is mailto');
  assert(res.candidates[0]?.emailMeta.domainMatched === true, 'Fixture 1: Domain matched company domain');
}

// ── Fixture 2: Adjacent text corruption across semantic elements ──
{
  const html = `
    <html>
      <body>
        <nav>Information</nav>
        <a href="mailto:info@company.com">info@company.com</a>
        <section>Warranty</section>
      </body>
    </html>
  `;
  const res = extractCandidatesFromHtml(html, 'https://company.com', 'company.com');
  assert(res.candidates.length === 1, 'Fixture 2: Extracts single candidate without merging nav text');
  assert(res.candidates[0]?.email === 'info@company.com', 'Fixture 2: info@company.com extracted without corruption');
  assert(!res.candidates.some((c) => c.email.includes('information')), 'Fixture 2: "information" not prepended to email');
  assert(!res.candidates.some((c) => c.email.includes('warranty')), 'Fixture 2: "warranty" not appended to email');
}

// ── Fixture 3: Navigation + header + footer + label + button combinations ──
{
  const html = `
    <html>
      <header><div class="logo">Acme Corp</div></header>
      <nav><a href="/">Home</a><a href="/about">About</a></nav>
      <main>
        <label>Email Address:</label>
        <span>contact@company.com</span>
        <button type="button">Copy</button>
        <address>123 Main St, City, ST</address>
      </main>
      <footer><span>Privacy Policy</span></footer>
    </html>
  `;
  const res = extractCandidatesFromHtml(html, 'https://company.com', 'company.com');
  assert(res.candidates.length === 1, 'Fixture 3: Extracts candidate from complex DOM tree');
  assert(res.candidates[0]?.email === 'contact@company.com', 'Fixture 3: Correctly extracts contact@company.com');
}

// ── Fixture 4: Multiple adjacent emails ──
{
  const html = `
    <div>
      <a href="mailto:a@company.com">A</a>
      <a href="mailto:b@company.com">B</a>
    </div>
  `;
  const res = extractCandidatesFromHtml(html, 'https://company.com', 'company.com');
  assert(res.candidates.length === 2, 'Fixture 4: Extracts two separate candidates');
  const emails = res.candidates.map((c) => c.email).sort();
  assert(emails[0] === 'a@company.com' && emails[1] === 'b@company.com', 'Fixture 4: No adjacent link merging');
}

// ── Fixture 5: JSON-LD Organization ──
{
  const html = `
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "Acme Inc",
            "email": "org@company.com"
          }
        </script>
      </head>
      <body><h1>Welcome</h1></body>
    </html>
  `;
  const res = extractCandidatesFromHtml(html, 'https://company.com', 'company.com');
  assert(res.candidates.length === 1, 'Fixture 5: Extracts email from JSON-LD Organization');
  assert(res.candidates[0]?.email === 'org@company.com', 'Fixture 5: Correct email extracted');
  assert(res.candidates[0]?.emailMeta.sourceType === 'json_ld', 'Fixture 5: Source type is json_ld');
}

// ── Fixture 6: JSON-LD ContactPoint & @graph ──
{
  const html = `
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "LocalBusiness",
                "name": "Acme Store",
                "contactPoint": {
                  "@type": "ContactPoint",
                  "email": "sales@company.com",
                  "contactType": "customer service"
                }
              }
            ]
          }
        </script>
      </head>
    </html>
  `;
  const res = extractCandidatesFromHtml(html, 'https://company.com', 'company.com');
  assert(res.candidates.length === 1, 'Fixture 6: Extracts email from nested JSON-LD ContactPoint inside @graph');
  assert(res.candidates[0]?.email === 'sales@company.com', 'Fixture 6: sales@company.com extracted');
  assert(res.candidates[0]?.emailMeta.sourceType === 'json_ld', 'Fixture 6: Source type is json_ld');
}

// ── Fixture 7: Malformed JSON-LD does not crash extraction ──
{
  const html = `
    <html>
      <head>
        <script type="application/ld+json">
          { broken json: not real syntax ...
        </script>
      </head>
      <body>
        <a href="mailto:fallback@company.com">Contact</a>
      </body>
    </html>
  `;
  let threw = false;
  let res: any = null;
  try {
    res = extractCandidatesFromHtml(html, 'https://company.com', 'company.com');
  } catch {
    threw = true;
  }
  assert(!threw, 'Fixture 7: Malformed JSON-LD does not throw or crash parser');
  assert(res && res.candidates.length === 1, 'Fixture 7: Fallback candidate extracted from HTML');
  assert(res && res.candidates[0]?.email === 'fallback@company.com', 'Fixture 7: fallback@company.com extracted');
}

// ── Fixture 8: Third-party email attribution separation ──
{
  const html = `
    <html>
      <body>
        <p>Contact the plumbers at <a href="mailto:info@acmeplumbing.com">info@acmeplumbing.com</a></p>
        <footer>Website created by <a href="mailto:support@pixelagency.com">Pixel Agency</a></footer>
      </body>
    </html>
  `;
  const res = extractCandidatesFromHtml(html, 'https://acmeplumbing.com', 'acmeplumbing.com');
  assert(res.candidates.length === 1, 'Fixture 8: Only company-affiliated email in primary candidates');
  assert(res.candidates[0]?.email === 'info@acmeplumbing.com', 'Fixture 8: Company email retained in candidates');
  assert(res.thirdPartyCandidates.length === 1, 'Fixture 8: Third-party email captured in thirdPartyCandidates');
  assert(res.thirdPartyCandidates[0]?.email === 'support@pixelagency.com', 'Fixture 8: pixelagency.com classified as third-party');
  assert(res.thirdPartyCandidates[0]?.emailMeta.domainMatched === false, 'Fixture 8: domainMatched is false for third-party');
}

// ── Fixture 9: Role email naming behavior ──
{
  const html = `<p>Contact us: <a href="mailto:info@company.com">info@company.com</a></p>`;
  const res = extractCandidatesFromHtml(html, 'https://company.com', 'company.com');
  assert(res.candidates[0]?.email === 'info@company.com', 'Fixture 9: Role account extracted');
  assert(res.candidates[0]?.firstName === null, 'Fixture 9: Role account firstName is null (NOT "Discovered")');
  assert(res.candidates[0]?.lastName === null, 'Fixture 9: Role account lastName is null');
  assert(res.candidates[0]?.emailMeta.isRoleAccount === true, 'Fixture 9: Flagged as role account');
}

// ── Fixture 10: Personal email name inference ──
{
  const html = `<p>Lead Engineer: <a href="mailto:john.smith@company.com">Email John</a></p>`;
  const res = extractCandidatesFromHtml(html, 'https://company.com', 'company.com');
  assert(res.candidates[0]?.email === 'john.smith@company.com', 'Fixture 10: Personal account extracted');
  assert(res.candidates[0]?.firstName === 'John', 'Fixture 10: Inferred firstName = "John"');
  assert(res.candidates[0]?.lastName === 'Smith', 'Fixture 10: Inferred lastName = "Smith"');
}

// ── Fixture 11: Valid repeated mailbox preserved ──
{
  const html = `<p>Navigation Systems: <a href="mailto:tomtom@company.com">tomtom@company.com</a></p>`;
  const res = extractCandidatesFromHtml(html, 'https://company.com', 'company.com');
  assert(res.candidates[0]?.email === 'tomtom@company.com', 'Fixture 11: "tomtom" preserved verbatim (not mangled to "tom")');
}

// ── Fixture 12: Parked / Landing template website signals ──
{
  const html = `
    <html>
      <head><title>This Domain is Parked | GoDaddy</title></head>
      <body>
        <h1>Buy this domain</h1>
        <p>Inquire about this domain: sales@acmeplumbing.com</p>
      </body>
    </html>
  `;
  const res = extractCandidatesFromHtml(html, 'https://acmeplumbing.com', 'acmeplumbing.com');
  assert(res.isParkedPage === true, 'Fixture 12: Detected parked template landing page');
  assert(res.candidates[0]?.emailStatus === ContactEmailStatus.QUARANTINED, 'Fixture 12: Candidate quarantined due to parked template');
}

// ── Invariant D: Explicit sources outrank weaker sources ──
{
  const html = `
    <html>
      <body>
        <p>Visible text: info@company.com</p>
        <a href="mailto:info@company.com">Email Us</a>
      </body>
    </html>
  `;
  const res = extractCandidatesFromHtml(html, 'https://company.com', 'company.com');
  assert(res.candidates.length === 1, 'Invariant D: Deduplicated to 1 candidate');
  assert(res.candidates[0]?.emailMeta.sourceType === 'mailto', 'Invariant D: mailto outranked dom_text');
}

// ── Invariant E: Idempotency ──
{
  const html = `<div><a href="mailto:ceo@company.com">CEO</a></div>`;
  const res1 = extractCandidatesFromHtml(html, 'https://company.com', 'company.com');
  const res2 = extractCandidatesFromHtml(html, 'https://company.com', 'company.com');
  assert(res1.candidates.length === res2.candidates.length, 'Invariant E: Candidate count is identical across runs');
  assert(res1.candidates[0]?.email === res2.candidates[0]?.email, 'Invariant E: Output email is identical');
}

// ── Invariant H: Source URL integrity ──
{
  const targetUrl = 'https://company.com/team/leadership';
  const html = `<p><a href="mailto:sarah@company.com">Sarah</a></p>`;
  const res = extractCandidatesFromHtml(html, targetUrl, 'company.com');
  assert(res.candidates[0]?.emailMeta.sourceUrl === targetUrl, 'Invariant H: sourceUrl matches exact extraction page');
}

console.log('\n=================================================================');
console.log(`TOTAL FIXTURE ASSERTIONS: ${passedCount + failedCount} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
console.log('=================================================================');

if (failedCount > 0) {
  process.exit(1);
} else {
  console.log('ALL CRAWLER INTEGRATION FIXTURES & INVARIANTS PASSED!');
}
