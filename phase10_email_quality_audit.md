# LeadForge OS — Phase 10: Email Quality, Verification, Bounce & Suppression Forensic Audit

**Document:** `phase10_email_quality_audit.md`  
**Date:** September 4, 2026  
**Status:** Complete Forensic Audit  
**Author:** DeepMind Antigravity Pair-Programmer & Systems Architect  

---

## Executive Summary

This forensic audit investigates all email extraction, validation, persistence, outreach gating, historical delivery feedback, and bounce/suppression mechanisms currently implemented in LeadForge OS. 

The primary objective of Phase 10 is to build an authoritative **Email Quality & Deliverability Intelligence Layer** that strictly enforces the central product invariant:
> **LeadForge must never represent an email as "verified" or "valid" merely because it passes syntax validation or because its domain has working MX records.**
> **LeadForge must never claim mailbox existence unless the system possesses actual evidence supporting that claim.**

The audit uncovers critical architectural conflations and operational gaps:
1. **Discovery-to-Valid Conflation:** The crawler extraction pipeline automatically marks newly scraped email addresses as `ContactEmailStatus.VALID` if they are classified as `exact` or `role_based`, promoting unverified, uncontacted addresses straight to send-eligible status.
2. **MX-to-Verified Conflation:** The desktop enricher plugin performs a simple DNS MX lookup and assigns `verificationStatus: 'verified'` with `confidence: 0.95` simply because the domain advertises Google or Outlook MX servers.
3. **Ghost Bounce State:** While `ContactStatus.BOUNCED` and `EmailFailureCategory.INVALID_RECIPIENT` exist in schema definitions, **zero production runtime code ever transitions a contact to `BOUNCED` or flags an email as suppressed** when an outbound delivery fails or an inbound bounce DSN arrives.
4. **Absence of Dedicated Suppression Ledger:** Suppression is overloaded onto the CRM contact record's lifecycle `status` field (`UNSUBSCRIBED`, `BOUNCED`, `DO_NOT_CONTACT`). There is no standalone suppression repository indexed by `(workspaceId, email)`. Direct sends bypassing a contact record completely escape suppression checks.
5. **Inbound Bounce Ingestion Discard:** When Google's Mail Delivery Subsystem (`mailer-daemon@googlemail.com`) returns a non-delivery report (DSN / hard bounce), the inbound reply poller tries to correlate `normalizedFrom` against CRM contacts, fails, and drops the message into `processingStatus: 'UNMATCHED'`, completely missing the bounce signal.

---

## Audit Matrix & Findings by Classification

