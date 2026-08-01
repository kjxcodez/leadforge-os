# Sequence Workflows & Automation Engine

This document details the sequence execution model, drip automation steps, and lock controls of the LeadForge OS workflow engine (`@leadforge/workflow-engine`).

---

## ⚙️ Workflow Engine Model

The workflow engine executes sequential marketing and outreach flows for contacts enrolled in campaigns. Long-running sequence steps are routed to the sandboxed worker plugin `automation:workflow` (`automation.ts`).

```text
  [ Contact Enrolled ] ──► [ Check status = 'NEW' / 'CONTACTED' ]
                                          │
                                          ▼
                             [ Check Automation Locks ]
                                          │
                                          ▼ (No Lock)
                             [ Execute Step - e.g. SEND_EMAIL ]
                                          │
                                          ▼
                             [ Update Execution Context ]
                                          │
                                          ▼
                             [ Save Progress Checkpoint ]
```

---

## 📋 Sequence Steps Reference

A sequence is defined as an array of step objects. The runner resolves and executes each step sequentially:

### 1. `WAIT`

- **Purpose**: Pause execution for a set duration.
- **Parameters**: `durationSeconds` (or hours/days).
- **Execution**: The engine schedules the next step check and exits the current run.

### 2. `SEND_EMAIL`

- **Purpose**: Send a templated email via the SMTP worker.
- **Parameters**: `templateId`, `fromEmail`.
- **Execution**: Renders tokens (e.g. `{{contact.firstName}}`), dispatches the email, and logs the activity.

### 3. `IF`

- **Purpose**: Conditional branch.
- **Parameters**: `condition` (e.g., check tag matches, check opportunity score).
- **Execution**: Evaluates expression in sandboxed context and branches execution path.

### 4. `GOTO`

- **Purpose**: Jump to a specific step index.
- **Parameters**: `targetStepIndex`.
- **Safety**: The engine caps GOTO loops to a maximum of 100 jumps per run to prevent infinite loops.

### 5. `HTTP_REQUEST`

- **Purpose**: Trigger external webhooks.
- **Parameters**: `url`, `method`, `headers`, `body`.
- **Safety**: Redacts authorization and session cookie headers from debug logs to prevent secret leakage.

---

## 🔒 Concurrency & Step Locks

To prevent race conditions where multiple campaign triggers execute the same sequence for the same contact at the same time:

- The engine creates a mutex record in the `automation_locks` table.
- A lock is keyed by the combination of `sequenceId` and `entityId` (contact ID).
- Locks expire automatically after 5 minutes to prevent permanent stalls if a worker process crashes unexpectedly.

---

## 📦 Execution Context & Checkpoints

- **Execution Context**: The engine tracks variables, contact states, and execution histories inside a JSON object stored in the database (`executionContext`).
- **Checkpoint Data**: When a sequence is paused, the worker saves the current step index and variables to `checkpointData` in SQLite before exiting. When restarted, the scheduler passes this data back to resume execution from the exact checkpoint.
