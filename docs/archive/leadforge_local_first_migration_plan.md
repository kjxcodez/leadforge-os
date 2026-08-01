# LeadForge OS — Master Local-First Migration Roadmap

## Executive Summary

This document outlines the master technical roadmap for migrating LeadForge OS from its current network-coupled, renderer-orchestrated state to a desktop-first, local-first architecture.

Currently, LeadForge OS acts as a client querying a remote Hono API directly. Offline synchronization, scraper invocations, and automation checks are managed from the fragile React UI thread. This design introduces high latency, makes the app unusable offline, Couples UI components directly to the network state, and risks UI freezing during heavy scrapers or SMTP workloads.

The target architecture relocates all business execution and synchronization logic into the Electron Main process and isolated Node worker processes:

1. **SQLite is the Primary Operational Database**: The UI only queries local workspace-scoped SQLite databases.
2. **Hono API & MongoDB Atlas act as Sync Target**: The remote backend only serves as a backup, sync repository, and multi-tenant collaboration engine, not an execution engine.
3. **Electron Main Supervises Runtime**: Main manages isolated, tenant-specific `WorkspaceRuntime` instances.
4. **Sandboxed Worker Host**: Heavy processes (headless browser scraping, Cheerio crawling, SMTP campaigns) run in isolated Node child processes (`child_process.fork`).
5. **Generic Job Runtime & Scheduler**: Tasks are queued as Jobs in SQLite and dispatched based on priority and concurrency rules.
6. **Local Event Bus & Plugin Registry**: Services communicate asynchronously through events. Capabilities are registered as extensible plugins (Actions, Conditions, and Scrapers).

This migration roadmap breaks down the transition into 7 logical milestones and 31 atomic, independent tasks, each designed to take between 30–90 minutes to implement and verify.

---

## Architecture Review

### Current Flows & Responsibilities

```
+-----------------------------------------------------------------------------+
|                                  RENDERER                                   |
|   +--------------------------+               +--------------------------+   |
|   |         React UI         |               |        SyncWorker        |   |
|   | - Displays views         |               | - Poller loops (60s)     |   |
|   | - Holds query cache      |               | - Calls Hono SDK directly|   |
|   +------------+-------------+               +------------+-------------+   |
|                |                                          |                 |
|                | IPC ('db:save')                          | IPC ('db:queue:push')
|                ▼                                          ▼                 |
+-----------------------------------------------------------------------------+
|                               PRELOAD BRIDGE                                |
|   - Exposes raw Hono SDK channels ('workspaces:create', 'discovery:list')   |
|   - Exposes raw SQLite CRUD channels ('db:find', 'db:save', 'db:queue:*')   |
+-----------------------------------------------------------------------------+
|                              ELECTRON MAIN                                  |
|   - Binds Hono SDK instance and coordinates IPC bridges                    |
|   - Manages one global SQLite file at `userData/leadforge.db`               |
+-----------------------------------------------------------------------------+
|                                HONO REST API                                |
|   - Receives Hono SDK requests and updates MongoDB Atlas                    |
|   - Performs stubbed discovery searches and triggers automation workflows    |
+-----------------------------------------------------------------------------+
```

- **Current Data Flow**: The React Renderer requests data by directly invoking remote Hono API channels or writing directly to SQLite via low-level IPC channels (`db:find`, `db:save`). Synchronization is triggered by a polling loop in the UI.
- **Current Startup Flow**: Electron Main boots, initializes one SQLite database (`userData/leadforge.db`), runs migrations, exposes Hono SDK-bound IPC handlers, and loads the BrowserWindow. The renderer starts, registers TanStack React Query, and triggers `SyncWorker.start()`.
- **Current IPC Flow**: Preload bridge acts as an open relay for raw database operations and remote API routes. No scoping, filtering, or transaction boundaries are enforced in Main.
- **Current SDK Flow**: `@leadforge/sdk` wraps HTTP endpoints using `fetch`. The renderer calls this SDK over IPC to load/save remote data.
- **Current Sync Flow**: Renderer-orchestrated. `SyncWorker` polls the SQLite `sync_queue` via IPC, calls remote HTTP SDK methods, and then updates SQLite back via IPC. If the UI tab hangs, sync stops.
- **Current Discovery Flow**: Stubs inside the Hono API routes return mock JSON payloads. Google Maps scraping is not integrated into the desktop app; it remains in the old CLI worker.
- **Current Automation Flow**: Executed on the backend in MongoDB when mutations arrive. Stubs exist in the `packages/workflows` package but are not run locally.
- **Current Worker Flow**: The old CLI worker runs as a standalone process communicating directly with MongoDB Atlas via Mongoose. It has no integration with Electron.
- **Electron Main Responsibilities**: Boot window, hold active auth token, run SQLite migrations, forward IPC messages.
- **Renderer Responsibilities**: State storage, scheduling synchronization ticks, processing offline sync queues, rendering views.
- **API Responsibilities**: Primary database storage (MongoDB), user authentication, CRM logic, workflow tracking.