| Dimension / Mechanism | Classification | Source Files | Root Cause / Impact |
| :--- | :--- | :--- | :--- |
| **Email Candidate Extraction (DOM, mailto, JSON-LD)** | Implemented | `apps/desktop/src/main/workers/plugins/crawler-extractor.ts`<br/>`packages/schema/src/utils/email-sanitizer.ts` | Conservative extraction with HTML link parsing, space-separated DOM traversal, and JSON-LD entity parsing. |
| **Email Candidate Normalization & Deduplication** | Implemented | `packages/schema/src/utils/email-sanitizer.ts`<br/>`apps/desktop/src/main/workers/plugins/crawler-extractor.ts` | Trims, strips quotes/brackets, lowercases domain, preserves local-part case where required, deduplicates via SourceRank. |
| **Syntax Validation (RFC 5321 / RFC 6531 / Unicode)** | Implemented | `packages/schema/src/utils/email-sanitizer.ts` | Strict regex conforming to RFC specifications, supporting Unicode letter sets (`\p{L}`, `\p{N}`), length boundaries (64 local, 254 total). |
| **ICANN Public Suffix & TLD Validation** | Implemented | `packages/schema/src/utils/email-sanitizer.ts` | Powered by `tldts`, validates real delegated ICANN suffixes, rejects arbitrary made-up TLDs. |
| **Disposable Domain Intelligence** | Missing | `packages/schema/src/utils/email-sanitizer.ts` | Only checks parking landers and registrar domains (`PARKING_OR_REGISTRAR_DOMAINS`). No database of disposable/throwaway mail providers (e.g. Mailinator, TempMail). |
| **Discovery-to-Valid Status Assignment** | Incorrectly Conflated | `apps/desktop/src/main/workers/plugins/crawler-extractor.ts:358-368` | Scraped candidates with `exact` or `role_based` classification are assigned `ContactEmailStatus.VALID` without DNS/MX or mailbox validation. |
| **MX Resolution to Mailbox Verification Conflation** | Incorrectly Conflated | `apps/desktop/src/main/workers/plugins/enricher.ts:53-70` | Resolving Google or Outlook MX sets `verificationStatus: 'verified'` and `confidence: 0.95` in contact notes. Confuses domain mail exchange presence with individual mailbox existence. |
| **Catch-All Domain Detection** | Missing | `apps/desktop/src/main/workers/plugins/enricher.ts` | No probe or heuristic exists to determine whether a domain accepts arbitrary recipients. |
| **Direct Send Suppression Check** | Missing | `apps/api/src/services/email/email.service.ts:156-196` | If `input.contactId` is `'direct-contact'` or missing, pre-flight eligibility check is completely bypassed. |
| **Audience Query Defaulting to Valid** | Incorrectly Conflated | `apps/desktop/src/main/ipc/audiences-ipc.ts:40, 63` | `COALESCE(emailStatus, 'VALID')` defaults any unclassified or null email status to `VALID`. |
| **Runtime Contact Bounce Transition** | Missing | `apps/api/src/services/email/email.service.ts:570-595` | Synchronous `INVALID_RECIPIENT` (550) failure marks `email_deliveries` as failed, but never updates contact `status` to `BOUNCED` or flags email as invalid. |
| **Inbound DSN / Bounce Parsing** | Missing | `apps/api/src/services/email/reconciliation.service.ts:401-520` | `mailer-daemon` bounces are treated as unmatched replies because sender is not in CRM contacts; bounce signal is discarded. |
| **Dedicated Suppression Ledger** | Missing | Entire codebase | Suppression only exists as overloaded contact lifecycle status (`UNSUBSCRIBED`, `BOUNCED`, `DO_NOT_CONTACT`). No `(workspaceId, email)` table. |
| **Suppression Precedence Enforcement** | Partially Implemented | `packages/schema/src/utils/outreach-eligibility.ts:180-210` | Guards exist for contact lifecycle status (`UNSUBSCRIBED` cannot become `CONTACTED`), but no multi-dimensional suppression hierarchy with reasons and timestamps. |
| **Evidence Auditability & Freshness TTL** | Missing | Entire codebase | No evidence records stored with source, timestamps, results, confidence, and expiration TTLs. |
| **Multiple Email Addresses per Contact** | Missing | `packages/schema/src/entities/contact.ts` | Contact model only supports a single `email?: string` field. |
| **External Mailbox Verification Provider Abstraction** | Requires External Verification | Entire codebase | No clean pluggable interface for third-party verification providers (e.g. ZeroBounce, Hunter, NeverBounce) or native DNS/MX checking. |
| **Direct SMTP Probing Assessment** | Not Recommended | N/A | Raw TCP socket SMTP VRFY/RCPT probing from desktop client or server causes IP blacklisting, greylisting, and silent drops. Requires safe DNS/MX and provider-level verification instead. |

---

## 1. Discovery & Extraction Audit

### 1.1 Candidate Extraction Logic
**Files Inspected:**
- [`apps/desktop/src/main/workers/plugins/crawler-extractor.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/crawler-extractor.ts)
- [`packages/schema/src/utils/email-sanitizer.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/schema/src/utils/email-sanitizer.ts)

**Findings:**
1. **Extraction Sources:** The system extracts email candidates from HTML anchor `mailto:` tags, JSON-LD structured schema entities (`Person`, `Organization`, `ContactPoint`), and space-separated DOM text nodes.
2. **Provenance Tracking:** `EmailCandidate` captures `sourceType` (`mailto`, `json_ld`, `dom_text`, `metadata`, `manual`, `unknown`) and `sourceUrl`.
3. **Domain Affiliation:** Compares candidate domain with the target company's domain; flags candidates as `domainMatched: true` or `classification: 'third_party'`.
4. **The Flaw (`crawler-extractor.ts:358-368`):**
   ```typescript
   // Map candidate classification to ContactEmailStatus
   let emailStatus: ContactEmailStatus;
   if (classification === 'quarantined' || classification === 'ambiguous') {
     emailStatus = ContactEmailStatus.QUARANTINED;
   } else if (classification === 'exact' || classification === 'role_based') {
     emailStatus = ContactEmailStatus.VALID; // <-- FLAW: Marks unverified candidate as VALID!
   } else {
     emailStatus = ContactEmailStatus.UNVERIFIED;
   }
   ```
   **Classification:** `Incorrectly Conflated`. Mere syntactic extraction from a company website causes the email to be stamped as `VALID`.

---

## 2. Validation Logic Audit

