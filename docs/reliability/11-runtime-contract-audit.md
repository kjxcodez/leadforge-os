# LeadForge OS — Runtime Contract & Cache Schema Audit (Phase 16)

**Document ID**: `REL-11-RUNTIME-CONTRACT-AUDIT`  
**Phase**: Phase 16 — Runtime Truth Reconciliation & Legacy Contract Elimination  
**Date**: August 31, 2026  
**Status**: `ZERO CONTRACT VIOLATIONS DETECTED`  

---

## 1. Canonical SQLite Cache Schema Specification

The local SQLite cache (`apps/desktop/src/main/database/cache-schema.ts`) initializes exactly 13 canonical tables:

1. **`cache_metadata`**: Stores schema version (`schema_version = 2`) and update timestamps.
2. **`workspaces`**: `id`, `name`, `slug`, `ownerId`, `plan`, `settings`, `createdAt`, `updatedAt`.
3. **`companies`**: `id`, `workspaceId`, `name`, `domain`, `industry`, `status`, `website`, `address`, `phone`, `email`, `employeeCount`, `size`, `revenue`, `city`, `state`, `country`, `location`, `linkedin`, `linkedinUrl`, `notes`, `opportunityScore`, `tags`, `customFields`, `metrics`, `createdAt`, `updatedAt`, `deletedAt`.
4. **`contacts`**: `id`, `workspaceId`, `companyId`, `firstName`, `lastName`, `email`, `phone`, `title`, `linkedin`, `linkedinUrl`, `source`, `priority`, `status`, `notes`, `tags`, `lastContactedAt`, `customFields`, `createdAt`, `updatedAt`, `deletedAt`.
5. **`campaigns`**: `id`, `workspaceId`, `sequenceId`, `sendingAccountId`, `name`, `description`, `dailyLimit`, `timezone`, `status`, `settings`, `stats`, `createdAt`, `updatedAt`, `deletedAt`.
6. **`sequences`**: `id`, `workspaceId`, `name`, `description`, `steps`, `status`, `trigger`, `triggers`, `createdAt`, `updatedAt`, `deletedAt`.
7. **`sequence_executions`**: `id`, `workspaceId`, `sequenceId`, `campaignId`, `contactId`, `companyId`, `status`, `currentStep`, `currentStepName`, `startedAt`, `completedAt`, `failedAt`, `pausedAt`, `nextExecutionAt`, `logs`, `metrics`, `emailsSent`, `replies`, `failures`, `createdAt`, `updatedAt`, `deletedAt`.
8. **`templates`**: `id`, `workspaceId`, `name`, `subject`, `body`, `variables`, `attachments`, `createdAt`, `updatedAt`, `deletedAt`.
9. **`email_accounts`**: `id`, `workspaceId`, `name`, `provider`, `email`, `displayName`, `dailyLimit`, `status`, `smtpHost`, `smtpPort`, `imapHost`, `imapPort`, `createdAt`, `updatedAt`, `deletedAt`.
10. **`audiences`**: `id`, `workspaceId`, `name`, `description`, `entityType`, `type`, `mode`, `isDynamic`, `filterRules`, `filterDefinition`, `memberCount`, `staticMemberIds`, `createdAt`, `updatedAt`, `deletedAt`.
11. **`discovery_runs`**: `id`, `workspaceId`, `name`, `query`, `country`, `state`, `city`, `provider`, `status`, `resultCount`, `startedAt`, `completedAt`, `failedAt`, `error`, `createdAt`, `updatedAt`, `deletedAt`.
12. **`company_discovery_runs`**: `id`, `workspaceId`, `discoveryRunId`, `companyId`, `createdAt`.
13. **`settings`**: `id`, `workspaceId`, `key`, `value`, `createdAt`, `updatedAt`.

---

## 2. Forbidden Entities Audit

The following table proves that zero references to obsolete entities remain in production desktop source or runtime bundles:

| Obsolete Entity | Legacy Role | Phase 16 Canonical Location | Production Desktop References |
| :--- | :--- | :--- | :--- |
| `jobs` table (SQLite) | Background tasks | Authoritative in MongoDB (`sdk.jobs`) | `0` (Verified via static scanner & bundle scan) |
| `system_logs` (SQLite) | SRE diagnostic logs | Authoritative in MongoDB (`sdk.systemLogs`) | `0` (Verified) |
| `audit_logs` (SQLite) | Security audit trail | Authoritative in MongoDB (`sdk.auditLogs`) | `0` (Verified) |
| `sequence_logs` (SQLite) | Step-by-step logs | Embedded `sequence_executions.logs: []` | `0` (Verified) |
| `activities` (SQLite) | Legacy event feed | Handled via API event telemetry | `0` (Verified) |
| `sync_*` (SQLite) | Local sync queues | Stateless pull/push via `sdk.sync` | `0` (Verified) |
| `sourcePlatform` column | Contact lead source | Canonical `source` column | `0` (Verified) |

---

## 3. Automated Contract Scanner Output

```text
========================================================================
 LeadForge OS — Phase 16: Runtime Cache & Query Contract Verification
========================================================================

--- [Step 1] Static Codebase SQL Query Scan ---
✅ PASS: Zero forbidden SQL queries or obsolete columns detected in apps/desktop/src.

--- [Step 2] Runtime Cache Fixture Verification ---
✅ PASS: All 13 canonical cache tables exist.

--- [Step 3] Representative Desktop IPC Queries Execution ---
✅ PASS: Representative production IPC queries executed cleanly with zero SqliteErrors.

========================================================================
 ALL QUERY & RUNTIME CACHE CONTRACT CHECKS PASSED
========================================================================
```
