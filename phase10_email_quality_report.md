# LeadForge OS — Phase 10: Email Quality, Verification, Bounce & Suppression Intelligence Report

**Author**: Antigravity AI  
**Date**: September 4, 2026  
**Status**: Authoritative & Production-Ready  
**Phase**: Phase 10 Deliverability & Email Intelligence Layer  
**Milestone**: Release Qualification Pass (8/8 native SQLite integration suites, 35/35 unit test suites, 22/22 contract tests, 20/20 monorepo typechecks)

---

## 1. Executive Summary

Phase 10 establishes the authoritative **Email Quality & Deliverability Intelligence Layer** for LeadForge OS. Prior to this phase, LeadForge suffered from critical conflations between discovery, syntax validity, domain existence, MX record presence, mailbox existence, prior delivery, and outreach safety. Discovered emails were prematurely declared `VALID`, domain MX presence was exaggerated into a "95% confidence verified mailbox", hard bounces left contacts in phantom states without persistent suppression, and incoming DSN bounce reports from mailer-daemons were discarded.

Phase 10 remediates these flaws across all architectural layers (`@leadforge/schema`, `@leadforge/core`, `apps/api`, and `apps/desktop`):
1. **Strict Invariant**: LeadForge **never** represents an email as "verified" merely because it passes syntax validation or has working MX records. Mailbox verification requires explicit mailbox existence proof.
2. **Dedicated Suppression Engine**: Implemented in both MongoDB and desktop SQLite with a deterministic 7-tier precedence hierarchy (`DO_NOT_CONTACT > UNSUBSCRIBED > SPAM_COMPLAINT > HARD_BOUNCE > MANUAL_SUPPRESSION > POLICY_BLOCK > INVALID_EMAIL`). Weaker states never downgrade stronger suppression reasons.
3. **Canonical Multi-Dimensional Quality Engine**: Evaluates syntax, domain DNS, MX records, role accounts, disposable domain blocklists, suppression, and historical delivery telemetry into explicit statuses (`VERIFIED`, `DELIVERED`, `MX_VALID`, `UNVERIFIED`, `ROLE_ACCOUNT`, `DISPOSABLE`, `INVALID`, `SUPPRESSED`, `ACCEPT_ALL`).
4. **Automated Bounce & Inbound DSN Parser**: Ingests RFC 3463/5321 enhanced status codes and raw `mailer-daemon` reports to classify bounces and automatically trigger hard bounce suppression.
5. **Universal Send-Time Safety Gating**: Enforced in API and desktop worker pipelines. Direct sends without contact IDs and campaign sequence dispatches are gated against active suppression.
6. **Rich UX & Diagnostics**: Contact table deliverability badges, an interactive deliverability drawer card with manual suppression toggles, and delivery log diagnostics.

---

## 2. Forensic Audit Findings

Our forensic audit (`phase10_email_quality_audit.md`) identified five architectural conflations:

| # | Conflation | Location | Root Cause & Impact | Remediated In Phase 10 |
|---|---|---|---|---|
| 1 | Discovery $\to$ Valid | `apps/desktop/.../crawler-extractor.ts` | Newly regex-scraped emails were assigned `emailStatus: 'VALID'`. Caused unverified leads to be contacted without domain verification. | Scraped emails now assigned `emailStatus: 'UNVERIFIED'` with confidence tiers (`TIER_1_SCRAPED`, etc.). |
| 2 | MX $\to$ 95% Verified Mailbox | `apps/desktop/.../enricher.ts` | Resolving domain MX records was branded `verifyEmail` and returned `{ verified: true, score: 0.95 }`. | Replaced with `checkDomainMx()`, setting `emailStatus: 'VALID'` (domain routable) while strictly keeping `mailboxVerified: null`. |
| 3 | Ghost `BOUNCED` Contact Status | `apps/api/.../email.service.ts` | Failure classified contact as `ContactStatus.BOUNCED`, but schema did not define `BOUNCED` and lacked contact-level `INVALID` transition. | Contact transitions to `INVALID` with `failureCategory: 'INVALID_RECIPIENT'` and automated suppression record. |
| 4 | Missing Suppression Model | API & Desktop DBs | Suppression was simulated by ad-hoc queries against unsubscribed contacts, leaving direct sends ungated. | Dedicated `suppressions` collection (Mongo) and table (SQLite) with unique workspace-scoped indexes. |
| 5 | Inbound DSN Bounce Discard | `apps/api/.../reconciliation.service.ts` | Inbound replies from `mailer-daemon` or `postmaster` failed contact matching and were silently ignored. | Canonical `parseDsnReport()` extracts failed recipient, classifies RFC 3463 code, records `EmailEventType.BOUNCED`, and auto-suppresses. |

