# Phase 1 Forensic Document 19 — UI Data Source & Projection Map

**Document Type:** Forensic UI Data Source Audit  
**Audited Against:** `apps/desktop/src/renderer/screens/`  
**Date:** September 2026  
**Status:** Authoritative Baseline  

---

## 1. Screen-by-Screen Data Source Audit Matrix

| Screen Name | Displayed Entities / Data Elements | Primary Data Source | Secondary / Fallback Source | Invalidation & Polling Mechanism |
| :--- | :--- | :--- | :--- | :--- |
| **Dashboard** | Companies count, Contacts count, Active campaigns, Recent discovery runs | **Local SQLite** via IPC (`companies:list`, `contacts:list`, `campaigns:list`) | None | TanStack Query (`refetchInterval: 5000ms`) |
| **Companies** | Company table rows, domain, industry, location, contacts count | **Local SQLite** via IPC (`companies:query`) | None | TanStack Query (`refetchInterval: 2000ms`) |
| **Contacts** | Contact table rows, email, phone, title, company name, status | **Local SQLite** via IPC (`contacts:query`) | None | TanStack Query (`refetchInterval: 2000ms`) |
| **Discovery** | Discovery runs, scraper job progress, found companies list | **Local SQLite + Scheduler Memory** via IPC (`discovery:run:list`, `scheduler:jobs:list`, `discovery:run:companies`) | Server API fallback if SQLite empty | TanStack Query (`refetchInterval: 2500ms`) |
| **Campaigns** | Campaign cards, aggregate contact stats, progressive sequence steps, email templates | **Local SQLite** via IPC (`campaigns:list`, `templates:list`, `sequence:list`) | Server API on template list | TanStack Query (`refetchInterval: 3000ms`) |
| **Outreach / Deliveries**| Outbound email send logs, message IDs, send timestamps, recipient emails | **Server API (MongoDB)** via `sdk.emailDeliveries.list()` | Local SQLite `email_deliveries` on network error | TanStack Query (`refetchInterval: 5000ms`) |
| **Reports** | Send volume, reply rates, campaign performance charts | **Local SQLite Aggregation** (`sequence_executions`, `campaigns`) | Computed React State | TanStack Query |
| **Operations Center**| Background job queues, active worker slots, audit logs, system error logs | **Server API + Main Process Memory** via IPC (`scheduler:jobs:list`, `audit-logs:list`, `system-logs:list`) | None | TanStack Query (`refetchInterval: 2000ms`) |
| **Settings** | Email accounts, Gmail connection status, daily sending limits, theme/sidebar config | **Server API** for email accounts (`sdk.outreach.listAccounts()`); **Local `config.json`** for theme/preferences | Local SQLite cache for email accounts | Manual refetch on mutation |

---

## 2. Key Data Source Discrepancies

1. **The "Split Authority" Perception:**  
   - CRM views (Companies, Contacts, Campaigns) read exclusively from local SQLite.
   - Operations & Deliveries views attempt to read directly from the Server API via SdkClient.
   - When the API is offline or cache hydration fails, CRM views show 0 records from SQLite while Settings and Deliveries show network errors, creating inconsistent user experiences across tabs.
2. **Undefined Parameter Generation in UI Queries:**  
   The Outreach / Deliveries table invokes `email-deliveries:list` without default filter values, triggering the `URLSearchParams` undefined serialization defect and returning empty data sets.
