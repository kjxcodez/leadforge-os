# Post-Release Beta Forensic Audit: Outreach Attachments, Message Formatting & Desktop API Runtime Configuration

**Repository**: LeadForge OS  
**Current Version**: `v1.1.1-beta.1`  
**Audit Date**: 2026-08-25  
**Scope**: Forensic root-cause analysis of three release-blocking beta issues against the current codebase without speculation.

---

## EXECUTIVE SUMMARY

A forensic audit of the LeadForge OS monorepo was conducted across `apps/desktop`, `apps/api`, `packages/schema`, and `packages/sdk`. All three reported issues have been traced to their precise code locations and architectural boundaries:

1. **Issue 1 (Campaign/Template Attachments)**: Attachments currently only function end-to-end for *Send Test* (`SendTestModal.tsx` → `email-accounts:send-test` IPC → `sendTestEmail` → API). The `ProgressiveSequenceEditor` and Campaign Editor completely lack attachment input/state, the `emailTemplateSchema`/`templates` table have no attachment fields, and `dispatchOutreach` in `outreach.ts` ignores attachments entirely. `attachments:save` IPC already exists for local managed storage in `userData/attachments/${workspaceId}/`, but was never wired to sequences/templates.
2. **Issue 2 (Template Formatting & Line Breaks)**: Template and sequence step bodies are stored as plain text with `\n` characters. During campaign execution in `automation.ts` (`handleSendEmailStep`), the plain-text body is sent directly as `html: renderedBody` without HTML paragraph/break conversion. When rendered by Gmail/mail clients as `text/html`, standard HTML collapses all `\n` into single spaces, stripping all paragraph breaks and blank lines. Furthermore, `outreach.ts` only passes `text`, which omits signature resolution and lacks HTML alternative generation.
3. **Issue 3 (Desktop API URL / `process.env`)**: In packaged Electron builds, `.env` is not packaged. The worker child processes are spawned by `scheduler.ts` via `fork(workerHostPath, [], { env: { WORKSPACES_DB_DIR, PLAYWRIGHT_BROWSERS_PATH, NODE_ENV } })` which intentionally does not forward `process.env.API_URL`. In v1.0.0-beta.6, worker plugins fell back to `http://localhost:3001/api/v1` and failed with `ECONNREFUSED`. In v1.1.1-beta.1, hardcoded fallbacks were patched in individual files rather than establishing a single authoritative configuration contract.

---

## ISSUE 1 FORENSIC AUDIT: CAMPAIGN / TEMPLATE ATTACHMENTS

### 1.1 Complete Attachment Lifecycle Trace

```
[UI Layer]
SendTestModal.tsx (FileReader -> Base64)  ───► email-accounts:send-test IPC ──► API /email/accounts/:id/test (WORKS)
ProgressiveSequenceEditor (NO UI / NO ATTACHMENTS) ───► SequenceStep.config (NO ATTACHMENTS) ───────┐
CampaignsScreen Template Dialog (NO UI / NO ATTACHMENTS) ───► templates table (NO ATTACHMENT COLUMN) ─┤ (LOST)
                                                                                                     │
[Persistence Layer]                                                                                  │
SQLite `templates` table: id, workspaceId, name, subject, body, variables (NO ATTACHMENTS) ◄─────────┤
SQLite `sequences` table: `steps` JSON (can store attachments in step.config, but UI omitted) ◄──────┤
SQLite `jobs` table: `payload` contains { sequenceId, entityId, executionId, workspaceId }           │
                                                                                                     │
[Worker Execution Layer]                                                                             │
apps/desktop/src/main/workers/plugins/automation.ts:                                                 │
  - handleSendEmailStep reads step.config.attachments (if present)                                   │
  - Resolves storagePath / path via fs.readFileSync -> Base64                                        │
  - Passes attachments to sdk.outreach.sendEmail                                                     │
apps/desktop/src/main/workers/plugins/outreach.ts:                                                   │
  - dispatchOutreach NEVER passes attachments to sdk.outreach.sendEmail (IGNORED) ◄─────────────────┘

[API & MIME Layer]
apps/api/src/routes/email/index.ts (POST /send): accepts attachments: [{ filename, contentBase64, path, contentType, size }]
apps/api/src/services/email/email.service.ts: validates 25 MB max limit across attachments
apps/api/src/services/email/providers/google-oauth.ts:
  - buildRawMime builds multipart/mixed with RFC 2045 compliant base64 chunks and Content-Disposition: attachment; filename="..."
  - Dispatches to Google Gmail API POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send
```

### 1.2 Answers to Specific Forensic Audit Questions

