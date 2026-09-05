# LeadForge OS: Post-Phase 13 Implementation Roadmap Proposal

Based strictly on the evidence collected during the system-wide forensic audit, this document defines the recommended sequence of future implementation phases.

In accordance with core roadmap principles:
- **Correctness precedes expansion**
- **Deterministic foundations precede AI**
- **Production blockers precede UX polish**
- **Mega-phases are avoided; coupled problems are kept together**

---

## Proposed Phase Sequence Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Phase 14: Execution Engine & Scheduler Recovery Hardening                   │
│ (Fix delay stalls, datetime collation, crash orphans, recovery sweep)       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Phase 15: Outreach Lineage, Template Versioning & Composition Alignment     │
│ (Expose versioning API/SDK, unify fingerprints, preserve retry lineage)     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Phase 16: Campaign Lifecycle, Concurrency & Outreach Exclusivity           │
│ (Fix UI pause/resume, prevent dual-campaign spam, handle account disconnect)│
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Phase 17: Inbound Reply Reconciliation & Suppression Consistency            │
│ (Fix SENDING reply race, un-suppress consistency, unmatched reply queue)     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Phase 18: Operational Hardening, Architecture Decoupling & Repo Hygiene     │
│ (Break circular deps, consolidate workflow engine, fix marketing linter)    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Phase 19: Deterministic Foundations for AI Readiness                        │
│ (Immutable AI generation schemas, sandboxed prompt boundaries, safety gates)│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 14: Execution Engine & Scheduler Recovery Hardening

### Objective
Resolve the critical flaws in the automation execution and scheduling loop that cause multi-step campaigns to stall permanently and lose state on crashes.

### Why It Exists
The post-Phase 13 audit revealed that any campaign step that yields `wait` (whether for a deliberate delay or due to a rate limit cooldown) updates MongoDB but fails to update the local SQLite database that the scheduler scans (`DELAY-01`). Furthermore, SQLite string comparison on ISO dates fails for same-day scheduled delays (`SCHED-02`). Together, these bugs make multi-step campaigns completely dysfunctional in production.

### Findings Addressed
- `DELAY-01` (CRITICAL): Sequence delay steps fail to write to SQLite, causing permanent stalls.
- `SCHED-02` (CRITICAL): ISO-8601 string collation mismatch with SQLite `datetime('now')`.
- `THROTTLE-04` (CRITICAL): Mailbox 429 cooldown triggering unrecoverable delays.
- `SCHED-CRASH-11` (HIGH): Execution recovery crash window between SQLite CAS and job creation.
- `STARTUP-RECOVERY-12` (HIGH): Un-scanned SQLite executions left in `RUNNING` on app restart.

### Dependencies
None. This is the primary foundational blocker for all outreach automation.

### Priority
**CRITICAL / P0** (Immediate Production Blocker).

### Explicitly Excluded
- Modifying UI components.
- Adding new workflow step types.
- AI features.
- Changing template or email composition logic.

---

## Phase 15: Outreach Lineage, Template Versioning & Composition Alignment

### Objective
Complete the broken template versioning chain, ensure deterministic fingerprint equality between SDK preview and API delivery ledger, and prevent lineage erasure during retries.

### Why It Exists
Phase 13 created `findVersion` in the repository and tested it in contract tests, but never exposed it in API routes or the SDK. Automation workers still query mutable templates (`TPL-05`). Additionally, SDK fingerprinting hashes tracking-injected HTML and attachments, while API delivery ledger hashes raw HTML and ignores attachments (`FINGERPRINT-06`). Finally, in-process retries on rate limits wipe out template lineage (`RETRY-LINEAGE-10`).

### Findings Addressed
- `TPL-05` (HIGH): Template versioning endpoint missing from API router and SDK.
- `FINGERPRINT-06` (HIGH): Fingerprint calculation divergence between SDK and API ledger.
- `RETRY-LINEAGE-10` (HIGH): Throttle retry payload omitting template ID and variables snapshot.
- `TPL-DELETE-15` (MEDIUM): Active template deletion causing running workflow failures.

### Dependencies
Phase 14 (requires stable execution worker).

### Priority
**HIGH / P1** (Correctness & Audit Integrity).

### Explicitly Excluded
- WYSIWYG template visual builder.
- Dynamic email preview rendering in marketing app.
- AI drafting or rewriting.

---

## Phase 16: Campaign Lifecycle, Concurrency & Outreach Exclusivity

### Objective
Unify campaign lifecycle semantics across Desktop UI, Electron IPC, Fastify API, and SQLite projections; establish contact-level outreach exclusivity across campaigns; and prevent job thrashing when accounts disconnect.