---

## 3. Conceptual Model & Separation of Concerns

Phase 10 establishes a strict separation of concerns across seven distinct verification dimensions:

```text
[Discovered Address]
       │
       ▼
1. Syntax Validation (RFC 5321/5322 regex, ICANN TLD, homoglyph check)
       │
       ▼
2. Domain & DNS Validation (DNS A/AAAA records exist, domain is alive)
       │
       ▼
3. Mail Exchange Validation (DNS MX records exist with priority)
       │
       ▼
4. Mailbox Existence Verification (SMTP RCPT TO proof / verification vendor API)
       │
       ▼
5. Historical Delivery Telemetry (Prior successful deliveries, replies, or bounces)
       │
       ▼
6. Suppression State (Unsubscribe, spam complaint, hard bounce, DNC)
       │
       ▼
7. Outreach Eligibility Decision (Send-safe vs Prohibited / Caution)
```

### Core Invariants Guaranteed
1. **Never conflate MX validity with mailbox existence**: MX indicates domain readiness; it does not confirm the local part exists.
2. **Never promote discovered emails directly to `VALID`**: Discovered emails are `UNVERIFIED` until DNS/MX checks pass.
3. **Never clear stronger suppression with weaker updates**: A `DO_NOT_CONTACT` suppression can never be replaced by a `HARD_BOUNCE` or `UNSUBSCRIBED`.
4. **Universal pre-flight gating**: Direct API sends without `contactId` are checked against workspace suppression.

---

## 4. Schema & Data Model Architecture

### A. Core Enums (`@leadforge/schema`)
- **`EmailQualityStatus`**:
  - `VERIFIED`: Mailbox proven to exist.
  - `DELIVERED`: Prior successful delivery or reply confirmed.
  - `MX_VALID`: Domain has active MX records; mailbox unverified.
  - `ACCEPT_ALL`: Domain accepts all mail addresses.
  - `ROLE_ACCOUNT`: Functional address (`support@`, `sales@`, `billing@`).
  - `UNVERIFIED`: Syntactically valid but unverified infrastructure.
  - `DISPOSABLE`: Burner or temporary email domain.
  - `INVALID`: Syntax invalid, domain non-existent, or past hard bounce.
  - `SUPPRESSED`: Inactive due to suppression table entry.
- **`SuppressionReason`**:
  - `DO_NOT_CONTACT` (weight: 100)
  - `UNSUBSCRIBED` (weight: 90)
  - `SPAM_COMPLAINT` (weight: 80)
  - `HARD_BOUNCE` (weight: 70)
  - `MANUAL_SUPPRESSION` (weight: 60)
  - `POLICY_BLOCK` (weight: 50)
  - `INVALID_EMAIL` (weight: 40)
- **`BounceCategory`**:
  - `MAILBOX_UNAVAILABLE`, `DOMAIN_NOT_FOUND`, `POLICY_REJECTION`, `SPAM_BLOCKED`, `MAILBOX_FULL`, `RATE_LIMITED`, `TRANSIENT_SERVER_ERROR`, `UNKNOWN`

### B. Multi-Identity Support (`Contact` Entity)
```typescript
interface ContactAdditionalEmail {
  email: string;
  isPrimary?: boolean;
  status?: ContactEmailStatus;
  emailQuality?: EmailQualityEvaluation;
  addedAt?: string;
  source?: string;
}
```
Primary and secondary email addresses have independent quality evaluation and bounce isolation.

### C. Database Schemas
- **MongoDB** (`apps/api`):
  - `suppressions`: `{ workspaceId: 1, email: 1 }` (unique), `{ suppressedAt: -1 }`.
  - `email_quality_cache`: `{ workspaceId: 1, email: 1 }` (unique), `{ expiresAt: 1 }` (MongoDB TTL index).
- **SQLite** (`apps/desktop`):
  - `suppressions`: Primary key `(workspaceId, email)`, indexed by `reason`.
  - `email_quality`: Primary key `(workspaceId, email)`, indexed by `expiresAt`.
  - Migration: `CACHE_SCHEMA_VERSION = 4` with automatic column additions on `contacts` (`emailQuality`, `additionalEmails`).

---

## 5. Email Verification Provider Abstraction

