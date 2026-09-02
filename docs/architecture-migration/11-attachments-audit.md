# LeadForge OS — Attachments, Files & Email Forensic Audit

## 1. Current File & Email Workflow

The template → attachment → email-sending workflow was audited across desktop and API components:
* SQLite `templates` table contains column `attachments TEXT NOT NULL DEFAULT '[]'` ([`runner.ts:840`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/runner.ts#L840)).
* Mongoose `EmailTemplateModel` contains `attachments: { type: [Schema.Types.Mixed], default: [] }` ([`email-template.model.ts:20`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/db/models/email-template.model.ts#L20)).
* Email sending providers are implemented in [`apps/api/src/services/email/providers/`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/services/email/providers):
  * **Gmail OAuth Provider:** [`gmail-provider.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/services/email/providers/gmail-provider.ts) & [`google-oauth.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/services/email/providers/google-oauth.ts).
  * **SMTP Provider:** [`smtp-provider.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/services/email/providers/smtp-provider.ts).

---

## 2. Current Attachment Storage & Transmission Model

Currently, attachments attached to email templates or outbound emails pass through two mechanisms:
1. **Base64 Inline String (`contentBase64`)**: Small files are converted to Base64 strings embedded in the template JSON payload.
2. **Local File Path (`path`)**: Desktop UI attachments reference local disk file paths (e.g. `C:\Users\...\document.pdf`).

### Risk in Local-Path Attachments
When attachments reference local disk paths (`path`), clearing or rebuilding the local SQLite cache or switching devices causes broken file references!

---

## 3. Target Architecture Proposal: Google Drive + MongoDB Metadata

To ensure attachments are durable, accessible across devices, and independent of SQLite cache state, the target architecture requires:

```text
User Uploads Attachment
           ↓
API Upload Endpoint (`POST /templates/attachments`)
           ↓
Upload binary stream to Google Drive API
           ↓
Google Drive returns `fileId`, `webContentLink`, `mimeType`, `size`
           ↓
MongoDB `EmailTemplate` document saves metadata:
{
  fileId: "drive_file_12345",
  filename: "proposal.pdf",
  mimeType: "application/pdf",
  size: 1048576,
  driveUrl: "https://drive.google.com/..."
}
```

### Send-Time Execution Flow

```text
Outreach Worker / Campaign Engine
           ↓
Trigger Send via API (`POST /email/send`)
           ↓
Fetch Template from MongoDB (containing attachment metadata with `fileId`)
           ↓
Download binary stream from Google Drive API using `fileId`
           ↓
Construct RFC 2822 / MIME message body with attachments
           ↓
Transmit via Gmail API (`sendMessage`) or SMTP
```

---

## 4. Drive Integration Requirements & Constraints
* **Drive API Scopes Required:** `https://www.googleapis.com/auth/drive.file` (access only to files created by the application).
* **Cache Invariance:** Deleting or wiping local SQLite cache has **zero impact** on template attachments because the binary lives in Google Drive and metadata lives in MongoDB.
