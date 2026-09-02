# Phase 1 Forensic Document 15 — Campaign & Sequence Domain Reality

**Document Type:** Forensic State Machine & Lifecycle Audit  
**Audited Against:** `packages/schema`, `apps/api/src/routes/business.ts`, `apps/desktop/src/main/ipc/crm.ts`, `apps/desktop/src/main/workers/plugins/automation.ts`  
**Date:** September 2026  
**Status:** Authoritative Baseline  

---

## 1. Campaign Domain State Machine

### 1.1 Canonical Status Enums (`@leadforge/schema`)
- `DRAFT`: Initial state before contact enrollment.
- `ACTIVE`: Actively executing sequence steps against enrolled contacts.
- `PAUSED`: Execution temporarily halted by user.
- `COMPLETED`: All enrolled contacts reached terminal sequence state.
- `ARCHIVED`: Soft-deleted / retired campaign.

### 1.2 Status Casing Matrix & Enforcement

| Subsystem / Layer | Enum Format | Validation / Normalization Behavior |
| :--- | :--- | :--- |
| **API Schema (`@leadforge/schema`)** | `UPPERCASE` (`DRAFT`, `ACTIVE`, `PAUSED`, `COMPLETED`) | Rejects lowercase strings with 400 Bad Request. |
| **MongoDB Model (`CampaignModel`)** | `UPPERCASE` (`enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']`) | Strict Mongoose enum validation. |
| **Desktop IPC (`crm.ts:369`)** | `UPPERCASE` | Normalizes input: `record.status ? String(record.status).toUpperCase() : 'DRAFT'`. |
| **Auto-Calculation Logic (`crm.ts:275-297`)** | `UPPERCASE` | Inspects `sequence_executions` stats; automatically transitions status from `DRAFT` -> `ACTIVE` -> `COMPLETED`. |
| **Renderer UI (`CampaignsScreen.tsx`)** | Mixed / Upper | Passes uppercase strings when creating campaigns. |

---

## 2. Sequence & Automation Execution State Machine

### 2.1 Supported Step Types (`automation.ts`)
1. **`SEND_EMAIL`**: Renders template with `CanonicalVariableContext`, validates email address, dispatches via `sdk.outreach.sendEmail()`.
2. **`DELAY`**: Pauses execution until `nextExecutionAt = now + delayMs`.
3. **`BRANCH` / `CONDITION`**: Evaluates Boolean expressions (e.g. `{{contact.status}} == 'lead'`, `{{contact.replied}} == true`).
4. **`SET_VARIABLE`**: Writes key-value pairs into `executionContext.variables`.
5. **`ASSIGN_TAG`**: Appends tag to contact in CRM.

### 2.2 Sequence Execution Status Flow (`SequenceExecutionModel`)

```
               ┌─────────────┐
               │   PENDING   │
               └──────┬──────┘
                      │
                      ▼
               ┌─────────────┐
        ┌─────►│   RUNNING   │◄────┐
        │      └──────┬──────┘     │
        │             │            │
(Next step ready)     ▼       (Resume)
        │      ┌─────────────┐     │
        └──────┤   WAITING   │     │
        │      │   (Delay)   │     │
        │      └──────┬──────┘     │
        │             │            │
        │             ▼            │
        │      ┌─────────────┐     │
        │      │   PAUSED    ├─────┘
        │      └──────┬──────┘
        │             │
        ▼             ▼
┌──────────────┐┌──────────────┐┌──────────────┐
│  COMPLETED   ││    FAILED    ││   REPLIED    │
└──────────────┘└──────────────┘└──────────────┘
```

---

## 3. Findings & Discrepancies

1. **Auto-Calculation Status Drift:** In `crm.ts:293`, the IPC handler automatically updates campaign status based on SQL counts from `sequence_executions` without updating MongoDB, causing local SQLite status to diverge from MongoDB until next full hydration.
2. **Execution Status Lowercase Storage:** `SequenceExecutionModel` stores execution statuses in lowercase (`'pending'`, `'running'`, `'waiting'`, `'completed'`, `'failed'`, `'replied'`), whereas `CampaignModel` stores campaign statuses in uppercase (`'DRAFT'`, `'ACTIVE'`). Case-sensitive SQL queries in earlier versions caused aggregation errors until normalized.
