# Phase 13 — Email Templates, Personalization & Message Composition Forensic Audit

## Executive Summary

Phase 12 consolidated the deterministic campaign and outreach core of LeadForge OS. Phase 13 targets the complete **Email Composition Pipeline**: from template storage and sequence step referencing through variable resolution, personalization, content safety, tracking transformation, attachment resolution, delivery snapshotting, and provider MIME dispatch.

In strict adherence to the project charter:
- **Zero AI**: No LLMs, models, prompts, agents, AI drafting, or AI classification are used. All composition and personalization is deterministic.
- **Audit-First**: This document presents the forensic audit covering all 20 architectural areas, followed by 4 core deliverables (Template State Map, Message Composition Map, Variable Resolution Matrix, and Remediation Matrix) and 15 Canonical Invariants (**T-001** through **T-015**).

---

## 1. Template State Map

| Entity | Authoritative Owner | Mutable State | Immutable State | Identity | Version Identity | Relationships | Cache / Projection | Recovery Behavior |
|---|---|---|---|---|---|---|---|---|
| **Email Template** | `EmailTemplateModel` (MongoDB) | `name`, `subject`, `body`, `variables`, `attachments`, `version` | `createdAt`, `workspaceId`, `_id` | `_id` (ObjectId) | `version` (int, increments on save) | Referenced by Campaign Steps and Sequence Steps | SQLite `templates` table | Invalidate local cache on update; prior version remains in version history |
| **Template Version** | `TemplateVersionModel` (MongoDB) | None (100% frozen) | `templateId`, `version`, `subject`, `body`, `variables`, `attachments`, `snapshotAt` | Composite `templateId_version` | Monotonic integer >= 1 | Belongs to `EmailTemplate` | Retained locally or fetched on demand | Read-only historical identity; survives template deletion or edit |
| **Campaign Step** | `CampaignModel.steps` | `delayDays` | `id`, `type`, `templateId`, `templateVersion` | Step `id` (string) | Bound to `templateVersion` | Parent: Campaign; Child: Template | SQLite `campaigns.steps` (JSON) | Steps freeze `templateVersion` upon campaign activation |
| **Sequence Step** | `SequenceModel.steps` | `config.delaySeconds`, `config.condition` | `id`, `type`, `config.templateId`, `config.templateVersion`, `config.subject`, `config.body` | Step `id` (string) | Bound to `templateVersion` | Parent: Sequence; References Template | SQLite `sequences.steps` (JSON) | Sequence execution binds to `templateVersion` of step at run start |
| **Rendered Message** | `OutboundMessage` (In-Memory DTO) | None (Transient deterministic computation) | `subject`, `htmlBody`, `textBody`, `resolvedVariables`, `attachments`, `messageFingerprint` | SHA-256 `messageFingerprint` | Derived from inputs + template version | Produced by `composeOutboundMessage()` | N/A (Transient) | Recomputed identically on identical input; skipped on retry if snapshot exists |
| **Delivery Snapshot** | `EmailDeliveryModel` (MongoDB) | `status`, `leaseExpiresAt`, `openCount`, `clickCount`, `firstOpenedAt`, `lastOpenedAt`, `replyCount` | `recipientEmail`, `senderEmail`, `subject`, `htmlBody`, `textBody`, `attachments`, `templateId`, `templateVersion`, `variablesSnapshot`, `messageFingerprint`, `openTrackingToken`, `clickTrackingTokens`, `idempotencyKey` | `_id` (ObjectId) & `idempotencyKey` | Permanent snapshot at time of initial reservation | Belongs to Workspace, Campaign, Sequence, Contact, Account | SQLite `email_deliveries` table | On retry, reuse existing snapshot and tokens; never re-render from mutable data |

---

## 2. Message Composition Map