---

## Gap Analysis

### 1. Desktop & IPC Subsystem

- **Current**: Renderer directly invokes SDK channels (e.g. `companies:create`) and raw DB queries (`db:save`). Preload exposes both.
- **Problem**: Tight coupling of UI to the network. Vulnerable to database leakage and crash loops if network times out. No workspace boundary in IPC.
- **Target**: Renderer has zero access to Hono SDK or raw DB commands. IPC is restricted to clean domain channels (e.g. `crm:companies:get`, `jobs:start`). Main marshals all network queries.
- **Migration Strategy**: Retract Hono SDK calls from Renderer. Replace with unified local workspace repositories. Remove raw `db:*` IPC channels and update Preload bridge validator list.

### 2. SQLite & Repository Subsystem

- **Current**: Single SQLite file at `userData/leadforge.db`. Scoping done manually by passing `workspaceId` through IPC filters.
- **Problem**: Risk of workspace database leakage. Multi-threading write locking (`SQLITE_BUSY`) when workers execute tasks.
- **Target**: Workspace isolation via workspace-specific SQLite files (`leadforge_${workspaceId}.db`). Dedicated connection pool configured with WAL (Write-Ahead Logging), busy timeout, and transaction locks managed exclusively by Electron Main.
- **Migration Strategy**: Implement a `WorkspaceRuntime` in Electron Main that opens a dedicated connection to `leadforge_${workspaceId}.db`. Update the schema runner to deploy migrations to newly loaded workspace databases.

### 3. Sync Engine

- **Current**: Renderer `SyncWorker` periodically pops from SQLite queue, makes API calls over IPC, and reconciles local state.
- **Problem**: High CPU consumption on the UI thread, fragile connection listeners, and race conditions leading to duplicate sync records.
- **Target**: Single `SyncEngine` class in Electron Main. Polls SQLite `sync_queue` table in the background, pushes mutations in order (FIFO), and pulls remote changes periodically using Last-Write-Wins (LWW) conflict resolution.
- **Migration Strategy**: Port the `SyncWorker` and `QueueProcessor` logic from the renderer into the Main process `SyncEngine`. Register it inside the `WorkspaceRuntime` class.

### 4. Job Runtime & Priority Scheduler

- **Current**: Does not exist. Scrapers and outreach scripts run manually via CLI or are stubbed.
- **Problem**: Impossible to scale heavy tasks like Playwright scraping within the desktop shell without blocking the UI thread.
- **Target**: Sandboxed Node processes spawned via `child_process.fork`. Main coordinates jobs via a priority-based, crash-resilient `JobScheduler` reading from the SQLite `jobs` table.
- **Migration Strategy**: Implement a generic Worker Host process. Build a scheduler tick in Main that queries queued jobs, evaluates concurrency settings, forks workers, and registers heartbeats.

### 5. Event Bus Subsystem

- **Current**: Direct service-to-service calls or stubbed API hooks on MongoDB.
- **Problem**: High coupling. Adding analytics or notification triggers requires editing core scraper or email code.
- **Target**: A class-based local `EventBus` inside each workspace runtime. Services emit events (e.g., `discovery:completed`), and decoupled listeners execute handlers.
- **Migration Strategy**: Create `LocalEventBus` in packages/core or desktop main. Wire the job scheduler and repository layers to dispatch events onto the bus.

### 6. Automation & Plugin Registries

- **Current**: Automation sequences evaluated on MongoDB via REST APIs. Hardcoded condition evaluations.
- **Problem**: Workflows do not work offline. Adding a new trigger or action requires changes to core API services.
- **Target**: Pluggable action executors (`AutomationActionPlugin`) and condition evaluators (`ConditionPlugin`) registered in a local registry. Evaluated inside the local database environment.
- **Migration Strategy**: Implement the plugin registries in the Main process workspace runtime. Port the API's automation logic to evaluate events against SQLite-stored sequences.

---

## Old Worker Audit & Migration

The old CLI worker implementation contains functional scrapers, emailers, and data normalizers. The table below outlines how these components will be integrated into the desktop app:

| Old CLI Worker Component          | Target Desktop Runtime Action             | Migration Type     | Technical Rationale                                                                                        |
| :-------------------------------- | :---------------------------------------- | :----------------- | :--------------------------------------------------------------------------------------------------------- |
| `src/commands/discover.ts`        | `GoogleMapsJob` plugin inside workers     | **Rewrite & Port** | Scrapers must write directly to local SQLite databases rather than MongoDB Atlas via Mongoose.             |
| `src/commands/contacts.ts`        | `WebsiteCrawlerJob` plugin inside workers | **Rewrite & Port** | Relocate site crawling (Cheerio/Playwright) to the generic worker, caching raw HTML in SQLite.             |
| `src/commands/enrich.ts`          | `EnrichmentJob` plugin inside workers     | **Port**           | Move deterministic enrichment rules into a local job.                                                      |
| `src/commands/outreachExecute.ts` | `EmailCampaignJob` plugin inside workers  | **Rewrite & Port** | Move SMTP dispatch from the CLI into the background worker host, logging outcomes to `system_logs`.        |
| `src/commands/reconcile.ts`       | `OutreachReconciliationJob` plugin        | **Port**           | Move outreach lock cleanup and metrics compilation into a periodic maintenance task.                       |
| `src/commands/migrate.ts`         | None                                      | **Remove**         | MongoDB document migration is deprecated; SQLite utilizes tabular structure with migrations.               |
| `src/commands/projections.ts`     | None                                      | **Remove**         | Local SQLite queries generate dynamic metrics; pre-calculated Mongoose dashboard projections are obsolete. |
| `src/services/workspace.ts`       | Main `WorkspaceRuntime` class             | **Rewrite**        | Replace CLI-specific workspace configuration loaders with Main process connection initializers.            |

