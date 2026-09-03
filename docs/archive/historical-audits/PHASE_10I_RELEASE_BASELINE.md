# Phase 10I — LeadForge OS Beta Release Baseline

**Release Identification:** LeadForge OS Beta 1.1.1  
**Package Version:** `1.1.1-beta.1`  
**Git Release Tag:** `v1.1.1-beta.1`  
**Authoritative Git Commit SHA:** `ae3f632bb6224ca2484d63f3f5e5770ff8e67bc8`  
**Build Platform Target:** Windows x64 (Native Electron 33.4.11 / NSIS / Standalone Executable)

---

## 1. Monorepo Package Declarations

Every package manifest within the LeadForge OS workspace is locked to the release candidate version `1.1.1-beta.1`:

```json
{
  "root": "1.1.1-beta.1",
  "apps/desktop": "1.1.1-beta.1",
  "apps/api": "1.1.1-beta.1",
  "packages/core": "1.1.1-beta.1",
  "packages/schema": "1.1.1-beta.1",
  "packages/sdk": "1.1.1-beta.1",
  "packages/ai": "1.1.1-beta.1",
  "packages/agent-core": "1.1.1-beta.1",
  "packages/agent-runtime": "1.1.1-beta.1",
  "packages/workflow-engine": "1.1.1-beta.1",
  "packages/logger": "1.1.1-beta.1",
  "packages/auth": "1.1.1-beta.1"
}
```

---

## 2. Release Artifacts & Cryptographic Checksums

The following artifacts have been built, verified, and certified for distribution:

### A. Windows Unpacked Standalone Application
- **Path:** `apps/desktop/dist/win-unpacked/LeadForge OS.exe`
- **Architecture:** `win32-x64`
- **File Size:** `188,830,208 bytes` (~188.8 MB)
- **SHA-256 Checksum:**
  ```
  D30557073A77ACF3A8CB32C9F5D1A672AFB2A6814E148A74FE26E40EBAD0CCCA
  ```

### B. Distributable Windows Release Archive
- **Path:** `apps/desktop/dist/LeadForge OS-1.1.1-beta.1-win-x64.zip`
- **Architecture:** `win32-x64`
- **File Size:** `135,699,576 bytes` (~129.4 MB)
- **SHA-256 Checksum:**
  ```
  7F19C87E829260C9796AA392841447F74DA986582872BD57366C46295CF971EF
  ```

---

## 3. Database Schema Baseline

- **Engine:** SQLite 3 via `better-sqlite3`
- **Total Migrations:** 32 sequential schema migrations
- **Initial Migration:** `001_initial_schema`
- **Latest Migration:** `033_contact_last_contacted_at`
- **Seeded Defaults:** Sequences seeded with 4 core production workflow presets on initial launch:
  1. `preset_daily_discovery`: Daily Lead Discovery
  2. `preset_auto_qualify`: Auto Qualify Leads
  3. `preset_auto_enroll`: Auto Enroll High Scores
  4. `preset_follow_up`: Follow Up After 3 Days
  5. `preset_notify_replies`: Notify on Replies
  6. `preset_nightly_backup`: Backup Every Night

---

## 4. Production Network & External API Endpoints

- **Authoritative API Base URL:** `https://api.leadforge.kapiljangid.pro/api/v1`
- **Auto-Update Repository:** `https://api.github.com/repos/kjxcodez/leadforge-os/releases`
- **OAuth Providers:** Google Cloud OAuth 2.0 (Gmail API: `gmail.send`, `gmail.readonly`)
- **Web Scraping Engine:** Local Chromium headless instance via native Playwright
- **Development Secret Status:** 0 developer credentials, test session tokens, or local environment files packaged into distribution.
