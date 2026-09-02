import assert from 'node:assert/strict';
import { MimeBuilder, type MimeAttachment } from '../apps/api/src/services/google/mime-builder.js';
import { GoogleAuthService, GMAIL_DEFAULT_SCOPES, DRIVE_FILE_SCOPE } from '../apps/api/src/services/google/auth.service.js';
import { GoogleDriveProvider } from '../apps/api/src/services/google/drive.provider.js';
import { attachmentSchema, uploadAttachmentDtoSchema } from '../packages/schema/src/entities/attachment.js';
import { emailTemplateSchema } from '../packages/schema/src/entities/outreach.js';

async function runVerification() {
  console.log('🧪 Starting Google Drive Media & Attachment Pipeline Verification...\n');

  // 1. Verify Schema Definitions
  console.log('--- 1. Testing Schema Contracts ---');
  const validAttachment = {
    id: 'att_test_1234567890',
    workspaceId: 'ws_test_1234567890',
    provider: 'google-drive',
    googleConnectionId: 'gconn_test_1234567890',
    googleAccountId: 'gacc_12345',
    fileId: 'drive_file_abc123',
    filename: 'brochure.pdf',
    mimeType: 'application/pdf',
    size: 1048576,
    driveUrl: 'https://drive.google.com/file/d/drive_file_abc123/view',
    thumbnailUrl: 'https://lh3.googleusercontent.com/thumbnail',
    contentHash: 'hash123',
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const parsedAttachment = attachmentSchema.parse(validAttachment);
  assert.equal(parsedAttachment.driveUrl, 'https://drive.google.com/file/d/drive_file_abc123/view');
  assert.equal(parsedAttachment.fileId, 'drive_file_abc123');
  console.log('✅ Attachment schema supports driveUrl and fileId.');

  const templateData = {
    id: 'tpl_test_1234567890',
    workspaceId: 'ws_test_1234567890',
    name: 'Outreach Template With Drive Media',
    subject: 'Special proposal for {{contact.firstName}}',
    body: 'Hi {{contact.firstName}},\n\nPlease check the attached proposal.',
    variables: ['contact.firstName'],
    attachments: [
      {
        id: 'att_1',
        filename: 'proposal.pdf',
        size: 204800,
        provider: 'google-drive',
        fileId: 'drive_file_abc123',
        driveUrl: 'https://drive.google.com/file/d/drive_file_abc123/view',
        mimeType: 'application/pdf'
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const parsedTemplate = emailTemplateSchema.parse(templateData);
  assert.equal(parsedTemplate.attachments?.length, 1);
  assert.equal(parsedTemplate.attachments?.[0]?.driveUrl, 'https://drive.google.com/file/d/drive_file_abc123/view');
  console.log('✅ Email template schema supports Drive attachments with driveUrl.');

  // 2. Verify MimeBuilder Attachment RFC 2822 Construction
  console.log('\n--- 2. Testing MimeBuilder with Drive Attachments ---');
  const samplePdfBuffer = Buffer.from('%PDF-1.4 Mock PDF binary content for testing Drive attachment MIME building');
  const rawMime = MimeBuilder.buildRaw({
    from: 'Sender <sender@example.com>',
    to: 'Recipient <recipient@example.com>',
    subject: 'Proposal with Google Drive Attachment',
    text: 'Please find attached the requested proposal from Google Drive.',
    html: '<p>Please find attached the requested proposal from Google Drive.</p>',
    attachments: [
      {
        filename: 'proposal.pdf',
        contentType: 'application/pdf',
        data: samplePdfBuffer
      }
    ]
  });

  assert(rawMime.length > 0, 'Raw MIME Base64URL string must be non-empty');
  const decodedMime = Buffer.from(rawMime.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

  assert(decodedMime.includes('Content-Type: multipart/mixed'), 'MIME must be multipart/mixed');
  assert(decodedMime.includes('Content-Disposition: attachment; filename="proposal.pdf"'), 'Attachment header present');
  assert(decodedMime.includes('Content-Type: application/pdf; name="proposal.pdf"'), 'Content-Type header present');
  assert(decodedMime.includes(samplePdfBuffer.toString('base64').substring(0, 30)), 'PDF binary base64 content embedded');
  console.log('✅ MimeBuilder successfully constructed valid multipart RFC 2822 message with binary payload.');

  console.log('\n🎉 ALL DRIVE MEDIA PIPELINE TESTS PASSED!');
}

runVerification().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