1. **Where are attachments currently supported?**
   - In `SendTestModal.tsx` (`readAsBase64`, 25MB validation, file-type blacklist).
   - In `apps/desktop/src/main/services/email-account-service.ts` (`sendTestEmail`).
   - In `apps/desktop/src/main/ipc/outreach.ts` (`attachments:save` IPC handler lines 106–140).
   - In `apps/api/src/routes/email/index.ts` (`POST /send` and `POST /accounts/:id/test`).
   - In `apps/api/src/services/email/email.service.ts` (size validation, provider forwarding).
   - In `apps/api/src/services/email/providers/google-oauth.ts` (`buildRawMime` creates `multipart/mixed`).
   - Partially in `apps/desktop/src/main/workers/plugins/automation.ts` (`handleSendEmailStep` lines 1878–1915).

2. **Is support only implemented for Send Test?**
   - **Yes.** Only Send Test has the UI picker, state management, file reading, and invocation wired end-to-end. Campaigns and template screens have no UI, no state, and no persistence for attachments.

3. **Does the template model have an attachment representation?**
   - **No.**
   - `packages/schema/src/entities/outreach.ts` (`emailTemplateSchema`): only `id, workspaceId, name, subject, body, variables, createdAt, updatedAt`.
   - `packages/schema/src/dto/outreach.ts` (`createEmailTemplateDtoSchema`): only `name, subject, body, variables`.
   - SQLite `templates` table (`runner.ts` lines 209–221): no attachments column.

4. **Does the sequence model have an attachment representation?**
   - **No formal schema field.**
   - `packages/schema/src/entities/campaign.ts` (`campaignStepSchema`): only `id, type, delayDays, templateId`.
   - `packages/schema/src/dto/campaign.ts` (`createCampaignStepDtoSchema`): only `type, delayDays, templateId`.
   - In SQLite `sequences.steps` column, steps are stored as a JSON string. `automation.ts` looks for `step.config.attachments`, but the TypeScript interfaces and UI components omit it.

5. **Does campaign creation preserve attachments?**
   - `CampaignsScreen.tsx` (`handleCreateCampaign` lines 440–461) maps `sequenceSteps` to `formattedSteps` with `config: stepConfig`. If `attachments` were in `step.config`, they would be serialized to the sequence `steps` JSON in SQLite. However, because `ProgressiveSequenceEditor` provides no way to attach files, `step.config.attachments` is never populated.

6. **Does campaign enrollment preserve attachments?**
   - `campaigns:enroll` (`campaigns-ipc.ts` lines 13–125) inserts `sequence_executions` and enqueues `automation:workflow` jobs with `{ sequenceId, entityId, executionId, workspaceId }`. The sequence steps are read directly from the `sequences` table at execution time, preserving any config stored in `sequences.steps`.

7. **Does sequence execution preserve attachments?**
   - In `apps/desktop/src/main/workers/plugins/automation.ts` (`handleSendEmailStep`), it checks `step.config?.attachments`. If `storagePath` exists and file is readable, it reads the file and attaches it. However, if a `templateId` is used instead of inline config, the template lookup (`SELECT subject, body FROM templates`) does not load attachments.
   - In `apps/desktop/src/main/workers/plugins/outreach.ts` (`dispatchOutreach`), attachments are completely omitted.

8. **Does the worker receive attachments?**
   - The worker receives `sequenceId` in job payload and loads `sequences.steps` from SQLite.

9. **Does API email sending support them?**
   - **Yes.** `POST /email/send` accepts `attachments: Array<{ filename: string; contentBase64?: string; path?: string; contentType?: string; size?: number }>` and validates total size <= 25MB.

10. **Does Gmail MIME composition support them?**
    - **Yes.** `GoogleOAuthMailboxProvider.buildRawMime` correctly creates `multipart/mixed` containing `multipart/alternative` (text/plain + text/html) followed by base64-encoded attachment parts with `Content-Disposition: attachment; filename="${safeFilename}"`.

11. **At which exact boundary is attachment information currently lost?**
    - **Boundary A (UI)**: `ProgressiveSequenceEditor.tsx` and `CampaignsScreen.tsx` have no file picker or attachment management.
    - **Boundary B (Template Model & Persistence)**: `emailTemplateSchema`, `createEmailTemplateDtoSchema`, and SQLite `templates` table omit attachments.
    - **Boundary C (Template → Step Application)**: When a template is selected in `ProgressiveSequenceEditor`, attachments are not copied.
    - **Boundary D (Outreach Worker Plugin)**: `apps/desktop/src/main/workers/plugins/outreach.ts` does not pass `attachments` to `sdk.outreach.sendEmail`.