---

## Migration Strategy

The migration follows a bottom-up sequence to prevent build breaking and ensure step-by-step testability:

```
[Step 1: DB & IPC Cleanout] -> [Step 2: Workspace Runtimes] -> [Step 3: Job Scheduler]
                                                                        |
[Step 7: DevTools UI] <------- [Step 6: Sync Engine] <------- [Step 4/5: Worker & Plugins]
```

1.  **Phase 1: DB & IPC Cleanout**: Implement the unified schema in SQLite, lock down the preload bridge, and refactor renderer repositories to write to SQLite first.
2.  **Phase 2: Workspace Runtimes**: Introduce the local Event Bus and wrap connections inside `WorkspaceRuntime` classes managed by a supervisor.
3.  **Phase 3: Job Scheduler**: Implement the priority queue scheduler and child process fork orchestration.
4.  **Phase 4: Porting Workers**: Migrate the old scraper, website crawler, and outreach handlers into worker-compatible plugins.
5.  **Phase 5: Automation Registry**: Build the Action and Condition registry to execute sequences locally.
6.  **Phase 6: Sync Engine**: Implement the main-process synchronization loop with Last-Write-Wins logic.
7.  **Phase 7: DevTools UI**: Create a visual developer dashboard inside the renderer to inspect logs, jobs, events, and sync records.

---

## Milestone 1: Database & IPC Restructuring

### Task 1.1: Define Unified local-first SQLite Schemas

- **Goal**: Add `jobs`, `sync_queue`, and `system_logs` tables to the SQLite migrations runner.
- **Why**: Supports generic job execution, unified synchronization, and offline diagnostics.
- **Files**:
  - `[MODIFY]` [runner.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/runner.ts)
- **Dependencies**: None.
- **Deliverables**: Migrations `005_jobs_and_sync_schema` added to `MIGRATIONS` array in `runner.ts`.
- **Verification**: Run the app locally and verify the migrations execute cleanly with no SQL syntax errors.
- **Exit Criteria**: Local SQLite database contains `jobs`, `sync_queue`, and `system_logs` tables with all columns and indexes initialized.

### Task 1.2: Implement Workspace Isolation Database Connections

- **Goal**: Refactor the database connection layer to open workspace-specific database files (`leadforge_${workspaceId}.db`).
- **Why**: Guarantees physical data isolation between workspaces and simplifies localized sync cycles.
- **Files**:
  - `[MODIFY]` [connection.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/connection.ts)
- **Dependencies**: Task 1.1.
- **Deliverables**: Refactored `getDatabase(workspaceId: string)` method that stores and retrieves SQLite connections mapped by workspace ID.
- **Verification**: Spawn two database instances for different workspace IDs and check that separate `.db` files are created in the filesystem.
- **Exit Criteria**: Database helper exposes workspace-scoped connections configured with WAL journal mode, normal synchronization, and a 5000ms busy timeout.

### Task 1.3: Clean Preload Bridge & Restrict IPC Channels

- **Goal**: Remove all raw database query channels (`db:find`, `db:save`) and remote Hono SDK invokes from the preload file. Expose only secure domain-specific IPC wrappers.
- **Why**: Prevents the renderer UI from running arbitrary SQL strings or bypassing the sync engine by making direct remote writes.
- **Files**:
  - `[MODIFY]` [index.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/preload/index.ts)
- **Dependencies**: Task 1.2.
- **Deliverables**: Restricted preload bridge exposing only approved channels like `crm:companies:get`, `crm:companies:save`, `jobs:start`.
- **Verification**: Attempt to call `window.ipc.invoke('db:save')` from the browser console and verify it throws an unauthorized channel exception.
- **Exit Criteria**: Build succeeds and the preload bridge contains no raw database query string parameters.

### Task 1.4: Build Main-Process Repository Layer

- **Goal**: Create a backend repository layer in Electron Main that wraps database queries, handles transactions, and inserts records into `sync_queue` on mutations.
- **Why**: Decouples the database engine from IPC communication and ensures that every local database edit automatically schedules a sync action.
- **Files**:
  - `[NEW]` `apps/desktop/src/main/database/repositories/company.ts`
  - `[NEW]` `apps/desktop/src/main/database/repositories/contact.ts`
  - `[NEW]` `apps/desktop/src/main/database/repositories/campaign.ts`
