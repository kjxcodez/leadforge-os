# Phase 1 Forensic Document 12 — Google Drive Reality Audit

**Document Type:** Forensic Integration & Evidence Audit  
**Audited Against:** Entire Monorepo (`apps/api`, `apps/desktop`, `packages/sdk`, `packages/schema`)  
**Date:** September 2026  
**Status:** Authoritative Baseline  

---

## 1. Strict Evidence Checklist

| Requirement / Capability | Real Implementation Status | Evidence / Code Location |
| :--- | :--- | :--- |
| **Google Drive Provider Class** | **IMPLEMENTED (Backend Only)** | [`apps/api/src/services/google/drive.provider.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/services/google/drive.provider.ts) |
| **OAuth Scope: `drive.file`** | **IMPLEMENTED** | [`apps/api/src/services/google/auth.service.ts:13`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/services/google/auth.service.ts#L13) (`https://www.googleapis.com/auth/drive.file`) |
| **Direct Multipart Drive Upload** | **IMPLEMENTED (Backend)** | `GoogleDriveProvider.uploadFile()` uploads to `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart` |
| **Binary Drive Download** | **IMPLEMENTED (Backend)** | `GoogleDriveProvider.downloadFile()` fetches from `https://www.googleapis.com/drive/v3/files/{fileId}?alt=media` |
| **Attachment Metadata Persistence** | **IMPLEMENTED (MongoDB)** | `AttachmentModel` stores `{ workspaceId, googleConnectionId, fileId, filename, mimeType, size }` |
| **API Attachment Endpoints** | **IMPLEMENTED** | `POST /api/v1/attachments/upload`, `GET /api/v1/attachments/:id/download`, `DELETE /api/v1/attachments/:id` |
| **SDK Attachment Module** | **IMPLEMENTED** | `packages/sdk/src/modules/attachments.ts` |
| **Desktop IPC File Upload** | **IMPLEMENTED (Local File Bridge)** | `attachments:save` in `outreach.ts:107` reads local file path and calls `sdk.attachments.upload()` |
| **Google Drive Dedicated UI File Browser** | **NOT IMPLEMENTED** | The desktop UI has no Drive file picker or Drive storage explorer. |
| **User Folder Creation in Drive** | **NOT IMPLEMENTED** | Files are uploaded directly to the root of the user's Drive app folder. |

---

## 2. Forensic Analysis: What Exists vs What Was Observed

### What ACTUALLY Exists:
1. **API & Provider Layer:** A full, working `GoogleDriveProvider` exists in `apps/api/src/services/google/drive.provider.ts`. It does not use external libraries like `googleapis` directly; instead, it uses native `fetch` requests to the Google Drive v3 REST API endpoints with the OAuth access token acquired from `GoogleAuthService`.
2. **Drive Scope in OAuth:** When a user connects their Gmail account, the authorization URL requests both `https://www.googleapis.com/auth/gmail.send` and `https://www.googleapis.com/auth/drive.file`.
3. **Attachment Flow in Email Sends:** When `EmailService.send()` receives an attachment with an `id`, it retrieves the `AttachmentModel` document, calls `GoogleDriveProvider.downloadFile(connectionId, fileId)`, and attaches the binary stream to the outbound MIME message.

### Why the User Observed "Drive Integration is Not Actually Present":
1. **No Drive Explorer in Desktop UI:** In the desktop app (`CampaignsScreen.tsx`, `ProgressiveSequenceEditor.tsx`), the "Add Attachment" button opens a standard local OS file dialog (`<input type="file" />`), not a Google Drive cloud browser.
2. **Lack of User Visibility:** The application uploads local files into Drive under the hood and stores the `fileId` in MongoDB, but never provides a visual "Google Drive" folder explorer tab in the UI.
3. **Failure When Google Account is Disconnected:** If the user hasn't connected a Gmail/Google account in Settings, attempting to save an attachment throws `No connected Google account found in this workspace`.

---

## 3. Verdict

- **Backend Google Drive API Integration:** **IMPLEMENTED & FUNCTIONAL** (Uses Google Drive v3 REST API via `fetch`).
- **Frontend Google Drive File Picker / Explorer:** **NOT IMPLEMENTED** (UI operates via local file upload bridge).
- **Attachment Durability:** Attachments uploaded to Google Drive persist across restarts because their `fileId` and connection credentials are stored in MongoDB.