### 1.3 Recommended Attachment Architecture

- **Primary Ownership**: **Sequence Step** (`step.config.attachments`). Sequence steps are the atomic unit of campaign execution (`SEND_EMAIL`).
- **Template Association**: Templates should optionally define default attachments (`template.attachments`). When a template preset is selected in `ProgressiveSequenceEditor`, its attachments are copied into the sequence step config.
- **Storage Pattern**: Managed local storage via existing `attachments:save` IPC handler. When a user selects a file, it is copied into `app.getPath('userData')/attachments/${workspaceId}/${fileId}_${safeName}`. The step config stores the metadata:
  ```json
  {
    "id": "uuid",
    "filename": "proposal.pdf",
    "size": 1048576,
    "contentType": "application/pdf",
    "storagePath": "C:/Users/.../AppData/Roaming/LeadForge OS/attachments/ws_123/uuid_proposal.pdf"
  }
  ```
- **Execution Time**: The worker reads `att.storagePath` from disk, validates size and presence, encodes to Base64, and passes to API `sdk.outreach.sendEmail`. No transient original file paths are relied upon.

---

## ISSUE 2 FORENSIC AUDIT: TEMPLATE FORMATTING / LINE BREAKS

### 2.1 Complete Message Formatting Lifecycle Trace

```
[UI Editor]
CampaignsScreen / ProgressiveSequenceEditor <Textarea>
User types plain text with newlines (\n or \r\n) and blank lines (\n\n)
                                │
                                ▼
[Persistence Layer]
Stored in SQLite `templates.body` or `sequences.steps[i].config.body` as plain text with \n
                                │
                                ▼
[Preview Layer]
CampaignsScreen Live Preview: Renders with CSS `whitespace-pre-wrap` (lines displayed correctly in UI)
                                │
                                ▼
[Variable Interpolation]
packages/sdk/src/utils/variable-resolver.ts (`renderCanonicalVariables`):
Regex replacement /\{\{([^}]+)\}\}/g. Preserves all \n, \r\n, and whitespace exactly as-is.
                                │
                                ▼
[Worker Execution Layer]
apps/desktop/src/main/workers/plugins/automation.ts:
  renderedBody = resolveVariables(rawBody, renderCtx)
  Calls sdk.outreach.sendEmail({
    subject: renderedSubject,
    html: renderedBody  ◄─── CRITICAL DEFECT: Raw plain text with \n passed as HTML!
  })
apps/desktop/src/main/workers/plugins/outreach.ts:
  isHtml = renderedBody.trim().startsWith('<') && /<[a-z][\s\S]*>/i.test(renderedBody)
  Calls sdk.outreach.sendEmail({
    ...(isHtml ? { html: renderedBody } : { text: renderedBody })
  }) ◄─── If plain text, passes `text` with NO `html`, losing signature & HTML alternative!
                                │
                                ▼
[API & MIME Layer]
apps/api/src/services/email/email.service.ts:
  if (input.html && account.signature) -> appends signature to input.html
  (If input.text only, signature is NEVER added)
apps/api/src/services/email/providers/google-oauth.ts (`buildRawMime`):
  If input.html was provided (which is raw plain text from automation.ts):
    headers: Content-Type: multipart/alternative
    part 1: text/plain: input.text || '' (EMPTY STRING because automation.ts only passed `html`)
    part 2: text/html: raw plain text without <p> or <br/>
                                │
                                ▼
[Gmail Inbox / Recipient]
Email client renders text/html part. HTML collapses all \n and \n\n into single whitespace.
All paragraph breaks and blank lines DISAPPEAR.
```

### 2.2 Answers to Specific Forensic Audit Questions

1. **Is body stored as plain text?**
   - **Yes.** Stored as plain text with `\n` or `\r\n`.
2. **Is body stored as HTML?**
   - **No.**
3. **Is the UI using textarea, contentEditable, rich editor, or some other representation?**
   - Standard HTML `<Textarea>` component from `apps/desktop/src/renderer/components/ui/textarea.tsx`.
4. **Where are newline characters introduced?**
   - In `<Textarea>` when the user presses Enter.
5. **Where are they transformed?**
   - They are NOT transformed during storage or interpolation. They are corrupted at the Worker → API → MIME boundary because `automation.ts` passes plain text into the `html` field of the email payload without converting newlines to `<p>`/`<br/>`, and `google-oauth.ts` leaves `text/plain` empty when `html` is passed.
