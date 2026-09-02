# LeadForge OS — Phase 9 Implementation Report: Multi-Gmail OAuth + Google Drive Attachments + SMTP Removal

**Phase:** Phase 9 — Multi-Gmail OAuth + Google Drive Attachments + SMTP Removal  
**Status:** COMPLETED & VERIFIED (27/27 Automated Checks Passed)  
**Date:** August 2026  
**Architecture Migration:** MongoDB-First Architecture Migration  

---

## 1. Executive Summary

Phase 9 establishes the final Google integration architecture for LeadForge OS:
1. **Gmail is the ONLY Outbound Email Provider:** Active outbound SMTP path is **0**. `nodemailer` has been removed from both `apps/api` and `apps/desktop`. Legacy SMTP-only accounts are classified as `unsupported` and rejected from outbound delivery paths with `MAILBOX_NOT_SUPPORTED`.
2. **Multi-Sender Decoupled Connection Model:** `GoogleConnection` is decoupled from `EmailAccount`. A single workspace can connect multiple independent Gmail sender profiles (`sender1@gmail.com`, `sender2@gmail.com`).
3. **Per-Sender OAuth Lifecycle:** Each sender profile possesses independent OAuth credentials, encrypted refresh tokens, access tokens, and lifecycle state. Revoking, expiring, or disconnecting Sender A has zero impact on Sender B.
4. **Google Drive Attachment Store:** Google Drive (`drive.file` scope) serves as the durable binary store. MongoDB stores lightweight canonical attachment metadata records (`id`, `workspaceId`, `provider: 'google-drive'`, `googleConnectionId`, `googleAccountId`, `fileId`, `filename`, `mimeType`, `size`, `contentHash`). Neither MongoDB nor SQLite ever stores permanent binary blobs.
5. **Separate Modular Architecture:** Clear separation between `GoogleAuthService`, `GmailProvider`, `GoogleDriveProvider`, and `MimeBuilder`. No monolithic `GoogleService`.
6. **Cross-Account Drive Ownership Policy:** Attachments are owned by the Google connection that uploaded them. Outbound sending verifies that the chosen sender has access to the Drive attachment before delivery.

---

## 2. Completed Architecture Deliverables

### 2.1 Schema & Models (`@leadforge/schema` & `apps/api`)
- **`GoogleConnection` Schema & Model:**
  - `_id`: Canonical UUID string (via `generateEntityId()`)
  - `workspaceId`: String (enforced workspace scoping)
  - `userId`: String (owning user)
  - `googleAccountId`: String (Google stable `sub` claim)
  - `email`: String (lowercase, trimmed)
  - `name`, `picture`: Optional profile info
  - `encryptedRefreshToken`, `encryptedAccessToken`: AES-256-GCM encrypted
  - `tokenExpiresAt`: Date
  - `grantedScopes`: Array of granted Google OAuth scopes
  - `gmailStatus`: `'connected' | 'reauth_required' | 'revoked' | 'error'`
  - `driveStatus`: `'authorized' | 'not_authorized' | 'reauth_required' | 'revoked' | 'error'`
  - `status`: `'active' | 'reauth_required' | 'disconnected'`
  - Compound unique index: `{ workspaceId: 1, googleAccountId: 1 }` guaranteeing zero duplicate connection profiles for the same Google account in a workspace.
- **`Attachment` Schema & Model:**
  - `_id`: Canonical UUID string (LeadForge ID)
  - `workspaceId`: String
  - `provider`: `'google-drive'`
  - `googleConnectionId`: String (points to owning `GoogleConnection`)
  - `googleAccountId`: String (Google `sub`)
  - `fileId`: String (Google Drive binary file ID, separate from `_id`)
  - `filename`: String
  - `mimeType`: String
  - `size`: Number (bytes)
  - `contentHash`: SHA-256 hash string
  - `metadata`: Flexible descriptor record
- **`EmailAccount` Schema & Model Normalization:**
  - Added `googleConnectionId: string`
  - Removed `encryptedPassword` (SMTP app password) from active use
  - Allowed status `'unsupported'` for legacy accounts
  - Restricted outbound provider to `'gmail'`

### 2.2 Provider Separation
- **`GoogleAuthService` (`apps/api/src/services/google/auth.service.ts`):**
  - Manages OAuth URL generation with `prompt: 'select_account consent'`, `access_type: 'offline'`, `include_granted_scopes: 'true'`, and PKCE.
  - Performs code-to-token exchange and stable identity resolution (`sub`, `email`, profile).
  - Handles independent token refresh per connection with in-flight promise deduplication.
  - Implements token revocation and connection disconnection.
- **`MimeBuilder` (`apps/api/src/services/google/mime-builder.ts`):**
  - Pure RFC 2822 builder constructing `multipart/mixed` and `multipart/alternative` structures.
  - Encodes subjects using UTF-8 RFC 2047 headers.
  - Formats attachments with base64 76-character chunking.
  - Encodes output as RFC 4648 Base64URL without padding.
- **`GmailProvider` (`apps/api/src/services/google/gmail.provider.ts`):**
  - Focused strictly on Gmail API `users/me/messages/send`.
  - Normalizes Gmail API HTTP errors (401/403 -> `reauth_required`, 429 -> rate limited).
  - Fetches user signatures via `users/me/settings/sendAs`.
