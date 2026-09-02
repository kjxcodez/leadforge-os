# LeadForge OS — Attachment & Google Integration Architecture Plan

## 1. Executive Summary & Core Decisions

In the legacy architecture:
1. Email attachments were either stored as Base64 strings embedded in SQLite JSON columns or pointed directly to local filesystem paths on the user's desktop (e.g. `C:\Users\...\pitch.pdf`).
2. Deleting or rebuilding the local SQLite database broke all attachment references.
3. Gmail OAuth sending and OAuth token management were tangled together in a monolithic `google-oauth.ts` file without clean abstractions.

### Target Architecture Mandates:
- **Google Drive as Permanent Binary Store:** Attachment binaries reside permanently in Google Drive. Neither SQLite nor MongoDB ever stores permanent binary blobs.
- **MongoDB Metadata Store:** MongoDB documents (`emailtemplates`) store light attachment descriptors (`fileId`, `filename`, `mimeType`, `size`, `driveUrl`).
- **Decoupled Google Services:** Clear separation between Google Authentication, Gmail API, and Google Drive API.
- **Cache-Destruction Invariance:** Deleting SQLite cache has **zero impact** on template attachments.

---

## 2. Google Integration Architecture

```text
                           ┌────────────────────────────┐
                           │     GoogleAuthService      │
                           │  (Token Refresh & Storage) │
                           └──────────────┬─────────────┘
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  │                                               │
       ┌──────────▼───────────┐                       ┌───────────▼──────────┐
       │ GoogleDriveProvider  │                       │    GmailProvider     │
       │ (Upload / Download)  │                       │   (Send RFC 2822)    │
       └──────────┬───────────┘                       └───────────┬──────────┘
                  │                                               │
                  ▼                                               ▼
         Google Drive API                                     Gmail API
         (Binary Storage)                                  (Email Delivery)
```