```
                                  ┌────────────────────────────────┐
                                  │ Source Trigger / Intent        │
                                  │ (Campaign / Sequence / Manual) │
                                  └───────────────┬────────────────┘
                                                  │
                                                  ▼
                                  ┌────────────────────────────────┐
                                  │ 1. Template & Version Binding  │
                                  │ - Resolve templateId & version │
                                  │ - Fallback to inline config    │
                                  └───────────────┬────────────────┘
                                                  │
                                                  ▼
                                  ┌────────────────────────────────┐
                                  │ 2. Personalization Resolution  │
                                  │ - Contact / Company / Sender   │
                                  │ - Build CanonicalVarContext    │
                                  │ - Snapshot all substituted vals│
                                  └───────────────┬────────────────┘
                                                  │
                                                  ▼
                                  ┌────────────────────────────────┐
                                  │ 3. Deterministic Rendering     │
                                  │ - Subject line variable sub    │
                                  │ - Body variable sub (HTML-safe)│
                                  │ - Text/HTML MIME parity sync   │
                                  └───────────────┬────────────────┘
                                                  │
                                                  ▼
                                  ┌────────────────────────────────┐
                                  │ 4. Pre-Send Validation Gate    │
                                  │ - CRLF check on subject/header │
                                  │ - Required variables validation│
                                  │ - Empty/malformed checks       │
                                  │ - HTML sanitization            │
                                  └───────────────┬────────────────┘
                                                  │
                                                  ▼
                                  ┌────────────────────────────────┐
                                  │ 5. Tracking Transformation     │
                                  │ - Idempotent link rewrite      │
                                  │ - Single open pixel injection  │
                                  │ - Reuse existing tokens        │
                                  └───────────────┬────────────────┘
                                                  │
                                                  ▼
                                  ┌────────────────────────────────┐
                                  │ 6. Attachment Resolution       │
                                  │ - Drive download / local read  │
                                  │ - Compute SHA-256 checksums    │
                                  │ - Snapshot metadata & hashes   │
                                  └───────────────┬────────────────┘
                                                  │
                                                  ▼
                                  ┌────────────────────────────────┐
                                  │ 7. Canonical Message Snapshot  │
                                  │ - Compute messageFingerprint   │
                                  │ - Atomic Delivery Reservation  │
                                  │ - Persist full snapshot in DB  │
                                  └───────────────┬────────────────┘
                                                  │
                                                  ▼
                                  ┌────────────────────────────────┐
                                  │ 8. Provider Dispatch           │
                                  │ - Gmail RFC 2822 / MIME Base64 │
                                  │ - Record providerMessageId     │
                                  │ - Finalize sent delivery       │
                                  └────────────────────────────────┘
```

### Flow Breakdown by Dispatch Route:

1. **Campaign Batch Sends** (`apps/desktop/src/main/workers/plugins/outreach.ts`):
   - Loads campaign, resolves target audience contacts.
   - Currently resolves live `tpl` via `sdk.outreach.listTemplates()` without version checking.
   - Renders variables via `renderCanonicalVariables()` and calls `formatEmailBody()`.
   - Dispatches via `sdk.outreach.sendEmail()`.
2. **Sequence Execution Step Sends** (`apps/desktop/src/main/workers/plugins/automation.ts`):
   - Background worker executes `SEND_EMAIL` step.
   - Currently resolves live `tpl` via `sdk.outreach.listTemplates()` without version checking.
   - Uses redundant `resolveVariables()` and calls `sdk.outreach.sendEmail()`.
3. **Manual / Direct Sends** (`apps/api/src/routes/email/index.ts` -> `EmailService.send`):
   - Receives raw `to`, `subject`, `text`, `html`, `attachments`.
   - Bypasses variable resolution (already resolved or typed by user).
   - Passes into `EmailService.send()` which executes typography wrapping, Drive resolution, tracking injection, and reservation.