- **Dependencies**: Task 1.2.
- **Deliverables**: Complete local repository implementations in Main executing scoped SQLite queries inside WAL transaction blocks.
- **Verification**: Unit test the repositories to verify that saving a company inserts a corresponding `CREATE` or `UPDATE` record into the `sync_queue` table.
- **Exit Criteria**: CRUD operations on local repositories successfully update SQLite tables and automatically append sync logs inside the same transaction.

### Task 1.5: Refactor Renderer Repositories

- **Goal**: Rewrite renderer repositories to read/write exclusively through local SQLite IPC channels, removing any SWR network polling.
- **Why**: Decouples the UI thread from remote network states.
- **Files**:
  - `[MODIFY]` [sync.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/sync.ts)
  - `[MODIFY]` [remote.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/repositories/remote.ts)
- **Dependencies**: Task 1.3, Task 1.4.
- **Deliverables**: Refactored `sync.ts` repositories that execute local IPC calls and rely on the Main process to perform network synchronization.
- **Verification**: Run the application in offline mode, add a company, verify it displays instantly in the UI, and verify that the sync queue contains a pending record.
- **Exit Criteria**: The renderer packages contain no remote HTTP fetch statements.

---

## Milestone 2: Workspace Runtimes & Local Event Bus

### Task 2.1: Implement Local Event Bus Class

- **Goal**: Build a thread-safe `LocalEventBus` class in Electron Main to manage pub/sub subscriptions.
- **Why**: Decouples services inside Electron Main, allowing background worker state changes to trigger automation checks or notifications asynchronously.
- **Files**:
  - `[NEW]` `apps/desktop/src/main/lib/event-bus.ts`
- **Dependencies**: None.
- **Deliverables**: `LocalEventBus` class supporting `publish`, `subscribe`, and `unsubscribe` with strongly typed events.
- **Verification**: Create a test script subscribing to `job:completed`, publish a mock event, and verify the listener receives the payload.
- **Exit Criteria**: Event bus handles generic payloads safely without blocking the Main process main loop.

### Task 2.2: Create WorkspaceRuntime Class

- **Goal**: Implement the `WorkspaceRuntime` class to orchestrate the database connection, Event Bus, Sync Engine, and Job Scheduler instances for a single workspace.
- **Why**: Provides isolated execution environments when switching between workspaces.
- **Files**:
  - `[NEW]` `apps/desktop/src/main/lib/workspace-runtime.ts`
- **Dependencies**: Task 1.2, Task 2.1.
- **Deliverables**: Complete `WorkspaceRuntime` model carrying instances of the local event bus, scheduler, sync engine, and SQLite connection.
- **Verification**: Instantiate a workspace runtime and check that all sub-components are initialized correctly.
- **Exit Criteria**: `WorkspaceRuntime` exposes `start()` and `stop()` methods that initialize or clean up sub-services.

### Task 2.3: Build Workspace Active Lifecycle Manager

- **Goal**: Implement a supervisor class in Electron Main that manages the life cycle of active workspace runtimes, swapping them when the user switches workspaces.
- **Why**: Prevents concurrent database locks and ensures only active workspaces consume system resources.
- **Files**:
  - `[NEW]` `apps/desktop/src/main/lib/workspace-manager.ts`
  - `[MODIFY]` [index.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/index.ts)
- **Dependencies**: Task 2.2.
- **Deliverables**: `WorkspaceManager` class with `setActiveWorkspace(workspaceId)` method that spins down the active runtime and boots the new one.
- **Verification**: Trigger a workspace swap from the UI and verify that the database files switch and previous polling loops are stopped.
- **Exit Criteria**: Main process handles workspace transitions cleanly, closing previous SQLite file descriptors.

### Task 2.4: Implement Structured Three-Way Logger

- **Goal**: Build a runtime logging service that writes to the local SQLite `system_logs` table, rotating JSONL files on the filesystem, and streams logs to the UI.
- **Why**: Provides comprehensive diagnostics for users and developers without slowing down the UI thread.
- **Files**:
  - `[NEW]` `apps/desktop/src/main/lib/logger.ts`
- **Dependencies**: Task 1.1.
- **Deliverables**: Unified logger class supporting `info`, `warn`, and `error` severities.
- **Verification**: Write logs, check that they populate `system_logs`, confirm a `.jsonl` file is written to `userData/logs/`, and confirm an IPC message is broadcast to the renderer.
- **Exit Criteria**: Logs are captured in all three sinks. Rotation cleans up JSONL files older than 10 days.

---

## Milestone 3: Worker Runtime & Concurrency Scheduler

### Task 3.1: Define Pluggable Job Interfaces

