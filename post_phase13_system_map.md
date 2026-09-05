# LeadForge OS: Post-Phase 13 System State & Architecture Map

## 1. Subsystem Topography & Boundaries

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                                 ELECTRON DESKTOP                                  │
│                                                                                   │
│  ┌───────────────────────┐   IPC Channels (50+)   ┌────────────────────────────┐  │
│  │   React Renderer UI   │ ◄────────────────────► │  Electron Main Process     │  │
│  │   (Tailwind / Query)  │                        │  - WorkspaceManager        │  │
│  └───────────────────────┘                        │  - JobScheduler (cron/tick)│  │
│                                                   │  - EventBus / EventBridge  │  │
│                                                   │  - ProjectionService       │  │
│                                                   └──────────────┬─────────────┘  │
│                                                                  │                │
│                                              Direct Read Cache   ▼                │
│                                                   ┌────────────────────────────┐  │
│                                                   │  Local SQLite Projection   │  │
│                                                   │  (per-workspace database)  │  │
│                                                   └────────────────────────────┘  │
│                                                                  ▲                │
│                                                                  │ Local Writes   │
│  ┌───────────────────────────────────────────────────────────────┴─────────────┐  │
│  │  Background Worker Host (Child Processes / Forked Workers)                 │  │
│  │  - Scraper / Crawler Plugins                                                │  │
│  │  - Automation Plugin (ad-hoc sequence runner: 2,627 lines)                  │  │
│  │  - Observability & Health Monitors                                          │  │
│  └───────────────────────────────┬────────────────────────────────────────────┘  │
└──────────────────────────────────┼────────────────────────────────────────────────┘
                                   │ HTTP (REST via @leadforge/sdk)
                                   ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                               FASTIFY / HONO API                                  │
│                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │  API Routers & Domain Services                                              │  │
│  │  - EmailService / OutreachService (Phase 9/11/13 consolidation)             │  │
│  │  - CampaignService / AudienceService                                        │  │
│  │  - ReconciliationService / SentFolderReconciliation (Phase 12)               │  │
│  │  - TrackingService (Public unauthenticated open/click tracking)             │  │
│  │  - CampaignAnalyticsService (Phase 10 deterministic metrics)                │  │
│  └───────────────────────────────┬─────────────────────────────────────────────┘  │
│                                  │ Mongoose ODM                                   │
│                                  ▼                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │  Authoritative Data Store: MongoDB                                          │  │
│  │  - campaigns, sequence_executions, email_deliveries, email_events           │  │
│  │  - email_accounts, email_templates, template_versions, suppressions         │  │
│  │  - contacts, companies, jobs, audit_logs                                    │  │
│  └───────────────────────────────┬─────────────────────────────────────────────┘  │
└──────────────────────────────────┼────────────────────────────────────────────────┘
                                   │ OAuth 2.0 / REST API
                                   ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                            EXTERNAL CLOUD PROVIDERS                               │
│                                                                                   │
│  ┌───────────────────────────────┐             ┌───────────────────────────────┐  │
│  │        Google Gmail API       │             │       Google Drive API        │  │
│  │   (Send / Inbound / Sent)     │             │     (Attachments Storage)     │  │
│  └───────────────────────────────┘             └───────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. System Authorities vs. Projections vs. Caches