4. **Template Preview** (`apps/desktop/src/main/ipc/outreach.ts` -> `outreach.service.ts`):
   - Calls `previewTemplate(templateId, contactId)`.
   - Resolves variables using mock contact/company data.
   - **Current Divergence**: Does not format typography, does not append signature, does not evaluate attachments, and renders in raw text `<pre>` in UI.
5. **Retry Path** (`EmailService.send` / `EmailDeliveryRepository.reserveDelivery`):
   - Existing delivery found by `idempotencyKey`.
   - **Current Flaw**: Overwrites `openTrackingToken` with new random token, rewrites links again, appends duplicate tracking pixels, and re-resolves Drive attachments instead of reusing existing snapshot.

---

## 3. Variable Resolution Matrix

| Variable Token | Source Entity | Data Type | Req / Opt | Default / Fallback | Normalization | Escaping (HTML Context) | Preview Behavior | Send Behavior | Missing / Failure Policy |
|---|---|---|---|---|---|---|---|---|---|
| `{{contact.firstName}}` | `Contact.firstName` | string | Optional | `""` | `trim()` | HTML Entity Escaped | Mock: `"John"` | Resolved from contact record | Replaced with empty string |
| `{{contact.lastName}}` | `Contact.lastName` | string | Optional | `""` | `trim()` | HTML Entity Escaped | Mock: `"Doe"` | Resolved from contact record | Replaced with empty string |
| `{{contact.name}}` | `Contact` | string | Optional | `""` | `"${first} ${last}".trim()` | HTML Entity Escaped | Mock: `"John Doe"` | Resolved or falls back to email | Replaced with empty string |
| `{{contact.email}}` | `Contact.email` | string | **Required** | `""` | `toLowerCase().trim()` | HTML Entity Escaped | Mock: `"john@example.com"` | Resolved from contact record | Send rejected (invalid recipient) |
| `{{contact.title}}` | `Contact.title` | string | Optional | `""` | `trim()` | HTML Entity Escaped | Mock: `"VP of Engineering"` | Resolved from contact record | Replaced with empty string |
| `{{contact.phone}}` | `Contact.phone` | string | Optional | `""` | `trim()` | HTML Entity Escaped | Mock: `"+15551234567"` | Resolved from contact record | Replaced with empty string |
| `{{company.name}}` | `Company.name` | string | Optional | `""` | `trim()` | HTML Entity Escaped | Mock: `"Acme Corp"` | Resolved from associated company | Replaced with empty string |
| `{{company.domain}}` | `Company.domain` | string | Optional | `""` | `toLowerCase().trim()` | HTML Entity Escaped | Mock: `"acme.com"` | Resolved from associated company | Replaced with empty string |
| `{{company.industry}}` | `Company.industry` | string | Optional | `""` | `trim()` | HTML Entity Escaped | Mock: `"Software"` | Resolved from associated company | Replaced with empty string |
| `{{company.location}}` | `Company.location` | string | Optional | `""` | `trim()` | HTML Entity Escaped | Mock: `"San Francisco, CA"` | Resolved from associated company | Replaced with empty string |
| `{{sender.name}}` | `EmailAccount.name` | string | Optional | `"LeadForge"` | `trim()` | HTML Entity Escaped | Mock: `"Sales Director"` | Resolved from sender mailbox | Falls back to `"LeadForge"` |
| `{{sender.email}}` | `EmailAccount.email` | string | **Required** | `""` | `toLowerCase().trim()` | HTML Entity Escaped | Mock: `"sales@workspace.com"`| Resolved from sender mailbox | Send rejected (no sender) |
| `{{workspace.name}}` | `Workspace.name` | string | Optional | `"Workspace"` | `trim()` | HTML Entity Escaped | Mock: `"Workspace CRM"` | Resolved from workspace | Falls back to `"Workspace"` |
| `{{today}}` | System Date | date | System | ISO Date `YYYY-MM-DD` | UTC / Workspace Timezone | Plain string | Current date | Current date at render time | Never fails |
| `{{now}}` | System Time | datetime | System | ISO Timestamp | ISO 8601 | Plain string | Current timestamp | Current timestamp at render | Never fails |
| `{{variables.<key>}}` | Custom Workflow Vars | any | Optional | `""` | Stringified primitive | HTML Entity Escaped | Empty string | Resolved from context | Replaced with empty string |
| `{{firstName}}` (Legacy) | `Contact.firstName` | string | Optional | `""` | Same as `contact.firstName` | HTML Entity Escaped | Mock: `"John"` | Maps to `contact.firstName` | Replaced with empty string |
| `{{company}}` (Legacy) | `Company.name` | string | Optional | `""` | Same as `company.name` | HTML Entity Escaped | Mock: `"Acme Corp"` | Maps to `company.name` | Replaced with empty string |

