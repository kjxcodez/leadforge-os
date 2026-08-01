# Distributed Data Architecture

LeadForge OS follows a Local-First, Cloud-Synchronized distributed data architecture. This model enables full offline operations on the desktop while supporting real-time workspace collaboration across desktop, web, mobile, and external API interfaces.

---

## Architectural Philosophy

```text
  Desktop Clients (Offline First)
          │
          ▼ [Writes]
    SQLite Database (Local State & Execution Source of Truth)
          │
          ▼ [Change Tracking / Write-Ahead Log]
     Sync Engine (Asynchronous Queue)
          │
          ▼ [Synchronize]
   MongoDB Atlas (Global State Consolidation & Cloud Source of Truth)
          │
     ┌────┴───────────────┐
     ▼                    ▼
Web Application      Mobile Application
```

---

## Database Roles & Boundaries

### 1. SQLite Database (Execution Store)

- **Location**: Local user directory.
- **Role**: Primary execution database. All application logic, crawling, email parsing, CRM pipelines, and scheduler runs query and write to this local SQLite instance.
- **Guarantees**: Under 5ms query response times, 100% offline functionality.

### 2. MongoDB Atlas (Global Consolidation Store)

- **Location**: Cloud.
- **Role**: Distributed synchronization hub. Collects change records from desktop apps and consolides them to support web/mobile views.
- **Guarantees**: Workspace tenant isolation, high availability, cross-platform sync source.

---

## Repository Layer Boundaries

The application logic must remain oblivious to the underlying database technologies. The database layer is encapsulated by standard repository interfaces:

- **`LeadRepository`**: Queries and updates leads.
- **`CompanyRepository`**: Queries and updates discovered company profiles.
- **`ContactRepository`**: Manages prospect contacts.
- **`CampaignRepository`**: Controls email outreach sequences and drip rules.
- **`WorkflowRepository`**: Manages sequence execution logs and automation configurations.
- **`AgentMemoryRepository`**: Reads and writes scoped agent memories.

```typescript
export interface LeadRepository {
  getById(id: string): Promise<Lead | null>;
  save(lead: Lead): Promise<void>;
  listByWorkspace(workspaceId: string): Promise<Lead[]>;
  delete(id: string): Promise<void>;
}
```

_Note: SQLite-specific connections (`better-sqlite3`) and MongoDB drivers are restricted to their concrete implementations inside the database module._

---

## Synchronization & Conflict Strategy

### 1. Conflict Resolution (Last-Write-Wins)

Every entity contains an `updatedAt` ISO-8601 timestamp and a `version` integer stamp. When syncing conflict states between local SQLite and cloud MongoDB, the record with the most recent `updatedAt` timestamp overwrites the older state.

### 2. Deletions (Tombstoning)

Records are never immediately deleted from the database. Instead, they are soft-deleted by setting `deletedAt = timestamp`. The Sync Engine transmits the soft-delete tombstone to MongoDB, which propagates the deletion flag to other connected clients. Periodic garbage collection sweeps purge tombstoned records after 30 days.

### 3. Workspace Isolation

Isolation is enforced at the database level:

- **SQLite**: Each workspace is stored in a separate SQLite database file (`<workspaceId>.db`).
- **MongoDB**: Every collection index requires `workspaceId` as a partition key. All queries are filtered by `workspaceId` to prevent cross-tenant leakages.