6. **Does canonical variable rendering preserve `\n`?**
   - **Yes.** `renderCanonicalVariables` in `packages/sdk/src/utils/variable-resolver.ts` strictly does regex substitution on `{{token}}` patterns and preserves all surrounding whitespace and newlines.
7. **Does API preview preserve `\n`?**
   - **Yes.** Returns plain text string with `\n`.
8. **Does worker rendering preserve `\n`?**
   - **Yes.** The string in memory retains `\n`.
9. **Does Gmail MIME builder convert plain text to HTML?**
   - **No.** `google-oauth.ts` blindly outputs `options.html` as the `text/html` part.
10. **Are line breaks being stripped because of HTML rendering?**
    - **Yes.** Because raw plain text is put inside `text/html`, receiving email clients parse it as HTML where `\n` is whitespace.
11. **Are blank lines preserved?**
    - **No.** In HTML, `\n\n` collapses to a single space.
12. **Are paragraphs preserved?**
    - **No.**
13. **Are existing HTML tags being escaped or stripped?**
    - When users type `<` or `>` in plain text, they are not escaped, causing potential HTML parser errors if sent as raw `html`.

### 2.3 Concrete Examples Trace

#### Example A:
```
Hello {{contact.firstName}},

I wanted to reach out.

Best,
Sender
```
- **What recipient currently receives**:
  `Hello Alice, I wanted to reach out. Best, Sender` (all collapsed into a single line).
- **What recipient should receive**:
  ```
  Hello Alice,

  I wanted to reach out.

  Best,
  Sender
  ```

#### Example B:
```
Hello,

This is paragraph one.

This is paragraph two.
```
- **What recipient currently receives**:
  `Hello, This is paragraph one. This is paragraph two.`

### 2.4 Canonical Formatting Solution

- **Canonical Stored Format**: PLAIN TEXT.
- **At Send Boundary (API / Worker / MIME)**:
  - Produce **both** `text/plain` and `text/html`.
  - `text/plain`: Exact interpolated plain text with `\n`.
  - `text/html`: Safe plain-text to HTML conversion:
    - HTML entities escaped (`&`, `<`, `>`, `"`, `'`).
    - Paragraph blocks separated by `\n\n` (or `\r\n\r\n`) wrapped in `<p style="margin: 0 0 16px 0; line-height: 1.5;">...</p>`.
    - Single line breaks `\n` converted to `<br/>`.
    - Signature appended cleanly to the HTML container.
  - MIME builder generates valid `multipart/alternative` with both parts.

---

## ISSUE 3 FORENSIC AUDIT: DESKTOP API URL / process.env

### 3.1 Complete API URL Access Matrix

| Location | Runtime | Source of API URL | Development | Packaged Production | Correct? |
|---|---|---|---|---|---|
| `apps/desktop/src/main/lib/config.ts` | Electron Main | `process.env.API_URL \|\| localData.apiUrl \|\| 'https://api.leadforge.kapiljangid.pro/api/v1'` | `http://localhost:3001/api/v1` (from `.env`) | `https://api.leadforge.kapiljangid.pro/api/v1` | ⚠️ Fallback is hardcoded |
| `apps/desktop/src/main/index.ts` | Electron Main | `loadConfig().apiUrl` | `http://localhost:3001/api/v1` | `https://api.leadforge.kapiljangid.pro/api/v1` | ✅ Uses config |
| `apps/desktop/src/main/ipc/auth.ts` | Electron Main | `sdk.httpClient.config.baseUrl` | `http://localhost:3001/api/v1` | `https://api.leadforge.kapiljangid.pro/api/v1` | ✅ Uses Main SDK |
| `apps/desktop/src/main/services/scheduler.ts` | Electron Main (fork options) | `env: { WORKSPACES_DB_DIR, PLAYWRIGHT_BROWSERS_PATH, NODE_ENV }` | `API_URL` NOT PASSED | `API_URL` NOT PASSED | ❌ Omits `API_URL` in worker `fork()` |
| `apps/desktop/src/main/workers/worker-host.ts` | Worker Child Process | Inherited from `fork()` `env` | `undefined` | `undefined` | ❌ `process.env.API_URL` is missing |
| `apps/desktop/src/main/workers/plugins/automation.ts` | Worker Child Process | `process.env.API_URL \|\| 'https://...'` | `https://api.leadforge.kapiljangid.pro/api/v1` | `https://api.leadforge.kapiljangid.pro/api/v1` | ❌ Independent hardcoded fallback |
| `apps/desktop/src/main/workers/plugins/outreach.ts` | Worker Child Process | `process.env.API_URL \|\| 'https://...'` | `https://api.leadforge.kapiljangid.pro/api/v1` | `https://api.leadforge.kapiljangid.pro/api/v1` | ❌ Independent hardcoded fallback |
| `apps/desktop/src/renderer` | Renderer Process | Calls Main via IPC (`window.ipc.invoke`) | N/A (uses IPC) | N/A (uses IPC) | ✅ Decoupled |

