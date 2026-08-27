# LeadForge OS — Target MongoDB-First Architecture

## 1. Executive Summary & Core Architectural Vision

In the target MongoDB-first architecture:
* **MongoDB** is the single, authoritative source of persistent truth for ALL LeadForge OS business data.
* **`apps/api`** serves as the canonical persistence boundary and gatekeeper.
* **Main Application & Local Workers** interact with data strictly through the API using `SdkClient`.
* **SQLite** is demoted to a 100% disposable materialized read-cache for fast desktop UI rendering.

```text
                                ┌─────────────────────────┐
                                │     MongoDB Server      │
                                │ SINGLE SOURCE OF TRUTH  │
                                └────────────┬────────────┘
                                             │
                                          Mongoose
                                             │
                                ┌────────────▼────────────┐
                                │     Hono API Server     │
                                │  (apps/api Persistence) │
                                └────────────┬────────────┘
                                             │
                                     HTTP via SdkClient
                                             │
             ┌───────────────────────────────┴───────────────────────────────┐
             │                                                               │
┌────────────▼────────────┐                                     ┌────────────▼────────────┐
│ Electron Main Process   │                                     │  Local Worker Process   │
│ (Desktop App UI / IPC)  │                                     │ (Playwright / Crawler)  │
└────────────┬────────────┘                                     └────────────┬────────────┘
             │                                                               │
      Update Cache                                                    Update Cache
             │                                                               │
             └───────────────────────────────┬───────────────────────────────┘
                                             │
                                ┌────────────▼────────────┐
                                │    SQLite Read-Cache    │
                                │   (Disposable Only)     │
                                └─────────────────────────┘
```

---

## 2. Definitive Target Persistence Responsibilities

### 2.1 MongoDB Collection Schema Additions
MongoDB must be expanded from 18 models to **33 models** by introducing Mongoose schemas for the 15 missing operational/intelligence entities:
1. `JobModel` (`jobs`)
2. `SystemLogModel` (`systemlogs`)
3. `CompanyIntelligenceModel` (`companyintelligences`)
4. `WebsiteIntelligenceModel` (`websiteintelligences`)
5. `ContactIntelligenceModel` (`contactintelligences`)
6. `OpportunityScoreModel` (`opportunityscores`)
7. `AuditLogModel` (`auditlogs`)
8. `WorkspaceMemoryModel` (`workspacememories`)
9. `PageCrawlModel` (`pagecrawls`)
10. `IntelligenceSourceModel` (`intelligencesources`)
11. `IntelligenceEvidenceModel` (`intelligenceevidences`)
12. `IntelligenceClaimModel` (`intelligenceclaims`)
13. `IntelligenceInferenceModel` (`intelligenceinferences`)
14. `EmailDeliveryModel` (`emaildeliveries`)
15. `AutomationLockModel` (`automationlocks`)

---

## 3. Canonical Write & Read Flow

### 3.1 Write Flow (User UI Action or Worker Output)
1. Client (Desktop main process or worker thread) constructs DTO payload.
2. Client invokes `sdk.<entity>.create(payload)` or `sdk.<entity>.update(id, payload)`.
3. API validates payload against Zod schema and persists record to MongoDB.
4. API returns saved document containing MongoDB `_id`.
5. Client receives response and executes `LocalCRMRepository.save(tableName, record, true)` to update local SQLite cache.

### 3.2 Read Flow (Desktop Application UI)
1. Desktop UI queries local SQLite cache via IPC channel (`companies:query`).
2. SQLite returns immediate synchronous cached results (< 5ms response time).
3. If SQLite cache is empty or dirty, UI falls back to `sdk.<entity>.list()`, fetching from Mongo API and populating local SQLite cache asynchronously.