---

## 4. Remediation Matrix

| Finding ID | Severity | Area | Affected Files | Root Cause | Risk | Canonical Behavior | Remediation | Tests |
|---|---|---|---|---|---|---|---|---|
| **R-13-01** | **CRITICAL** | Area 7: Tracking & Retry | `apps/api/src/services/email/email.service.ts`, `packages/schema/src/utils/tracking.ts` | `EmailService.send` regenerates open and click tracking tokens on every send attempt without checking if the delivery record already has tokens. `rewriteLinksForClickTracking` does not check if an `href` is already rewritten, causing double-wrapping. | Retrying a delivery creates a mutated message payload, breaks existing tracking URLs, and injects duplicate tracking pixels. | Retries of the same logical delivery must reuse existing tracking tokens and preserve identical message HTML. | In `EmailService.send`, check `deliveryRecord.openTrackingToken` and `clickTrackingTokens`; reuse them if present. Guard `rewriteLinksForClickTracking` against `/t/click/` URLs. | `retry-composition.test.ts` asserting token reuse and idempotent HTML. |
| **R-13-02** | **CRITICAL** | Area 4 & Area 19: HTML Injection | `packages/sdk/src/utils/variable-resolver.ts` | `renderCanonicalVariables` replaces `{{token}}` with unescaped raw string values. If a contact name contains `<script>` or HTML tags, it is injected raw into HTML templates. | Stored XSS / HTML injection in recipient inboxes when templates are HTML-formatted. | Variable values interpolated into HTML contexts must be HTML-escaped. Template markup must remain intact. | Add context-aware escaping: `renderCanonicalVariables(template, ctx, { isHtml: true })` escapes substituted values while preserving template tags. | `variable-resolver.test.ts` testing malicious variable values (`<script>`, `<img>`). |
| **R-13-03** | **HIGH** | Area 1 & Area 2: Template Versioning | `packages/schema/src/entities/outreach.ts`, `apps/api/src/db/models/email-template.model.ts`, `apps/desktop/src/main/workers/plugins/automation.ts` | Email templates have no version field and sequence steps reference mutable live templates via `templateId`. | Editing an email template silently alters what future steps of already-scheduled campaigns send. Deleting a template crashes active workflows. | Templates must be versioned (`version: number`). Steps freeze a `templateVersion`. Deliveries record `templateId` and `templateVersion`. | Add `version: number` to `EmailTemplateModel` and `emailTemplateSchema`. Store `templateVersion` on `EmailDeliveryModel`. Implement versioned lookup. | `template-versioning.test.ts` verifying frozen execution behavior after edits. |
| **R-13-04** | **HIGH** | Area 6: Subject CRLF Injection | `apps/api/src/services/email/email.service.ts`, `packages/sdk/src/utils/variable-resolver.ts` | Subject line interpolation does not strip `\r` and `\n` characters before dispatch or logging. | Header injection in email transports or corrupted log lines if subject contains CRLF. | Subject lines must be strictly single-line: `\r` and `\n` stripped, whitespace collapsed, max 998 chars. | Add `sanitizeSubject()` validator in SDK and call it during message composition and `EmailService.send`. | `subject-composition.test.ts` asserting CRLF rejection/stripping. |
| **R-13-05** | **HIGH** | Area 9 & Area 10: Message Fingerprint & Snapshot | `packages/schema/src/entities/delivery.ts`, `apps/api/src/db/models/email-delivery.model.ts`, `apps/api/src/services/email/email.service.ts` | `EmailDeliveryModel.snapshot` only stores 6 top-level fields. No `variablesSnapshot`, no `templateVersion`, no `messageFingerprint`. | Impossible to reconstruct exact substituted values or prove message content integrity after contact updates. | Every outbound delivery must compute and record `messageFingerprint` (SHA-256) and `variablesSnapshot`. | Add `messageFingerprint`, `templateVersion`, and `variablesSnapshot` to `EmailDeliveryDocument` and `createEmailDeliveryDto`. | `delivery-snapshot.test.ts` verifying complete historical reconstruction. |
| **R-13-06** | **MEDIUM** | Area 7: Preview Sanitizer Token Mismatch | `packages/schema/src/utils/tracking.ts` | `sanitizeHtmlForPreview` regex searches for `/tracking/open/`, but `injectOpenTrackingPixel` produces `/t/open/`. | Tracking pixel is NOT stripped in preview, potentially leaking preview opens as real opens or displaying broken images. | `sanitizeHtmlForPreview` must match all LeadForge open pixel patterns (`/t/open/` and `/tracking/open/`). | Update regex in `tracking.ts` to `/<img\b[^>]*\/(?:t|tracking)\/open\/[^>]*>/gi`. | `tracking.test.ts` asserting `/t/open/` is stripped. |
| **R-13-07** | **MEDIUM** | Area 11: Preview vs Send Parity | `apps/api/src/services/outreach/outreach.service.ts`, `apps/desktop/src/renderer/screens/CampaignsScreen.tsx` | `previewTemplate` returns raw unformatted strings; UI displays them in a `<pre>` block without typography, signature, or `SafeEmailPreview`. | Users see completely different typography and formatting in preview compared to what recipients receive. | Preview must execute canonical composition (typography, paragraphs, signature preview) and render in `SafeEmailPreview`. | Expose `html` and `text` from `previewTemplate` with `plainTextToHtml` and signature preview; render via `SafeEmailPreview` in `CampaignsScreen`. | `preview-parity.test.ts` asserting identical output between preview and send. |
| **R-13-08** | **MEDIUM** | Area 5: Plain-Text Generation Parity | `apps/api/src/services/email/email.service.ts` | When an HTML-only email is sent without `text`, `google-oauth.ts` sends an empty `text/plain` MIME part. | Plain-text email clients and spam filter analyzers receive empty text parts, increasing spam scores. | Outbound messages must always contain a faithful plain-text representation generated from the HTML. | Add `htmlToPlainText()` converter that extracts clean text from HTML bodies when `text` is missing. | `plain-text-parity.test.ts` verifying HTML-to-text conversion. |
| **R-13-09** | **LOW** | Area 3: Duplicate Resolver in Worker | `apps/desktop/src/main/workers/plugins/automation.ts` | Lines 127-198 of `automation.ts` contain an obsolete duplicate implementation of `resolveTokenPath`. | Code duplication and confusion. | SDK `renderCanonicalVariables` is the sole canonical resolver. | Remove dead code in `automation.ts` and delegate cleanly to SDK. | `variable-resolver.test.ts`. |