### Module Responsibilities:
1. **`GoogleAuthService` (`apps/api/src/services/google/auth.service.ts`):**
   - Manages client credentials (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
   - Exchanges authorization codes for access and refresh tokens.
   - Refreshes expired access tokens automatically using encrypted tokens stored in MongoDB `emailaccounts`.
2. **`GoogleDriveProvider` (`apps/api/src/services/google/drive.provider.ts`):**
   - Exclusively handles file uploads, multipart streaming, permission management, and file downloads by `fileId`.
   - Completely agnostic of email protocols or MIME composition.
3. **`GmailProvider` (`apps/api/src/services/email/providers/gmail-provider.ts`):**
   - Exclusively handles sending raw MIME messages via `messages.send` and fetching user email profile/signatures.

---

## 3. Drive Account Scope: Option A vs Option B Evaluation

The forensic audit documented that the account scope for Google Drive was unresolved. The two architectural alternatives are evaluated below:

```text
┌──────────────────────────────────────┬──────────────────────────────────────────────────────────┐
│ Option A: User-Delegated OAuth Scope │ Option B: Platform Service Account (LeadForge Drive)     │
├──────────────────────────────────────┼──────────────────────────────────────────────────────────┤
│ **Concept:**                         │ **Concept:**                                             │
│ Attachments are stored in the user's │ Attachments are stored in a dedicated Google Cloud       │
│ personal Google Drive account using  │ Service Account owned by LeadForge OS, partitioned by    │
│ the `drive.file` OAuth scope.        │ workspace folder.                                        │
│                                      │                                                          │
│ **Pros:**                            │ **Pros:**                                                │
│ • User owns their own data.          │ • Works identically for ALL users (including those using │
│ • Storage costs billed to user Drive.│   custom SMTP/IMAP like SendGrid or Amazon SES).         │
│ • Strict tenant data isolation.      │ • User doesn't need a Google account to store files.     │
│                                      │ • Simpler enterprise attachment administration.          │
│ **Cons:**                            │ **Cons:**                                                │
│ • Users connecting custom SMTP/IMAP  │ • Storage costs billed to LeadForge Google Cloud project.│
│   cannot use Drive attachments       │ • API holds master credentials for shared storage.       │
│   without a separate Google login.   │                                                          │
└──────────────────────────────────────┴──────────────────────────────────────────────────────────┘
```

### Recommended Architecture & Decision Gate:
> [!IMPORTANT]
> **RECOMMENDED: Hybrid Foundation with Platform Storage Default (Option B Priority)**
> 1. **Why:** LeadForge OS supports arbitrary SMTP providers (SendGrid, Postmark, AWS SES, self-hosted IMAP). If Drive were strictly bound to user Gmail OAuth (Option A), non-Gmail users would be unable to send email attachments.
> 2. **Implementation Impact:** `GoogleDriveProvider` is implemented to accept either a Service Account JWT client (default) OR an individual user OAuth token when available.
> 3. **Action Required:** Product owner confirmation during Phase 9 configuration gate to supply `GOOGLE_SERVICE_ACCOUNT_KEY` in production environment.

---

## 4. End-to-End Attachment Lifecycle

```text
                       PHASE 1: ATTACHMENT UPLOAD & STORAGE
                       ────────────────────────────────────

  User Selects File in Desktop UI (e.g. "case-study.pdf")
            │
            ▼ (Multipart Form POST)
  Electron Main -> SdkClient -> API (`POST /api/v1/templates/attachments`)
            │
            ▼
  GoogleDriveProvider streams file to Google Drive:
  - File uploaded to folder: `LeadForge_Workspace_<workspaceId>`
  - Sets file permission: `anyoneWithLink` (view) or authenticated restricted
            │
            ▼
  Google Drive returns metadata:
  {
    fileId: "1AbC-dEfGhIjK_LmNoPqRsTuVwXyZ",
    name: "case-study.pdf",
    mimeType: "application/pdf",
    size: 2048576,
    webViewLink: "https://drive.google.com/file/d/1AbC.../view"
  }
            │
            ▼
  MongoDB EmailTemplate Document Updated:
  attachments: [
    {
      id: "att_9b1deb4d-3b7d-4bad",
      provider: "google-drive",
      fileId: "1AbC-dEfGhIjK_LmNoPqRsTuVwXyZ",
      filename: "case-study.pdf",
      mimeType: "application/pdf",
      size: 2048576,
      driveUrl: "https://drive.google.com/file/d/1AbC.../view"
    }
  ]
            │
            ▼ (Confirmed response)
  Desktop UI updates cached template locally (cache contains fileId + driveUrl)


                        PHASE 2: SEND-TIME MIME DISPATCH
                        ────────────────────────────────

  Outreach Worker / Campaign Runner Triggers Send (`POST /api/v1/email/send`)
            │
            ▼
  API fetches EmailTemplate and EmailAccount from MongoDB
            │
            ▼
  For each attachment descriptor in template.attachments:
  1. GoogleDriveProvider.downloadStream(att.fileId)
  2. Binary buffer received into temporary memory stream
            │
            ▼
  MimeBuilder constructs RFC 2822 Email Body:
  - Text / HTML content with variable substitution
  - Multi-part / Mixed boundary
  - Attachment MIME block: Content-Disposition: attachment; filename="case-study.pdf"
            │
            ▼
  Email Account Provider Invoked:
  - If Gmail OAuth -> GmailProvider.sendMessage(rawMime)
  - If SMTP        -> SmtpProvider.sendMail(rawMime)
            │
            ▼
  Record Delivery in MongoDB `emaildeliveries` ledger with `status: 'SENT'`
```

---

## 5. Email Sending Safety & Delivery Ledger

To prevent accidental double-sends, spam filtering, and provider quota throttling:

```text
┌─────────────────────────────────────┬────────────────────────────────────────────────────────────┐
│ Safety Mechanism                    │ Enforcement Specification                                  │
├─────────────────────────────────────┼────────────────────────────────────────────────────────────┤
│ **Idempotency Key Verification**    │ Every send request generates a deterministic key:          │
│                                     │ `idempotencyKey = sha256(`${ws}:${execId}:${step}:${contact}`)`│
│                                     │ Checked against Mongo `emaildeliveries` before sending.   │
├─────────────────────────────────────┼────────────────────────────────────────────────────────────┤
│ **Pre-Send Ledger State**           │ Before contacting Gmail/SMTP, a document is created with   │
│                                     │ `status: 'SENDING'`. If duplicate arrives, it is blocked.  │
├─────────────────────────────────────┼────────────────────────────────────────────────────────────┤
│ **Provider Failure Retries**        │ Network timeouts are marked `RETRYING` (max 3 retries with │
│                                     │ exponential backoff: 30s, 2m, 10m).                        │
├─────────────────────────────────────┼────────────────────────────────────────────────────────────┤
│ **Hard Bounce / Auth Rejection**    │ `401 Unauthorized` or invalid recipient marks status       │
│                                     │ `FAILED` immediately (no blind retries).                   │
├─────────────────────────────────────┼────────────────────────────────────────────────────────────┤
│ **Drive Download Failure**          │ If Google Drive download fails, send is NOT attempted;    │
│                                     │ delivery marked `FAILED` with "Attachment fetch error".    │
└─────────────────────────────────────┴────────────────────────────────────────────────────────────┘
```

---

## 6. Implementation & Verification Status (Phase 9 Complete)

Phase 9 implementation has fully delivered the target Google integration architecture:
- **Gmail Exclusivity:** Gmail API is the sole outbound email transport. All SMTP infrastructure and dependencies (`nodemailer`) are removed (`active outbound SMTP path = 0`).
- **Decoupled Connection Model:** `GoogleConnection` abstraction handles OAuth authentication, independent credentials, and granular capabilities (`gmailStatus`, `driveStatus`).
- **Multi-Sender Isolation:** Workspace supports multiple concurrent Gmail senders with independent token refresh and revocation lifecycles.
- **Drive Attachment Store:** Binaries are stored in Google Drive (`drive.file`); MongoDB stores canonical `Attachment` metadata records.
- **Verification Suite:** Fully verified by `scripts/verify-phase9.ts` passing all 27 checks (T9.1 – T9.27). Full documentation recorded in `docs/architecture-migration/47-phase9-google-integration-report.md`.