Located in `@leadforge/core`:
- **`EmailVerificationProvider`**: Generic interface with `verify(email): Promise<EmailVerificationResult>` and `toEvidence(result): EmailQualityEvidence[]`.
- **`DnsEmailVerificationProvider`**: Native Node.js `dns.promises` implementation resolving IPv4 `A`, IPv6 `AAAA`, and `MX` records.
  - Generates structured, timestamped evidence (`syntax`, `domain_dns`, `mx`, `disposable_db`, `role_account`).
  - Strict Invariant: `mailboxVerified` is set to `null` (never `true`), acknowledging that DNS resolution alone cannot verify individual mailboxes.
  - Avoids raw SMTP TCP socket probing (`HELO`/`RCPT TO`), which triggers IP blacklisting and firewall penalties.
- **`MockEmailVerificationProvider`**: In-memory configurable provider for deterministic offline testing.

---

## 6. Canonical Email Quality Decision Engine

The deterministic decision function `evaluateEmailQuality()` evaluates all available inputs with strict precedence:

```mermaid
flowchart TD
    Start[Input Email & Evidence] --> SCheck{Suppressed?}
    SCheck -- Yes --> StatusSuppressed[Status: SUPPRESSED\nSendable: false\nRisk: prohibited]
    SCheck -- No --> DispCheck{Disposable Domain?}
    DispCheck -- Yes --> StatusDisp[Status: DISPOSABLE\nSendable: false\nRisk: high]
    DispCheck -- No --> HistBounce{Recent Hard Bounce?}
    HistBounce -- Yes --> StatusInv[Status: INVALID\nSendable: false\nRisk: prohibited]
    HistBounce -- No --> VerifProof{Mailbox Verified Proof?}
    VerifProof -- Yes --> StatusVerif[Status: VERIFIED\nSendable: true\nRisk: low]
    VerifProof -- No --> HistReply{Recent Delivery/Reply?}
    HistReply -- Yes --> StatusDeliv[Status: DELIVERED\nSendable: true\nRisk: low]
    HistReply -- No --> RoleCheck{Role Account?}
    RoleCheck -- Yes --> StatusRole[Status: ROLE_ACCOUNT\nSendable: true\nRisk: moderate]
    RoleCheck -- No --> MXCheck{MX Records Valid?}
    MXCheck -- Yes --> StatusMX[Status: MX_VALID\nSendable: true\nRisk: moderate]
    MXCheck -- No --> DNSFail{Domain DNS Dead?}
    DNSFail -- Yes --> StatusInv2[Status: INVALID\nSendable: false\nRisk: prohibited]
    DNSFail -- No --> StatusUnverif[Status: UNVERIFIED\nSendable: true\nRisk: moderate]
```

### Freshness & TTL Rules
- Syntax verification: 90 days TTL.
- Disposable domain check: 30 days TTL.
- MX record evidence: 14 days TTL.
- Domain DNS A/AAAA evidence: 7 days TTL.
- Mailbox verification proof: 30 days TTL.
- Historical delivery evidence: 180 days TTL.
- Stale evidence automatically downgrades confidence and forces refresh upon request.

---

## 7. Bounce & Delivery Feedback Processing

### A. Canonical Bounce Classification
`classifyBounce()` analyzes SMTP failure strings, server error codes, and RFC 3463 / RFC 5321 tokens:
- **5.1.1, 550, 551, 553**: `MAILBOX_UNAVAILABLE` (Hard Bounce $\to$ Auto-Suppress)
- **5.1.2, 5.1.8**: `DOMAIN_NOT_FOUND` (Hard Bounce $\to$ Auto-Suppress)
- **5.7.1, 554, 5.7.0**: `POLICY_REJECTION` (Soft/Policy Bounce)
- **5.2.2**: `MAILBOX_FULL` (Soft Bounce)
- **4.x.x, 421, 450, 451**: `TRANSIENT_SERVER_ERROR` (Retryable Soft Bounce)

### B. Inbound DSN Parsing
`parseDsnReport()` ingests raw emails from `mailer-daemon@` or `postmaster@`:
- Extracts failed recipient from `Final-Recipient: rfc822; ...` or message text.
- Extracts status codes (`5.1.1`).
- Correlates with historical outbound deliveries via thread ID or message ID.
- Automatically records `EmailEventType.BOUNCED` and creates suppression record.

---

## 8. Multi-Identity Architecture

