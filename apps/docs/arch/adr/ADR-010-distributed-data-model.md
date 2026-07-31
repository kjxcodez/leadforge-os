# ADR-010: Distributed Data Model

## Status
Proposed

## Context
LeadForge is Local-First but supports cloud synchronization. Future application interfaces (web, mobile, external APIs) must share synchronized workspace states. However, the desktop app must operate 100% offline. We need a clear architecture defining database roles, tenancy, conflict resolution, and data ownership.

## Decision
We establish the following distributed data model:
1. **Primary execution DB**: SQLite. Each desktop workspace writes to a separate local `<workspaceId>.db` file.
2. **Sync hub DB**: MongoDB Atlas. MongoDB aggregates workspace databases in the cloud.
3. **Flow Direction**: Desktop execution writes strictly to SQLite, which the Sync Engine asynchronously replicates to MongoDB. The desktop application NEVER queries MongoDB Atlas directly for local UI rendering or task execution.
4. **Repository Isolation**: The business logic interacts exclusively with abstract repositories (e.g. `LeadRepository`). Concrete repository implementations manage underlying SQLite statements.

## Alternatives Considered
* **Direct Cloud Write**: Write to MongoDB Atlas directly from the desktop, writing to SQLite as a cache fallback.
  * *Tradeoffs*: Complex sync logic, slow latency, breaks full offline guarantees.

## Tradeoffs
* **Pros**:
  * **Offline Guarantee**: The desktop app runs identically with or without network.
  * **Collaborative Cloud**: MongoDB Atlas provides a scalable foundation for future web and mobile apps.
  * **Strict Isolation**: Workspace separation is guaranteed at the SQLite file level.
* **Cons**:
  * Requires maintaining a continuous replication sync queue.

## Consequences
* We define clean Repository abstractions in `@leadforge/database`.
* Database drivers are completely hidden from business logic.