### 2.1 `validateEmailStrict` & Syntax Checking
**Files Inspected:**
- [`packages/schema/src/utils/email-sanitizer.ts:697-717`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/schema/src/utils/email-sanitizer.ts#L697-L717)

**Findings:**
1. **Syntax Checking:** Highly compliant with RFC 5321 and RFC 6531. Correctly verifies local-part characters, rejects leading/trailing dots, enforces max 64 octets on local-part and 254 octets total.
2. **TLD / Public Suffix:** Validates domain using `tldts` and asserts `isIcannTld`.
3. **Exclusions:** Rejects known filler addresses (`test@`, `someone@`) and parking lander domains (`godaddy.com`, `dan.com`).
4. **Scope Limitation:** `validateEmailStrict` is strictly a synchronous, offline syntax and domain structure parser. It performs no DNS lookups, no MX record resolution, no disposable domain checks, and no mailbox verification. Calling this "validation" and using it as a sufficient condition for sending conflates syntax with deliverability.

### 2.2 Enricher Plugin MX Checking
**Files Inspected:**
- [`apps/desktop/src/main/workers/plugins/enricher.ts:31-74, 268-278`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/enricher.ts#L31-L74)

**Findings:**
1. **The Code:**
   ```typescript
   if (
     primaryMx.includes('google.com') ||
     primaryMx.includes('googlemail.com') ||
     primaryMx.includes('outlook.com') ||
     primaryMx.includes('protection.outlook.com')
   ) {
     return { verificationStatus: 'verified', confidence: 0.95, mxDomain: primaryMx };
   }
   ```
2. **The Flaw:** If an email is `nonexistent-user-12345@harvard.edu`, because Harvard's MX points to `protection.outlook.com`, the enricher claims `verificationStatus: 'verified'` with `confidence: 0.95`! It then saves this string into the contact's text notes: `notes: [Enriched] status=verified, confidence=0.95`.
3. **Classification:** `Incorrectly Conflated`. Conflates domain MX existence with 95% certainty of mailbox existence.

---

## 3. Persistence & Data Model Audit

### 3.1 Contact Schema & Entities
**Files Inspected:**
- [`packages/schema/src/entities/contact.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/schema/src/entities/contact.ts)
- [`apps/api/src/db/models/contact.model.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/db/models/contact.model.ts)
- [`apps/desktop/src/main/database/cache-schema.ts:133-174`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/database/cache-schema.ts#L133-L174)

**Findings:**
1. **Fields Present:**
   - `status`: `ContactStatus` enum (`NEW`, `CONTACTED`, `REPLIED`, `BOUNCED`, `UNSUBSCRIBED`, `DO_NOT_CONTACT`, `ARCHIVED`).
   - `emailStatus`: `ContactEmailStatus` enum (`VALID`, `UNVERIFIED`, `QUARANTINED`, `INVALID`).
   - `emailMeta`: JSON object storing `raw`, `sourceUrl`, `confidenceTier`, `domainMatched`, `isRoleAccount`.
2. **Missing Primitives:**
   - No `emailQuality`: no structured evidence array, no risk score, no breakdown of syntax vs DNS vs MX vs mailbox evidence.
   - No multiple emails per contact: single `email?: string` column/field. If a contact changes jobs or has multiple emails, the entire contact is tied to one address.
   - No suppression record: no record of *who* suppressed the address, *why*, *when*, or *from what evidence*.

---

## 4. Outreach Gating Audit

### 4.1 Send Decision Points
**Files Inspected:**
- [`packages/schema/src/utils/outreach-eligibility.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/schema/src/utils/outreach-eligibility.ts)
- [`apps/desktop/src/main/ipc/audiences-ipc.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/audiences-ipc.ts)
- [`apps/desktop/src/main/workers/plugins/outreach.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/outreach.ts)
- [`apps/api/src/services/email/email.service.ts`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/services/email/email.service.ts)

**Findings:**
1. **Audience Filtering:**
   - In `audiences-ipc.ts:40, 63`:
     ```sql
     AND UPPER(COALESCE(emailStatus, 'VALID')) NOT IN ('QUARANTINED', 'INVALID')
     ```
     `COALESCE(emailStatus, 'VALID')` promotes null or unassigned email status to `VALID`.
2. **Outreach Eligibility Policy:**
   - In `outreach-eligibility.ts:128-135`:
     Only blocks if `emailStatus` is `QUARANTINED` or `INVALID`. Any address in `UNVERIFIED` is deemed send-eligible.
3. **API Send Gate:**
   - In `email.service.ts:156-196`:
     Only checks `validateEmailStrict(input.to)`.
     If `input.contactId` is omitted or `'direct-contact'`, it skips all CRM status and suppression checks. A hard-bounced or unsubscribed email can be messaged repeatedly via direct send.

---

## 5. Bounce & Rejection Handling Audit

### 5.1 Outbound Send Failures (`email.service.ts`)
**Files Inspected:**
- [`apps/api/src/services/email/email.service.ts:549-595`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/services/email/email.service.ts#L549-L595)

**Findings:**
1. When Gmail or SMTP rejects a message with `INVALID_RECIPIENT` (e.g. 550 5.1.1 "User unknown"):
   - `failure.category` is classified as `EmailFailureCategory.INVALID_RECIPIENT`.
   - `deliveryRepo.failDelivery(...)` records the failure in `email_deliveries`.
   - **Crucial Omission:** Neither `ContactModel` nor `contacts` in SQLite is updated! `ContactStatus.BOUNCED` is **never set**. No suppression is recorded. The contact remains in `NEW` or `CONTACTED` status, eligible for future sends.

### 5.2 Inbound Bounce DSN Processing (`reconciliation.service.ts`)
**Files Inspected:**
- [`apps/api/src/services/email/reconciliation.service.ts:401-520, 630-660`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/services/email/reconciliation.service.ts#L401-L520)

**Findings:**
1. Inbound messages from `mailer-daemon@googlemail.com` or `postmaster@domain.com` arrive with DSN failure reports.
2. The poller extracts `normalizedFrom = 'mailer-daemon@googlemail.com'`.
3. It tries to correlate with `ContactModel.findOne({ email: normalizedFrom })`.
4. No contact exists with that email address.
5. It falls into line 630 (`processingStatus: 'UNMATCHED'`).
6. The bounce report is saved as an unmatched inbound message, never parsed, never linked to the recipient, and never triggers a bounce event.
7. `EmailEventType.BOUNCED` is defined in schema enums but is **never emitted anywhere in the codebase**.

---

## 6. Verification Strategy & SMTP Probing Audit

### 6.1 Direct SMTP Probing Feasibility
- **Risk Assessment:** Initiating direct socket SMTP connections (`HELO`, `MAIL FROM`, `RCPT TO`) from desktop clients or API workers has catastrophic deliverability side-effects:
  - Residential and commercial cloud IPs (AWS, DigitalOcean, Hetzner) are on Spamhaus ZEN / CBL blocklists.
  - Major mailbox providers (Google, Microsoft 365, Yahoo) utilize greylisting and silent drops for direct unauthenticated probes.
  - Repeated `RCPT TO` probes without message completion trigger anti-harvesting countermeasures and IP blacklisting.
- **Architectural Decision:** Direct raw socket SMTP probing is strictly rejected. Verification strategy must rely on:
  1. High-precision deterministic syntax & ICANN PSL parsing.
  2. Authoritative DNS A/AAAA and MX resolution.
  3. Pluggable `EmailVerificationProvider` abstraction for third-party verification APIs (ZeroBounce, Hunter, Kickbox, etc.).
  4. Disposable email domain databases.
  5. Role-account pattern matching.
  6. Closed-loop historical delivery and bounce feedback.

---

## 7. Forensic Audit Summary Table

| Category | Finding | Target Remediation in Phase 10 |
| :--- | :--- | :--- |
| **Extraction** | Scraped emails marked `VALID` immediately | Retain as `discovered` / `unverified`; evaluate via quality engine |
| **Enrichment** | MX presence treated as 95% verified mailbox | Treat MX as domain-level evidence only; mailbox status remains `unknown` |
| **Quality Model** | Binary `valid`/`invalid` status | Multi-dimensional model: syntax, domain, MX, mailbox, delivery evidence |
| **Evidence** | No auditable evidence records | Canonical `EmailQualityEvidence` records with sources, timestamps, and TTL |
| **Outreach Gating** | Direct sends and unverified emails bypass gate | Unified gate checking quality decision and suppression for all sends |
| **Bounce Handling** | Outbound 550 and inbound DSN bounces ignored | Canonical bounce classifier, DSN parser, and automatic suppression |
| **Suppression** | No dedicated suppression table | Dedicated `suppressions` collection & SQLite table with reason hierarchy |
| **Freshness** | Evidence never expires | Configurable TTLs (e.g., DNS 7 days, MX 14 days, verification 30 days) |

---
*Forensic audit certified complete. No implementation code will be written until the implementation plan is reviewed and approved.*