### Why It Exists
Clicking "Pause Campaign" in the desktop UI calls `crm.ts:campaigns:update`, which leaves background workers running (`PAUSE-07`). There is no `campaigns:resume` IPC channel (`RESUME-09`). A contact can be enrolled in multiple campaigns simultaneously and receive conflicting emails (`ENROLL-08`). Disconnecting a mailbox lets queued jobs fail one by one rather than pausing campaigns (`DISCONNECT-16`).

### Findings Addressed
- `PAUSE-07` (HIGH): UI Pause bypasses background job cancellation and execution pauses.
- `ENROLL-08` (HIGH): Missing cross-campaign contact enrollment deduplication.
- `RESUME-09` (HIGH): Missing campaign resume IPC channel and execution rescheduling.
- `DISCONNECT-16` (MEDIUM): Account disconnection failing to pause attached campaigns.
- `DRIFT-STOP-19` (MEDIUM): API campaign stop not propagating to SQLite projection.

### Dependencies
Phase 14, Phase 15.

### Priority
**HIGH / P1** (Operational Safety & Customer Experience).

### Explicitly Excluded
- Multi-mailbox round-robin rotation.
- Visual flowchart campaign builder.
- External webhook triggers.

---

## Phase 17: Inbound Reply Reconciliation & Suppression Consistency

### Objective
Eliminate the race window where fast replies are dropped into `UNMATCHED`, ensure administrative un-suppression synchronizes cleanly across all layers, and provide an operator queue for unmatched replies.

### Why It Exists
If a recipient replies within seconds while the outbound delivery is still in `SENDING` status, reconciliation fails to match and permanently records the reply as `UNMATCHED` (`INBOUND-03`). The contact never transitions to `REPLIED`, and follow-up emails continue sending. Un-suppressing an address removes the MongoDB record but fails to update SQLite or reset contact status (`UNSUPPRESS-13`).

### Findings Addressed
- `INBOUND-03` (CRITICAL): Fast reply race dropping inbound replies into permanent UNMATCHED.
- `UNSUPPRESS-13` (HIGH): Admin un-suppression failing to update SQLite cache or contact status.
- `SEC-EMAIL-14` (MEDIUM): Inbound replies from alternate addresses losing campaign attribution.

### Dependencies
Phase 14, Phase 16.

### Priority
**HIGH / P1** (Outreach Safety & Legal Compliance).

### Explicitly Excluded
- Natural language sentiment analysis.
- Automated AI reply draft generation.
- IMAP / non-Gmail reply polling.

---

## Phase 18: Operational Hardening, Architecture Decoupling & Repo Hygiene

### Objective
Resolve circular dependencies in the desktop application, reconcile duplicate workflow engine packages, fix marketing application ESLint failures, and format the repository to pass `pnpm doctor` cleanly.

### Why It Exists
The repository currently fails `pnpm doctor` on ESLint (31 errors in `apps/marketing`), Prettier (49 unformatted files), and circular dependencies (8 plugins circular with `worker-host.ts`). Monorepo contains both `@leadforge/workflow-engine` and an ad-hoc 2,627-line script in `automation.ts` (`ENGINE-DUPLICATION-17`).

### Findings Addressed
- `ENGINE-DUPLICATION-17` (MEDIUM): Unused `@leadforge/workflow-engine` vs monolithic `automation.ts`.
- `CIRCULAR-DEP-18` (MEDIUM): Circular dependencies between worker plugins and worker host.
- `ANALYTICS-FALLBACK-20` (LOW): Desktop SQLite analytics projection missing background sync.
- `LINT-MARKETING-21` (LOW): 31 ESLint errors in `apps/marketing`.
- `FORMAT-PRETTIER-22` (LOW): 49 unformatted files.

### Dependencies
Phase 14 through Phase 17.

### Priority
**MEDIUM / P2** (Technical Debt & Code Hygiene).

### Explicitly Excluded
- Rebuilding the marketing site design.
- Monorepo package restructuring beyond decoupling circular boundaries.

---

## Phase 19: Deterministic Foundations for AI Readiness

### Objective
Establish rigid, immutable boundaries, sandboxes, and audit schemas required before any autonomous AI agents or LLM-driven actions are introduced into LeadForge OS.

### Why It Exists
AI agents must operate on an infallible deterministic bedrock. Introducing LLMs before schemas, versioning, rate limiting, and reply attribution are proven will lead to un-auditable prompt drift, hallucinated outreach, and mailbox quota burnout.

### Scope & Invariants
- Establish schema contracts for AI-generated drafts (must require template versioning and message fingerprinting).
- Sandboxed evaluation of AI variables prior to dispatch.
- Operator approval gate for all AI-composed emails before provider transmission.
- Token budget and cost ledger tracking per workspace.

### Dependencies
Phases 14, 15, 16, 17, 18 fully verified and complete.

### Priority
**DEFERRED UNTIL DETERMINISTIC STABILITY IS VERIFIED**.

### Explicitly Excluded
- Autonomous AI email sending without operator confirmation.
- Unbounded LLM agent execution loops.
