# Phase 1 Forensic Document 13 — Template Engine Reality & Variable Matrix

**Document Type:** Forensic Template & Variable Engine Audit  
**Audited Against:** `packages/sdk/src/utils/variable-resolver.ts`, `apps/desktop/src/main/workers/plugins/outreach.ts`  
**Date:** September 2026  
**Status:** Authoritative Baseline  

---

## 1. Variable Resolution Matrix

| Variable Token | Supported Status | Fallback / Resolution Behavior | Code Evidence |
| :--- | :--- | :--- | :--- |
| `{{contact.firstName}}` | **SUPPORTED** | Returns `contact.firstName` or `""` if null | [`variable-resolver.ts:75`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/utils/variable-resolver.ts#L75) |
| `{{contact.lastName}}` | **SUPPORTED** | Returns `contact.lastName` or `""` if null | `variable-resolver.ts:75` |
| `{{contact.name}}` | **SUPPORTED** | Returns `${firstName} ${lastName}` or `email` | [`variable-resolver.ts:71`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/utils/variable-resolver.ts#L71) |
| `{{contact.email}}` | **SUPPORTED** | Returns `contact.email` or `""` | `variable-resolver.ts:75` |
| `{{contact.title}}` | **SUPPORTED** | Returns `contact.title` or `""` | `variable-resolver.ts:75` |
| `{{contact.phone}}` | **SUPPORTED** | Returns `contact.phone` or `""` | `variable-resolver.ts:75` |
| `{{company.name}}` | **SUPPORTED** | Returns `company.name` or `""` | [`variable-resolver.ts:80`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/utils/variable-resolver.ts#L80) |
| `{{company.domain}}` | **SUPPORTED** | Returns `company.domain` or `company.website` | [`variable-resolver.ts:83`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/utils/variable-resolver.ts#L83) |
| `{{company.website}}` | **SUPPORTED** | Returns `company.domain` or `company.website` | `variable-resolver.ts:83` |
| `{{company.industry}}` | **SUPPORTED** | Returns `company.industry` or `""` | `variable-resolver.ts:86` |
| `{{company.location}}` | **PARTIALLY BROKEN (Worker Bug)** | Resolver supports it, but Outreach worker passes `companyRow.address` (which is `undefined`), so it returns `""` | `outreach.ts:213` |
| `{{sender.name}}` | **SUPPORTED** | Returns `sender.name` or `""` | [`variable-resolver.ts:109`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/utils/variable-resolver.ts#L109) |
| `{{sender.email}}` | **SUPPORTED** | Returns `sender.email` or `""` | `variable-resolver.ts:110` |
| `{{sequence.name}}` | **SUPPORTED** | Returns `sequence.name` or `""` | [`variable-resolver.ts:96`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/utils/variable-resolver.ts#L96) |
| `{{workspace.name}}` | **SUPPORTED** | Returns `workspace.name` or `""` | [`variable-resolver.ts:90`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/utils/variable-resolver.ts#L90) |
| `{{execution.currentStep}}` | **SUPPORTED** | Returns step number or `""` | [`variable-resolver.ts:103`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/utils/variable-resolver.ts#L103) |
| `{{variables.customKey}}` | **SUPPORTED** | Returns nested variable value or `""` | [`variable-resolver.ts:115`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/utils/variable-resolver.ts#L115) |
| `{{today}}` | **SUPPORTED** | Returns ISO date `YYYY-MM-DD` | [`variable-resolver.ts:129`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/utils/variable-resolver.ts#L129) |
| `{{now}}` | **SUPPORTED** | Returns full ISO timestamp | [`variable-resolver.ts:132`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/utils/variable-resolver.ts#L132) |
| `{{firstName}}` (Legacy) | **SUPPORTED** | Alias to `contact.firstName` | [`variable-resolver.ts:137`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/utils/variable-resolver.ts#L137) |
| `{{company}}` (Legacy) | **SUPPORTED** | Alias to `company.name` | [`variable-resolver.ts:143`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/utils/variable-resolver.ts#L143) |

---

## 2. Null & Boundary Conditions

| Scenario | Behavior in `renderCanonicalVariables()` | Crash Risk |
| :--- | :--- | :--- |
| `contact` is `null` / `undefined` | Resolves all `contact.*` tokens to empty string `""` | 0% (Safe) |
| `company` is `null` / `undefined` (Standalone contact) | Resolves all `company.*` tokens to empty string `""` | 0% (Safe) |
| Specific field is `null` (e.g. `contact.title === null`) | Resolves to empty string `""` | 0% (Safe) |
| Unrecognized token (e.g. `{{random.token}}`) | Resolves to empty string `""` | 0% (Safe) |

---

## 3. MIME Body Conversion (`plainTextToHtml` & `formatEmailBody`)

The SDK converts plain-text email bodies into multi-part MIME formats:
1. **HTML Escaping:** Converts `&`, `<`, `>`, `"`, `'` to HTML entities to prevent XSS.
2. **Paragraph Handling:** Splits text on double newlines (`\n\n`) and wraps blocks in `<p style="margin:0 0 16px 0;line-height:1.5;">`.
3. **Line Breaks:** Converts single `\n` to `<br/>`.
4. **MIME Structure:** Dispatches both `text/plain` and `text/html` parts in the RFC 2822 envelope.