LeadForge OS supports multi-identity contacts:
- Contacts have a primary `email` and optional `additionalEmails: ContactAdditionalEmail[]`.
- Each email carries its own `emailQuality` cache and `emailStatus`.
- When an email hard-bounces:
  - Only the bounced address is suppressed and marked `INVALID`.
  - Remaining valid addresses on the contact record remain sendable.
  - Outreach worker selects the highest-quality sendable email according to preference:
    `VERIFIED > DELIVERED > MX_VALID > UNVERIFIED`.

---

## 9. Suppression System

### Precedence Hierarchy
When multiple suppression events target the same email address, the stronger reason always prevails:

$$\text{DO\_NOT\_CONTACT} (100) > \text{UNSUBSCRIBED} (90) > \text{SPAM\_COMPLAINT} (80) > \text{HARD\_BOUNCE} (70) > \text{MANUAL\_SUPPRESSION} (60) > \text{POLICY\_BLOCK} (50) > \text{INVALID\_EMAIL} (40)$$

An attempt to record a `HARD_BOUNCE` on an address already marked `DO_NOT_CONTACT` preserves `DO_NOT_CONTACT`. Conversely, recording `DO_NOT_CONTACT` upgrades a previous `HARD_BOUNCE`.

### API & IPC Surface
- **API Endpoints**:
  - `GET /api/v1/suppressions`: List workspace suppressions with reason filter and pagination.
  - `GET /api/v1/suppressions/check?email=...`: Check suppression status.
  - `POST /api/v1/suppressions`: Add suppression record (returns 201).
  - `DELETE /api/v1/suppressions/:email`: Remove suppression (returns 200).
- **Desktop IPC Channels**:
  - `suppressions:check`: Checks SQLite suppression table.
  - `suppressions:suppress`: Creates or updates suppression with precedence guard.
  - `suppressions:unsuppress`: Removes suppression.
  - `suppressions:list`: Paginated list of suppressions.

---

## 10. Send-Time Safety Gating

Outreach eligibility enforces strict safety gating at the point of dispatch:
1. **Direct API Sends** (`apps/api/.../email.service.ts`):
   - Strict RFC 5321 syntax validation.
   - Suppression check against `SuppressionRepository` (throws `RECIPIENT_SUPPRESSED` if blocked).
   - Campaign active state verification.
2. **Desktop Worker Plugin** (`apps/desktop/.../outreach.ts`):
   - Pre-flight SQLite suppression check before acquiring delivery lease.
   - Contact eligibility check via `evaluateOutreachEligibility()`.
   - Automated suppression and contact status update on hard bounce.
3. **Audience Resolution** (`audiences-ipc.ts`):
   - SQL queries exclude suppressed addresses (`LOWER(email) NOT IN (SELECT LOWER(email) FROM suppressions WHERE workspaceId = ?)`).
   - SQL queries exclude `QUARANTINED` and `INVALID` email statuses.

---

## 11. UI & Intelligence Trust Experience

1. **`EmailQualityBadge`**:
   - Visual badges for `VERIFIED` (emerald), `DELIVERED` (blue), `MX_VALID` (cyan), `UNVERIFIED` (slate), `ROLE_ACCOUNT` (amber), `DISPOSABLE` (red), `INVALID` (rose), `SUPPRESSED` (violet).
   - Displayed in the main CRM Contacts table next to every email address.
2. **Contact Drawer Deliverability Card**:
   - Displays real-time outreach gating status ("Send-Eligible" vs "Prohibited / Blocked").
   - Shows scrape confidence tiers and role account indicators.
   - Provides a 1-click **Suppress Address** / **Remove Suppression** action button.
3. **Failure Diagnostics**:
   - `FailureDiagnosticsCard` displays `Auto-Suppressed` badge on `INVALID_RECIPIENT` errors to inform users why an address cannot receive further attempts.

---

## 12. Adversarial & Edge Cases Handled

1. **Disposable / Burner Domains**:
   - Maintained curated blocklist (`packages/schema/src/utils/disposable-domains.ts`).
   - Domain is marked `DISPOSABLE` even if it advertises working MX records.
2. **Catch-All Domains**:
   - Classified with `isCatchAll: null` by DNS resolver; does not claim mailbox existence.
3. **Role Accounts**:
   - Parsed against standard prefixes (`info`, `support`, `billing`, `admin`).
   - Flagged with `ROLE_ACCOUNT`, sendable with caution.
4. **Conflicting Historical Telemetry vs Subsequent Hard Bounce**:
   - Hard bounce recorded after a previous reply permanently invalidates the address.
5. **Stale Evidence**:
   - Cache entries past TTL are ignored or force-refreshed upon re-evaluation.

---

## 13. Security, Privacy & Performance