- **Goal**: Create core type definitions for background jobs, execution payloads, context builders, and job plugins.
- **Why**: Standardizes worker plugins so new scraping or enrichment steps can be added without modifying the scheduler.
- **Files**:
  - `[NEW]` `apps/desktop/src/shared/types/job.ts`
- **Dependencies**: None.
- **Deliverables**: TypeScript interfaces for `JobContext`, `JobPlugin`, and `JobPayload`.
- **Verification**: Run compiler check (`tsc --noEmit`) to verify types compile cleanly.
- **Exit Criteria**: Types compile without errors and are shareable between the Main process and forked child workers.

### Task 3.2: Create Job Concurrency Scheduler

- **Goal**: Implement the `JobScheduler` class in Electron Main. It queries pending SQLite jobs every second and dispatches them based on priority and concurrency limits.
- **Why**: Protects local CPU resources and prevents rate-limit bans on target sites.
- **Files**:
  - `[NEW]` `apps/desktop/src/main/services/scheduler.ts`
- **Dependencies**: Task 1.1, Task 3.1.
- **Deliverables**: `JobScheduler` class with a non-blocking `tick()` method.
- **Verification**: Queue five jobs in SQLite with different priorities, verify that they are fetched in priority order, and verify that the number of concurrently running jobs does not exceed the limit.
- **Exit Criteria**: Scheduler accurately tracks running job limits, handles priority orders, and updates database records to `running`.

### Task 3.3: Implement Worker Host Entrypoint

- **Goal**: Create a standalone Node worker script (`worker-host.ts`) that runs in a spawned child process, resolves the requested `JobPlugin`, and executes it.
- **Why**: Isolates long-running browser processes from the main desktop thread.
- **Files**:
  - `[NEW]` `apps/desktop/src/main/workers/worker-host.ts`
- **Dependencies**: Task 3.1.
- **Deliverables**: Executable Node script that imports registered plugins and communicates with Main using process IPC.
- **Verification**: Spawn the worker script manually and pass a mock task via `process.send`. Verify that it replies with a progress update.
- **Exit Criteria**: Worker host script runs outside the Electron Main process and receives message payloads.

### Task 3.4: Build Process Spawn and IPC Handler

- **Goal**: Implement the worker runner in Electron Main that calls `child_process.fork`, sets up environment variables, and listens for process messages.
- **Why**: Facilitates bi-directional communication between the supervisor and child workers.
- **Files**:
  - `[NEW]` `apps/desktop/src/main/services/worker-runner.ts`
- **Dependencies**: Task 3.2, Task 3.3.
- **Deliverables**: Process launcher wrapper that spawns the worker host and forwards progress, logs, and success states to the Event Bus.
- **Verification**: Start a job and verify that child process logs are successfully written to the Main process terminal.
- **Exit Criteria**: Forked processes are registered by Main, and message payloads are routed to the workspace Event Bus.

### Task 3.5: Implement Job Heartbeats & Status Tracking

- **Goal**: Build a heartbeat check that monitors child process status and updates the SQLite `jobs` table if a worker crashes.
- **Why**: Prevents jobs from getting stuck in a `running` state if a process crashes.
- **Files**:
  - `[MODIFY]` `apps/desktop/src/main/services/scheduler.ts`
  - `[MODIFY]` `apps/desktop/src/main/services/worker-runner.ts`
- **Dependencies**: Task 3.4.
- **Deliverables**: Status monitor that registers worker exit codes and updates database records to `failed` or `interrupted` if a worker crashes.
- **Verification**: Force-kill a running worker process and verify that the scheduler catches the exit and updates its database status.
- **Exit Criteria**: Worker process crashes are handled, database statuses are updated, and resources are cleaned up.

### Task 3.6: Implement Job Cancellation & Recovery

- **Goal**: Implement job cancellation handlers that send kill signals to child processes and restore database states.
- **Why**: Allows users to halt long-running scrapers or outreach processes safely.
- **Files**:
  - `[MODIFY]` `apps/desktop/src/main/services/scheduler.ts`
  - `[MODIFY]` `apps/desktop/src/main/services/worker-runner.ts`
- **Dependencies**: Task 3.5.
- **Deliverables**: Kill wrappers sending `SIGTERM` signals to child processes and updating job statuses to `cancelled`.
- **Verification**: Trigger a cancellation event from IPC and check that the child process stops immediately and the database state updates.
- **Exit Criteria**: Processes terminate on request and the database returns to a stable state.

---

## Milestone 4: Migration & Porting of Background Jobs

### Task 4.1: Port Google Maps Playwright Scraper

- **Goal**: Port the Google Maps scraper from the old worker package into a desktop-compatible `JobPlugin`.
- **Why**: Integrates LeadForge's core search feature into the desktop application.
- **Files**:
  - `[NEW]` `apps/desktop/src/main/workers/plugins/google-maps-scraper.ts`