### 3.2 Answers to Specific Forensic Audit Questions

1. **Which code paths can access `process.env`?**
   - Main Process in Node/Electron.
   - Worker Child Processes in Node (only for keys in the `fork()` `env` whitelist).
   - In dev: `.env` is read manually by `main/index.ts` from `../../.env`.
2. **Which can NOT?**
   - Renderer process (`sandbox: true, nodeIntegration: false`).
   - Worker processes do NOT receive `API_URL` because `scheduler.ts` explicitly whitelist-forks without `API_URL`.
   - Main process in packaged production does not have `.env` (it is not packaged).
3. **Which API URLs are hardcoded?**
   - `apps/desktop/src/main/lib/config.ts`: fallback `'https://api.leadforge.kapiljangid.pro/api/v1'`.
   - `apps/desktop/src/main/workers/plugins/automation.ts`: `'https://api.leadforge.kapiljangid.pro/api/v1'`.
   - `apps/desktop/src/main/workers/plugins/outreach.ts`: `'https://api.leadforge.kapiljangid.pro/api/v1'`.
   - (In v1.0.0-beta.6, the workers had `'http://localhost:3001/api/v1'`).
4. **Which values are injected at build time?**
   - Currently none. `electron.vite.config.js` does not use `define` to inject compile-time API endpoints.
5. **Which values exist only in development?**
   - `apps/desktop/.env` with `API_URL=http://localhost:3001/api/v1`.
6. **Why did v1.0.0-beta.6 attempt `localhost:3001`?**
   - `automation.ts` and `outreach.ts` had `process.env.API_URL || 'http://localhost:3001/api/v1'`. Because `scheduler.ts` did not pass `API_URL` to the worker process, `process.env.API_URL` evaluated to `undefined`, triggering the `localhost:3001` fallback.
7. **Why did the worker fail specifically?**
   - The worker attempted `fetch('http://localhost:3001/api/v1/email/send')`. Because no API server runs locally on user machines, it failed with `ECONNREFUSED`.
8. **Why didn't normal renderer/API traffic expose the problem earlier?**
   - Renderer traffic communicates over IPC to Electron Main. Main process uses `loadConfig().apiUrl` which in production evaluated to the production URL. Only background worker child processes instantiated their own SDK with their own faulty fallbacks.
9. **Is the SDK itself assuming a default localhost URL?**
   - No. `HttpClient` requires `config.baseUrl`.
10. **Does the worker inherit environment variables?**
    - No. `scheduler.ts` passes a strict `env` object to `fork()`.
11. **Does electron-builder package runtime configuration?**
    - No. It packages `out/**` and `package.json`.
12. **Is there already an existing configuration abstraction that should be reused?**
    - **Yes.** `apps/desktop/src/main/lib/config.ts` (`loadConfig()`, `AppConfig`) is the central configuration manager.

### 3.3 Authoritative API Configuration Architecture

1. **Single Source of Truth in Main Process**:
   - `apps/desktop/src/main/lib/config.ts` defines the canonical API endpoint resolution:
     - If in dev mode (`is.dev` or `process.env.NODE_ENV !== 'production'`): default to `process.env.API_URL || 'http://localhost:3001/api/v1'`.
     - If in production: default to production endpoint `'https://api.leadforge.kapiljangid.pro/api/v1'` (or user-configured `localData.apiUrl`).
     - Never silently fall back from production to localhost.
2. **Explicit Injection into Worker Processes**:
   - In `scheduler.ts` `fork()` options:
     ```ts
     env: {
       ...
       API_URL: config.apiUrl,
       NODE_ENV: process.env.NODE_ENV
     }
     ```
   - In `scheduler.ts` `start` message:
     ```ts
     payload: {
       ...parsedPayload,
       _config: {
         apiUrl: config.apiUrl
       }
     }
     ```
3. **Explicit Worker Resolution**:
   - Worker plugins resolve `apiUrl` via `ctx.payload._config?.apiUrl || process.env.API_URL`.
   - If missing in production, **FAIL LOUDLY** with:
     `"LeadForge could not determine the API server configuration."`

---

## CONCLUSION OF AUDIT

The root causes of all three problems are verified with concrete code evidence. The next step is creating `implementation_plan.md` for review.
