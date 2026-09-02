# LeadForge OS — Unknowns & Unresolved Items Log

## 1. Overview
In accordance with the evidence standard, any architectural decision or system behavior that cannot be definitively established from existing repository source code is explicitly documented below as `UNKNOWN` requiring human confirmation.

---

## 2. Unresolved Technical Items

### 2.1 Google Drive Account Scope & Service Account Credentials
* **Status:** `UNKNOWN`
* **Finding:** While [`gmail-provider.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/services/email/providers/gmail-provider.ts) handles Gmail OAuth tokens, the specific Google Drive storage strategy (whether attachments should be uploaded to individual user Google Drive accounts via OAuth OR to a centralized LeadForge OS Google Drive Service Account) is not configured in code.
* **Impact:** Determines whether API attachment upload uses user OAuth tokens or a service account key.

### 2.2 Strict Offline Operations Policy
* **Status:** `UNKNOWN`
* **Finding:** The repository contains offline sync queues, but does not define an explicit product policy for whether end-users should be allowed to create campaigns/contacts while completely offline under the new MongoDB-first model.
* **Impact:** Requires product team confirmation on whether offline write access is disabled or queued at an outbox boundary.

### 2.3 Existing Production SQLite Database Locations in Field Deployments
* **Status:** `UNKNOWN`
* **Finding:** Standalone desktop app installations in production may store SQLite database files in non-standard user profile paths.
* **Impact:** Field data migration script must include auto-discovery of all `.db` files across standard Electron `userData` directories.