- **Dependencies**: Milestone 3, old worker source `google-maps.ts`.
- **Deliverables**: Completed `GoogleMapsScraperPlugin` class that executes search queries, parses cards, and updates company cache tables.
- **Verification**: Run the scraper plugin inside a worker thread, scrape Google Maps for a sample business query, and verify that the company details are saved to SQLite.
- **Exit Criteria**: Scraped results are saved to the workspace database. Playwright launches in headless mode and cleans up resources on completion.

### Task 4.2: Port Website Contact Crawler

- **Goal**: Port the Playwright and Cheerio website crawler from the old worker into a `JobPlugin`.
- **Why**: Finds emails, phone numbers, and social profiles directly from discovered websites.
- **Files**:
  - `[NEW]` `apps/desktop/src/main/workers/plugins/website-crawler.ts`
- **Dependencies**: Task 4.1, old worker source `website-crawler.ts`.
- **Deliverables**: Completed `WebsiteCrawlerPlugin` class that crawls pages, extracts details, and validates contacts.
- **Verification**: Crawl a test domain, confirm that it extracts contact profiles, and verify that the results are saved to the contacts table in SQLite.
- **Exit Criteria**: Contacts are successfully crawled and saved to SQLite with appropriate confidence scores.

### Task 4.3: Port SMTP Outreach dispatcher

- **Goal**: Port the email outreach execution and test-sending scripts into a `JobPlugin`.
- **Why**: Allows outreach campaigns to run locally.
- **Files**:
  - `[NEW]` `apps/desktop/src/main/workers/plugins/smtp-dispatcher.ts`
- **Dependencies**: Milestone 3, old worker source `outreachExecute.ts`.
- **Deliverables**: `SmtpDispatcherPlugin` class that sends emails, handles daily limits, and logs outreach events.
- **Verification**: Send a test email, verify that the email is received, and check that the status in the outreach log updates to `sent`.
- **Exit Criteria**: Emails are sent successfully, and outcomes are saved to SQLite.

### Task 4.4: Port Scoring & Enrichment Job

- **Goal**: Port the contact profile scoring and enrichment jobs.
- **Why**: Automatically filters leads that match target ICP profiles.
- **Files**:
  - `[NEW]` `apps/desktop/src/main/workers/plugins/enrichment.ts`
- **Dependencies**: Milestone 3, old worker source `enrich.ts`.
- **Deliverables**: `EnrichmentPlugin` class that scores company domains and normalizes contact attributes.
- **Verification**: Pass a set of contacts to the plugin and check that they are scored correctly.
- **Exit Criteria**: Data fields are normalized, scoring rules are applied, and updates are saved to SQLite.

---

## Milestone 5: Local Automation Engine & Registry

### Task 5.1: Implement Action and Condition Registries

- **Goal**: Build registries to hold and look up executable automation actions and conditions.
- **Why**: Provides a modular registry so new triggers, conditions, and actions can be added easily.
- **Files**:
  - `[NEW]` `apps/desktop/src/main/services/automation/registry.ts`
- **Dependencies**: None.
- **Deliverables**: Action and Condition registry manager that registers pluggable handlers.
- **Verification**: Register a test action, look it up by ID, and verify that the plugin returns the correct handler.
- **Exit Criteria**: Action and Condition registries are registered inside the workspace runtime.

### Task 5.2: Create Condition Evaluator Plugins

- **Goal**: Implement default condition evaluators (`HasTag`, `LeadScore`, `TimeElapsed`).
- **Why**: Allows the automation engine to evaluate criteria before executing sequence steps.
- **Files**:
  - `[NEW]` `apps/desktop/src/main/services/automation/conditions.ts`
- **Dependencies**: Task 5.1.
- **Deliverables**: Condition classes implementing the `ConditionPlugin` interface.
- **Verification**: Pass mock user contacts with different properties and verify that condition checks return the correct boolean values.
- **Exit Criteria**: All standard condition evaluators compile and run database queries successfully.

### Task 5.3: Create Action Executor Plugins

- **Goal**: Implement default action executors (`SendEmail`, `AddTag`, `UpdateStatus`).
- **Why**: Executes changes when sequence conditions are met.
- **Files**:
  - `[NEW]` `apps/desktop/src/main/services/automation/actions.ts`
- **Dependencies**: Task 5.1.
- **Deliverables**: Action executor classes implementing the `AutomationActionPlugin` interface.
- **Verification**: Trigger a sequence step action and verify that it updates local tables or queues a send-email job.
- **Exit Criteria**: Actions execute successfully, mutate the database, and log results.

### Task 5.4: Build Local Sequence Event Listener

- **Goal**: Build an automation event handler that listens to the Event Bus and evaluates campaigns in response to events (e.g., `contact:created`).
- **Why**: Drives campaigns automatically when contacts are discovered.
- **Files**:
  - `[NEW]` `apps/desktop/src/main/services/automation/listener.ts`
- **Dependencies**: Task 2.1, Task 5.2, Task 5.3.
- **Deliverables**: Automation listener that subscribes to the Event Bus and executes pending workflow sequences.
- **Verification**: Publish `contact:created` on the Event Bus and check that the listener triggers the appropriate automation sequence.
- **Exit Criteria**: Campaigns are automatically evaluated and executed in response to system events.