| Entity | Primary Authority | Read Projection | Disposable Cache | Consistency Mechanism | Invalidation / Rehydration Trigger |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Campaigns** | MongoDB (`campaigns`) | SQLite (`campaigns`) | React Query | Push on IPC update; Poll on interval | IPC `campaigns:update`, manual sync, rehydrate |
| **Sequences** | MongoDB (`sequences`) | SQLite (`sequences`) | React Query | Push on IPC update | IPC `sequence:update`, manual sync |
| **Sequence Executions** | MongoDB (`sequence_executions`) | SQLite (`sequence_executions`) | React Query | Worker calls API; Job completion reconciles | `ProjectionService.reconcileJobOutcome` on job completion |
| **Contacts & Companies** | MongoDB (`contacts`, `companies`) | SQLite (`contacts`, `companies`) | React Query | Bidirectional local-first + remote sync | CRM IPC handlers, crawler completion |
| **Email Accounts** | MongoDB (`email_accounts`) | SQLite (`email_accounts`) | React Query | API write -> SQLite write | Account connect / update IPC |
| **Email Templates** | MongoDB (`email_templates`, `template_versions`) | SQLite (`templates`) | React Query | API write -> SQLite write | Template editor save IPC |
| **Email Deliveries (Ledger)**| MongoDB (`email_deliveries`) | SQLite (`email_deliveries`) | React Query | On-demand pagination push | Only populated during `outreach:list-deliveries` IPC! |
| **Email Events (Tracking)** | MongoDB (`email_events`) | SQLite (`email_events`) | React Query | Read directly via API aggregations | Not projected to SQLite in real time |
| **Suppressions** | MongoDB (`suppressions`) | SQLite (`suppressions`) | React Query | IPC `suppressions:add` writes both | API suppression endpoints bypass SQLite |
| **Jobs & Worker Locks** | MongoDB (`jobs`, `locks`) | Memory (`activeWorkers` in Scheduler) | None | Scheduler loop + MongoDB atomic updates | Polling every 5s; startup crash recovery sweep |

---

## 3. Core State Machines & Transitions

### A. Campaign State Machine
Authority: `apps/api/src/db/models/campaign.model.ts`, validated in `apps/api/src/services/campaign/campaign.service.ts:54-66`.

```
                    ┌───────────┐
                    │   DRAFT   │
                    └─────┬─────┘
                          │ (activate)
                          ▼
                    ┌───────────┐
       ┌───────────►│  ACTIVE   │◄───────────┐
       │            └─────┬─────┘            │
       │ (resume)         │ (pause)          │ (resume)
       │                  ▼                  │
 ┌─────┴─────┐      ┌───────────┐      ┌─────┴─────┐
 │  PAUSED   │◄────►│  PAUSED   │      │  PAUSED   │
 └───────────┘      └─────┬─────┘      └───────────┘
                          │ (stop / complete)
                          ▼
            ┌───────────────────────────┐
            │   STOPPED  /  COMPLETED   │ (Terminal states)
            └───────────────────────────┘
```
- **Allowed Transitions**:
  - `DRAFT` $\rightarrow$ `ACTIVE`, `STOPPED`
  - `ACTIVE` $\rightarrow$ `PAUSED`, `STOPPED`, `COMPLETED`
  - `PAUSED` $\rightarrow$ `ACTIVE`, `STOPPED`
  - `STOPPED` $\rightarrow$ None (Terminal)
  - `COMPLETED` $\rightarrow$ None (Terminal)

### B. Sequence Execution State Machine
Authority: `apps/api/src/db/models/sequence-execution.model.ts`.

```
        ┌───────────┐
        │  PENDING  │
        └─────┬─────┘
              │ (start / worker claim)
              ▼
        ┌───────────┐
   ┌───►│  RUNNING  │◄──────────────────┐
   │    └─────┬─────┘                   │
   │          │ (step delay / rate wait)│ (scheduler resume)
   │          ▼                         │
   │    ┌───────────┐                   │
   │    │  WAITING  │───────────────────┘
   │    └─────┬─────┘
   │          │ (campaign pause / stop / reply)
   │          ▼
   │    ┌───────────┐
   └────┤  PAUSED   │
        └─────┬─────┘
              │
              ▼
   ┌────────────────────────────────────────────────────────┐
   │   COMPLETED  /  FAILED  /  CANCELLED  /  REPLIED       │ (Terminal)
   └────────────────────────────────────────────────────────┘
```

### C. Delivery Ledger State Machine (Phase 11/12)
Authority: `apps/api/src/db/models/email-delivery.model.ts`, enforced in `apps/api/src/repositories/email-delivery/email-delivery.repository.ts:7-16`.

