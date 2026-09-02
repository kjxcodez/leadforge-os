import assert from 'node:assert';
import {
  plainTextToHtml,
  formatEmailBody,
  renderCanonicalVariables,
  wrapHtmlWithDefaultTypography,
  type CanonicalVariableContext
} from '../packages/sdk/src/utils/variable-resolver.js';
import { MimeBuilder } from '../apps/api/src/services/google/mime-builder.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function testAssert(condition: boolean, testName: string, details?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ [FAIL] ${testName}`, details ? details : '');
  }
}

async function runTypographyVerification() {
  console.log('========================================================================');
  console.log(' LeadForge OS — Outbound Email Typography (Gmail-Like) Verification');
  console.log('========================================================================\n');

  // ---------------------------------------------------------------------------
  // Condition 1 & 2: HTML output contains font-family:sans-serif and line-height:107%
  // ---------------------------------------------------------------------------
  console.log('── [Condition 1 & 2] Default Typography Tokens in HTML Output ──');
  {
    const rawBody = 'Dear Alex,\n\nI hope this email finds you well.\nWe would love to discuss partnership options.\n\nBest,\nLeadForge Team';
    const html = plainTextToHtml(rawBody);

    testAssert(html.includes('font-family:sans-serif'), 'HTML output contains font-family:sans-serif');
    testAssert(html.includes('line-height:107%'), 'HTML output contains line-height:107%');
    testAssert(html.startsWith('<div style="font-family:sans-serif;line-height:107%;">'), 'Root container has inline style with sans-serif and 107% line-height');
    testAssert(html.endsWith('</div>'), 'HTML ends with root container closing tag');
    testAssert(html.includes('<p style="margin:0 0 16px 0;line-height:107%;">Dear Alex,</p>'), 'Child paragraph styles use line-height:107% (no overriding 1.5 or 150%)');
  }

  // ---------------------------------------------------------------------------
  // Condition 3: Typography wrapper is present in final HTML entering MIME generation
  // ---------------------------------------------------------------------------
  console.log('\n── [Condition 3] Typography Wrapper in Final Outgoing MIME Message ──');
  {
    const rawBody = 'Hello Jordan,\n\nHere is our updated brochure for Q3.';
    const formatted = formatEmailBody(rawBody);

    const rawMime = MimeBuilder.buildRaw({
      from: 'sender@leadforge.ai',
      to: 'recipient@enterprise.com',
      subject: 'Updated Q3 Brochure',
      text: formatted.text,
      html: formatted.html
    });

    const decodedMime = Buffer.from(rawMime.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

    testAssert(decodedMime.includes('text/html'), 'MIME contains text/html part');
    testAssert(decodedMime.includes('font-family:sans-serif') || decodedMime.includes('font-family%3Asans-serif') || decodedMime.length > 0, 'MIME payload was generated successfully');

    // Extract HTML base64 part and decode
    const htmlPartMatch = decodedMime.match(/Content-Type: text\/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n([\s\S]*?)(?=\r\n--)/);
    testAssert(Boolean(htmlPartMatch && htmlPartMatch[1]), 'Extracted text/html MIME payload chunk');
    if (htmlPartMatch && htmlPartMatch[1]) {
      const htmlBase64Clean = htmlPartMatch[1].replace(/[\r\n]/g, '');
      const decodedHtml = Buffer.from(htmlBase64Clean, 'base64').toString('utf8');
      testAssert(decodedHtml.includes('font-family:sans-serif'), 'Decoded MIME text/html payload contains font-family:sans-serif');
      testAssert(decodedHtml.includes('line-height:107%'), 'Decoded MIME text/html payload contains line-height:107%');
    }
  }

  // ---------------------------------------------------------------------------
  // Condition 4: Plain-text version is completely unchanged
  // ---------------------------------------------------------------------------
  console.log('\n── [Condition 4] Plain-Text Version Unaltered ──');
  {
    const originalText = 'Hello World,\n\nThis is paragraph 1.\n\nThis is paragraph 2 with newline:\nLine 2.1\n\nThanks!';
    const formatted = formatEmailBody(originalText);

    testAssert(formatted.text === originalText, 'formatEmailBody(text).text matches original raw string exactly');
    testAssert(!formatted.text.includes('font-family'), 'Plain text contains no CSS font-family styles');
    testAssert(!formatted.text.includes('107%'), 'Plain text contains no CSS line-height styles');
    testAssert(!formatted.text.includes('<div'), 'Plain text contains no HTML tags');
  }

  // ---------------------------------------------------------------------------
  // Condition 5: Existing HTML content & intentional formatting is preserved
  // ---------------------------------------------------------------------------
  console.log('\n── [Condition 5] Preservation of Intentional Rich-Text Content ──');
  {
    const customHtml = '<p>Welcome to <strong>LeadForge OS</strong>. Visit our <a href="https://leadforge.ai">portal</a>.</p>';
    const wrapped = wrapHtmlWithDefaultTypography(customHtml);

    testAssert(wrapped.includes('<strong>LeadForge OS</strong>'), 'Bold tags preserved in HTML');
    testAssert(wrapped.includes('<a href="https://leadforge.ai">portal</a>'), 'Links preserved in HTML');
    testAssert(wrapped.startsWith('<div style="font-family:sans-serif;line-height:107%;">'), 'Custom HTML wrapped in default typography container');
    
    // Idempotency check: don't double wrap
    const doubleWrapped = wrapHtmlWithDefaultTypography(wrapped);
    testAssert(doubleWrapped === wrapped, 'wrapHtmlWithDefaultTypography is idempotent (no duplicate nested wrappers)');
  }

  // ---------------------------------------------------------------------------
  // Condition 6: Template variables still render correctly with typography
  // ---------------------------------------------------------------------------
  console.log('\n── [Condition 6] Canonical Variable Resolution with Typography ──');
  {
    const ctx: CanonicalVariableContext = {
      contact: {
        firstName: 'Elena',
        lastName: 'Rostova',
        email: 'elena@novacorp.com',
        title: 'Chief Technology Officer'
      },
      company: {
        name: 'NovaCorp Industries',
        domain: 'novacorp.com',
        industry: 'Clean Energy',
        location: 'Stockholm, Sweden'
      },
      sender: {
        name: 'Marcus Vance',
        email: 'marcus@leadforge.ai'
      },
      sequence: {
        name: 'Enterprise Outbound 2026'
      }
    };

    const template = `Hi {{contact.firstName}},\n\nI saw your work as {{contact.title}} at {{company.name}} in {{company.location}}.\n\nWith {{company.name}} expanding in {{company.industry}}, {{sender.name}} would love to connect.\n\nBest regards,\n{{senderName}}\n{{sender.email}}`;

    const rendered = renderCanonicalVariables(template, ctx);
    const formatted = formatEmailBody(rendered);

    testAssert(rendered.includes('Hi Elena,'), 'Contact first name rendered');
    testAssert(rendered.includes('Chief Technology Officer at NovaCorp Industries in Stockholm, Sweden'), 'Title, company, and location rendered');
    testAssert(rendered.includes('Clean Energy'), 'Industry rendered');
    testAssert(rendered.includes('Marcus Vance'), 'Sender name rendered');
    testAssert(rendered.includes('marcus@leadforge.ai'), 'Sender email rendered');

    testAssert(formatted.html.includes('font-family:sans-serif'), 'Formatted HTML with variables contains font-family:sans-serif');
    testAssert(formatted.html.includes('line-height:107%'), 'Formatted HTML with variables contains line-height:107%');
    testAssert(formatted.html.includes('Chief Technology Officer at NovaCorp Industries'), 'Variables present inside HTML paragraphs');
  }

  // ---------------------------------------------------------------------------
  // Condition 7: Attachments are unaffected
  // ---------------------------------------------------------------------------
  console.log('\n── [Condition 7] Attachments Unaffected by Typography Changes ──');
  {
    const dummyPdfBuffer = Buffer.from('%PDF-1.4 Mock Attachment Binary Data', 'utf8');
    const rawMime = MimeBuilder.buildRaw({
      from: 'sender@leadforge.ai',
      to: 'recipient@enterprise.com',
      subject: 'Attached Report',
      text: 'Please find the attached document.',
      html: plainTextToHtml('Please find the attached document.'),
      attachments: [
        {
          filename: 'Strategic_Plan_2026.pdf',
          contentType: 'application/pdf',
          data: dummyPdfBuffer
        }
      ]
    });

    const decodedMime = Buffer.from(rawMime.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

    testAssert(decodedMime.includes('Content-Disposition: attachment; filename="Strategic_Plan_2026.pdf"'), 'Attachment header present in MIME');
    testAssert(decodedMime.includes('Content-Type: application/pdf; name="Strategic_Plan_2026.pdf"'), 'Attachment content-type present in MIME');
    testAssert(decodedMime.includes(dummyPdfBuffer.toString('base64')), 'Attachment binary payload intact');
  }

  // ---------------------------------------------------------------------------
  // Condition 8: Existing MIME structure remains valid (RFC 2045 & RFC 2822)
  // ---------------------------------------------------------------------------
  console.log('\n── [Condition 8] MIME RFC 2045 / RFC 2822 Structure Validation ──');
  {
    const sampleHtml = plainTextToHtml('Paragraph 1\n\nParagraph 2\n\nParagraph 3');
    const rawMime = MimeBuilder.buildRaw({
      from: 'outreach@leadforge.ai',
      to: 'lead@target.com',
      subject: 'Testing RFC Compliance',
      text: 'Paragraph 1\n\nParagraph 2\n\nParagraph 3',
      html: sampleHtml
    });

    const decodedMime = Buffer.from(rawMime.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

    testAssert(decodedMime.includes('MIME-Version: 1.0'), 'MIME-Version header present');
    testAssert(decodedMime.includes('Content-Type: multipart/alternative;'), 'multipart/alternative boundary present');

    const lines = decodedMime.split('\r\n');
    let maxLineLength = 0;
    for (const l of lines) {
      if (l.length > maxLineLength) maxLineLength = l.length;
    }
    testAssert(maxLineLength <= 998, `Max line length is ${maxLineLength} (strictly <= 998 per RFC 2822)`);
  }

  // ---------------------------------------------------------------------------
  // FINAL SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`  VERIFICATION RESULT: ${passedTests}/${totalTests} TESTS PASSED`);
  if (failedTests === 0) {
    console.log('  STATUS: 100% PASS — ALL EMAIL TYPOGRAPHY REQUIREMENTS VERIFIED');
  } else {
    console.log(`  STATUS: ${failedTests} FAILURE(S) DETECTED`);
  }
  console.log('========================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTypographyVerification().catch((err) => {
  console.error('Fatal typography verification error:', err);
  process.exit(1);
});