---

## Milestone 6: Main-Bound Sync Engine

### Task 6.1: Create SyncEngine Class

- **Goal**: Implement the `SyncEngine` class in Electron Main to manage background synchronization loops.
- **Why**: Relocates synchronization from the renderer to the Main process.
- **Files**:
  - `[NEW]` `apps/desktop/src/main/services/sync-engine.ts`
- **Dependencies**: Task 1.1, Task 2.2.
- **Deliverables**: `SyncEngine` class with `start()`, `stop()`, and periodic interval timers.
- **Verification**: Initialize the engine, set a short polling interval, and check that the polling ticks trigger in the background.
- **Exit Criteria**: Polling loops execute without blocking, and stop cleanly when the workspace runtime is shut down.

### Task 6.2: Implement Local Queue Mutation Processor

- **Goal**: Build the upload logic that polls the SQLite `sync_queue` table and sends updates to the Hono API in order (FIFO).
- **Why**: Ensures local database changes are synchronized to the remote MongoDB backend.
- **Files**:
  - `[MODIFY]` `apps/desktop/src/main/services/sync-engine.ts`
- **Dependencies**: Task 6.1, `@leadforge/sdk`.
- **Deliverables**: Sync processor that reads queued tasks, sends them to the API via the SDK, and removes them from the queue upon success.
- **Verification**: Add local updates, run the processor, verify the changes are sent to Hono, and confirm the queue is cleared.
- **Exit Criteria**: Local database modifications are synchronized, and the processor handles offline states and retries correctly.

### Task 6.3: Implement Last-Write-Wins Conflict Resolver

- **Goal**: Add conflict resolution to the sync engine using a `version` column.
- **Why**: Prevents concurrent updates from overwriting newer changes.
- **Files**:
  - `[MODIFY]` `apps/desktop/src/main/services/sync-engine.ts`
- **Dependencies**: Task 6.2.
- **Deliverables**: Version checks inside the sync engine that compare local and remote record versions.
- **Verification**: Simulate a conflict where the server has a newer version, and verify the local engine updates SQLite with the server's changes.
- **Exit Criteria**: Conflicts are resolved using the version values, and the databases are successfully reconciled.

### Task 6.4: Implement Main-Process Sync Pull Engine

- **Goal**: Implement the sync pull logic that queries the API for updates since the last sync timestamp and updates SQLite.
- **Why**: Keeps the local database up to date with changes made on other clients.
- **Files**:
  - `[MODIFY]` `apps/desktop/src/main/services/sync-engine.ts`
- **Dependencies**: Task 6.3.
- **Deliverables**: Fetch logic that checks for new changes, updates SQLite cache tables, and updates the local sync timestamp.
- **Verification**: Modify a record on the server, trigger a pull sync, and check that the local SQLite database reflects the changes.
- **Exit Criteria**: Periodic sync pull successfully updates SQLite tables and records the last sync timestamp.

---

## Milestone 7: Developer Tools Panel

### Task 7.1: Build Developer Panel UI

- **Goal**: Create a Developer Tools UI panel inside the React Renderer.
- **Why**: Helps developers debug background processes, database states, and synchronization logs in real time.
- **Files**:
  - `[NEW]` `apps/desktop/src/renderer/screens/dev-console.tsx`
  - `[MODIFY]` `apps/desktop/src/renderer/router/index.tsx`
- **Dependencies**: Preload IPC bridge channels.
- **Deliverables**: Dev console screen with tab navigation for Jobs, Sync Queue, Event Bus, Database, and Logs.
- **Verification**: Navigate to the Developer console in the UI and confirm that the component renders.
- **Exit Criteria**: UI loads with clean layout styles.

### Task 7.2: Build Jobs and Sync Monitor Feeds

- **Goal**: Add real-time feeds to the Developer console showing running jobs and sync queue statistics.
- **Why**: Provides a clear view of current background workloads.
- **Files**:
  - `[MODIFY]` `apps/desktop/src/renderer/screens/dev-console.tsx`
- **Dependencies**: Task 7.1.
- **Deliverables**: Dynamic lists that query SQLite via IPC and show running jobs and sync queue lengths.
- **Verification**: Queue a scraper job and verify that the Dev Console shows the running job and its progress.
- **Exit Criteria**: Feeds update automatically when jobs are queued, started, or completed.

### Task 7.3: Implement SQLite Query Inspector Panel

- **Goal**: Implement an SQL query editor in the Dev Console that allows developers to run read-only queries directly against the local SQLite database.
- **Why**: Speeds up database debugging by avoiding the need for external database inspectors.
- **Files**:
  - `[MODIFY]` `apps/desktop/src/renderer/screens/dev-console.tsx`
- **Dependencies**: Task 7.2.
- **Deliverables**: Code editor field with execute button that returns query results in a table view.
- **Verification**: Run `SELECT * FROM companies LIMIT 5` and verify that the results are displayed in the UI.
- **Exit Criteria**: Query interface evaluates SQL queries and displays the results. Block write commands (e.g. `DROP`, `DELETE`) to prevent data loss.