- **`GoogleDriveProvider` (`apps/api/src/services/google/drive.provider.ts`):**
  - Focused strictly on Google Drive API multipart uploads (`uploadType=multipart`), binary downloads (`?alt=media`), metadata retrieval, and deletion.
  - Verifies `drive.file` scope and provides cross-connection access verification.
- **`AttachmentService` (`apps/api/src/services/attachment/attachment.service.ts`):**
  - Coordinates Drive upload and MongoDB metadata persistence with 25 MB size limits and SHA-256 hashing.

### 2.3 API Routes & SDK Client
- **Routes:**
  - `/google-connections`: `GET /`, `GET /:id`, `POST /connect`, `GET /oauth/callback`, `GET /oauth/status/:transactionId`, `POST /:id/disconnect`, `POST /:id/reauthorize`.
  - `/attachments`: `POST /upload`, `GET /`, `GET /:id`, `GET /:id/download`, `DELETE /:id`.
- **SDK Modules:**
  - `sdk.googleConnections`: full CRUD and OAuth lifecycle methods.
  - `sdk.attachments`: upload, list, download, delete methods.

### 2.4 Complete SMTP Removal
- Removed `nodemailer` from `apps/api/package.json` and `apps/desktop/package.json`.
- Removed `nodemailer` transport and configuration from `apps/api/src/lib/mailer.ts`.
- Replaced nodemailer SMTP diagnostic socket test in `apps/desktop/src/main/ipc/observability-ipc.ts` with Gmail OAuth profile health checks.
- Zero active SMTP outbound paths remain in the codebase.

---

## 3. Verification Suite Results (`scripts/verify-phase9.ts`)

All 27 verification tests passed cleanly:

| Test ID | Objective | Result |
|---|---|:---:|
| **T9.1** | Connect Gmail Account A independently | **PASS** |
| **T9.2** | Connect Gmail Account B independently | **PASS** |
| **T9.3** | Both sender profiles coexist in workspace | **PASS** |
| **T9.4** | Sender A credentials do not affect Sender B credentials | **PASS** |
| **T9.5** | Sender A token expiration does not disable Sender B | **PASS** |
| **T9.6** | Sender A revocation does not disable Sender B | **PASS** |
| **T9.7** | Same Google account reconnect does not create duplicate profiles | **PASS** |
| **T9.8** | OAuth account selection `prompt=select_account consent` emitted | **PASS** |
| **T9.9** | Gmail scope (`gmail.send`) verified | **PASS** |
| **T9.10** | Drive scope (`drive.file`) present when requested | **PASS** |
| **T9.11** | Incremental Drive authorization upgrades capability | **PASS** |
| **T9.12** | Gmail-only connection works without Drive | **PASS** |
| **T9.13** | Drive capability decoupled from Gmail capability | **PASS** |
| **T9.14** | Drive upload through authenticated connection | **PASS** |
| **T9.15** | Drive metadata stored in MongoDB | **PASS** |
| **T9.16** | Attachment LeadForge ID equals Mongo `_id` (string UUID) | **PASS** |
| **T9.17** | Drive `fileId` remains separate from LeadForge ID | **PASS** |
| **T9.18** | Workspace isolation for connections and attachments | **PASS** |
| **T9.19** | User isolation recorded on connection | **PASS** |
| **T9.20** | Attachment download simulation from Drive | **PASS** |
| **T9.21** | Pure MimeBuilder produces valid RFC 2822 base64url message | **PASS** |
| **T9.22** | OAuth state validation rejects tampered/unknown token | **PASS** |
| **T9.23** | Independent token refresh deduplication per connection | **PASS** |
| **T9.24** | Revoked token handling marks status `reauth_required` | **PASS** |
| **T9.25** | Disconnect one sender without affecting another | **PASS** |
| **T9.26** | Static Forensic Audit: 0 active nodemailer / SMTP paths | **PASS** |
| **T9.27** | Legacy SMTP-only account becomes unsupported | **PASS** |

---

## 4. Full Migration Regression Suite

- `scripts/verify-phase1.ts`: **PASS** (Canonical Identity & Shared Schemas)
- `scripts/verify-phase2.ts`: **PASS** (MongoDB Model Expansion & Hardening)
- `scripts/verify-mongo-string-ids.ts`: **PASS** (0 ObjectIds across 27 relations)
- `scripts/verify-phase3.ts`: **PASS** (API Persistence Boundary & Batch APIs)
- `scripts/verify-phase4.ts`: **PASS** (SQLite to MongoDB Migration Engine)
- `scripts/verify-phase5.ts`: **PASS** (Desktop Mongo-First Write Cutover)
- `scripts/verify-phase6.ts`: **PASS** (Disposable SQLite Cache Cleanup)
- `scripts/verify-phase7.ts`: **PASS** (Worker Persistence Migration)
- `scripts/verify-phase8.ts`: **PASS** (MongoDB Job Scheduler & Execution Runtime)
- `scripts/verify-phase9.ts`: **PASS** (Multi-Gmail OAuth + Google Drive Attachments + SMTP Removal)
- Monorepo Typecheck (`pnpm turbo run check-types`): **20/20 tasks successful**
- Production Builds:
  - `pnpm --filter api build`: **Exit 0**
  - `npx electron-vite build`: **Exit 0**

---

## 5. Architectural Stop Condition

Phase 9 is complete. Per user directive, the system stops here and does not proceed to Phase 10 without explicit prompt.