---

## 5. Detailed Analysis of the 20 Forensic Areas

### Area 1: Template Identity & Versioning
- **Current Reality**: Templates are stored in MongoDB `EmailTemplateModel` and SQLite `templates`. Only mutable fields exist (`name`, `subject`, `body`, `variables`, `attachments`).
- **Gaps**: No `version` number is tracked. Editing a template mutates it in place.
- **Canonical Model**: 
  - Every template has `version: number` (initial = 1).
  - Every edit increments `version` and saves a snapshot into `TemplateVersionModel`.
  - Campaign sequence steps record `templateId` and `templateVersion`.

### Area 2: Template Snapshots
- **Current Reality**: Workers fetch `tpl` dynamically from `sdk.outreach.listTemplates()`.
- **Gaps**: A user editing a template mid-campaign changes the email content for leads executing future steps.
- **Canonical Model**:
  - When an execution starts or step is enrolled, it binds to `templateVersion`.
  - If `templateVersion` is specified, worker loads the frozen snapshot of that version.

### Area 3: Variable Resolution
- **Current Reality**: `renderCanonicalVariables` handles namespaced variables. Unresolved variables are replaced with `""`.
- **Gaps**: No distinction between optional and required variables. Malformed tokens (`{{unclosed`) are left as raw strings.
- **Canonical Model**:
  - Distinguish resolved, missing-but-optional, and missing-required.
  - Reject messages with unresolved required variables before send.

