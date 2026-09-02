# Product Workflow Inventory

This document catalogs every user-facing workflow, background runtime process, and data interaction pathway in **LeadForge OS**.

---

## 1. Core Platform Workflows

### 1.1 Authentication & Session Lifecycle
* **Cold Startup**: Electron main process reads persisted session from safe storage (`userData/session.json`). Restores active JWT and user metadata.
* **Email/Password Login**: Renderer submits credentials via IPC `auth:login` -> SDK -> API `/api/v1/auth/login`. On success, tokens are persisted, workspace headers are configured, and the active workspace runtime is initialized.
* **Google OAuth Login**: Renderer triggers `auth:loginWithGoogle` -> launches loopback OAuth flow -> exchanges code with API `/api/v1/auth/google/callback` -> establishes session.
* **Session Restoration & Verification**: Renderer calls `auth:restoreSession` on mount; verifies token freshness against API.
* **Logout & Token Revocation**: Clears in-memory tokens, stops the active `WorkspaceRuntime`, unlinks local credentials, resets renderer store, and transitions to login screen.

### 1.2 Workspace Management & Isolation
* **Workspace Discovery & Selection**: Users can view workspaces they own or belong to (`workspaces:list`).
* **Active Workspace Switching**: Transition lifecycle (`IDLE` -> `STOPPING` -> `STOPPED` -> `STARTING` -> `HYDRATING` -> `READY` -> `ACTIVE`):
  1. Serialized via `WorkspaceManager` transition lock to prevent race conditions.
  2. Stops the previous workspace's `JobScheduler`, `CacheHydrator`, and `AutomationTriggerEvaluator`.
  3. Closes SQLite file handle for previous workspace (`leadforge_<wsId>.db`).
  4. Boots new isolated `WorkspaceRuntime`, ensures clean cache schema, starts background engines, and initiates async hydration from MongoDB.
* **Workspace Settings & Role Management**: Team invitations, role updates (`OWNER`, `ADMIN`, `MEMBER`, `READ_ONLY`, `BILLING`), and ownership transfer via API.

---

## 2. CRM & Lead Management Workflows

### 2.1 Companies
* **Listing & Pagination**: Local SQLite read cache with instant UI rendering (`companies:list`).
* **Search & Dynamic Filtering**: Full-text name search, industry, location, city, state, country, and status filters (`companies:distinct-values`).
* **Creation & Ingestion**: Single company creation (`companies:create`) or bulk discovery imports write authoritatively to MongoDB and immediately project into local SQLite.
* **Opportunity Scoring & Metrics**: Enriched metrics (technologies, headcount, rating, social links).

### 2.2 Contacts
* **Listing & Association**: Paginated contact lists per workspace or filtered by company (`contacts:list`).
* **Multi-Channel Metadata**: Names, corporate email, phone, title, LinkedIn profile, source origin (`google_maps`, `crawler`, `linkedin`, `manual`).
* **Distinct Filter Aggregation**: Instant distinct filter values for titles and sources.
* **Status Transitions**: `NEW` -> `CONTACTED` -> `REPLIED` -> `BOUNCED` -> `UNSUBSCRIBED`.

### 2.3 Audiences & Segmenting
* **Dynamic Segments**: Rule-based audience queries (industry matches, location sets, verification status).
* **Static Ingestion**: Adding selected companies/contacts to predefined campaign target pools.

---

## 3. Lead Discovery & Scraping Workflows

### 3.1 Google Maps Discovery
* **Query Execution**: User submits search query (e.g., "HVAC Contractors in Texas") with target limit and location scope.
* **Job Enqueueing**: API creates persistent `scraper:maps` job in MongoDB `jobs` collection.
* **Worker Execution**: Child worker process claims job via atomic lease, launches headless Chromium via Playwright, navigates to Google Maps, handles cookie/consent dialogs, scrolls feed, extracts place details, and resolves website redirects.
* **Authoritative Persistence**: Saves companies and contacts directly via SdkClient -> API -> MongoDB, then links to `discovery_runs`.
* **Outcome Classification**: Distinguishes `SUCCESS_WITH_RESULTS`, `SUCCESS_ZERO_RESULTS`, `BLOCKED`, `CAPTCHA`, `RATE_LIMITED`, `PROVIDER_FAILURE`, `EXTRACTION_FAILURE`.

### 3.2 Website Crawler & Intelligence
* **Deep Crawl**: Discovers subpages (about, contact, team), scrapes emails, phone numbers, and social links.
* **AI Intelligence & Synthesis**: Synthesizes company value propositions, key decision-makers, and personalized icebreakers.

---

## 4. Outreach, Campaigns & Automation Workflows

### 4.1 Campaign Configuration
* **Lifecycle**: `DRAFT` -> `ACTIVE` -> `PAUSED` -> `COMPLETED`.
* **Sequencing**: Multi-step outreach workflows with configurable wait delays, dynamic template variables (`{{firstName}}`, `{{companyName}}`), and conditional branches (e.g., "if replied -> stop sequence").
* **Sending Profiles**: Association with authenticated Google/Gmail accounts.

### 4.2 Multi-Account Gmail Delivery
* **OAuth Profile Connection**: Multiple Google accounts per workspace, token refresh management.
* **Pre-Send Ledger Reservation**: Atomic delivery reservation in MongoDB `email_deliveries` using idempotency keys.
* **MIME Generation & Dispatch**: Generates RFC 2822 MIME payloads with attachments from Google Drive or local uploads, dispatches via Gmail API, records provider message and thread IDs.

### 4.3 Inbound Reply Detection & Reconciler
* **IMAP/Gmail Polling**: Ephemeral polling worker queries inbox threads for matching `Message-ID` or `In-Reply-To`.
* **Thread Matching & Sentiment Analysis**: Detects positive replies, updates contact status to `REPLIED`, stops sequence executions, and alerts user.

---

## 5. Background Engine & Observability Workflows

### 5.1 Job Scheduler & Worker Host
* **Atomic Claiming**: `POST /api/v1/jobs/claim` atomically transitions next eligible queued job using MongoDB `findOneAndUpdate` with lease duration.
* **Worker Forking**: Spawns isolated Node.js child processes with clean IPC channels and environment scoping.
* **Heartbeats & Checkpoints**: Periodic heartbeat renewal and progress checkpointing.
* **Crash Recovery**: Auto-reclaims orphaned jobs whose worker lease expired.

### 5.2 Cache Hydration
* **MongoDB -> SQLite Hydration**: Pulls authoritative workspace documents in bulk batches and updates local SQLite tables without blocking UI.
* **Schema Integrity & Self-Healing**: Detects outdated or corrupt SQLite databases, archives them cleanly, and reconstructs the schema from MongoDB.

### 5.3 System Observability & Diagnostics
* **Operations Center**: Live tracking of scheduler status, active workers, database connectivity, and API latency.
* **Dashboard Feed**: Aggregated system logs, delivery timelines, execution statuses, and CRM growth charts.
