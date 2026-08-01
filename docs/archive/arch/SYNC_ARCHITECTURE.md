# Synchronization Architecture

The Sync Engine is responsible for matching states between local SQLite databases and MongoDB Atlas cloud collections. It operates as an asynchronous, non-blocking background queue to protect offline local execution.

---

## Sync Engine Responsibilities

The Sync Engine manages replication and change tracking with these core duties:

1. **Change Detection**: Monitors local database modifications using SQLite `UPDATE`/`INSERT` hooks or an explicit local outbox table (`sync_outbox`).
2. **Outbound Synchronization**: Batches and sends local change records to MongoDB Atlas when internet connectivity is available.
3. **Inbound Synchronization**: Pulls cloud modifications since the last sync timestamp and applies them locally.
4. **Conflict Detection & Resolution**: Resolves differences between local and cloud states using a Last-Write-Wins (LWW) resolution rule.
5. **Robust Retry Loop**: Implements exponential backoff with jitter to handle intermittent network losses.
6. **Data Transport Optimization**: Compresses and batches sync payloads to reduce network overhead.
7. **Workspace Filtering**: Restricts operations to the active workspace ID to preserve tenant isolation boundaries.

---

## Architectural Boundaries

To ensure stability, the Sync Engine is highly isolated from other platform operations:

```text
                  [ Core Platform Abstractions ]
                   /                          \
            (Sync Engine)                 (Agent Platform)
                 |                               |
    ┌────────────┴────────────┐                  ├─────────────────────────────┐
    ▼                         ▼                  ▼                             ▼
Change Tracking           Replication     Orchestration Planners        Tool Execution
    X (No AI Execution)       X (No Tools)       X (No Sync Control)           X (No Sync Outbox)
```

* **No AI Execution**: The Sync Engine must never call LLMs or prompts.
* **No Planners or Loops**: The Sync Engine does not interact with agent routing or execution loops.
* **No Direct Tool Invocation**: Tools do not trigger the sync queue directly. Synchronization is an automatic database-level observer side-effect.

---

## Data Transport Flow

```text
Local SQLite Write ──► outbox Entry ──► SyncEngine ──► Batching & Compression ──► MongoDB Atlas
                                                                                      │
                                                                                 (WS Listeners)
                                                                                      │
                                                                                      ▼
                                                                               Push Notification
                                                                                      │
                                                                                      ▼
                                                                             Inbound Local Sync
```
1. **Outbox Log**: Local writes write change records to a `sync_outbox` table.
2. **Batching**: The Sync Engine compiles logs into a compressed JSON payload.
3. **Transmission**: The Engine executes a secure POST request to the Atlas API with a transaction version stamp.
4. **Conflict Verification**: The server validates version stamps, updates MongoDB documents, and broadcasts changes to other active clients.