### Task 7.4: Build Live Event Bus Logger

- **Goal**: Build a real-time event logger in the Dev Console that streams logs and event bus activity.
- **Why**: Helps track system events and identify errors in background workers.
- **Files**:
  - `[MODIFY]` `apps/desktop/src/renderer/screens/dev-console.tsx`
- **Dependencies**: Task 7.3.
- **Deliverables**: Event stream list component that displays logs and events in chronological order.
- **Verification**: Trigger an event (e.g. create a company) and verify that the event appears instantly in the Dev Console log stream.
- **Exit Criteria**: Event stream updates in real time and includes controls to filter by severity or event type.

---

## Verification Matrix

| Milestone       | Automated Verification                                            | Manual Verification                                                                                    | Exit Criteria                                                                                             |
| :-------------- | :---------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------- |
| **Milestone 1** | `pnpm --filter @leadforge/desktop check-types`                    | Open app, perform CRM actions, check `leadforge_ws.db` with DB Browser.                                | Database contains `jobs`, `sync_queue`, and `system_logs` tables. Renderer makes no direct network calls. |
| **Milestone 2** | Test Event Bus publisher callbacks and listener binds.            | Change workspaces in the UI, verify previous connections close and new workspace database file mounts. | Workspace-scoped database files are created, and logs are written to SQLite and JSONL files.              |
| **Milestone 3** | Verify priority queue order and concurrency limits in mock tests. | Kill worker process via Task Manager and verify status updates to `failed`.                            | Background jobs are run in isolated processes and supervised by the Scheduler.                            |
| **Milestone 4** | Verify scrapers and outreach jobs compile.                        | Run Google Maps query and verify discovered leads populate SQLite.                                     | Ported scraper, website crawler, and email dispatcher work locally.                                       |
| **Milestone 5** | Verify action and condition executors compile.                    | Trigger a sequence rule and confirm actions execute.                                                   | Automation events are evaluated and executed locally using SQLite databases.                              |
| **Milestone 6** | Mock Hono API disconnects to test queue recovery.                 | Disconnect internet, add a company, reconnect, verify updates are sent to backend.                     | Local updates synchronize with MongoDB Atlas, and conflict versioning prevents data loss.                 |
| **Milestone 7** | Verify DevTools page renders.                                     | Run a SQL query in the inspector and verify output.                                                    | DevTools panel displays running jobs, sync queues, system logs, and events in real time.                  |

---

## Risk & Mitigation Matrix

- **Risk**: SQLite Database Lock (`SQLITE_BUSY`)
  - _Problem_: Multiple worker processes writing to SQLite concurrently can lock the database.
  - _Mitigation_: Enable WAL (Write-Ahead Logging) mode, set `busy_timeout = 5000` on connections, and route all worker writes through IPC back to the Main process.
- **Risk**: Worker Memory Leaks (Playwright Browser Crashes)
  - _Problem_: Headless browser processes can leak memory over time, causing crashes.
  - _Mitigation_: Run each job in a fresh worker process, and monitor process exit codes to automatically clean up orphaned browser processes.
- **Risk**: Synchronization Version Conflicts
  - _Problem_: Simultaneous edits on the local app and the web app can result in conflicts.
  - _Mitigation_: Check version numbers on incoming records and apply Last-Write-Wins (LWW) resolution.
- **Risk**: Main Thread Event Loop Latency
  - _Problem_: Processing heavy payloads or handling excessive IPC traffic in Main can cause UI lag.
  - _Mitigation_: Keep IPC payloads small. Offload large JSON operations (like parsing scraper results) to child workers, sending only summary metadata to Main.

---

## Migration Order

```
1. Milestone 1: Database & IPC Restructuring (Task 1.1 -> 1.5)
2. Milestone 2: Workspace Runtimes & Local Event Bus (Task 2.1 -> 2.4)
3. Milestone 3: Worker Runtime & Concurrency Scheduler (Task 3.1 -> 3.6)
4. Milestone 4: Migration & Porting of Background Jobs (Task 4.1 -> 4.4)
5. Milestone 5: Local Automation Engine & Registry (Task 5.1 -> 5.4)
6. Milestone 6: Main-Bound Sync Engine (Task 6.1 -> 6.4)
7. Milestone 7: Developer Tools Panel (Task 7.1 -> 7.4)
```

---

## Final Recommendation

To migrate LeadForge OS to a robust, local-first application, the team should implement a **Generic Job Runtime** managed by isolated **Workspace Runtimes**.

By moving network operations out of the renderer and routing resource-heavy tasks through isolated child processes, the application remains responsive, resilient, and fully functional offline. The proposed roadmap should be followed sequentially, with each task tested and verified before moving to the next.

This plan maintains clear boundaries between the Renderer, Electron Main, and isolated Workers, laying a solid foundation for future offline automation and AI research capabilities.
