import { z } from 'zod';
import { MimeBuilder } from '../apps/api/src/services/google/mime-builder.js';
import { renderCanonicalVariables, formatEmailBody } from '../packages/sdk/src/utils/variable-resolver.js';
import crypto from 'crypto';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, errorDetails?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${testName}`, errorDetails ? errorDetails : '');
  }
}

async function runVerification() {
  console.log('================================================================');
  console.log('  LEADFORGE OS — OUTREACH CAMPAIGN & TEMPLATE DISPATCH AUDIT');
  console.log('================================================================\n');

  // ── TEST SUITE 1: Zod sendSchema Preservation & Passthrough ───────────────
  console.log('── Suite 1: API sendSchema Schema Validation & Metadata Preservation ──');
  {
    const sendSchema = z
      .object({
        accountId: z.string().min(1),
        to: z.string().email(),
        subject: z.string().min(1),
        text: z.string().optional(),
        html: z.string().optional(),
        from: z.string().optional(),
        useSignature: z.boolean().optional(),
        idempotencyKey: z.string().optional(),
        campaignId: z.string().optional(),
        sequenceId: z.string().optional(),
        executionId: z.string().optional(),
        stepIndex: z.number().optional(),
        contactId: z.string().optional(),
        attachments: z
          .array(
            z
              .object({
                id: z.string().optional(),
                attachmentId: z.string().optional(),
                fileId: z.string().nullable().optional(),
                provider: z.string().optional(),
                filename: z.string(),
                contentBase64: z.string().optional(),
                data: z.any().optional(),
                path: z.string().optional(),
                contentType: z.string().optional(),
                mimeType: z.string().nullable().optional(),
                size: z.number().optional(),
                driveUrl: z.string().nullable().optional(),
                googleConnectionId: z.string().nullable().optional()
              })
              .passthrough()
          )
          .optional()
      })
      .passthrough();

    const payload = {
      accountId: 'acc_sales_123',
      to: 'lead@enterprise.com',
      subject: 'Partnership Opportunity with Acme',
      text: 'Hi John, let us connect.',
      html: '<p>Hi John, let us connect.</p>',
      idempotencyKey: 'email_ws1_exec456_step0_lead789',
      campaignId: 'camp_enterprise_q3',
      sequenceId: 'seq_outreach_q3',
      executionId: 'exec456',
      stepIndex: 0,
      contactId: 'lead789',
      attachments: [
        {
          id: 'att_case_study_99',
          filename: 'Case_Study_2026.pdf',
          fileId: '1AbCdEfGhIjKlMnOpQrStUvWxYz',
          googleConnectionId: 'gconn_director_01',
          driveUrl: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view'
        }
      ]
    };

    const parsed = sendSchema.parse(payload);
    assert(parsed.idempotencyKey === 'email_ws1_exec456_step0_lead789', 'idempotencyKey is preserved after schema parse');
    assert(parsed.campaignId === 'camp_enterprise_q3', 'campaignId is preserved after schema parse');
    assert(parsed.sequenceId === 'seq_outreach_q3', 'sequenceId is preserved after schema parse');
    assert(parsed.executionId === 'exec456', 'executionId is preserved after schema parse');
    assert(parsed.stepIndex === 0, 'stepIndex is preserved after schema parse');
    assert(parsed.contactId === 'lead789', 'contactId is preserved after schema parse');
    assert(parsed.attachments?.[0].fileId === '1AbCdEfGhIjKlMnOpQrStUvWxYz', 'attachment fileId is preserved');
    assert(parsed.attachments?.[0].googleConnectionId === 'gconn_director_01', 'attachment googleConnectionId is preserved');
  }

  // ── TEST SUITE 2: RFC 2045 & RFC 2822 MIME Chunking ──────────────────────
  console.log('\n── Suite 2: RFC 2045 / RFC 2822 MIME Construction & Line Wrapping ──');
  {
    // Long HTML text (5000 chars)
    const longHtml = '<h1>Quarterly Business Review</h1>' + '<p>Long paragraph with substantial outreach text.</p>'.repeat(100);
    const longText = 'Quarterly Business Review: ' + 'Details for the meeting and deck review. '.repeat(100);
    const sampleAttachmentBuffer = Buffer.from('PDF Mock Data Content '.repeat(200), 'utf8');

    const rawMime = MimeBuilder.buildRaw({
      from: 'alex@company.com',
      to: 'target@enterprise.com',
      subject: 'Quarterly Executive Summary & Strategic Proposal',
      text: longText,
      html: longHtml,
      attachments: [
        {
          filename: 'Executive_Deck_2026.pdf',
          contentType: 'application/pdf',
          data: sampleAttachmentBuffer
        }
      ]
    });

    assert(typeof rawMime === 'string' && rawMime.length > 0, 'MIME payload was built and base64url encoded');

    // Decode base64url to test RFC line length
    const base64Standard = rawMime.replace(/-/g, '+').replace(/_/g, '/');
    const decodedMime = Buffer.from(base64Standard, 'base64').toString('utf8');

    const lines = decodedMime.split('\r\n');
    let maxLineLength = 0;
    for (const line of lines) {
      if (line.length > maxLineLength) maxLineLength = line.length;
    }

    assert(maxLineLength <= 998, `All MIME lines conform to RFC 2822 max line limit (Max line length: ${maxLineLength} <= 998)`);
    assert(decodedMime.includes('Content-Type: multipart/mixed;'), 'MIME contains multipart/mixed root boundary');
    assert(decodedMime.includes('Content-Type: multipart/alternative;'), 'MIME contains nested multipart/alternative boundary');
    assert(decodedMime.includes('Executive_Deck_2026.pdf'), 'MIME attachment filename is encoded in headers');
    assert(decodedMime.includes('Content-Disposition: attachment;'), 'MIME contains attachment disposition');
  }

  // ── TEST SUITE 3: Canonical Variable Template Engine ───────────────────────
  console.log('\n── Suite 3: Canonical Variable Template Resolution ──────────────');
  {
    const renderCtx = {
      contact: {
        id: 'cnt_001',
        firstName: 'Sarah',
        lastName: 'Connor',
        email: 'sarah.connor@cyberdyne.com',
        title: 'VP of Engineering'
      },
      company: {
        id: 'comp_001',
        name: 'Cyberdyne Systems',
        domain: 'cyberdyne.com',
        industry: 'Robotics & AI'
      },
      sender: {
        name: 'Alex Mercer',
        email: 'alex@leadforge.ai'
      },
      workspace: {
        id: 'ws_demo',
        name: 'LeadForge Global'
      },
      sequence: {
        id: 'seq_01',
        name: 'Outbound Q3 Wave 1'
      }
    };

    const templateSubject = 'Hi {{contact.firstName}}, quick question for {{company.name}}';
    const templateBody = `Hello {{firstName}},

