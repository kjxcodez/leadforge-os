# LeadForge OS: Post-Phase 13 Product Gap Analysis

## 1. Production Blockers (Must Fix Immediately)

These issues present direct risks of data corruption, delivery failure, campaign stalling, or irreversible customer outreach errors. They must be resolved before LeadForge OS can be deployed to production.

| ID | Issue | Technical Impact | Risk Level |
| :--- | :--- | :--- | :--- |
| **PB-01** | **The Sequence Delay Stall Bug** (`DELAY-01`) | Automation plugin sets MongoDB to `WAITING`, but never updates SQLite `sequence_executions`. Scheduler only scans SQLite. Any multi-step sequence with a delay stops permanently. | **CATASTROPHIC** |
| **PB-02** | **SQLite Datetime Collation Mismatch** (`SCHED-02`) | Comparing ISO-8601 string (`'2026-09-05T...'`) with SQLite `datetime('now')` (`'2026-09-05 ...'`). String comparison evaluates false on the same day due to `'T'` > `' '`. Due executions remain invisible until midnight UTC. | **CRITICAL** |
| **PB-03** | **Inbound Reply Drop on Fast Responses** (`INBOUND-03`) | Replies arriving while an outbound message is in `SENDING` status fail thread, message ID, and status checks. Ingested as `UNMATCHED` with a permanent idempotency key. Follow-up emails continue sending to someone who replied. | **CRITICAL** |
| **PB-04** | **Mailbox 429 Cascading Campaign Freeze** (`THROTTLE-04`) | Provider 429 cooldown causes workers to yield `wait` for cooldown duration. Due to PB-01, every campaign sharing that mailbox enters an unrecoverable permanent stall. | **CRITICAL** |
| **PB-05** | **Template Versioning Bypass in Production Workers** (`TPL-05`) | Versioned template repository (`findVersion`) was never wired to API routes or SDK. Automation workers always fetch the latest mutable template. Mid-campaign template edits alter emails for enrolled contacts. | **HIGH** |
| **PB-06** | **Discrepant Composition Fingerprints** (`FINGERPRINT-06`) | SDK computes fingerprints over tracking HTML and attachment hashes. API ledger hashes raw HTML and ignores attachments. Delivery ledger audit trails and previews never match. | **HIGH** |
| **PB-07** | **In-Flight UI Campaign Pause Bypass** (`PAUSE-07`) | "Pause Campaign" in Desktop UI triggers `crm.ts:campaigns:update`, which only updates the campaign record without pausing active jobs or executions. Background workers continue dispatching sends. | **HIGH** |
| **PB-08** | **Delivery Lineage Erasure on Throttle Retries** (`RETRY-LINEAGE-10`) | In-process 5-second throttle retries in `automation.ts` omit `templateId`, `templateVersion`, and `variablesSnapshot`. Resulting delivery ledger records have null lineage. | **HIGH** |
| **PB-09** | **Scheduler Recovery Crash Window** (`SCHED-CRASH-11`) | Atomic CAS transition in SQLite (`WAITING -> RUNNING`) occurs before `sdk.jobs.create`. A crash or API failure between the two permanently orphans the execution in SQLite with no MongoDB job. | **HIGH** |
| **PB-10** | **Incomplete Administrative Un-suppression** (`UNSUPPRESS-13`) | Admin un-suppression removes MongoDB record but does not update SQLite projection or reset `ContactModel.status`. Subsequent sends continue to be blocked by send-time safety gates. | **HIGH** |

---

## 2. Public Beta Gaps (Required Before Broader Public Testing)

These items do not immediately corrupt data, but cause visible product confusion, user frustration, or unexpected outreach behavior.

1. **Cross-Campaign Contact Exclusivity (`ENROLL-08`)**:
   - Currently, a contact can be enrolled in two active campaigns simultaneously.
   - Users expect contacts to be protected by global outreach rules so they aren't bombarded by conflicting messages.
2. **True Campaign Resume Semantics (`RESUME-09`)**:
   - Currently, resuming a campaign updates the campaign status to `ACTIVE` in MongoDB, but does not unpause or reschedule paused sequence executions.
3. **Safe Template Deletion & Historical Version Fallback (`TPL-DELETE-15`)**:
   - Deleting a template causes active workflows to throw unhandled errors instead of falling back to archived snapshots or halting with clean warnings.
4. **Account Disconnection Protection (`DISCONNECT-16`)**:
   - Disconnecting a Google account should automatically pause all campaigns relying on that account, rather than letting jobs fail one by one until retries are exhausted.
5. **Startup Recovery of Abandoned Executions (`STARTUP-RECOVERY-12`)**:
   - On application startup, SQLite `sequence_executions` left in `RUNNING` from a hard crash should be swept and re-queued.
6. **Secondary Email Reply Ingestion (`SEC-EMAIL-14`)**:
   - Inbound replies from alternate email addresses not pre-populated in `additionalEmails` cannot correlate to contacts, losing campaign attribution.
7. **Projection Sync for API-Triggered Stops (`DRIFT-STOP-19`)**:
   - When a campaign is stopped via API, the local desktop SQLite projection remains marked `ACTIVE` until an explicit sync occurs.

---

## 3. Product Completeness Gaps (Expected Core Workflows)

Workflows that standard cold outreach platforms provide which LeadForge OS currently lacks:

1. **Manual Reply Reconciliation**:
   - When an incoming email arrives that cannot be matched automatically (e.g. from an alternate email address or missing thread headers), provide an "Unmatched Inbound" queue in Operations Center where operators can manually link the reply to a contact and campaign.
