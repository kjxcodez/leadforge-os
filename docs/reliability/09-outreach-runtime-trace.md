# LeadForge OS — Outreach & Campaign Runtime Trace (Phase 16)

**Document ID**: `REL-09-OUTREACH-RUNTIME-TRACE`  
**Phase**: Phase 16 — Runtime Truth Reconciliation & Legacy Contract Elimination  
**Date**: August 31, 2026  
**Status**: `VERIFIED & OPERATIONAL`  

---

## 1. Overview & Flow Architecture

This document maps the complete end-to-end execution path of the Outreach and Campaign automation engine, showing exact contracts across Renderer UI, Electron IPC, SDK, Hono API, MongoDB, and Worker Dispatchers.

```mermaid
sequenceDiagram
    autonumber
    actor User as User / UI
    participant Renderer as React Renderer
    participant IPC as Electron Main (IPC)
    participant Cache as SQLite Cache
    participant SDK as SdkClient
    participant API as Hono API
    participant Mongo as MongoDB Atlas
    participant Worker as Background Worker

    User->>Renderer: Click "Enroll & Launch Campaign"
    Renderer->>IPC: ipcRenderer.invoke('campaigns:enroll', { campaignId, contactIds })
    IPC->>Cache: SELECT sequenceId, status FROM campaigns
    IPC->>SDK: sdk.executions.create({ sequenceId, campaignId, contactId, ... })
    SDK->>API: POST /executions
    API->>Mongo: SequenceExecutionModel.create(...)
    Mongo-->>API: Saved Document
    API-->>SDK: Execution JSON (with embedded logs: [])
    SDK-->>IPC: Created Execution
    IPC->>Cache: LocalCRMRepository.saveFromServer('sequence_executions', exec)
    
    alt Campaign is ACTIVE
        IPC->>SDK: sdk.jobs.create({ type: 'automation:workflow', payload: { executionId } })
        SDK->>API: POST /jobs
        API->>Mongo: JobModel.create({ type: 'automation:workflow', status: 'queued' })
        Mongo-->>API: Created Job
        API-->>SDK: Job JSON
    end
    
    Worker->>SDK: sdk.jobs.claim(['automation:workflow'])
    SDK->>API: POST /jobs/claim
    API->>Mongo: Find & Lease Job
    API-->>Worker: Claimed Job Payload
    Worker->>Worker: Execute Workflow Step (Send Email / Delay / AI Prompt)
    Worker->>SDK: sdk.executions.appendLog(execId, { step, message, timestamp })
    SDK->>API: POST /executions/:id/logs
    API->>Mongo: $push { logs: logEntry }
    Worker->>SDK: sdk.jobs.complete(jobId, { status: 'completed' })
    SDK->>API: POST /jobs/:id/complete
    API->>Mongo: Update Job Status -> 'completed'
```

---

## 2. Key IPC Channels & Implementation Details

### 1. `campaigns:enroll` (`apps/desktop/src/main/ipc/campaigns-ipc.ts`)
* Validates `campaignId` and non-empty `contactIds`.
* Queries target campaign from SQLite cache to extract `sequenceId` and `status`.
* Enrolls contacts idempotently via `sdk.executions.create`.
* Saves created executions into local cache `sequence_executions`.
* If campaign is `ACTIVE`, spawns workflow jobs directly in MongoDB via `sdk.jobs.create`.

### 2. `campaigns:enrollments:list`
* Performs an enriched read projection joining SQLite cache tables:
  ```sql
  SELECT 
    se.*, c.firstName, c.lastName, c.email, c.title as contactTitle,
    comp.name as companyName, comp.domain as companyDomain, s.name as sequenceName
  FROM sequence_executions se
  LEFT JOIN contacts c ON se.contactId = c.id
  LEFT JOIN companies comp ON c.companyId = comp.id
  LEFT JOIN sequences s ON se.sequenceId = s.id
  WHERE se.campaignId = ? AND se.deletedAt IS NULL
  ORDER BY se.createdAt DESC
  ```
* Deserializes embedded JSON `logs` array for instant UI rendering without hitting secondary log tables.

### 3. `campaigns:bulk-pause-enrollments`
* Updates local SQLite cache status to `PAUSED`.
* Fetches active workflow jobs from MongoDB via `sdk.jobs.list({ limit: 100 })` and cancels them via `sdk.jobs.cancel(jobId)`.

### 4. `campaigns:bulk-resume-enrollments`
* Transitions paused sequence executions back to `RUNNING` or `WAITING` depending on `nextExecutionAt`.
* Immediately schedules pending workflow jobs in MongoDB via `sdk.jobs.create`.

### 5. `campaigns:runtime:overview`
* Aggregates real-time active workflow jobs from MongoDB (`sdk.jobs.list`) correlated with SQLite cache `sequence_executions` waiting for future timers.

---

## 3. Data Integrity & Verification

1. **Embedded Log Integrity**: Execution logs never invoke raw `sequence_logs` SQL. All logs reside in `SequenceExecution.logs: []`.
2. **Deterministic Enums**: All status strings (`ACTIVE`, `PAUSED`, `COMPLETED`, `RUNNING`, `WAITING`) are normalized to prevent case-sensitivity or casing mismatches between renderer and backend.
3. **Safe Idempotency**: Campaign enrollments check for existing active executions prior to inserting, avoiding duplicate outreach blasts.
