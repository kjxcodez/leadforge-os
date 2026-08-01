# ADR-004: Scoped Memory Model

## Status

Proposed

## Context

LeadForge OS requires multiple types of memory (conversation threads, workspace configuration state, long-term embeddings). Mixing these scopes into a single memory store would create security risks, data bloat, and context window issues. We need a scoped memory model that aligns with the local-first philosophy.

## Decision

We will establish a scoped memory model that separates memory into five distinct scopes:

1. **Conversation**: Tracks active chat sessions.
2. **Workspace**: Shared context across all agents in a workspace.
3. **Execution**: Short-lived context for a running scheduler job.
4. **Scratchpad**: Transient memory used during a single reasoning step.
5. **Semantic**: Stores embeddings of crawled text and successful outreach.

Memory scopes are governed by four dimensions: **Owner**, **Lifetime**, **Visibility**, and **Persistence**.

### Memory Dimensions Matrix

| Memory Scope     | Owner          | Lifetime       | Visibility (Shared?)          | Persistence (Storage)           |
| :--------------- | :------------- | :------------- | :---------------------------- | :------------------------------ |
| **Conversation** | Active Session | Session        | Single User (No)              | SQLite (`messages` table)       |
| **Workspace**    | Workspace      | Permanent      | Shared across Workspace (Yes) | SQLite (`settings` table)       |
| **Execution**    | Job            | Job            | Single Worker (No)            | In-Memory (Job payload context) |
| **Scratchpad**   | Planner        | Loop Iteration | Single Step (No)              | In-Memory (State variables)     |
| **Semantic**     | Workspace      | Permanent      | Shared across Workspace (Yes) | SQLite + `sqlite-vec` index     |

## Alternatives Considered

- **Single JSON Memory File**: Store all memory scopes in a single JSON file per workspace.
  - _Tradeoffs_: Hard to query, lacks vector search, and risks file corruption on concurrent writes.
- **Cloud Vector Host**: Sync embeddings to a cloud service (e.g. Pinecone).
  - _Tradeoffs_: Violates the local-first philosophy and exposes customer lead data to third parties.

## Tradeoffs

- **Pros**:
  - **Privacy**: All prospect data, templates, and chats remain local.
  - **Efficiency**: Separating scopes prevents LLM context windows from filling with irrelevant logs.
  - **Local-First RAG**: SQLite embeddings run locally with no cloud cost.
- **Cons**:
  - Requires setting up the `sqlite-vec` extension across target operating systems (Windows, macOS, Linux).

## Consequences

- The Agent Core exposes five distinct memory interfaces.
- Workspaces are physically isolated; agents in Workspace A cannot access Workspace B's memory.
