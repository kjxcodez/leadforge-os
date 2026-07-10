# LeadForge OS Roadmap (Post Forensic Audit V2)

## Phase 0 — Audit Remediation (Mandatory)

**Goal**

Resolve every architectural issue that blocks MVP development.

This is **not feature development**.

It is stabilization.

### Deliverables

* Authentication architecture finalized
* SDK ↔ API contracts finalized
* Enum mismatches removed
* Desktop connected to SDK
* React Query configured
* Route protection
* Workspace validation
* Security fixes
* Clean builds
* Green type checks
* Green database verification

### Exit Criteria

Everything in the audit marked **P0** and **P1** is resolved.

No remaining architectural blockers.

---

# Phase 1 — Desktop Foundation

**Goal**

Build the real desktop application shell.

Not the CRM.

Just the application itself.

## Authentication Flow

Implement

* Splash Screen
* Loading Screen
* Login
* Register
* Verify Email
* Forgot Password
* Session Expired
* Logout
* Auto Login
* Authentication Guard

## Routing

Implement

* Protected Routes
* Guest Routes
* App Layout
* Auth Layout

## Providers

Configure

* React Query
* Theme Provider
* Toast Provider
* Dialog Provider
* Tooltip Provider

## Global State

Create

* Auth Store
* Workspace Store
* UI Store
* Settings Store

## Electron

Implement

* IPC foundation
* System status
* App version
* Native dialogs
* Notifications

### Exit Criteria

A user can

* Login
* Stay logged in
* Logout
* Restart app
* Restore session

---

# Phase 2 — Workspace Foundation

Everything revolves around workspaces.

Implement

* Workspace creation
* Workspace selection
* Invite members
* Member management
* Roles
* Permissions
* Active workspace switching

### Exit Criteria

Multiple workspaces work correctly.

---

# Phase 3 — Local Data Layer

This is where LeadForge becomes fast.

Implement

## SQLite

* Local database
* Cache
* Queue

## Sync Engine

* Offline changes
* Background sync
* Retry queue
* Conflict handling

## Repository Layer

Desktop repositories

Remote repositories

Sync repositories

### Exit Criteria

Desktop works even with intermittent internet.

---

# Phase 4 — Core CRM

Now build the CRM.

Modules

## Companies

* CRUD
* Search
* Filters
* Notes
* Tags

## Contacts

* CRUD
* Social profiles
* Company relations

## Workspaces

* Members
* Roles

## Activities

* Timeline
* Notes
* History

### Exit Criteria

LeadForge is now a usable CRM.

---

# Phase 5 — Discovery Engine

Now build what makes LeadForge unique.

Implement

* Discovery Jobs
* Scrapers
* Enrichment
* Company lookup
* Contact discovery
* Queue
* Job monitoring

### Exit Criteria

System can discover companies automatically.

---

# Phase 6 — Outreach

Implement

* Email Accounts
* Templates
* Campaigns
* Scheduling
* Tracking
* Replies
* Bounce detection

### Exit Criteria

LeadForge can contact leads.

---

# Phase 7 — Workflow Engine

Expand the existing workflow package.

Implement

* Visual workflows
* Triggers
* Conditions
* Actions
* Variables
* Execution history

### Exit Criteria

No-code automation works.

---

# Phase 8 — AI Platform

Rename `prompts` → `ai` (if not already done).

Implement

## Providers

* OpenRouter
* Ollama
* Local Models

## Memory

* sqlite-vec
* Embeddings

## Features

* Email generation
* Company summaries
* Research
* Workflow AI
* Prompt registry

### Exit Criteria

AI is integrated across the platform.

---

# Phase 9 — Integrations

Implement

* Gmail
* Outlook
* LinkedIn
* Apollo
* Hunter
* Google Calendar
* Slack
* Discord
* Webhooks

---

# Phase 10 — Analytics

Implement

* Dashboard
* Metrics
* Campaign analytics
* Funnel analytics
* Revenue
* Performance

---

# Phase 11 — Polish

Complete

* Settings
* Preferences
* Themes
* Keyboard shortcuts
* Command Palette
* Accessibility
* Performance
* Error boundaries
* Logging improvements

---

# Phase 12 — Release Preparation

Finalize

* Auto updates
* Installers
* Crash reporting
* Backups
* Documentation
* Testing
* CI/CD
* Release builds

---

# Overall Development Order

```text
Audit Remediation
        │
        ▼
Desktop Foundation
        │
        ▼
Workspace Foundation
        │
        ▼
SQLite + Sync Engine
        │
        ▼
Core CRM
        │
        ▼
Discovery Engine
        │
        ▼
Outreach
        │
        ▼
Workflow Engine
        │
        ▼
AI Platform
        │
        ▼
Integrations
        │
        ▼
Analytics
        │
        ▼
Polish
        │
        ▼
Release
```

## What I'd change from the audit

There are three changes I'd make to keep the project moving:

1. **Finish all P0/P1 issues first**, but don't spend time on lower-priority cleanup before the MVP. For example, the AI package expansion, SQLite offline engine, and some architectural refinements can come later, while authentication, SDK alignment, enum consistency, and route security should happen immediately. These are the blockers identified in the audit. 

2. **Build vertically instead of horizontally.** Once the foundation is stable, each feature should be completed end-to-end (API → SDK → Desktop UI → Testing) before starting the next. That gives you working functionality after every phase.

3. **Keep every phase independently shippable.** At the end of each phase, you should have a working application that can be demonstrated, not just another set of internal infrastructure changes. This keeps progress measurable and prevents another long period of refactoring without visible results.
