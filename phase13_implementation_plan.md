# Phase 13 — Email Templates, Personalization & Message Composition Implementation Plan

## Objective

Consolidate the email composition pipeline of LeadForge OS into a deterministic, versioned, safe, auditable, and production-grade system. Ensure that for every outbound message, LeadForge can answer with immutable evidence:
> **What exact message was intended, what values were substituted, what version of the template produced it, what transformations were applied, and what exact content was handed to the provider?**

---

## Non-Negotiables
- **Strictly Zero AI**: No LLMs, AI providers, AI prompts, AI drafting, or AI classification.
- **Audit-First**: Complete forensic audit documented in `phase13_email_composition_audit.md`.
- **Small Conventional Commits**: Atomic, incremental commits with passing tests at each step.
- **100% Verification**: All unit, contract, and integration tests must pass cleanly.

---

## Architectural Stages

### Stage 1: Core Schemas, DTOs & Contracts (`packages/schema`)
- **`packages/schema/src/entities/outreach.ts`**:
  - Add `version: z.number().int().positive().default(1)` to `emailTemplateSchema`.
  - Export `templateVersionSchema` and `TemplateVersion` entity.
- **`packages/schema/src/entities/delivery.ts`**:
  - Add `templateId: entityIdFieldNullable.optional()` to `emailDeliverySchema` and DTOs.
  - Add `templateVersion: z.number().int().positive().nullable().optional()`.
  - Add `variablesSnapshot: z.record(z.string()).nullable().optional()`.
  - Add `messageFingerprint: z.string().nullable().optional()`.
- **`packages/schema/src/utils/tracking.ts`**:
  - Fix preview open pixel stripping regex: `/<img\b[^>]*\/(?:t|tracking)\/open\/[^>]*>/gi`.
  - Guard `rewriteLinksForClickTracking` so links already matching `/t/click/` are not rewritten twice.
- **`packages/schema/src/entities/composition.ts`**:
  - Define canonical `ComposeMessageInput`, `ComposeMessageResult`, and `MessageFingerprintInput`.

### Stage 2: Deterministic Message Composition Engine (`packages/sdk`)
- **`packages/sdk/src/utils/variable-resolver.ts`**:
  - Enhance `renderCanonicalVariables` to support context-aware HTML entity escaping (`isHtml: boolean`), capturing substituted values into a `variablesSnapshot` dictionary.
  - Add `sanitizeSubject(subject: string): { sanitized: string; isValid: boolean; error?: string }`:
    - Strips `\r` and `\n` characters.
    - Collapses consecutive whitespace.
    - Enforces non-empty and max length of 998 characters.
  - Add `htmlToPlainText(html: string): string`:
    - Deterministic converter replacing `<br/>` and `<p>` with appropriate newlines, stripping tags, and unescaping HTML entities.
  - Add `computeMessageFingerprint(input)`:
    - Computes SHA-256 over `workspaceId`, `sender`, `recipient`, `subject`, `textBody`, `htmlBody`, `attachmentChecksums`, `templateVersion`.
  - Export canonical `composeOutboundMessage(input)` uniting variable resolution, sanitization, typography, and fingerprinting.

### Stage 3: Server-Side Template Versioning & Storage (`apps/api`)
- **`apps/api/src/db/models/email-template.model.ts`**:
  - Add `version` to schema with default `1`.
  - Define `TemplateVersionModel` for immutable historical snapshots (`templateId`, `version`, `name`, `subject`, `body`, `variables`, `attachments`, `snapshotAt`).
- **`apps/api/src/repositories/email-template/email-template.repository.ts`**:
  - In `update()`, archive current state to `TemplateVersionModel` and increment `version`.
  - Add `findVersion(templateId: string, version: number)`.
- **`apps/api/src/db/models/email-delivery.model.ts`**:
  - Add `templateId`, `templateVersion`, `variablesSnapshot`, `messageFingerprint` to schema.
- **`apps/api/src/repositories/email-delivery/email-delivery.repository.ts`**:
  - In `reserveDelivery()`, save `templateId`, `templateVersion`, `variablesSnapshot`, `messageFingerprint`.
  - On retry: preserve existing snapshot, tokens, and fingerprint.
- **`apps/api/src/services/email/email.service.ts`**:
  - Integrate `sanitizeSubject` and validate non-empty / no-CRLF.
  - In `send()`, reuse existing `openTrackingToken` and `clickTrackingTokens` if present on delivery record.
  - Compute attachment SHA-256 hashes and save to snapshot.
  - Populate plain-text via `htmlToPlainText` if text part is missing.
- **`apps/api/src/services/outreach/outreach.service.ts`**:
  - Update `previewTemplate()` to run `composeOutboundMessage()` with mock or live contact data, returning formatted `html`, `text`, `subject`, and `variablesSnapshot`.

### Stage 4: Worker Alignment & Dead Code Removal (`apps/desktop`)
- **`apps/desktop/src/main/workers/plugins/automation.ts`**:
  - Remove dead duplicate `resolveTokenPath` (lines 127-198).
  - In `handleSendEmailStep`, propagate `templateId` and `templateVersion` to `sendEmail`.
- **`apps/desktop/src/main/workers/plugins/outreach.ts`**:
  - Propagate `templateId` and `templateVersion` to `sendEmail`.
- **`apps/desktop/src/main/database/cache-schema.ts`**:
  - Add `version INTEGER DEFAULT 1` to `templates` table.
  - Add `templateId TEXT`, `templateVersion INTEGER`, `messageFingerprint TEXT`, `variablesSnapshot TEXT` to `email_deliveries` table.
- **`apps/desktop/src/renderer/screens/CampaignsScreen.tsx`**:
  - In template preview dialog, display formatted HTML inside `SafeEmailPreview` component with typography and signature preview.

### Stage 5: Invariant Testing & Monorepo Qualification
- **Unit Tests (`packages/schema/src/utils/composition-invariants.test.ts`)**:
  - Assert Invariants **T-001** through **T-015**.
- **Contract Tests (`apps/api/src/tests/contract/composition-contracts.test.ts`)**:
  - Template version increment & history snapshot.
  - Subject CRLF injection rejection.
  - Idempotent send retry token preservation.
  - Delivery snapshot completeness (fingerprint, variables, template version).
- **Monorepo Qualification**:
  - `pnpm test`
  - `pnpm test:contract`
  - `pnpm test:integration`
  - `pnpm check-types`
  - `pnpm doctor`
