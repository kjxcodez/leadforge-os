# 12. Workflow Architecture

LeadForge OS relies on automated workflows (such as scraper runs, lead qualification, and cold email campaigns). This document details how execution is scheduled and run.

---

## 1. Execution Environments

Workflows are divided by resource intensity and process boundaries:

1. **Local Node.js Child Process**: Runs Playwright scraper routines locally to keep infrastructure costs at zero. 
2. **Cloud Containers (Apify / AWS ECS)**: Distributes heavy web scraping jobs to cloud clusters, preventing IP blacklisting and reducing local client CPU overhead.
3. **n8n Automation Engine**: Self-hosted n8n instances (running in local Docker Compose or cloud setups) act as an integration bridge for long-tail API notifications (like Slack alerts or Google Sheet syncs).

---

## 2. Process Boundaries & Scheduler

```text
                  [ User UI / Trigger ]
                            │
                            ▼
                [ Electron Main Scheduler ]
                            │
             ┌──────────────┴──────────────┐
             ▼                             ▼
    [ Local Scraper Worker ]     [ Cloud API / n8n ]
     - Playwright Engine          - Webhooks / Syncs
```

- **Crash Recovery**: Jobs are claimed using atomic flags in the database. A checker process resets jobs whose locks have expired back to a pending state.
- **n8n Bridge**: The LeadForge workflow engine calls n8n workflows via webhook, tracks execution state locally, and logs audits under the workspace scope.
