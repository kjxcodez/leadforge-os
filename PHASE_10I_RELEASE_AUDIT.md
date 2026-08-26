# Phase 10I — Beta Release Baseline & Forensic Engineering Audit

**Date:** August 27, 2026  
**Auditor / Systems Architect:** LeadForge OS Systems Engineering & Architecture  
**Release Baseline Git SHA:** `ae3f632bb6224ca2484d63f3f5e5770ff8e67bc8`  
**Package Version:** `1.1.1-beta.1`  
**Target Release Tag:** `v1.1.1-beta.1`  
**Active Release Gate Verdict:** **`GREEN` (PRODUCTION RELEASE CANDIDATE CERTIFIED)**

---

## 1. Exact Release Baseline & Manifest Alignment

All package manifests across the monorepo, lockfiles, and configuration files are 100% synchronized to version `1.1.1-beta.1`:

| Package / Manifest Path | Declared Version | Status |
|---|---|---|
| `package.json` (Root Monorepo) | `1.1.1-beta.1` | **VERIFIED** |
| `apps/desktop/package.json` | `1.1.1-beta.1` | **VERIFIED** |
| `apps/api/package.json` | `1.1.1-beta.1` | **VERIFIED** |
| `packages/core/package.json` | `1.1.1-beta.1` | **VERIFIED** |
| `packages/schema/package.json` | `1.1.1-beta.1` | **VERIFIED** |
| `packages/sdk/package.json` | `1.1.1-beta.1` | **VERIFIED** |
| `packages/ai/package.json` | `1.1.1-beta.1` | **VERIFIED** |
| `packages/agent-core/package.json` | `1.1.1-beta.1` | **VERIFIED** |
| `packages/agent-runtime/package.json` | `1.1.1-beta.1` | **VERIFIED** |
| `packages/workflow-engine/package.json` | `1.1.1-beta.1` | **VERIFIED** |
| `packages/logger/package.json` | `1.1.1-beta.1` | **VERIFIED** |
| `pnpm-lock.yaml` | Importers aligned to `1.1.1-beta.1` | **VERIFIED** |

### Version Source of Truth & Propagation Contract
1. **Application Packaging:** `apps/desktop/package.json` (`version`) provides the authoritative version string to `electron-builder`.
2. **CI Tag Verification:** `.github/workflows/release.yml` executes an automated enforcement gate before compilation:
   ```bash
   PKG_VERSION=$(node -p "require('./package.json').version")
   TAG_VERSION=${GITHUB_REF_NAME#v}
   if [ "$PKG_VERSION" != "$TAG_VERSION" ]; then
     echo "::error::Version mismatch! package.json version ($PKG_VERSION) does not match Git tag ($TAG_VERSION)"
     exit 1
   fi
   ```
   This prevents any release where `package.json = X` and `Git tag = Y`.

---

## 2. Release Workflow Forensic Audit

**Workflow File:** `.github/workflows/release.yml`

```
Git Tag Push (v1.1.1-beta.1)
  ↓
GitHub Actions (windows-latest)
  ↓
checkout (actions/checkout@v4)
  ↓
Node.js 22 + pnpm 9 (frozen lockfile)
  ↓
Version Match Verification (pkg === tag)
  ↓
Compile Workspaces (`pnpm --filter=!@leadforge/desktop build`)
  ↓
Vite & Electron Builder (`pnpm --filter=@leadforge/desktop run build --publish never`)
  ↓
Generate SHA-256 Checksums (`sha256sum "$f" > "$f.sha256"`)
  ↓
Upload Build Artifacts (upload-artifact@v4)
  ↓
Publish GitHub Release (softprops/action-gh-release@v2)
  ↓
Publish latest.yml & .blockmap
  ↓
Auto-Updater Discovers Update
```

### Environment Isolation & Cleanliness
- **Zero Local Secrets:** The release workflow does NOT include or upload local `.env` files.
- **Dependency Isolation:** Native module `better-sqlite3` is rebuilt specifically for the target Electron ABI (`@electron/rebuild` targeting Electron 33.4.11).
- **Production URL Fallback:** Packaged desktop application evaluates `app.isPackaged === true`, setting authoritative API endpoint to `https://api.leadforge.kapiljangid.pro/api/v1`.

---

## 3. Desktop Production Runtime Configuration Audit

**File:** `apps/desktop/src/main/lib/config.ts`

- Authoritative Production URL: `DEFAULT_PRODUCTION_API_URL = 'https://api.leadforge.kapiljangid.pro/api/v1'`
- Precedence Order:
  1. `process.env.API_URL` (Override flag if passed at runtime)
  2. `userData/config.json` (`localData.apiUrl` set via Workspace Settings)
  3. Environment default: `https://api.leadforge.kapiljangid.pro/api/v1` when packaged; `http://localhost:3001/api/v1` when unpacking in developer mode.

### Bundle Secret Inspection
A complete forensic inspection of the compiled distribution bundles (`apps/desktop/out/main/index.js`, `apps/desktop/out/main/worker.js`, `apps/desktop/out/preload/index.js`, and `apps/desktop/out/renderer/`) verified:
- **`SESSION_TOKEN`:** 0 occurrences found.
- **`LINKEDIN_COOKIE`:** 0 occurrences found.
- **`OPENROUTER_API_KEY`:** 0 hardcoded keys found.
- **Localhost Fallback:** Only present behind `isDevEnvironment()` guard for non-packaged dev mode.