### Area 4: HTML Safety & Escaping
- **Current Reality**: `plainTextToHtml` escapes entities, but `renderCanonicalVariables` interpolates raw strings directly.
- **Gaps**: If template is HTML, injecting `<script>` in contact variables passes straight into outbound HTML.
- **Canonical Model**:
  - When interpolating into an HTML template, all variable values must be HTML entity-escaped.

### Area 5: Plain-Text Generation
- **Current Reality**: If `text` is omitted, the MIME text/plain part is empty string.
- **Gaps**: High spam score and broken plain-text client experience.
- **Canonical Model**:
  - Deterministic bidirectional conversion: `plainTextToHtml(text)` and `htmlToPlainText(html)`. Both parts are always populated.

### Area 6: Subject Composition
- **Current Reality**: Subject is Base64-encoded in Gmail API, but contains no CRLF sanitization or length limits.
- **Gaps**: Potential newline injection in transport logging and malformed empty subjects.
- **Canonical Model**:
  - `sanitizeSubject(subject)`: strips `[\r\n]`, collapses whitespace, validates non-empty, truncates at 998 characters.

### Area 7: Link & Tracking Transformation
- **Current Reality**: Tokens generated freshly on every send; `rewriteLinksForClickTracking` re-wraps existing tracking links; regex mismatch in `sanitizeHtmlForPreview`.
- **Gaps**: Double-wrapping on retry; tracking pixel leak in preview.
- **Canonical Model**:
  - Idempotent tracking: check existing `openTrackingToken` on delivery; skip links matching `/t/click/`; fix preview regex.

### Area 8: Attachment Resolution
- **Current Reality**: Files downloaded at send time from Google Drive. Metadata saved without content hash.
- **Gaps**: Modifying a Drive file alters future retries or delivery evidence.
- **Canonical Model**:
  - Compute `sha256` checksum of attachment bytes and persist on delivery snapshot.

### Area 9: Message Fingerprint / Content Identity
- **Current Reality**: No message fingerprint exists.
- **Canonical Model**:
  - `messageFingerprint = sha256(canonicalPayload)`: computed over `sender`, `recipient`, `subject`, `textBody`, `htmlBody`, `attachmentChecksums`, `templateVersion`.

### Area 10: Delivery Snapshot Integrity
- **Current Reality**: `snapshot` object is minimal (`accountId`, `senderEmail`, `recipientEmail`, `subject`, `hasHtml`, `attachmentCount`).
- **Canonical Model**:
  - Full immutable snapshot: includes `templateId`, `templateVersion`, `variablesSnapshot`, `messageFingerprint`, `attachmentChecksums`.

### Area 11: Preview vs Send Parity
- **Current Reality**: Preview returns raw unformatted strings in a text `<pre>` element.
- **Canonical Model**:
  - Preview runs the exact same formatting pipeline (`plainTextToHtml`, typography, signature) and renders in `SafeEmailPreview`.

