# Tool Catalog Specifications

This specification defines the `ToolCatalog` structure, which separates tool discovery metadata from the concrete runtime registration and execution engine (`ToolRegistry`).

---

## Catalog vs. Registry Responsibilities

| Subsystem          | Primary Responsibility                                                  | Dependency Footprint                                 | Usage Phase                |
| :----------------- | :---------------------------------------------------------------------- | :--------------------------------------------------- | :------------------------- |
| **`ToolCatalog`**  | Holds metadata profiles of all available capabilities for discovery.    | Zero runtime dependencies (JSON/Static Schema only). | Planning & Agent Reasoning |
| **`ToolRegistry`** | Registers, resolves, and manages concrete tool instances for execution. | Requires adapters and connection scopes.             | Execution Phase            |

---

## Tool Metadata Schema

Every tool catalog entry must expose a structured profile containing the following metadata:

- **`identity`**: Unique string key (e.g., `crawl_company_website`).
- **`displayName`**: User-friendly label.
- **`description`**: Detailed description explaining _why_ and _when_ an agent should select this tool.
- **`categories`**: Array of classifications (e.g. `['Scraper', 'Discovery']`).
- **`tags`**: List of identifiers for keyword lookup.
- **`requiredCapabilities`**: Infrastructure features needed (e.g. `['browser']`).
- **`requiredPermissions`**: User authorization boundaries (e.g., `['network:outbound', 'file:write']`).
- **`riskLevel`**: `LOW` | `MEDIUM` | `HIGH`.
- **`estimatedDuration`**: Baseline duration in milliseconds (e.g., `60000` for deep crawling).
- **`supportsCancellation`**: Boolean flag.
- **`supportsStreaming`**: Boolean flag.
- **`requiresBrowser`**: Boolean flag.
- **`requiresNetwork`**: Boolean flag.
- **`requiresHumanApproval`**: Boolean flag (overrides safety loops if true).
- **`sideEffects`**: Description of state mutations (e.g., "Updates CRM sequence status").
- **`version`**: Semantic version string.

---

## Standard Catalog Entries

The catalog contains the following pre-defined profiles:

1. **`search_local_businesses`**: Google Maps discovery.
2. **`crawl_website`**: Targeted page scraper.
3. **`linkedin_enrichment`**: Contact scraper.
4. **`send_email`**: SMTP email sender (Risk: `HIGH`, requires approval).
5. **`imap_reply_check`**: IMAP reply checking.
6. **`crm_update`**: SQLite mutations.
7. **`workflow_execute`**: Resumes sequence events.
8. **`query_logs`**: System audit queries.

---

## Reasoning Flow

```text
    [ Agent Planner ] ──► Queries ToolCatalog ──► Selects "crawl_website"
            │
            ▼
    [ Agent Framework ] ──► Requests "crawl_website" from ToolRegistry
            │
            ▼
    [ ToolRegistry ] ──► Resolves CrawlWebsiteTool class and executes it
```

This decoupling allows planners to run offline or in remote serverless nodes without importing desktop-specific libraries or sqlite databases.