2. **Sending Window & Schedule Constraints**:
   - Campaigns currently execute immediately when triggered. Outreach requires business hours scheduling (e.g. "Send only Monday through Friday between 9:00 AM and 5:00 PM in the contact's local timezone").
3. **Contact Un-enrollment / Removal**:
   - No clean UI flow to manually un-enroll an individual contact from an active campaign without stopping the entire campaign.
4. **Multi-Mailbox Rotation / Send Distribution**:
   - A campaign can currently only bind to a single sending account. Cold outreach at scale requires pooling multiple mailboxes and rotating sends across them.
5. **Email Account Warm-Up Schedule**:
   - Automated ramp-up policy that slowly increases daily limits (e.g. 5/day $\rightarrow$ 10/day $\rightarrow$ 25/day $\rightarrow$ 50/day) to build domain reputation safely.

---

## 4. Operational Maturity & Observability

Gaps in diagnosing, operating, and recovering the system in production environments:

1. **Circular Architecture in Desktop (`CIRCULAR-DEP-18`)**:
   - 8 worker plugins import `worker-host.ts`, while `worker-host.ts` dynamically imports the plugins.
   - `scheduler.ts`, `projection-service.ts`, and `logger.ts` have mutual circular dependencies that cause bundling fragility and make isolated unit testing difficult.
2. **Workflow Engine Duplication (`ENGINE-DUPLICATION-17`)**:
   - Monorepo includes `@leadforge/workflow-engine` package, but outreach campaigns run entirely on an ad-hoc 2,627-line script in `apps/desktop/src/main/workers/plugins/automation.ts`.
   - Maintaining two divergent workflow abstractions creates confusion and technical debt.
3. **Worker Heartbeat Watchdog**:
   - If a background worker child process hangs without crashing (e.g., hanging network request), the scheduler's `activeWorkers` map holds the lease indefinitely until timeout.
4. **Dead-Letter Queue (DLQ) Management**:
   - Jobs that exceed max retries are simply marked `failed` in MongoDB. There is no bulk retry or inspection tool in the UI.

---

## 5. Quality & Codebase Hygiene

1. **Marketing Site Lint Failures (`LINT-MARKETING-21`)**:
   - 31 ESLint errors and 65 warnings in `apps/marketing` (e.g. direct `setState` inside `useEffect`, unescaped HTML entities, explicit `any`).
2. **Repository-Wide Prettier Formatting (`FORMAT-PRETTIER-22`)**:
   - 49 files have style discrepancies failing the `pnpm doctor` code style check.
3. **Desktop Offline Analytics Fallback (`ANALYTICS-FALLBACK-20`)**:
   - SQLite `email_deliveries` is only populated when the delivery logs UI is browsed. Offline analytics queries against SQLite frequently return zeros.

---

## 6. Deliberately Deferred Areas

Features that should **NOT** be built yet to avoid premature complexity:

1. **Native SMTP / IMAP Support**:
   - Google Workspace / Gmail OAuth is fully integrated and hardened. Adding raw SMTP/IMAP introduces deliverability, TLS, and credential storage security risks that are unnecessary for current requirements.
2. **Third-Party CRM Two-Way Sync (HubSpot / Salesforce)**:
   - LeadForge has an integrated CRM and local SQLite projection. Full bidirectional synchronization creates massive reconciliation complexity and should wait until core outreach is bulletproof.
3. **Custom Tracking Domain White-labeling**:
   - Direct API tracking pixel and redirect URLs are functional. Custom CNAME domains require DNS validation infrastructure that should be deferred.
4. **Complex Sequence Branching (Multi-level Tree Visualizer)**:
   - Linear sequences with delays, rate limit backoffs, and simple condition jumps are sufficient. Advanced visual node-based graph editors are unnecessary at this stage.

---

## 7. AI Prerequisites (Deterministic Foundations Required First)

Before LeadForge OS can safely incorporate AI agents (e.g. AI personalization, auto-drafting, reply sentiment classification, auto-followups), the underlying deterministic engine must satisfy these non-negotiable criteria:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AI AGENT INTEGRATION                            │
│           (Personalization, Reply Handling, Smart Scheduling)          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ REQUIRES
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               DETERMINISTIC SYSTEM PREREQUISITES                       │
│                                                                        │
│  1. Immutable Template Snapshots & Version Pinning (Fix TPL-05)        │
│     - AI cannot generate or mutate text unless the generated draft    │
│       is strictly versioned and hashed into the delivery lineage.      │
│                                                                        │
│  2. Reliable Reply Ingestion & Attribution (Fix INBOUND-03)            │
│     - AI sentiment analysis cannot classify replies if replies are     │
│       dropped into UNMATCHED or race against delivery finalization.    │
│                                                                        │
│  3. Reliable Sequence Delay & Scheduler Recovery (Fix DELAY-01)        │
│     - AI decision trees ("wait 3 days, then check if opened")          │
│       will stall permanently if the underlying scheduler fails delays. │
│                                                                        │
│  4. Strict Mailbox Quotas & Cooldowns (Fix THROTTLE-04)               │
│     - High-speed AI generation must not overwhelm mailbox quotas or    │
│       trigger unrecoverable permanent freezes upon 429 responses.      │
│                                                                        │
│  5. Contact-Level Outreach Exclusivity (Fix ENROLL-08)                │
│     - AI autonomous agents must be structurally prohibited from        │
│       enrolling a contact already active in another campaign.          │
└────────────────────────────────────────────────────────────────────────┘
```
