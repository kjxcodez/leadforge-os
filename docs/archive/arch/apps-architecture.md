# 3. Applications Architecture (apps/)

This section audits the current application space and outlines the architectural rules governing each application directory.

---

## 1. Current Applications Audit

### 1.1 `apps/desktop`

- **Purpose**: Serve as the core client executable environment.
- **Responsibilities**:
  - Manage the Electron native window shell, menus, tray, and update cycles.
  - Render the single-page React frontend application.
  - Coordinate local tasks and SQLite database writes.
- **Dependencies**: React, Vite, Tailwind CSS v4, `@electron-toolkit/utils`, and Electron core dependencies.
- **Forbidden Responsibilities**:
  - Direct execution of heavy Playwright scraping runs on the main user interface thread.
  - Directly running cloud sync API operations without routing through isolated adapter layers.
- **Expected Scale**: Handles up to 500k+ active locally-cached leads and records per client machine.

### 1.2 `apps/docs`

- **Purpose**: Canonical engineering manual and product specifications.
- **Responsibilities**: Detail design systems, database indexes, and architecture structures.
- **Dependencies**: None. Contains static markdown files.
- **Forbidden Responsibilities**: Must never contain compiled project source code or operational binary assets.
- **Expected Scale**: Maintained as a repository index for 100+ developers.

---

## 2. Recommended Future Applications

To support Horizon 2 and Horizon 3 transitions, the following application shells are recommended to be added to `apps/`:

### 2.1 `apps/worker` (Horizon 2)

- **Purpose**: Isolated background execution nodes.
- **Responsibilities**: Poll queues, execute heavy-duty web scraping (Playwright), email verification verification, and document parsing.
- **Dependencies**: Playwright, `packages/logger`, `packages/shared`.
- **Forbidden Responsibilities**: Displaying any user interfaces or writing directly to SQLite databases.
- **Expected Scale**: Scales dynamically as headless cloud containers or local child processes.

### 2.2 `apps/api` (Horizon 3)

- **Purpose**: Cloud synchronization REST/gRPC API.
- **Responsibilities**: Sync client workspaces, manage user accounts, handle billing, and coordinate remote queues.
- **Dependencies**: Fastify, Prisma, PostgreSQL.
- **Forbidden Responsibilities**: Running Electron or Chromium native window setups.
- **Expected Scale**: Highly available server-side cluster handling millions of API sync requests.