---

## 4. Database Fresh-State & Migration Lifecycle Certification

**Verification Test:** `apps/desktop/src/main/services/fresh-database.test.ts` (Automated suite executed natively under Electron)

1. **Clean Database Initialization:** Tested against a genuine empty in-memory and disk database.
2. **Total Migrations:** Exactly 32 sequential migrations executed in order:
   - Migrations `001_initial_schema` through `033_contact_last_contacted_at` (with index `022` omitted in historical sequence).
   - Final migration recorded: `033_contact_last_contacted_at`.
3. **Idempotency Guarantee:** Re-running `runMigrations()` on an already migrated database results in 0 errors and maintains total applied count at 32.
4. **Essential Tables Verified:**
   `_migrations`, `companies`, `contacts`, `campaigns`, `sequences`, `sequence_executions`, `email_accounts`, `email_deliveries`, `templates`, `audiences`, `discovery_runs`, `jobs`, `sync_queue`.
5. **Seeded Data:** Default workflow presets (`Daily Lead Discovery`, `Auto Qualify Leads`, `Follow Up After 3 Days`, `Notify on Replies`) seeded cleanly into `sequences` table on first launch without creating duplicate workspaces.

---

## 5. Campaign Safety & Outreach Concurrency Certification

**Verification Test:** `apps/desktop/src/main/services/campaign.test.ts` (13/13 subtests passed)

1. **Pre-Send Idempotency Lock:** SQLite enforces `UNIQUE constraint` on `email_deliveries.idempotencyKey`.
2. **Concurrent Worker Suppression:** If a secondary worker attempts duplicate execution of the same campaign step and contact, `automation.ts` detects the constraint violation, re-queries `email_deliveries`, recognizes status `'SENDING'` or `'SENT'`, and gracefully suppresses duplicate email sending to Gmail.
3. **Contact Lifecycle Integrity:** `handleSendEmailStep` records send details in `email_deliveries` and updates `contacts.lastContactedAt = CURRENT_TIMESTAMP`, leaving `contacts.status` intact for CRM pipeline stages.
4. **Scheduler Recovery:** In-flight worker executions interrupted during desktop restart are automatically detected and transitioned to `'retrying'` or `'failed'` without generating duplicate sends.

---

## 6. Full Filter Parity & Audience Resolution Certification

**Verification Test:** `apps/desktop/src/main/services/audiences.test.ts` (11/11 subtests passed)

1. **Geographic & Company Parity:** Both local SQLite resolver (`audiences-ipc.ts`) and MongoDB API resolver (`audience.service.ts`) support full parity across `city`, `state`, `country`, `location`, `companyId`, `search`, `status`, `industry`, and `discoveryRunId`.
2. **Dynamic Outreach History Filter:** First-class support for `contactedStatus: 'never' | 'contacted'`, querying the `email_deliveries` ledger to ensure campaigns never re-contact leads unintentionally.
3. **Workspace Isolation:** Audience member resolution strictly enforces `workspaceId` partition, preventing cross-tenant data leakage.

---

## 7. Production Artifact Forensics

The Windows release candidate binaries have been successfully compiled and verified:

| Artifact | Path | Size | SHA-256 Checksum |
|---|---|---|---|
| **Packaged Windows Executable** | `apps/desktop/dist/win-unpacked/LeadForge OS.exe` | 188.83 MB | `D30557073A77ACF3A8CB32C9F5D1A672AFB2A6814E148A74FE26E40EBAD0CCCA` |
| **Distributable Windows Archive** | `apps/desktop/dist/LeadForge OS-1.1.1-beta.1-win-x64.zip` | 129.41 MB | `7F19C87E829260C9796AA392841447F74DA986582872BD57366C46295CF971EF` |

---

## 8. Summary of Automated Test Suite Results

Command: `pnpm --filter @leadforge/desktop test` (Executed under native Electron runtime)

```text
[Desktop Test] PASS: src/main/services/onboarding.test.ts
[Desktop Test] PASS: src/main/services/updater.test.ts
[Desktop Test] PASS: src/main/services/intelligence.test.ts
[Desktop Test] PASS: src/main/ai/tools/adapter.test.ts
[Desktop Test] PASS: src/main/services/campaign.test.ts
[Desktop Test] PASS: src/main/services/email-test-recipients.test.ts
[Desktop Test] PASS: src/main/services/send-test-attachment.test.ts
[Desktop Test] PASS: src/main/services/audiences.test.ts
[Desktop Test] PASS: src/main/services/post-release-stabilization.test.ts
[Desktop Test] PASS: src/main/services/desktop-runtime-config.test.ts
[Desktop Test] PASS: src/main/services/fresh-database.test.ts
```

**Total Desktop Suites:** 11 Passed, 0 Failed, 0 Skipped.  
**Monorepo Typecheck (`pnpm check-types`):** 20/20 tasks successful, 0 errors.