### Area 12: Retry Semantics
- **Current Reality**: Re-runs tracking and Drive downloads; mutates delivery document with new tokens.
- **Canonical Model**:
  - If a delivery already exists in `SENDING` or `FAILED`, reuse existing snapshot, tracking tokens, and rendered content.

### Area 13: Personalization Data Consistency
- **Current Reality**: Variables read at step run time, but substituted values are never saved.
- **Canonical Model**:
  - `variablesSnapshot` persists all resolved key-value pairs at send time.

### Area 14: Template Validation
- **Current Reality**: No pre-send validation boundary.
- **Canonical Model**:
  - Canonical `validateComposition()` checks recipient, sender, subject, body, variables, and attachments before delivery reservation.

### Area 15: Manual Message Composition
- **Current Reality**: `POST /email/send` accepts direct HTML/text without CRLF subject sanitization.
- **Canonical Model**:
  - Manual sends pass through `composeOutboundMessage()` with identical safety and validation gates.

### Area 16: Email Logs & Conversation History
- **Current Reality**: Email logs display `htmlBody` and `textBody`, but lack variable snapshot details.
- **Canonical Model**:
  - Email logs read directly from immutable delivery ledger and display complete variable snapshot.

### Area 17: Analytics Interaction
- **Current Reality**: Analytics aggregate from `email_deliveries` and `sequence_executions`.
- **Verification**: Zero joins to mutable `templates` table; analytics remain 100% immutable.

### Area 18: Cache / SQLite Projections
- **Current Reality**: SQLite `templates` and `email_deliveries` tables mirror MongoDB.
- **Canonical Model**:
  - Add `version` column to SQLite `templates` and `templateVersion`, `messageFingerprint` to `email_deliveries`.

### Area 19: Security Boundary
- **Current Reality**: Variable injection in HTML; CRLF in subject; preview regex mismatch.
- **Canonical Model**:
  - Strict HTML escaping of variables, CRLF stripping, and safe link rewriting.

### Area 20: Deterministic Composition Contract
- **Canonical Contract**:
  ```typescript
  export interface ComposeMessageInput {
    template: { subject: string; body: string; id?: string; version?: number };
    context: CanonicalVariableContext;
    sender: { email: string; name?: string; signatureHtml?: string };
    recipientEmail: string;
    attachments?: AttachmentInput[];
    isHtml?: boolean;
    useSignature?: boolean;
    existingTracking?: { openToken: string; clickTokens: Array<{ token: string; targetUrl: string }> };
    trackingBaseUrl?: string;
  }

  export interface ComposeMessageResult {
    subject: string;
    htmlBody: string;
    textBody: string;
    variablesSnapshot: Record<string, string>;
    openTrackingToken: string;
    clickTrackingTokens: Array<{ token: string; targetUrl: string }>;
    attachments: ProcessedAttachment[];
    messageFingerprint: string;
  }
  ```

---

## 6. Canonical Outreach Invariants (T-001 through T-015)

- **T-001**: A sent delivery never depends on the current mutable template.
- **T-002**: Template versions are stable historical identities.
- **T-003**: The same logical input produces deterministic composition output.
- **T-004**: Required variables cannot silently remain unresolved.
- **T-005**: Variable values cannot inject executable HTML or email headers.
- **T-006**: Subject composition cannot inject CR/LF headers.
- **T-007**: Preview and send use equivalent composition semantics.
- **T-008**: Tracking transformation is deterministic and cannot create arbitrary redirects.
- **T-009**: Historical attachment metadata and checksums cannot change because the source file changes later.
- **T-010**: A retry of the same logical delivery does not silently regenerate different message content.
- **T-011**: Historical delivery snapshots remain immutable.
- **T-012**: HTML and text representations correspond to the same logical message.
- **T-013**: Template edits cannot rewrite historical delivery evidence.
- **T-014**: Manual composition cannot bypass message safety validation.
- **T-015**: Cache/projection state cannot override authoritative template/message state.