```
                        ┌───────────┐
                        │  QUEUED   │
                        └─────┬─────┘
                              │ (reserveSendSlot)
                              ▼
                        ┌───────────┐
             ┌─────────►│  SENDING  │◄─────────┐
             │          └─────┬─────┘          │
             │ (retry)        │                │ (reclaim / retry)
             │                ▼                │
       ┌─────┴─────┐    ┌───────────┐    ┌─────┴─────┐
       │ RETRYING  │    │ AMBIGUOUS │    │ RETRYING  │
       └─────▲─────┘    └─────┬─────┘    └───────────┘
             │                │
             │ (backoff)      │ (reconciliation confirmed sent)
             │                ▼
       ┌─────┴─────────────────────┐     ┌──────────────┐
       │           SENT            │     │  SUPPRESSED  │
       └──────────────┬────────────┘     └──────────────┘
                      │
                      ├──────────────────────────┐
                      ▼                          ▼
               ┌─────────────┐            ┌─────────────┐
               │   OPENED    │            │   REPLIED   │
               └─────────────┘            └─────────────┘
```

---

## 4. Worker Architecture & Execution Topography

```
[JobScheduler] (apps/desktop/src/main/services/scheduler.ts)
  │
  ├── Ticks every 5,000ms
  ├── Scans SQLite sequence_executions for due WAITING records
  ├── Polls MongoDB jobs collection for queued tasks
  ├── Spawns child process workers (WorkerHost)
  │
  ▼
[Worker Host Process] (apps/desktop/src/main/workers/worker-host.ts)
  │
  ├── Loads plugin by jobType ('automation:workflow', 'scraper:maps', etc.)
  ├── Injects JobContext (saveCheckpoint, emitLog, updateProgress)
  │
  ▼
[Automation Worker] (apps/desktop/src/main/workers/plugins/automation.ts)
  │
  ├── 2,627-line monolithic ad-hoc engine (NOT @leadforge/workflow-engine)
  ├── ActionRegistry:
  │     - SEND_EMAIL (calls SdkClient.outreach.sendEmail)
  │     - DELAY / WAIT (calculates nextExecutionAt, sets status = WAITING)
  │     - CONDITION / IF_ELSE (evaluates field expressions)
  │     - GOTO / LABEL (jumpCount loop guards)
  │     - SET_VARIABLE (mutates execution context variables)
  │     - UPDATE_CONTACT (mutates contact record)
  │
  └── On Step Completion:
        - Updates MongoDB sequence_executions via SdkClient
        - Releases sequence execution lock
        - Emits event on local EventEmitter
        - Yields result back to Scheduler
```

---

## 5. Failure and Crash Recovery Topography

| Failure Scenario | Detecting Component | Recovery Path | Ledger Impact | User Visibility |
| :--- | :--- | :--- | :--- | :--- |
| **Worker Process Crash during SEND_EMAIL** | Scheduler heartbeat (`activeWorkers` ping) | Worker restarted; job retried if attempt < maxRetries | Delivery remains `SENDING` until lease expires (5m), then flagged `AMBIGUOUS` | Appears as "Running" or "Retrying" in Queue Monitor |
| **Gmail API Network Timeout** | `EmailService` / `GmailProvider` (30s abort) | Marked `AMBIGUOUS`; lease released; scheduled for SentFolderReconciliation | `status = AMBIGUOUS`, `failureClassification = timeout` | Operations Center displays "Ambiguous Delivery" badge |
| **Desktop App Force Quit / Crash** | `JobScheduler.onStartup` | MongoDB jobs in `running` reset to `queued`; SQLite executions left un-scanned | MongoDB jobs resume; SQLite `sequence_executions` may orphan in `RUNNING` | Queue restarts; stranded executions must be manually re-run |
| **Gmail Rate Limit (429)** | `EmailAccountRepository` | Cooldown set on mailbox in MongoDB; step yields `wait`; scheduler backs off | Delivery marked `RETRYING` or `FAILED`; quota preserved | Warning logged; mailbox status shows cooldown countdown |
| **Hard Bounce (DSN)** | `ReconciliationService` (inbound polling) | Contact updated to `BOUNCED`; email added to `suppressions`; campaign cancelled | Delivery marked `FAILED`; `BOUNCED` event recorded | Contact badge turns red (`BOUNCED`); campaign bounce rate increases |