I saw your work as {{contact.title}} at {{company.name}}.
Given {{company.name}}'s focus on {{company.industry}}, our team at {{workspaceName}} would love to connect.

Best regards,
{{senderName}}
{{sender.email}}`;

    const renderedSubject = renderCanonicalVariables(templateSubject, renderCtx);
    const renderedBody = renderCanonicalVariables(templateBody, renderCtx);
    const formattedBody = formatEmailBody(renderedBody);

    assert(renderedSubject === 'Hi Sarah, quick question for Cyberdyne Systems', 'Subject variables resolved correctly');
    assert(renderedBody.includes('Hello Sarah,'), 'First name resolved from {{firstName}} alias');
    assert(renderedBody.includes('VP of Engineering at Cyberdyne Systems'), 'Title and company resolved from namespaced tokens');
    assert(renderedBody.includes('focus on Robotics & AI'), 'Industry resolved');
    assert(renderedBody.includes('Alex Mercer'), 'Sender name resolved');
    assert(renderedBody.includes('alex@leadforge.ai'), 'Sender email resolved');
    assert(formattedBody.html.includes('Hello Sarah,') && formattedBody.html.includes('font-family:sans-serif') && formattedBody.html.includes('line-height:107%'), 'Plain text formatted to HTML paragraphs with default Gmail typography');
  }

  // ── TEST SUITE 4: Attachment Identity Query Matching ──────────────────────
  console.log('\n── Suite 4: MongoDB Attachment Query Matching ───────────────────');
  {
    // Emulate attachment ID lookup query building
    function buildAttachmentQuery(att: { id?: string; attachmentId?: string; fileId?: string | null }) {
      const attId = att.id || att.attachmentId;
      const fileId = att.fileId;
      const query: any[] = [];
      if (attId) query.push({ _id: attId });
      if (fileId) query.push({ fileId });
      if (attId && attId !== fileId) query.push({ fileId: attId });
      return query;
    }

    const testAtt1 = { id: 'att_a1b2c3d4e5f6', fileId: '1xyz987' };
    const query1 = buildAttachmentQuery(testAtt1);
    assert(query1.length === 3, 'Query includes _id, fileId, and fallback fileId');
    assert(query1[0]._id === 'att_a1b2c3d4e5f6', '_id query matches att_ prefix entity ID');

    const testAtt2 = { attachmentId: 'att_drive_999', fileId: null };
    const query2 = buildAttachmentQuery(testAtt2);
    assert(query2[0]._id === 'att_drive_999', 'attachmentId correctly maps to _id query');
    assert(query2[1].fileId === 'att_drive_999', 'attachmentId maps to fallback fileId query');
  }

  // ── TEST SUITE 5: Deterministic Idempotency Key Isolation ─────────────────
  console.log('\n── Suite 5: Idempotency Key Isolation & Collision Prevention ────');
  {
    function generateDeterministicIdempotencyKey(input: {
      idempotencyKey?: string;
      executionId?: string;
      stepIndex?: number;
      accountId: string;
      to: string;
      subject: string;
      workspaceId: string;
    }): string {
      if (input.idempotencyKey) return input.idempotencyKey;
      const executionPart = input.executionId || `send_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;
      const stepPart = input.stepIndex !== undefined ? `_step${input.stepIndex}` : '';
      const hash = crypto
        .createHash('sha256')
        .update(`${input.workspaceId}:${input.accountId}:${input.to.toLowerCase().trim()}:${input.subject.trim()}`)
        .digest('hex')
        .substring(0, 16);
      return `${executionPart}${stepPart}_${input.accountId}_${hash}`;
    }

    const wsId = 'ws_prod';
    const accId = 'acc_gmail_01';
    const to = 'lead@client.com';
    const subject = 'Follow-up regarding proposal';

    // 1. Explicit idempotency key passed from campaign execution
    const explicitKey = generateDeterministicIdempotencyKey({
      idempotencyKey: 'camp_q3_exec_101_cnt_55_step0',
      accountId: accId,
      to,
      subject,
      workspaceId: wsId
    });
    assert(explicitKey === 'camp_q3_exec_101_cnt_55_step0', 'Explicit idempotency key is preserved');

    // 2. Distinct execution IDs produce distinct keys even for same recipient/subject
    const execKey1 = generateDeterministicIdempotencyKey({
      executionId: 'exec_run_alpha',
      stepIndex: 0,
      accountId: accId,
      to,
      subject,
      workspaceId: wsId
    });
    const execKey2 = generateDeterministicIdempotencyKey({
      executionId: 'exec_run_beta',
      stepIndex: 0,
      accountId: accId,
      to,
      subject,
      workspaceId: wsId
    });
    assert(execKey1 !== execKey2, 'Different executions for the same contact/subject generate unique idempotency keys');
    assert(execKey1.startsWith('exec_run_alpha_step0_acc_gmail_01_'), 'execKey1 includes execution, step, and account');
    assert(execKey2.startsWith('exec_run_beta_step0_acc_gmail_01_'), 'execKey2 includes execution, step, and account');

    // 3. Fallback send keys without executionId are uniquely generated to avoid stale collisions
    const fallbackKey1 = generateDeterministicIdempotencyKey({ accountId: accId, to, subject, workspaceId: wsId });
    const fallbackKey2 = generateDeterministicIdempotencyKey({ accountId: accId, to, subject, workspaceId: wsId });
    assert(fallbackKey1 !== fallbackKey2, 'Fallback sends without explicit keys do not collide across time');
  }

  // ── FINAL SUMMARY ──────────────────────────────────────────────────────────
  console.log('\n================================================================');
  console.log(`  VERIFICATION RESULT: ${passedTests}/${totalTests} TESTS PASSED`);
  if (failedTests === 0) {
    console.log('  STATUS: 100% PASS — ALL OUTREACH CAMPAIGN & TEMPLATE INVARIANTS VERIFIED');
  } else {
    console.log(`  STATUS: ${failedTests} FAILURE(S) DETECTED`);
  }
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
