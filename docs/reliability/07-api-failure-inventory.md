# API Failure Inventory & Forensic Log

This document records the specific API-level warnings, polling inefficiencies, validation mismatches, and deprecations observed during runtime.

---

## 1. Excessive Job Polling vs. Atomic Claims

### 1.1 Observed Behavior
```text
GET /api/v1/jobs?limit=100
POST /api/v1/jobs/claim
GET /api/v1/jobs?limit=100
POST /api/v1/jobs/claim
...
```
Requests arriving at ~1–2s intervals.

### 1.2 Call Graph Analysis
* **`POST /api/v1/jobs/claim`**: Originates from desktop `JobScheduler.tick()` running on a `2000ms` interval inside the active `WorkspaceRuntime`. This is an atomic claim primitive utilizing MongoDB `findOneAndUpdate` to retrieve work.
* **`GET /api/v1/jobs?limit=100`**: Originates from renderer `DiscoveryScreen.tsx` (`jobsQuery`) which was configured with `refetchInterval: 1500`.
* **Finding**: `JobScheduler` was NOT calling `GET /jobs`. The read traffic was purely UI telemetry from `DiscoveryScreen.tsx`.
* **Remediation**:
  * Relax `DiscoveryScreen.tsx` `refetchInterval` from 1500ms to 5000ms.
  * Invalidate query immediately upon user action (e.g. submitting a new discovery job) rather than relying on rapid polling.

---

## 2. Mongoose `new: true` Deprecation Warnings

### 2.1 Observed Log
```text
[MONGOOSE] Warning: mongoose: the `new` option for `findOneAndUpdate()` and `findOneAndReplace()` is deprecated. Use `returnDocument: 'after'` instead.
```

### 2.2 Occurrence Inventory
* `apps/api/src/repositories/base/base.repository.ts` (lines 138, 238)
* `apps/api/src/repositories/automation-lock/automation-lock.repository.ts` (lines 57, 101)
* `apps/api/src/repositories/workspace-memory/workspace-memory.repository.ts` (line 26)
* `apps/api/src/services/automation/automation.service.ts` (lines 45, 88)
* `apps/api/src/services/outreach/outreach.service.ts` (line 214)

### 2.3 Installed Version
* `mongoose@^9.7.4` (Mongoose 9+) requires `returnDocument: 'after'`.

### 2.4 Remediation
* Standardize all `findOneAndUpdate` and `findOneAndReplace` option payloads across repositories and services to use `returnDocument: 'after'`.

---

## 3. Campaign Status Validation Mismatch

### 3.1 Observed Failure
* API returned `400 Bad Request` with Zod validation failure: `received "Active"`.

### 3.2 Contract Definition
* **Canonical Machine Enum**: `CampaignStatus.ACTIVE`, `CampaignStatus.PAUSED`, `CampaignStatus.DRAFT`, `CampaignStatus.COMPLETED`.
* **Renderer Origin**: `CampaignsScreen.tsx` sent literal string `'Active'`.
* **Remediation**:
  * Correct `CampaignsScreen.tsx` mutations to send `CampaignStatus` uppercase enums.