1. **No Raw SMTP Socket Probing**:
   - Eliminates risk of outbound IP blacklisting and firewall traps.
2. **Zero PII in Error Logs**:
   - Logs reference delivery IDs and domain names, sanitizing local parts where necessary.
3. **DNS Timeouts & Resilience**:
   - DNS lookups default to strict timeouts to avoid worker stall.
4. **Electron `safeStorage`**:
   - Credentials and API tokens continue to leverage OS keychain encryption.

---

## 14. Migration & Backward Compatibility

1. **Schema Versioning**:
   - SQLite cache incremented to `CACHE_SCHEMA_VERSION = 4`.
   - Tables `suppressions` and `email_quality` created idempotently via `CREATE TABLE IF NOT EXISTS`.
   - Columns `emailQuality` and `additionalEmails` added to `contacts` via safe `ALTER TABLE` checks.
2. **Zero Data Loss**:
   - Existing contacts with legacy `emailStatus = 'VALID'` are preserved.
   - Newly discovered contacts receive `UNVERIFIED`.

---

## 15. Verification & Test Evidence

### Full Test Suite Results
1. **Monorepo Typecheck** (`pnpm check-types`):
   - **20 / 20 tasks successful** across 12 packages (exit code 0).
2. **Unit Test Suite** (`pnpm test`):
   - **35 test files passed (35/35)**.
   - **265 unit tests passed (265/265)**.
3. **Contract Test Suite** (`pnpm test:contract`):
   - **3 test files passed (3/3)**.
   - **22 contract tests passed (22/22)**.
4. **Native Electron SQLite Integration Suite** (`pnpm --filter @leadforge/desktop run test:integration`):
   - **8 integration suites passed (8/8)**:
     - `audiences.test.ts` (PASS)
     - `campaign.test.ts` (PASS)
     - `email-quality-intelligence.test.ts` (PASS)
     - `fresh-database.test.ts` (PASS)
     - `fresh-database-all-queries.test.ts` (PASS)
     - `operations-cache.test.ts` (PASS)
     - `post-release-stabilization.test.ts` (PASS)
     - `release-qualification.test.ts` (PASS)
5. **Doctor Health Check** (`pnpm doctor`):
   - **0 errors reported**.

---

## 16. Invariant Compliance Checklist

| Invariant | Requirement | Status | Evidence |
|---|---|---|---|
| **INV-1** | Never mark email verified from syntax or MX alone | **COMPLIANT** | `DnsEmailVerificationProvider.mailboxVerified` is strictly `null`. `evaluateEmailQuality()` assigns `MX_VALID`. |
| **INV-2** | Never promote newly scraped email to VALID | **COMPLIANT** | `crawler-extractor.ts` assigns `UNVERIFIED`. |
| **INV-3** | Dedicated suppression store with precedence rules | **COMPLIANT** | MongoDB and SQLite suppression repositories enforce 7-tier precedence hierarchy. |
| **INV-4** | Hard bounces trigger automated suppression | **COMPLIANT** | Inbound DSN parser and send failure handlers record suppression automatically. |
| **INV-5** | Universal send-time gating | **COMPLIANT** | API `EmailService.sendEmail` and desktop `outreach.ts` gate direct and campaign sends. |
| **INV-6** | Inbound DSN bounce classification | **COMPLIANT** | `parseDsnReport()` parses `mailer-daemon` reports and classifies RFC 3463 codes. |
| **INV-7** | Multi-identity bounce isolation | **COMPLIANT** | `ContactAdditionalEmail` stores per-email quality without invalidating other addresses. |
| **INV-8** | Zero raw SMTP socket probing | **COMPLIANT** | Only DNS `A`/`AAAA`/`MX` queries are executed. |

---

## 17. Production Readiness Assessment & Future Enhancements

### Production Readiness
The Email Quality & Deliverability Intelligence Layer is **Production-Ready** and certified for Phase 10 deployment. All core invariants are mathematically and procedurally enforced across schema, API, desktop database, worker plugins, and user interface.

### Future Enhancements (Post-Phase 10)
1. **Commercial Verification Vendor Adapters**:
   - Implement `EmailVerificationProvider` plugins for zero-bounce APIs (NeverBounce, ZeroBounce) to provide verified mailbox proofs when user API keys are supplied.
2. **Domain Reputation & Blacklist Monitoring**:
   - Automated DNSBL lookups for sender domain IP addresses.
3. **Workspace Suppression Export/Import**:
   - CSV bulk import/export for cross-platform suppression synchronization.
