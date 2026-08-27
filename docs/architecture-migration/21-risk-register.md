# LeadForge OS — Technical & Operational Risk Register

## 1. Overview
This risk register documents technical, operational, and data risks identified during the forensic audit of LeadForge OS, along with impact ratings and mitigation strategies.

---

## 2. Risk Register Matrix

| Risk ID | Category | Risk Description | Impact | Probability | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **R-01** | **Data Loss** | Un-synced SQLite local mutations lost if SQLite is wiped before migration | **CRITICAL** | HIGH | Pre-migration data extraction script (`migrate-sqlite-to-mongo.ts`) MUST scan all local `.db` files and migrate `syncStatus = 'pending'` rows into MongoDB before wiping local cache. |
| **R-02** | **Identity Break** | ID translation or surrogate key generation corrupts entity linkages | **CRITICAL** | MEDIUM | Enforce absolute identity invariant: `MongoDB _id === API ID === SQLite Cache ID`. Reject any code attempting ID translation. |
| **R-03** | **Worker Offline Crash** | Workers attempting direct SQLite writes fail when SQLite is cache-only | **HIGH** | HIGH | Refactor all worker plugins (`scraper.ts`, `crawler.ts`, `outreach.ts`) to use `SdkClient` to issue REST API requests directly to `apps/api`. |
| **R-04** | **API Network Latency** | Direct API write path makes desktop UI feel sluggish compared to instant local SQLite writes | **MEDIUM** | MEDIUM | Use optimistic UI updates in React UI while API request is in-flight, updating local cache upon API response. |
| **R-05** | **Offline UI Mutations** | Desktop app operating offline cannot write directly to Mongo API | **MEDIUM** | HIGH | Display clear offline warning banner in desktop UI; block destructive mutations until connection is restored or queue explicitly at API layer. |
| **R-06** | **Drive Auth Expiration** | Google Drive refresh token expires, breaking email attachment sends | **HIGH** | LOW | Implement automatic token refresh handler in API (`GmailProviderConfig.onTokenRefresh`) to refresh OAuth tokens before send. |
| **R-07** | **Large Cache Memory** | Large workspace hydration overwhelms SQLite memory or locks file | **MEDIUM** | LOW | Implement batch chunking (1,000 rows per batch) inside `CacheHydrator.hydrateWorkspaceCache()` and use SQLite WAL mode. |
